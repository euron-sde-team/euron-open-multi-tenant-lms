/**
 * Domain health monitor, catches tenants who break their DNS after onboarding.
 *
 * Runs four checks per VERIFIED domain:
 *   1. SES GetEmailIdentity      -> DKIM status + MAIL FROM status (authoritative)
 *   2. DNS TXT on subdomain      -> SPF presence
 *   3. DNS TXT on _dmarc.{sub}   -> DMARC presence
 *   4. DNS MX  on bounce.{sub}   -> MAIL FROM MX presence
 *
 * Every check persists a `tenant_email_domain_health_checks` row.
 *
 * Failure escalation:
 *   - DKIM or MAIL FROM = FAILED: hard failure
 *   - If hard failure persists for >24h since the last SUCCESS health check
 *     (or, for never-checked domains, since verified_at), flip the parent
 *     `tenant_email_sending_domains.status` to FAILED and invalidate the
 *     resolver cache so the next send falls through to the legacy SES path.
 *   - SPF / DMARC missing: warning only; recorded in `failures` JSON but
 *     never triggers a status transition. SES tolerates missing DMARC; the
 *     records are recommendations, not requirements.
 *
 * Single transient failure does NOT flip status; the 24h grace lets a
 * tenant's DNS provider hiccup recover before we cut them off.
 */

import { resolveTxt, resolveMx } from "dns/promises";
import { ulid } from "ulid";
import {
  SESv2Client,
  GetEmailIdentityCommand,
  NotFoundException,
} from "@aws-sdk/client-sesv2";
import config from "../../config";
import { db } from "../../db/connection";
import logger from "../../utils/logger";
import emailSendingDomainRepository, {
  type SendingDomainRow,
} from "../../repositories/email-sending-domain.repository";
import { invalidate as invalidateResolverCache } from "./resolver";
import { notifyOps } from "./ops-alert";

export interface DomainHealthCheckRow {
  id: string;
  sendingDomainId: string;
  dkimStatus: string;
  mailFromStatus: string;
  spfPresent: boolean;
  dmarcPresent: boolean;
  failures: { check: string; reason: string }[];
  createdAt: string;
}

interface CheckOutcome {
  failures: { check: string; reason: string }[];
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

async function checkSesIdentity(
  ses: SESv2Client,
  subdomain: string,
): Promise<{ dkim: string; mailFrom: string } & CheckOutcome> {
  try {
    const result = await ses.send(
      new GetEmailIdentityCommand({ EmailIdentity: subdomain }),
    );
    return {
      dkim: result.DkimAttributes?.Status ?? "UNKNOWN",
      mailFrom: result.MailFromAttributes?.MailFromDomainStatus ?? "UNKNOWN",
      failures: [],
    };
  } catch (err) {
    if (err instanceof NotFoundException) {
      return {
        dkim: "MISSING",
        mailFrom: "MISSING",
        failures: [
          {
            check: "ses_identity",
            reason: "SES identity was deleted out-of-band",
          },
        ],
      };
    }
    return {
      dkim: "ERROR",
      mailFrom: "ERROR",
      failures: [
        {
          check: "ses_identity",
          reason: (err as Error).message.slice(0, 240),
        },
      ],
    };
  }
}

async function checkSpf(
  subdomain: string,
): Promise<{ present: boolean } & CheckOutcome> {
  try {
    const records = await resolveTxt(subdomain);
    const joined = records.flat().join(" ").toLowerCase();
    if (joined.includes("v=spf1") && joined.includes("amazonses.com")) {
      return { present: true, failures: [] };
    }
    return {
      present: false,
      failures: [
        {
          check: "spf",
          reason: "no SPF TXT record on sending subdomain references amazonses.com",
        },
      ],
    };
  } catch (err) {
    return {
      present: false,
      failures: [
        { check: "spf", reason: (err as Error).message.slice(0, 240) },
      ],
    };
  }
}

async function checkDmarc(
  subdomain: string,
): Promise<{ present: boolean } & CheckOutcome> {
  try {
    const records = await resolveTxt(`_dmarc.${subdomain}`);
    const joined = records.flat().join(" ").toLowerCase();
    if (joined.includes("v=dmarc1")) {
      return { present: true, failures: [] };
    }
    return {
      present: false,
      failures: [
        { check: "dmarc", reason: "no DMARC v=DMARC1 TXT record" },
      ],
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      // DMARC is recommended but not required by SES; record as a warning.
      return {
        present: false,
        failures: [
          {
            check: "dmarc",
            reason:
              "DMARC record missing (recommended for inbox placement; not required for SES sending)",
          },
        ],
      };
    }
    return {
      present: false,
      failures: [
        { check: "dmarc", reason: (err as Error).message.slice(0, 240) },
      ],
    };
  }
}

async function checkMx(
  mailFromSubdomain: string,
): Promise<{ present: boolean } & CheckOutcome> {
  try {
    const records = await resolveMx(mailFromSubdomain);
    if (records.some((r) => r.exchange.toLowerCase().includes("amazonses.com"))) {
      return { present: true, failures: [] };
    }
    return {
      present: false,
      failures: [
        {
          check: "mail_from_mx",
          reason: `no MX record on ${mailFromSubdomain} points at amazonses.com`,
        },
      ],
    };
  } catch (err) {
    return {
      present: false,
      failures: [
        { check: "mail_from_mx", reason: (err as Error).message.slice(0, 240) },
      ],
    };
  }
}

function toResponse(row: {
  id: string;
  sending_domain_id: string;
  dkim_status: string;
  mail_from_status: string;
  spf_present: boolean;
  dmarc_present: boolean;
  failures: unknown;
  created_at: Date;
}): DomainHealthCheckRow {
  return {
    id: row.id,
    sendingDomainId: row.sending_domain_id,
    dkimStatus: row.dkim_status,
    mailFromStatus: row.mail_from_status,
    spfPresent: row.spf_present,
    dmarcPresent: row.dmarc_present,
    failures: Array.isArray(row.failures)
      ? (row.failures as { check: string; reason: string }[])
      : typeof row.failures === "string"
        ? (JSON.parse(row.failures) as { check: string; reason: string }[])
        : [],
    createdAt: row.created_at.toISOString(),
  };
}

class DomainHealthService {
  /**
   * Run all four health checks for one domain, persist the result row, and
   * apply the 24h-of-failure status transition if appropriate.
   */
  async checkDomainHealth(domain: SendingDomainRow): Promise<DomainHealthCheckRow> {
    const ses = buildSesClient();
    const [sesCheck, spfCheck, dmarcCheck, mxCheck] = await Promise.all([
      checkSesIdentity(ses, domain.subdomain),
      checkSpf(domain.subdomain),
      checkDmarc(domain.subdomain),
      checkMx(domain.mail_from_subdomain),
    ]);

    const failures = [
      ...sesCheck.failures,
      ...spfCheck.failures,
      ...dmarcCheck.failures,
      ...mxCheck.failures,
    ];

    const id = ulid();
    const now = new Date();
    const inserted = await db
      .insertInto("tenant_email_domain_health_checks")
      .values({
        id,
        sending_domain_id: domain.id,
        dkim_status: sesCheck.dkim,
        mail_from_status: sesCheck.mailFrom,
        spf_present: spfCheck.present,
        dmarc_present: dmarcCheck.present,
        failures: failures.length > 0 ? JSON.stringify(failures) : null,
        created_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Update last_checked_at on the parent domain row so the operator UI can
    // show "checked X minutes ago" without joining health checks.
    await emailSendingDomainRepository.updateVerificationState(domain.id, {
      lastCheckedAt: now,
    });

    // Status transition: only when CURRENT check shows hard failure AND the
    // failure has persisted for >24h since the last SUCCESS (or, for
    // never-checked domains, since verified_at).
    const hardFailureNow =
      sesCheck.dkim === "FAILED" ||
      sesCheck.mailFrom === "FAILED" ||
      sesCheck.dkim === "MISSING" ||
      sesCheck.mailFrom === "MISSING";

    if (
      domain.status === "VERIFIED" &&
      hardFailureNow &&
      (await this.hasFailedFor24h(domain))
    ) {
      await this.flipToFailed(domain, failures);
    }

    return toResponse(inserted);
  }

  private async hasFailedFor24h(domain: SendingDomainRow): Promise<boolean> {
    // Find the most recent fully-successful health check.
    const lastSuccess = await db
      .selectFrom("tenant_email_domain_health_checks")
      .select("created_at")
      .where("sending_domain_id", "=", domain.id)
      .where("dkim_status", "=", "SUCCESS")
      .where("mail_from_status", "=", "SUCCESS")
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();

    const lastSuccessTime = lastSuccess
      ? lastSuccess.created_at
      : (domain.verified_at ?? domain.created_at);

    const ageMs = Date.now() - lastSuccessTime.getTime();
    return ageMs > 24 * 60 * 60 * 1000;
  }

  private async flipToFailed(
    domain: SendingDomainRow,
    failures: { check: string; reason: string }[],
  ): Promise<void> {
    const failureReason = failures
      .map((f) => `${f.check}: ${f.reason}`)
      .join("; ")
      .slice(0, 512);

    await emailSendingDomainRepository.updateVerificationState(domain.id, {
      status: "FAILED",
      failureReason,
    });

    // Cached resolver result includes the domain status; flip means future
    // sends must re-resolve and route via legacy.
    await invalidateResolverCache(domain.tenant_id);

    // Log + OPS alert. Phase 14 will add tenant-facing in-app notification.
    logger.warn(
      `[domain-health] domain=${domain.id} tenant=${domain.tenant_id} subdomain=${domain.subdomain} VERIFIED -> FAILED after >24h of broken DNS. Affected checks: ${failureReason}`,
    );
    await notifyOps({
      severity: "SEV3",
      source: "email-engine.domain-health",
      message: `Tenant ${domain.tenant_id} sending domain ${domain.subdomain} flipped VERIFIED -> FAILED; DNS broken for >24h. Tenant emails fall back to legacy noreply@example.com until the tenant fixes DNS and re-onboards.`,
      context: {
        tenantId: domain.tenant_id,
        domainId: domain.id,
        subdomain: domain.subdomain,
        failureReason,
      },
    });
  }

  /**
   * Get the most recent health check for a domain. Used by the GET endpoint.
   */
  async getLatestForDomain(
    tenantId: string,
    domainId: string,
  ): Promise<DomainHealthCheckRow | null> {
    const owned = await emailSendingDomainRepository.findByTenantAndId(
      tenantId,
      domainId,
    );
    if (!owned) return null;
    const latest = await db
      .selectFrom("tenant_email_domain_health_checks")
      .selectAll()
      .where("sending_domain_id", "=", domainId)
      .orderBy("created_at", "desc")
      .limit(1)
      .executeTakeFirst();
    return latest ? toResponse(latest) : null;
  }

  /**
   * Sweep all VERIFIED domains. Called by the BullMQ scheduled worker. Each
   * domain check is independent; one tenant's failure shouldn't abort
   * subsequent tenants.
   */
  async sweepAllVerifiedDomains(): Promise<void> {
    const domains = await db
      .selectFrom("tenant_email_sending_domains")
      .selectAll()
      .where("status", "=", "VERIFIED")
      .execute();
    if (domains.length === 0) return;
    logger.info(
      `[domain-health] sweep: ${domains.length} VERIFIED domain(s) to check`,
    );
    for (const domain of domains) {
      try {
        await this.checkDomainHealth(domain);
      } catch (err) {
        logger.error(
          `[domain-health] sweep failed for domain=${domain.id} tenant=${domain.tenant_id}: ${(err as Error).message}`,
        );
      }
    }
  }
}

export default new DomainHealthService();
