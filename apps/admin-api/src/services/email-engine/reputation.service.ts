/**
 * Reputation enforcer, drives the ACTIVE -> WARNING -> THROTTLED -> PAUSED
 * state machine for tenants' email sending status.
 *
 * Two entrypoints:
 *   1. Inline from the SES event handler on every Bounce / Complaint
 *      (trigger AUTO_BOUNCE / AUTO_COMPLAINT). Drives degradation quickly.
 *   2. Periodic sweep every 10 min (Phase 8 worker). Iterates WARNING +
 *      THROTTLED tenants and applies AUTO_RECOVERY when their rates have
 *      been clean for EMAIL_REPUTATION_AUTO_RECOVERY_HOURS (default 48h).
 *
 * Transitions (spec §7):
 *   - ACTIVE   -> WARNING   when permBounceRate >= 3% OR complaintRate >= 0.05%
 *   - WARNING  -> THROTTLED when permBounceRate >= 5% OR complaintRate >= 0.1%
 *   - THROTTLED-> PAUSED    when permBounceRate >= 8% OR complaintRate >= 0.3%
 *   - Auto-downgrade is always allowed.
 *   - Auto-upgrade goes one step at a time, after EMAIL_REPUTATION_AUTO_RECOVERY_HOURS
 *     have elapsed in the current state AND rates are strictly below the
 *     next-lower threshold AND sent volume >= EMAIL_REPUTATION_MIN_VOLUME.
 *   - PAUSED never auto-recovers; requires ADMIN_OVERRIDE.
 *
 * Side-effects on transition:
 *   - UPDATE tenants.email_sending_status + .email_sending_status_changed_at
 *   - INSERT tenant_email_reputation_events with rates_snapshot JSON
 *   - Invalidate the resolver Redis cache for this tenant (the cached
 *     payload includes tenantSendingStatus)
 *   - OPS alert on every PAUSED transition (SEV2) and EMERGENCY_BRAKE (SEV1)
 *   - Log line on every transition for audit
 */

import { ulid } from "ulid";
import config from "../../config";
import { db } from "../../db/connection";
import logger from "../../utils/logger";
import { notifyOps } from "./ops-alert";
import { getRates, type ReputationRates } from "./reputation-metrics.service";
import { invalidate as invalidateResolverCache } from "./resolver";

export type ReputationTrigger =
  | "AUTO_BOUNCE"
  | "AUTO_COMPLAINT"
  | "AUTO_RECOVERY"
  | "ADMIN_OVERRIDE"
  | "EMERGENCY_BRAKE";

export type TenantSendingStatus =
  | "ACTIVE"
  | "WARNING"
  | "THROTTLED"
  | "PAUSED";

export interface EvaluateTenantOptions {
  trigger: ReputationTrigger;
  triggeredBy?: string;
  reason?: string;
  /** Used by ADMIN_OVERRIDE + EMERGENCY_BRAKE to force a specific target. */
  forceStatus?: TenantSendingStatus;
}

// ---------------------------------------------------------------------------
// Thresholds (spec §7)
// ---------------------------------------------------------------------------

const PERM_BOUNCE_WARN = 0.03;
const PERM_BOUNCE_THROTTLE = 0.05;
const PERM_BOUNCE_PAUSE = 0.08;

const COMPLAINT_WARN = 0.0005;
const COMPLAINT_THROTTLE = 0.001;
const COMPLAINT_PAUSE = 0.003;

const STATUS_RANK: Record<TenantSendingStatus, number> = {
  ACTIVE: 0,
  WARNING: 1,
  THROTTLED: 2,
  PAUSED: 3,
};

/** Return the worst status the current rates would put this tenant in. */
function levelFromRates(rates: ReputationRates): TenantSendingStatus {
  if (
    rates.permBounceRate >= PERM_BOUNCE_PAUSE ||
    rates.complaintRate >= COMPLAINT_PAUSE
  ) {
    return "PAUSED";
  }
  if (
    rates.permBounceRate >= PERM_BOUNCE_THROTTLE ||
    rates.complaintRate >= COMPLAINT_THROTTLE
  ) {
    return "THROTTLED";
  }
  if (
    rates.permBounceRate >= PERM_BOUNCE_WARN ||
    rates.complaintRate >= COMPLAINT_WARN
  ) {
    return "WARNING";
  }
  return "ACTIVE";
}

function isBelowThresholdForStatus(
  rates: ReputationRates,
  status: TenantSendingStatus,
): boolean {
  switch (status) {
    case "WARNING":
      return (
        rates.permBounceRate < PERM_BOUNCE_WARN &&
        rates.complaintRate < COMPLAINT_WARN
      );
    case "THROTTLED":
      return (
        rates.permBounceRate < PERM_BOUNCE_THROTTLE &&
        rates.complaintRate < COMPLAINT_THROTTLE
      );
    case "PAUSED":
      return (
        rates.permBounceRate < PERM_BOUNCE_PAUSE &&
        rates.complaintRate < COMPLAINT_PAUSE
      );
    case "ACTIVE":
      return true;
  }
}

function oneStepBetter(status: TenantSendingStatus): TenantSendingStatus {
  switch (status) {
    case "PAUSED":
      return "THROTTLED";
    case "THROTTLED":
      return "WARNING";
    case "WARNING":
      return "ACTIVE";
    case "ACTIVE":
      return "ACTIVE";
  }
}

// ---------------------------------------------------------------------------
// Decision logic
// ---------------------------------------------------------------------------

interface Decision {
  next: TenantSendingStatus;
  reason: string;
}

function decideTarget(
  current: TenantSendingStatus,
  rates: ReputationRates,
  statusChangedAt: Date | null,
): Decision {
  const naturalLevel = levelFromRates(rates);
  const currentRank = STATUS_RANK[current];
  const naturalRank = STATUS_RANK[naturalLevel];

  // Degrade immediately when rates are worse than current status. PAUSED is
  // the worst; we can degrade INTO PAUSED via this path on AUTO_BOUNCE /
  // AUTO_COMPLAINT triggers (the SES event handler is the only place that
  // can flip a tenant into PAUSED through automatic logic).
  if (naturalRank > currentRank) {
    return {
      next: naturalLevel,
      reason: `rates exceed ${naturalLevel} threshold (permBounce=${(rates.permBounceRate * 100).toFixed(2)}%, complaint=${(rates.complaintRate * 100).toFixed(3)}%)`,
    };
  }

  // PAUSED never auto-recovers, regardless of how clean rates look.
  if (current === "PAUSED") {
    return { next: current, reason: "PAUSED requires admin override" };
  }

  // Auto-recovery: step one level better when rates are strictly below the
  // current state's threshold AND cooldown has elapsed.
  if (current !== "ACTIVE") {
    const cooldownMs =
      config.EMAIL_REPUTATION_AUTO_RECOVERY_HOURS * 60 * 60 * 1000;
    const stateAgeMs =
      statusChangedAt !== null
        ? Date.now() - statusChangedAt.getTime()
        : Number.POSITIVE_INFINITY;
    if (
      stateAgeMs >= cooldownMs &&
      isBelowThresholdForStatus(rates, current)
    ) {
      const next = oneStepBetter(current);
      return {
        next,
        reason: `rates clean for ${Math.floor(stateAgeMs / 3600000)}h; recovering to ${next}`,
      };
    }
  }

  return { next: current, reason: "no change" };
}

// ---------------------------------------------------------------------------
// Apply transition
// ---------------------------------------------------------------------------

async function applyTransition(
  tenantId: string,
  from: TenantSendingStatus,
  to: TenantSendingStatus,
  rates: ReputationRates,
  opts: EvaluateTenantOptions,
): Promise<void> {
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("tenants")
      .set({
        email_sending_status: to,
        email_sending_status_changed_at: now,
        // When transitioning OUT of degraded states, clear the marketing
        // blocked reason. When transitioning INTO PAUSED, set it.
        email_marketing_blocked_reason:
          to === "PAUSED" ? (opts.reason ?? "Auto-paused by reputation enforcer") : null,
        updated_at: now,
      })
      .where("id", "=", tenantId)
      .execute();

    await trx
      .insertInto("tenant_email_reputation_events")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        from_status: from,
        to_status: to,
        trigger: opts.trigger,
        triggered_by: opts.triggeredBy ?? null,
        reason: (opts.reason ?? "auto").slice(0, 512),
        rates_snapshot: JSON.stringify({
          sent: rates.sent,
          delivered: rates.delivered,
          bouncedPerm: rates.bouncedPerm,
          bouncedTrans: rates.bouncedTrans,
          complained: rates.complained,
          opened: rates.opened,
          clicked: rates.clicked,
          permBounceRate: rates.permBounceRate,
          complaintRate: rates.complaintRate,
          deliveryRate: rates.deliveryRate,
          openRate: rates.openRate,
          windowStart: rates.windowStart.toISOString(),
          windowEnd: rates.windowEnd.toISOString(),
        }),
        created_at: now,
      })
      .execute();
  });

  // The resolver caches tenantSendingStatus alongside the identity / domain
  // resolution. Status flip mandates a fresh cache fill on next send.
  await invalidateResolverCache(tenantId);

  logger.info(
    `[reputation] tenant=${tenantId} ${from} -> ${to} trigger=${opts.trigger} permBounce=${(rates.permBounceRate * 100).toFixed(2)}% complaint=${(rates.complaintRate * 100).toFixed(3)}% sent=${rates.sent}`,
  );

  if (to === "PAUSED") {
    await notifyOps({
      severity: opts.trigger === "EMERGENCY_BRAKE" ? "SEV1" : "SEV2",
      source: "email-engine.reputation",
      message: `Tenant ${tenantId} moved to PAUSED (trigger=${opts.trigger}). MARKETING sends are blocked; TRANSACTIONAL keeps flowing. Investigate suppression list + recent bounce/complaint volume.`,
      context: {
        tenantId,
        from,
        to,
        trigger: opts.trigger,
        triggeredBy: opts.triggeredBy,
        permBounceRate: rates.permBounceRate,
        complaintRate: rates.complaintRate,
        sentInWindow: rates.sent,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a single tenant and apply any required status transition.
 *
 * Called from:
 *   - SES event handler on every Bounce / Complaint (trigger AUTO_BOUNCE /
 *     AUTO_COMPLAINT)
 *   - Periodic sweep job (trigger AUTO_RECOVERY)
 *   - Core-admin manual override (trigger ADMIN_OVERRIDE, forceStatus set)
 *   - Phase 13 emergency brake (trigger EMERGENCY_BRAKE, forceStatus PAUSED)
 *
 * For automatic triggers (AUTO_*): skip if sent volume below min, too noisy
 * for low-volume tenants. For manual triggers (ADMIN_OVERRIDE,
 * EMERGENCY_BRAKE) with `forceStatus`: bypass rate evaluation and force the
 * given status.
 */
export async function evaluateTenant(
  tenantId: string,
  opts: EvaluateTenantOptions,
): Promise<void> {
  const tenant = await db
    .selectFrom("tenants")
    .select(["email_sending_status", "email_sending_status_changed_at"])
    .where("id", "=", tenantId)
    .executeTakeFirst();
  if (!tenant) return;

  const currentStatus = tenant.email_sending_status;
  const rates = await getRates(tenantId);

  // Manual override path: rate evaluation is bypassed; the operator's
  // judgement wins. We still record the rates snapshot for audit context.
  if (opts.forceStatus && opts.forceStatus !== currentStatus) {
    await applyTransition(tenantId, currentStatus, opts.forceStatus, rates, opts);
    return;
  }

  // Auto path: skip below-min-volume tenants so a tenant with 12 sends + 1
  // bounce doesn't get flagged as 8.3% perm bounce rate.
  if (rates.sent < config.EMAIL_REPUTATION_MIN_VOLUME) return;

  const decision = decideTarget(
    currentStatus,
    rates,
    tenant.email_sending_status_changed_at,
  );
  if (decision.next === currentStatus) return;

  await applyTransition(tenantId, currentStatus, decision.next, rates, {
    ...opts,
    reason: opts.reason ?? decision.reason,
  });
}

/**
 * Sweep entrypoint called by the BullMQ sweep worker every 10 min.
 *
 * Only iterates WARNING + THROTTLED tenants:
 *   - ACTIVE tenants have nothing to recover to; degradation is driven inline
 *     from the SES event handler.
 *   - PAUSED tenants never auto-recover.
 */
export async function sweepReputationRecovery(): Promise<void> {
  const candidates = await db
    .selectFrom("tenants")
    .select("id")
    .where("email_sending_status", "in", ["WARNING", "THROTTLED"])
    .execute();
  if (candidates.length === 0) return;
  logger.info(
    `[reputation] sweep: evaluating ${candidates.length} degraded tenant(s) for auto-recovery`,
  );
  for (const row of candidates) {
    try {
      await evaluateTenant(row.id, { trigger: "AUTO_RECOVERY" });
    } catch (err) {
      logger.error(
        `[reputation] sweep: tenant=${row.id} evaluation failed:`,
        err,
      );
    }
  }
}
