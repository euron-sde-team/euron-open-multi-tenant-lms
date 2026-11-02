/**
 * Email Engine, sending domain onboarding service
 * ============================================================================
 *
 * CRITICAL GUARDRAIL: OPT-IN ONLY:
 *   This service MUST NOT be called from:
 *     - the tenant signup endpoint
 *     - any tenant-create admin tooling
 *     - plan / subscription / entitlement provisioning
 *     - any seed or migration script
 *
 *   The only legitimate entry points are:
 *     - POST /tenant/email-sending-domains (tenant admin UI)
 *     - GET / DELETE /tenant/email-sending-domains/:id (tenant admin UI)
 *
 *   Every new tenant defaults to the legacy email path
 *   (FROM `"{tenantName} <{config.legacyFromEmail}>"`). The legacy path stays
 *   the default for every tenant indefinitely until a tenant admin opens
 *   Settings -> Email Sending and submits this form.
 *
 * LEGACY FALLBACK CONTRACT (preserved across all phases):
 *   The resolver (Phase 6) returns `{ mode: "legacy" }` whenever a tenant has
 *   no VERIFIED sending domain. Callers MUST then send through the existing
 *   legacy SES path with the FROM line formatted as
 *   `"{tenantName} <{config.legacyFromEmail}>"`. The tenant's organization
 *   name MUST appear in the FROM display name; ONLY the email address
 *   falls back to the platform's noreply@example.com.
 *
 * IDEMPOTENCY:
 *   Onboarding the same (tenantId, subdomain) is a no-op that returns the
 *   existing row. AWS resources (configuration set, identity, MAIL FROM)
 *   are created with idempotent semantics: AlreadyExistsException is caught
 *   and treated as success.
 * ============================================================================
 */

import {
  SESv2Client,
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  CreateEmailIdentityCommand,
  DeleteConfigurationSetCommand,
  DeleteEmailIdentityCommand,
  GetConfigurationSetEventDestinationsCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  AlreadyExistsException,
  NotFoundException,
  EventType,
} from "@aws-sdk/client-sesv2";
import { promises as dnsPromises } from "node:dns";
import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { InternalServerError } from "../errors/internal-server.error";
import { NotFoundError } from "../errors/not-found.error";
import emailSendingDomainRepository, {
  type SendingDomainRow,
} from "../repositories/email-sending-domain.repository";
import type {
  DnsRecord,
  SendingDomainResponse,
} from "../types/email-sending-domain.type";
import { invalidate as invalidateResolverCache } from "./email-engine/resolver";
import logger from "../utils/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_EVENT_TYPES: EventType[] = [
  EventType.SEND,
  EventType.DELIVERY,
  EventType.BOUNCE,
  EventType.COMPLAINT,
  EventType.REJECT,
  EventType.OPEN,
  EventType.CLICK,
  EventType.RENDERING_FAILURE,
  EventType.DELIVERY_DELAY,
];

const PER_TENANT_EVENT_DESTINATION_NAME = "sns-fanout";

// Strict hostname label: lowercase alphanumeric + hyphens, no leading/trailing hyphen.
const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSesClient(): SESv2Client {
  return new SESv2Client({
    region: config.AWS_SES_REGION,
    credentials: {
      accessKeyId: config.AWS_SES_ACCESS_KEY,
      secretAccessKey: config.AWS_SES_SECRET_KEY,
    },
  });
}

function perTenantConfigSetName(tenantId: string): string {
  return `email-tenant-${tenantId}`;
}

/**
 * Validate + normalize a sending domain. Accepts BOTH apex (`example.com`,
 * two labels) and subdomain (`mail.example.com`, three or more labels).
 *
 * Subdomain is the recommended default because it isolates reputation,
 * SPF lookup count, and DMARC policy from the rest of the tenant's
 * organization. Apex is supported because some tenants explicitly want
 * mail to read as `From: noreply@example.com` (no `mail.`-style prefix)
 * and are willing to accept the coupling. The UI surfaces the tradeoff
 * via the `isApex` flag on the response.
 */
function validateSendingDomain(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    throw new BadRequestError("sending domain is required");
  }
  if (normalized.length > 253) {
    throw new BadRequestError(
      "sending domain must be 253 characters or fewer",
    );
  }
  const labels = normalized.split(".");
  if (labels.length < 2) {
    throw new BadRequestError(
      "sending domain must be a fully-qualified hostname with at least two labels (e.g. example.com or mail.example.com)",
    );
  }
  for (const label of labels) {
    if (!LABEL_REGEX.test(label)) {
      throw new BadRequestError(
        `invalid label "${label}"; each label must be lowercase alphanumeric or hyphen, 1-63 chars, not starting or ending with hyphen`,
      );
    }
  }
  return normalized;
}

/**
 * "Apex" here means a 2-label hostname like `example.com` or `acme.io`.
 * This is a heuristic, not a Public-Suffix-List lookup, so it'll
 * misclassify ccTLD-style 3-label domains such as `acme.co.uk` as
 * non-apex. That's fine for our purposes (the flag drives a UI warning,
 * nothing security-sensitive). A tenant on `acme.co.uk` simply won't
 * see the apex warning, which is the safer failure mode.
 */
function isApexDomain(sendingDomain: string): boolean {
  return sendingDomain.split(".").length === 2;
}

/**
 * Look up `_dmarc.{sendingDomain}` and return whatever TXT record is
 * already there. Returns null when no DMARC is found, or when the DNS
 * lookup fails for any reason (NXDOMAIN, timeout, ENODATA, etc.). The
 * caller surfaces the value to the tenant so they can decide whether
 * to keep their existing policy (typical on apex) or replace it with
 * the conservative `p=none` record we recommend.
 *
 * Fail-soft on purpose: a transient DNS failure should never block
 * onboarding. The worst case is the user doesn't see the advisory and
 * potentially overwrites their existing DMARC; we mitigate that in
 * copy by telling them to check before publishing.
 */
async function lookupExistingDmarc(
  sendingDomain: string,
): Promise<string | null> {
  try {
    const records = await dnsPromises.resolveTxt(`_dmarc.${sendingDomain}`);
    for (const chunks of records) {
      const joined = chunks.join("");
      if (joined.toLowerCase().includes("v=dmarc1")) {
        return joined;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function buildDnsRecords(
  subdomain: string,
  dkimTokens: string[],
  region: string,
): DnsRecord[] {
  const mailFromSubdomain = `bounce.${subdomain}`;
  const records: DnsRecord[] = [];

  for (const token of dkimTokens) {
    records.push({
      type: "CNAME",
      name: `${token}._domainkey.${subdomain}`,
      value: `${token}.dkim.amazonses.com`,
      purpose: "DKIM",
    });
  }

  records.push({
    type: "MX",
    name: mailFromSubdomain,
    value: `feedback-smtp.${region}.amazonses.com`,
    priority: 10,
    purpose: "MAIL_FROM_MX",
  });

  records.push({
    type: "TXT",
    name: mailFromSubdomain,
    value: "\"v=spf1 include:amazonses.com ~all\"",
    purpose: "MAIL_FROM_SPF",
  });

  records.push({
    type: "TXT",
    name: subdomain,
    value: "\"v=spf1 include:amazonses.com ~all\"",
    purpose: "SENDING_SPF",
  });

  records.push({
    type: "TXT",
    name: `_dmarc.${subdomain}`,
    value: `"v=DMARC1; p=none; rua=mailto:dmarc-reports@${subdomain}"`,
    purpose: "DMARC",
  });

  return records;
}

function parseDnsRecords(raw: unknown): DnsRecord[] {
  if (Array.isArray(raw)) return raw as DnsRecord[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as DnsRecord[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * `existingDmarcTxt` is an onboarding-time advisory and is NOT persisted
 * on the row. Callers that have just resolved DMARC (onboard, runCheckById)
 * pass it explicitly; routine reads (list, getById) pass null. The flag
 * `isApex` is derived from the stored subdomain on every call, so it
 * survives across reads.
 */
function toResponse(
  row: SendingDomainRow,
  advisories: { existingDmarcTxt: string | null } = { existingDmarcTxt: null },
): SendingDomainResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subdomain: row.subdomain,
    mailFromSubdomain: row.mail_from_subdomain,
    sesConfigurationSet: row.ses_configuration_set,
    status: row.status,
    dkimStatus: row.dkim_status,
    mailFromStatus: row.mail_from_status,
    dnsRecords: parseDnsRecords(row.dns_records),
    failureReason: row.failure_reason,
    verifiedAt: row.verified_at?.toISOString() ?? null,
    lastCheckedAt: row.last_checked_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    isApex: isApexDomain(row.subdomain),
    existingDmarcTxt: advisories.existingDmarcTxt,
  };
}

// ---------------------------------------------------------------------------
// AWS helpers (each is idempotent)
// ---------------------------------------------------------------------------

async function ensurePerTenantConfigurationSet(
  ses: SESv2Client,
  tenantId: string,
): Promise<string> {
  const name = perTenantConfigSetName(tenantId);
  try {
    await ses.send(
      new CreateConfigurationSetCommand({
        ConfigurationSetName: name,
        ReputationOptions: { ReputationMetricsEnabled: true },
        SendingOptions: { SendingEnabled: true },
      }),
    );
  } catch (err) {
    if (!(err instanceof AlreadyExistsException)) throw err;
  }

  // Wire the per-tenant config set to publish events to the shared SNS topic.
  // Without this, the events consumer (Phase 7) never receives bounces /
  // complaints / deliveries for this tenant.
  if (!config.SES_EVENTS_SNS_TOPIC_ARN) {
    throw new InternalServerError(
      "SES_EVENTS_SNS_TOPIC_ARN is not configured; run infra/email-engine bootstrap first",
    );
  }

  const existingDests = await ses.send(
    new GetConfigurationSetEventDestinationsCommand({
      ConfigurationSetName: name,
    }),
  );
  const alreadyWired = existingDests.EventDestinations?.some(
    (d) => d.Name === PER_TENANT_EVENT_DESTINATION_NAME,
  );
  if (!alreadyWired) {
    try {
      await ses.send(
        new CreateConfigurationSetEventDestinationCommand({
          ConfigurationSetName: name,
          EventDestinationName: PER_TENANT_EVENT_DESTINATION_NAME,
          EventDestination: {
            Enabled: true,
            MatchingEventTypes: ALL_EVENT_TYPES,
            SnsDestination: { TopicArn: config.SES_EVENTS_SNS_TOPIC_ARN },
          },
        }),
      );
    } catch (err) {
      if (!(err instanceof AlreadyExistsException)) throw err;
    }
  }
  return name;
}

async function ensureSesIdentity(
  ses: SESv2Client,
  subdomain: string,
  configSetName: string,
  tenantId: string,
): Promise<string[]> {
  try {
    const created = await ses.send(
      new CreateEmailIdentityCommand({
        EmailIdentity: subdomain,
        DkimSigningAttributes: {
          NextSigningKeyLength: "RSA_2048_BIT",
        },
        ConfigurationSetName: configSetName,
        Tags: [{ Key: "tenantId", Value: tenantId }],
      }),
    );
    return created.DkimAttributes?.Tokens ?? [];
  } catch (err) {
    if (!(err instanceof AlreadyExistsException)) throw err;
    // Identity exists from a previous attempt that crashed before DB write.
    // Read back current DKIM tokens so we still hand the tenant valid records.
    const fetched = await ses.send(
      new GetEmailIdentityCommand({ EmailIdentity: subdomain }),
    );
    return fetched.DkimAttributes?.Tokens ?? [];
  }
}

async function ensureMailFromAttributes(
  ses: SESv2Client,
  subdomain: string,
): Promise<void> {
  await ses.send(
    new PutEmailIdentityMailFromAttributesCommand({
      EmailIdentity: subdomain,
      MailFromDomain: `bounce.${subdomain}`,
      BehaviorOnMxFailure: "REJECT_MESSAGE",
    }),
  );
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class EmailSendingDomainService {
  async onboardSendingDomain(
    tenantId: string,
    rawSendingDomain: string,
  ): Promise<SendingDomainResponse> {
    const sendingDomain = validateSendingDomain(rawSendingDomain);

    // Pre-flight DMARC lookup. Done BEFORE creating AWS resources so we
    // can surface the existing record alongside the DNS instructions in
    // the very first response the tenant sees. Apex domains often have
    // a corporate DMARC policy already in place; we never want to silently
    // suggest the tenant overwrite it.
    const existingDmarcTxt = await lookupExistingDmarc(sendingDomain);

    // Idempotent: re-onboarding the same (tenant, sendingDomain) returns
    // the existing row without touching AWS again. We still re-query DMARC
    // so the response stays accurate if the tenant has published or changed
    // their DMARC since the original onboarding.
    const existing =
      await emailSendingDomainRepository.findByTenantAndSubdomain(
        tenantId,
        sendingDomain,
      );
    if (existing) return toResponse(existing, { existingDmarcTxt });

    // For V1 we limit each tenant to one sending domain. Reject if any other
    // domain exists for this tenant.
    const all = await emailSendingDomainRepository.listByTenant(tenantId);
    if (all.length > 0) {
      throw new ConflictError(
        "This tenant already has a sending domain. Delete the existing one before onboarding another. Multi-domain support is planned for V2.",
      );
    }

    const ses = buildSesClient();
    const configSetName = await ensurePerTenantConfigurationSet(ses, tenantId);
    const dkimTokens = await ensureSesIdentity(
      ses,
      sendingDomain,
      configSetName,
      tenantId,
    );
    await ensureMailFromAttributes(ses, sendingDomain);

    const dnsRecords = buildDnsRecords(
      sendingDomain,
      dkimTokens,
      config.AWS_SES_REGION,
    );

    const row = await emailSendingDomainRepository.create({
      tenantId,
      subdomain: sendingDomain,
      mailFromSubdomain: `bounce.${sendingDomain}`,
      sesConfigurationSet: configSetName,
      dnsRecords,
    });

    await invalidateResolverCache(tenantId);
    return toResponse(row, { existingDmarcTxt });
  }

  async listForTenant(tenantId: string): Promise<SendingDomainResponse[]> {
    const rows = await emailSendingDomainRepository.listByTenant(tenantId);
    // Explicit arrow so TS doesn't pass Array.prototype.map's `index`
    // argument into toResponse's `advisories` slot.
    return rows.map((row) => toResponse(row));
  }

  async getById(
    tenantId: string,
    id: string,
  ): Promise<SendingDomainResponse> {
    const row = await emailSendingDomainRepository.findByTenantAndId(
      tenantId,
      id,
    );
    if (!row) throw new NotFoundError("Sending domain not found");
    return toResponse(row);
  }

  async deleteById(tenantId: string, id: string): Promise<void> {
    const row = await emailSendingDomainRepository.findByTenantAndId(
      tenantId,
      id,
    );
    if (!row) throw new NotFoundError("Sending domain not found");

    const ses = buildSesClient();

    // Best-effort AWS cleanup: log + swallow NotFoundException so a stuck
    // record can still be deleted from the DB even if AWS state has drifted.
    try {
      await ses.send(
        new DeleteEmailIdentityCommand({ EmailIdentity: row.subdomain }),
      );
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
    }
    try {
      await ses.send(
        new DeleteConfigurationSetCommand({
          ConfigurationSetName: row.ses_configuration_set,
        }),
      );
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
    }

    // Cascades to tenant_email_sender_identities + tenant_email_domain_health_checks.
    // tenant_email_messages with this sending_domain_id stay; the FK becomes
    // NULL via SetNull (preserving send history for audit/reputation).
    await emailSendingDomainRepository.deleteById(tenantId, id);
    await invalidateResolverCache(tenantId);
  }

  // -------------------------------------------------------------------------
  // Verification polling (Phase 4)
  // -------------------------------------------------------------------------
  //
  // The verification poller worker calls pollPendingDomains() on a 60s cadence.
  // For each PENDING row, GetEmailIdentity is called against SES. DKIM +
  // MAIL FROM statuses are persisted to the DB. Transitions:
  //   - both SUCCESS  -> VERIFIED, verified_at set, one-shot notification
  //   - either FAILED for >24h after onboarding -> FAILED
  //   - otherwise -> stays PENDING (TEMPORARY_FAILURE included; DNS not yet
  //     propagated is normal in the first few minutes)
  //
  // The on-demand POST /:id/check endpoint calls runCheckById() to bypass
  // the schedule; useful when a tenant just published their DNS records and
  // doesn't want to wait up to 60s for the next sweep.

  async pollPendingDomains(): Promise<void> {
    // listPending now filters by last_checked_at so we don't re-poll a row
    // we just checked. Default 30s skew leaves headroom for ~2 checks per
    // minute per row (sweep cadence is 60s) while preventing redundant SES
    // calls when the sweep races ahead of itself.
    const pending = await emailSendingDomainRepository.listPending(50);
    if (pending.length === 0) return;

    const ses = buildSesClient();

    // Parallelise SES GetEmailIdentity calls. The AWS SDK keeps an internal
    // HTTP keep-alive pool, so the right concurrency knob here is "how many
    // in-flight requests we hold". 5 keeps a 50-row sweep to ~1.5s wall-
    // clock instead of ~7.5s sequential, without risking the SES API rate
    // ceiling (GetEmailIdentity is a low-cost read with generous quotas).
    //
    // We use fixed-size chunked Promise.all rather than a true pLimit queue
    // so we don't add a dependency for a marginal latency benefit; a slow
    // call in a chunk only delays the start of the NEXT chunk, not the
    // overall throughput target.
    const CHECK_CONCURRENCY = 5;
    for (let i = 0; i < pending.length; i += CHECK_CONCURRENCY) {
      const chunk = pending.slice(i, i + CHECK_CONCURRENCY);
      await Promise.all(
        chunk.map(async (row) => {
          try {
            await this.checkAndUpdate(ses, row);
          } catch (err) {
            logger.error(
              `[email-sending-domain] verification poll failed for ${row.id} (${row.subdomain}): ${(err as Error).message}`,
            );
          }
        }),
      );
    }
  }

  async runCheckById(
    tenantId: string,
    id: string,
  ): Promise<SendingDomainResponse> {
    const row = await emailSendingDomainRepository.findByTenantAndId(
      tenantId,
      id,
    );
    if (!row) throw new NotFoundError("Sending domain not found");
    const ses = buildSesClient();
    await this.checkAndUpdate(ses, row);
    const refreshed = await emailSendingDomainRepository.findByTenantAndId(
      tenantId,
      id,
    );
    if (!refreshed) throw new NotFoundError("Sending domain not found");
    // Re-resolve DMARC on every manual check so the response reflects what
    // the tenant has just published (or removed). Cheap, and the manual
    // check is rate-limited by the human clicking the button.
    const existingDmarcTxt = await lookupExistingDmarc(refreshed.subdomain);
    return toResponse(refreshed, { existingDmarcTxt });
  }

  private async checkAndUpdate(
    ses: SESv2Client,
    row: SendingDomainRow,
  ): Promise<void> {
    let dkimStatus: string | null = null;
    let mailFromStatus: string | null = null;
    let failureReason: string | null = null;

    try {
      const identity = await ses.send(
        new GetEmailIdentityCommand({ EmailIdentity: row.subdomain }),
      );
      dkimStatus = identity.DkimAttributes?.Status ?? null;
      mailFromStatus = identity.MailFromAttributes?.MailFromDomainStatus ?? null;
    } catch (err) {
      if (err instanceof NotFoundException) {
        // The SES identity was deleted out of band. Treat as a hard failure;
        // the tenant must delete + re-onboard.
        failureReason =
          "SES identity not found. The identity may have been deleted manually; delete this row and re-onboard.";
      } else {
        failureReason = (err as Error).message.slice(0, 480);
      }
    }

    const bothSuccess =
      dkimStatus === "SUCCESS" && mailFromStatus === "SUCCESS";
    const hasHardFailure =
      dkimStatus === "FAILED" || mailFromStatus === "FAILED" || !!failureReason;
    const ageMs = Date.now() - row.created_at.getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    let nextStatus = row.status;
    let verifiedAt = row.verified_at;
    let nextFailureReason = failureReason;

    if (bothSuccess) {
      nextStatus = "VERIFIED";
      verifiedAt = verifiedAt ?? new Date();
      nextFailureReason = null;
    } else if (hasHardFailure && ageMs > TWENTY_FOUR_HOURS) {
      nextStatus = "FAILED";
    }

    await emailSendingDomainRepository.updateVerificationState(row.id, {
      status: nextStatus,
      dkimStatus,
      mailFromStatus,
      failureReason: nextFailureReason,
      verifiedAt,
      lastCheckedAt: new Date(),
    });

    // Any status change can flip the resolver's verdict for this tenant.
    // Cheap to invalidate; the cache will refill on the next send.
    if (nextStatus !== row.status) {
      await invalidateResolverCache(row.tenant_id);
    }

    if (nextStatus === "VERIFIED" && row.status !== "VERIFIED") {
      // Fire-and-forget notification to the tenant. Sent FROM the platform
      // legacy path (not the tenant's own domain) because the legacy path is
      // always known to be working, even when a brand new domain just
      // verified. Wiring into notification.service is left for the tenant-
      // admin UI work; the log line below is the audit signal.
      logger.info(
        `[email-sending-domain] tenant=${row.tenant_id} subdomain=${row.subdomain} transitioned PENDING -> VERIFIED`,
      );
    }
  }
}

export default new EmailSendingDomainService();
