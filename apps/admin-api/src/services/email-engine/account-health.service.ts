/**
 * Account-wide emergency brake.
 *
 * Runs every 5 min via the BullMQ worker. Two trigger conditions:
 *
 *   1. SES EnforcementStatus !== "HEALTHY"
 *      AWS has flagged the entire account for high bounce/complaint rates.
 *      Time is short before AWS auto-suspends sending; we proactively PAUSE
 *      the top 10 offenders by absolute permanent-bounce + complaint volume,
 *      PLUS every currently-THROTTLED tenant (they're already showing
 *      degradation; force them all the way to PAUSED to stop the bleeding).
 *
 *   2. Account-wide CloudWatch BounceRate > 4% OR ComplaintRate > 0.08%
 *      Rates are bad but AWS hasn't intervened yet. We PAUSE the top 20
 *      offenders by absolute volume to drop the account rate before AWS
 *      acts.
 *
 * Each paused tenant gets a `tenant_email_reputation_events` row with
 * trigger=EMERGENCY_BRAKE for audit. PAUSE via the reputation enforcer's
 * forceStatus path so the same code that handles ADMIN_OVERRIDE runs here.
 *
 * Risk score: bouncedPerm + complained * 10 over the 14d window. Complaints
 * weighted higher because they signal active hostility (recipient hit "spam"
 * button) versus bounces which are sometimes just dead mailboxes.
 *
 * Dry-run mode returns the would-be-paused list without writing. Used by
 * the operator dashboard's "preview emergency brake" button.
 */

import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";
import { SESv2Client, GetAccountCommand } from "@aws-sdk/client-sesv2";
import config from "../../config";
import { db } from "../../db/connection";
import logger from "../../utils/logger";
import { notifyOps } from "./ops-alert";
import { evaluateTenant, type TenantSendingStatus } from "./reputation.service";
import { getRates } from "./reputation-metrics.service";

const ACCOUNT_BOUNCE_DANGER = 0.04; // 4%
const ACCOUNT_COMPLAINT_DANGER = 0.0008; // 0.08%
const ENFORCEMENT_TOP_N = 10;
const RATES_TOP_N = 20;
// Minimum sent volume to even be considered for the brake. Tenants with 5
// sends + 1 complaint shouldn't dominate the risk ranking.
const MIN_SENT_FOR_RANKING = 50;

export type EnforcementStatus =
  | "HEALTHY"
  | "PROBATION"
  | "SHUTDOWN"
  | "UNKNOWN";

export interface AccountRates {
  bounceRate: number;
  complaintRate: number;
  windowStart: Date;
  windowEnd: Date;
}

export interface TenantRiskInfo {
  tenantId: string;
  tenantName: string;
  currentStatus: TenantSendingStatus;
  bouncedPerm: number;
  complained: number;
  sent: number;
  riskScore: number;
}

export interface AccountHealthSnapshot {
  enforcementStatus: EnforcementStatus;
  rates: AccountRates;
  triggers: { enforcementUnhealthy: boolean; ratesUnhealthy: boolean };
  topRiskTenants: TenantRiskInfo[];
  brakeWouldFire: boolean;
}

export interface BrakeResult extends AccountHealthSnapshot {
  pausedTenants: TenantRiskInfo[];
  dryRun: boolean;
}

function buildSesClient(): SESv2Client {
  return new SESv2Client({
    region: config.AWS_SES_REGION,
    credentials: {
      accessKeyId: config.AWS_SES_ACCESS_KEY,
      secretAccessKey: config.AWS_SES_SECRET_KEY,
    },
  });
}

function buildCloudWatchClient(): CloudWatchClient {
  return new CloudWatchClient({
    region: config.AWS_SES_REGION,
    credentials: {
      accessKeyId: config.AWS_SES_ACCESS_KEY,
      secretAccessKey: config.AWS_SES_SECRET_KEY,
    },
  });
}

async function fetchEnforcementStatus(): Promise<EnforcementStatus> {
  try {
    const ses = buildSesClient();
    const result = await ses.send(new GetAccountCommand({}));
    const raw = result.EnforcementStatus ?? "UNKNOWN";
    if (raw === "HEALTHY" || raw === "PROBATION" || raw === "SHUTDOWN") {
      return raw;
    }
    return "UNKNOWN";
  } catch (err) {
    logger.warn(
      `[account-health] SES GetAccount failed: ${(err as Error).message}`,
    );
    return "UNKNOWN";
  }
}

async function fetchAccountRates(): Promise<AccountRates> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  try {
    const cw = buildCloudWatchClient();
    const baseInput = {
      Namespace: "AWS/SES",
      StartTime: oneHourAgo,
      EndTime: now,
      Period: 3600,
      Statistics: ["Maximum"] as ["Maximum"],
    };
    const [bounceResult, complaintResult] = await Promise.all([
      cw.send(
        new GetMetricStatisticsCommand({
          ...baseInput,
          MetricName: "Reputation.BounceRate",
        }),
      ),
      cw.send(
        new GetMetricStatisticsCommand({
          ...baseInput,
          MetricName: "Reputation.ComplaintRate",
        }),
      ),
    ]);
    return {
      bounceRate: bounceResult.Datapoints?.[0]?.Maximum ?? 0,
      complaintRate: complaintResult.Datapoints?.[0]?.Maximum ?? 0,
      windowStart: oneHourAgo,
      windowEnd: now,
    };
  } catch (err) {
    logger.warn(
      `[account-health] CloudWatch metrics fetch failed: ${(err as Error).message}`,
    );
    return {
      bounceRate: 0,
      complaintRate: 0,
      windowStart: oneHourAgo,
      windowEnd: now,
    };
  }
}

async function rankTopRiskTenants(limit: number): Promise<TenantRiskInfo[]> {
  // Only consider tenants in non-PAUSED states. PAUSED tenants are already
  // blocked from MARKETING; no further action needed. ACTIVE / WARNING /
  // THROTTLED are the candidates for the brake.
  const candidates = await db
    .selectFrom("tenants")
    .select(["id", "name", "email_sending_status"])
    .where("email_sending_status", "in", ["ACTIVE", "WARNING", "THROTTLED"])
    .execute();

  const scored: TenantRiskInfo[] = [];
  for (const tenant of candidates) {
    let rates;
    try {
      rates = await getRates(tenant.id);
    } catch (err) {
      logger.warn(
        `[account-health] getRates failed for tenant=${tenant.id}: ${(err as Error).message}`,
      );
      continue;
    }
    if (rates.sent < MIN_SENT_FOR_RANKING) continue;
    const riskScore = rates.bouncedPerm + rates.complained * 10;
    if (riskScore <= 0) continue;
    scored.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      currentStatus: tenant.email_sending_status,
      bouncedPerm: rates.bouncedPerm,
      complained: rates.complained,
      sent: rates.sent,
      riskScore,
    });
  }

  scored.sort((a, b) => b.riskScore - a.riskScore);
  return scored.slice(0, limit);
}

async function listThrottledTenants(): Promise<TenantRiskInfo[]> {
  const rows = await db
    .selectFrom("tenants")
    .select(["id", "name", "email_sending_status"])
    .where("email_sending_status", "=", "THROTTLED")
    .execute();
  return rows.map((r) => ({
    tenantId: r.id,
    tenantName: r.name,
    currentStatus: r.email_sending_status,
    bouncedPerm: 0,
    complained: 0,
    sent: 0,
    riskScore: 0,
  }));
}

class AccountHealthService {
  /**
   * Read-only snapshot for the operator dashboard. Returns enforcement
   * status, rolling-hour account rates, and top 20 risk tenants. Always
   * safe to call; no mutations.
   */
  async getSnapshot(): Promise<AccountHealthSnapshot> {
    const [enforcementStatus, rates, topRiskTenants] = await Promise.all([
      fetchEnforcementStatus(),
      fetchAccountRates(),
      rankTopRiskTenants(RATES_TOP_N),
    ]);
    const enforcementUnhealthy =
      enforcementStatus === "PROBATION" || enforcementStatus === "SHUTDOWN";
    const ratesUnhealthy =
      rates.bounceRate > ACCOUNT_BOUNCE_DANGER ||
      rates.complaintRate > ACCOUNT_COMPLAINT_DANGER;
    return {
      enforcementStatus,
      rates,
      triggers: { enforcementUnhealthy, ratesUnhealthy },
      topRiskTenants,
      brakeWouldFire: enforcementUnhealthy || ratesUnhealthy,
    };
  }

  /**
   * Conditional emergency brake. Called by the 5-min worker (dryRun=false)
   * and the operator's dashboard test button (dryRun=true).
   *
   * Returns the list of tenants that WERE paused (or WOULD BE paused, in
   * dry-run). Idempotent: tenants already PAUSED stay PAUSED; we still
   * record an EMERGENCY_BRAKE event for audit but the status update is a
   * no-op via the enforcer.
   */
  async runEmergencyBrake({ dryRun }: { dryRun: boolean }): Promise<BrakeResult> {
    const [enforcementStatus, rates] = await Promise.all([
      fetchEnforcementStatus(),
      fetchAccountRates(),
    ]);
    const enforcementUnhealthy =
      enforcementStatus === "PROBATION" || enforcementStatus === "SHUTDOWN";
    const ratesUnhealthy =
      rates.bounceRate > ACCOUNT_BOUNCE_DANGER ||
      rates.complaintRate > ACCOUNT_COMPLAINT_DANGER;
    const brakeWouldFire = enforcementUnhealthy || ratesUnhealthy;

    // Build the action list. Different N depending on severity; merge in
    // THROTTLED tenants when SES has flagged enforcement.
    const limit = enforcementUnhealthy ? ENFORCEMENT_TOP_N : RATES_TOP_N;
    const topRiskTenants = await rankTopRiskTenants(limit);
    const actionList: TenantRiskInfo[] = [...topRiskTenants];

    if (enforcementUnhealthy) {
      const throttled = await listThrottledTenants();
      for (const t of throttled) {
        if (!actionList.find((a) => a.tenantId === t.tenantId)) {
          actionList.push(t);
        }
      }
    }

    // Phase 16: standalone SES enforcement alert. Fires SEV1 whenever the
    // account is on PROBATION or SHUTDOWN, INDEPENDENT of whether any
    // tenants got paused by the brake. Without this, an enforcement event
    // with zero eligible offenders (e.g., everyone below min volume) would
    // silently slip past. Skipped in dry-run.
    if (!dryRun && enforcementUnhealthy) {
      await notifyOps({
        severity: "SEV1",
        source: "email-engine.ses-enforcement",
        message: `AWS SES EnforcementStatus = ${enforcementStatus}. Account is flagged; sending may be suspended imminently. accountBounceRate=${(rates.bounceRate * 100).toFixed(2)}%, accountComplaintRate=${(rates.complaintRate * 100).toFixed(4)}%.`,
        context: {
          enforcementStatus,
          bounceRate: rates.bounceRate,
          complaintRate: rates.complaintRate,
        },
      });
    }

    if (!brakeWouldFire) {
      return {
        enforcementStatus,
        rates,
        triggers: { enforcementUnhealthy, ratesUnhealthy },
        topRiskTenants,
        brakeWouldFire,
        pausedTenants: [],
        dryRun,
      };
    }

    const reason = `Account-wide emergency brake: enforcementStatus=${enforcementStatus}, accountBounceRate=${(rates.bounceRate * 100).toFixed(2)}%, accountComplaintRate=${(rates.complaintRate * 100).toFixed(4)}%`;
    const pausedTenants: TenantRiskInfo[] = [];
    if (!dryRun) {
      for (const t of actionList) {
        try {
          await evaluateTenant(t.tenantId, {
            trigger: "EMERGENCY_BRAKE",
            forceStatus: "PAUSED",
            reason,
            triggeredBy: "system:account-health",
          });
          pausedTenants.push(t);
        } catch (err) {
          logger.error(
            `[account-health] failed to pause tenant=${t.tenantId} via emergency brake: ${(err as Error).message}`,
          );
        }
      }
      if (pausedTenants.length > 0) {
        await notifyOps({
          severity: enforcementUnhealthy ? "SEV1" : "SEV2",
          source: "email-engine.emergency-brake",
          message: `Emergency brake fired: ${pausedTenants.length} tenant(s) forced to PAUSED. SES EnforcementStatus=${enforcementStatus}, accountBounceRate=${(rates.bounceRate * 100).toFixed(2)}%, accountComplaintRate=${(rates.complaintRate * 100).toFixed(4)}%.`,
          context: {
            enforcementStatus,
            bounceRate: rates.bounceRate,
            complaintRate: rates.complaintRate,
            pausedTenantIds: pausedTenants.map((t) => t.tenantId),
          },
        });
      }
    }

    return {
      enforcementStatus,
      rates,
      triggers: { enforcementUnhealthy, ratesUnhealthy },
      topRiskTenants,
      brakeWouldFire,
      pausedTenants: dryRun ? actionList : pausedTenants,
      dryRun,
    };
  }
}

export default new AccountHealthService();
