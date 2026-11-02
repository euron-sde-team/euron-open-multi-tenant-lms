/**
 * Sender, the hot path of the email engine.
 *
 * Flow (matching spec §Phase 6):
 *   1. Lowercase `to`.
 *   2. Resolve sender via resolver. If { mode: "legacy" }, return immediately
 *      so the caller falls through to its existing legacy SES path with
 *      `"{tenantName} <{config.legacyFromEmail}>"`.
 *   3. Category gate. Throw EmailError("TENANT_PAUSED_FOR_CATEGORY") if
 *      blocked. TRANSACTIONAL is never blocked.
 *   4. Suppression check (global OR per-category). Throw EmailError("SUPPRESSED").
 *   5. Rate limit (per-tenant TPS * categoryMultiplier + account-wide TPS).
 *      Throw EmailError("RATE_LIMITED", retryable=true).
 *   6. Insert tenant_email_messages row in QUEUED. Unique constraint on
 *      (tenant_id, idempotency_key) provides idempotency: a duplicate insert
 *      attempt returns the prior row without re-sending.
 *   7. Build SES request. Attach List-Unsubscribe + List-Unsubscribe-Post
 *      headers when category is NOTIFICATION or MARKETING.
 *   8. SES v2 SendEmail with ConfigurationSetName = per-tenant config set,
 *      EmailTags = [tenantId, messageId, category].
 *   9. Update row with ses_message_id + status=SENT, or status=FAILED on
 *      SES error.
 *
 * IMPORTANT: This file is duplicated verbatim across admin-api
 * and learner-api (the two backends that actually send email). Schema is
 * shared via Postgres; types are regenerated independently. The one
 * deliberate diff is the storefront URL helper (BASE_DOMAIN vs MAIN_DOMAIN);
 * see comment near getStorefrontBaseUrl().
 */

import {
  SESv2Client,
  SendEmailCommand,
  type MessageHeader,
} from "@aws-sdk/client-sesv2";
import { ulid } from "ulid";
import config from "../../config";
import { db } from "../../db/connection";
import { storefrontUrlForSlug } from "../../utils/tenant-domain.util";
import logger from "../../utils/logger";
import { checkGate, type EmailCategory } from "./category-gate";
import { EmailError, isTransientSendError } from "./errors";
import { consumeRateLimit } from "./rate-limiter";
import {
  resolveSender,
  type ResolvedCustomSender,
  type ResolveOptions,
} from "./resolver";
import { isSuppressed } from "./suppression";
import { signUnsubscribeToken } from "./unsubscribe-token";

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface SendInput {
  tenantId: string;
  category: EmailCategory;
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * Override the identity's reply-to address. If undefined, falls back to
   * the resolved identity's configured reply_to (or no Reply-To header).
   */
  replyTo?: string;
  /**
   * Stable key for idempotent retries (e.g. `otp:${otpId}`). If the same key
   * arrives twice for the same tenant, the second call returns the prior
   * row without a second SES call. Strongly recommended for OTPs, password
   * resets, payment receipts.
   */
  idempotencyKey?: string;
  /** Force a specific sender identity instead of the per-category default. */
  identityOverrideId?: string;
  /** Foreign key to email_campaigns when this send is part of a campaign. */
  campaignId?: string;
  /** Free-form template label for the messages log filter. */
  templateKey?: string;
  /**
   * Per-call FROM display-name override. Highest priority for the FROM
   * display name; takes precedence over the sender identity's `display_name`
   * and the tenant org-name fallback. Set this to preserve any legacy
   * caller that already constructs a `"{name} <addr>"` line (e.g. invoice
   * sends that use the per-invoice `company_name`).
   */
  senderName?: string;
  /**
   * File attachments. When present the send switches from SES `Simple`
   * content to `Raw` (MIME) content, because Simple cannot carry attachments.
   *
   * This exists so an attachment no longer forces a caller onto the legacy
   * platform-SES path: a booking confirmation can keep its .ics invite AND
   * still go out from the tenant's verified domain. Everything else about the
   * send (identity resolution, suppression, rate limiting, idempotency,
   * message logging, SES tags) is identical between the two content modes.
   */
  attachments?: EmailAttachment[];
  metadata?: Record<string, unknown>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  /** MIME type, e.g. "text/calendar; method=REQUEST" or "application/pdf". */
  contentType: string;
}

export type SendResult =
  | {
      mode: "custom";
      messageId: string;
      sesMessageId: string | null;
      idempotent: boolean;
    }
  | {
      mode: "legacy";
      reason: string;
    };

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * RFC 2047 encoded-word for header values that aren't plain ASCII (product
 * titles and tenant names are user-supplied and routinely contain non-ASCII).
 * Raw MIME headers are bytes, so an unencoded "Booking Confirmed: कोर्स"
 * would arrive mojibake. Simple content doesn't need this: SES encodes it.
 */
function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Fold base64 into 76-char lines, as MIME requires. */
function foldBase64(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? []).join("\r\n");
}

/**
 * Build a multipart/mixed MIME message: the HTML body plus each attachment.
 *
 * `From`/`To`/`Subject` are written into the MIME itself; SendEmailCommand is
 * still given FromEmailAddress + Destination so the SMTP envelope matches the
 * resolved identity (same belt-and-braces the legacy attachment path used).
 */
export function buildRawMimeMessage(args: {
  fromLine: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
  /** SES MessageHeader[]: Name/Value are optional in the SDK type. */
  headers: Array<{ Name?: string; Value?: string }>;
  attachments: EmailAttachment[];
}): Buffer {
  const boundary = `----=_Part_${ulid()}`;
  const lines: string[] = [
    `From: ${args.fromLine}`,
    `To: ${args.to}`,
    `Subject: ${encodeHeaderValue(args.subject)}`,
  ];
  if (args.replyTo) lines.push(`Reply-To: ${args.replyTo}`);
  for (const h of args.headers) {
    if (h.Name && h.Value) lines.push(`${h.Name}: ${h.Value}`);
  }
  lines.push(
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(args.html, "utf8").toString("base64")),
    "",
  );
  for (const att of args.attachments) {
    const buf = Buffer.isBuffer(att.content)
      ? att.content
      : Buffer.from(att.content, "utf8");
    lines.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType}`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(buf.toString("base64")),
      "",
    );
  }
  lines.push(`--${boundary}--`, "");
  return Buffer.from(lines.join("\r\n"), "utf8");
}

let sesClient: SESv2Client | null = null;
function getSes(): SESv2Client {
  if (sesClient) return sesClient;
  sesClient = new SESv2Client({
    region: config.AWS_SES_REGION,
    credentials: {
      accessKeyId: config.AWS_SES_ACCESS_KEY,
      secretAccessKey: config.AWS_SES_SECRET_KEY,
    },
  });
  return sesClient;
}

/**
 * Returns the tenant's public-facing storefront URL base (no path).
 *
 * admin-api uses `config.BASE_DOMAIN`; learner-api uses
 * `config.MAIN_DOMAIN`. These are the only diff between the two duplicates
 * of this file.
 */
async function getStorefrontBaseUrl(tenantId: string): Promise<string> {
  const tenant = await db
    .selectFrom("tenants")
    .select(["slug", "custom_domain"])
    .where("id", "=", tenantId)
    .executeTakeFirst();
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found when building storefront URL`);
  }
  if (tenant.custom_domain) {
    return `https://${tenant.custom_domain}`;
  }
  return storefrontUrlForSlug(tenant.slug);
}

/**
 * FROM display-name precedence (matches legacy behavior, the display name
 * is NEVER blank):
 *   1. Per-call `senderName` override (caller-supplied, e.g. invoice
 *      `company_name`).
 *   2. The sender identity's stored `display_name` (configured in the
 *      Sender Domain UI).
 *   3. The tenant organization name from `tenants.name`, same value the
 *      legacy SES path always used.
 *
 * If all three are empty (effectively never, since `tenants.name` is NOT
 * NULL in the schema), fall back to the bare email address, but the
 * resolver guarantees `tenantName` is populated, so this branch is unreachable
 * in practice.
 */
function buildFromLine(
  resolved: ResolvedCustomSender,
  senderNameOverride?: string,
): string {
  const display =
    senderNameOverride?.trim() ||
    resolved.displayName?.trim() ||
    // Null-safe because the 60s resolver cache may temporarily hold pre-fix
    // entries shaped without `tenantName` right after a deploy. After the
    // TTL elapses (or invalidate runs), `tenantName` is always present.
    (resolved.tenantName ?? "").trim();
  if (display.length > 0) {
    return `${display} <${resolved.fromAddress}>`;
  }
  return resolved.fromAddress;
}

async function findExistingByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string,
) {
  return db
    .selectFrom("tenant_email_messages")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("idempotency_key", "=", idempotencyKey)
    .executeTakeFirst();
}

export async function sendThroughEngine(input: SendInput): Promise<SendResult> {
  // 1. Normalize recipient.
  const to = input.to.trim().toLowerCase();
  if (!to || to.indexOf("@") < 1) {
    throw new EmailError(
      "RENDER_FAILED",
      "Recipient email is required and must be well-formed",
      false,
    );
  }

  // 2. Resolve sender. Legacy short-circuit keeps the caller on the existing
  //    SES path with the tenant-name-prefixed legacy FROM.
  const resolveOptions: ResolveOptions = {};
  if (input.identityOverrideId) {
    resolveOptions.identityOverrideId = input.identityOverrideId;
  }
  const resolved = await resolveSender(
    input.tenantId,
    input.category,
    resolveOptions,
  );
  if (resolved.mode === "legacy") {
    return { mode: "legacy", reason: resolved.reason };
  }

  // 3. Category gate. PAUSED tenants only block MARKETING; TRANSACTIONAL +
  //    NOTIFICATION still flow (at reduced rate for NOTIFICATION when PAUSED).
  const gate = checkGate(resolved.tenantSendingStatus, input.category);
  if (!gate.allowed) {
    throw new EmailError(
      "TENANT_PAUSED_FOR_CATEGORY",
      `Tenant is ${resolved.tenantSendingStatus}; ${input.category} sends are blocked.`,
      false,
    );
  }

  // 4. Suppression.
  if (await isSuppressed(input.tenantId, to, input.category)) {
    throw new EmailError(
      "SUPPRESSED",
      `Recipient ${to} is on the suppression list for tenant ${input.tenantId}${input.category === "MARKETING" ? " (marketing scope)" : ""}.`,
      false,
    );
  }

  // 5. Rate limit. RATE_LIMITED is retryable; campaign worker re-enqueues.
  if (!(await consumeRateLimit(input.tenantId, gate.rateMultiplier))) {
    throw new EmailError(
      "RATE_LIMITED",
      "Per-tenant or account-wide email TPS exhausted; retry shortly.",
      true,
    );
  }

  // 6. Idempotent insert. ON CONFLICT DO NOTHING uses the
  //    (tenant_id, idempotency_key) unique index. A NULL idempotency_key
  //    never conflicts (Postgres NULL semantics), so non-idempotent sends
  //    insert normally.
  const messageId = ulid();
  const now = new Date();
  const insertValues = {
    id: messageId,
    tenant_id: input.tenantId,
    category: input.category,
    sending_domain_id: resolved.domainId,
    sender_identity_id: resolved.identityId,
    from_address: resolved.fromAddress,
    to_address: to,
    subject: input.subject,
    template_key: input.templateKey ?? null,
    campaign_id: input.campaignId ?? null,
    ses_message_id: null,
    status: "QUEUED" as const,
    bounce_type: null,
    bounce_sub_type: null,
    complaint_feedback_type: null,
    delivered_at: null,
    bounced_at: null,
    complained_at: null,
    opened_at: null,
    clicked_at: null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    idempotency_key: input.idempotencyKey ?? null,
    created_at: now,
    updated_at: now,
  };

  const inserted = await db
    .insertInto("tenant_email_messages")
    .values(insertValues)
    .onConflict((oc) =>
      oc.columns(["tenant_id", "idempotency_key"]).doNothing(),
    )
    .returningAll()
    .executeTakeFirst();

  if (!inserted) {
    // Unique violation on idempotency key; fetch existing row.
    if (!input.idempotencyKey) {
      // Should never happen: ON CONFLICT only fires for the indexed columns,
      // and a NULL idempotency_key cannot collide.
      throw new EmailError(
        "SES_FAILED",
        "Unexpected duplicate insert on tenant_email_messages without idempotency key",
        true,
      );
    }
    const existing = await findExistingByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );
    if (!existing) {
      throw new EmailError(
        "SES_FAILED",
        "Idempotent insert reported conflict but no prior row was found",
        true,
      );
    }
    return {
      mode: "custom",
      messageId: existing.id,
      sesMessageId: existing.ses_message_id,
      idempotent: true,
    };
  }

  // 7. Build optional headers (NOTIFICATION + MARKETING get List-Unsubscribe).
  const headers: MessageHeader[] = [];
  if (input.category === "NOTIFICATION" || input.category === "MARKETING") {
    try {
      const token = signUnsubscribeToken({
        tenantId: input.tenantId,
        email: to,
        messageId,
        category: input.category,
      });
      const base = await getStorefrontBaseUrl(input.tenantId);
      const url = `${base}/u/${token}`;
      headers.push({ Name: "List-Unsubscribe", Value: `<${url}>` });
      headers.push({
        Name: "List-Unsubscribe-Post",
        Value: "List-Unsubscribe=One-Click",
      });
    } catch (err) {
      // Header construction failure is not catastrophic, the send still
      // works without the header. Log + continue so a missing storefront
      // URL doesn't blackhole every marketing send.
      logger.warn(
        `[email-engine] List-Unsubscribe header build failed for tenant=${input.tenantId}: ${(err as Error).message}`,
      );
    }
  }

  const replyTo = input.replyTo ?? resolved.replyTo;
  const hasAttachments = (input.attachments?.length ?? 0) > 0;
  const emailTags = [
    { Name: "tenantId", Value: input.tenantId },
    { Name: "messageId", Value: messageId },
    { Name: "category", Value: input.category },
  ];

  // 8. SES send.
  try {
    const result = await getSes().send(
      new SendEmailCommand({
        FromEmailAddress: buildFromLine(resolved, input.senderName),
        Destination: { ToAddresses: [to] },
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        ConfigurationSetName: resolved.configurationSetName,
        EmailTags: emailTags,
        Content: hasAttachments
          ? {
              Raw: {
                Data: buildRawMimeMessage({
                  fromLine: buildFromLine(resolved, input.senderName),
                  to,
                  subject: input.subject,
                  html: input.html,
                  replyTo,
                  headers,
                  attachments: input.attachments!,
                }),
              },
            }
          : {
              Simple: {
                Subject: { Data: input.subject, Charset: "UTF-8" },
                Body: {
                  Html: { Data: input.html, Charset: "UTF-8" },
                  ...(input.text
                    ? { Text: { Data: input.text, Charset: "UTF-8" } }
                    : {}),
                },
                Headers: headers.length > 0 ? headers : undefined,
              },
            },
      }),
    );

    // 9. Persist SES message id + flip to SENT.
    await db
      .updateTable("tenant_email_messages")
      .set({
        ses_message_id: result.MessageId ?? null,
        status: "SENT",
        updated_at: new Date(),
      })
      .where("id", "=", messageId)
      .execute();

    return {
      mode: "custom",
      messageId,
      sesMessageId: result.MessageId ?? null,
      idempotent: false,
    };
  } catch (err) {
    // Mark FAILED with the error message in metadata so the operator UI
    // (Phase 14) can show it. Retryable=true; the upstream queue/caller
    // decides whether to retry.
    const message = (err as Error).message ?? String(err);
    await db
      .updateTable("tenant_email_messages")
      .set({
        status: "FAILED",
        updated_at: new Date(),
        metadata: JSON.stringify({
          ...(input.metadata ?? {}),
          sesError: message.slice(0, 1024),
        }),
      })
      .where("id", "=", messageId)
      .execute();
    // Stamp retryable from the actual SES error: a throttle or 5xx is worth
    // another pass, a rejected address is not. Callers branch on this to
    // decide between leaving the recipient PENDING and marking it FAILED.
    throw new EmailError("SES_FAILED", message, isTransientSendError(err));
  }
}
