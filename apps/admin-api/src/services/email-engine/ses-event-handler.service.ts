/**
 * SES event handler, parses raw SES event JSON from SQS and updates state.
 *
 * Idempotency rule: every UPDATE that flips a one-shot timestamp uses
 * `WHERE ... AND <timestamp> IS NULL` so a second delivery of the same SQS
 * message (at-least-once semantics) is a no-op.
 *
 * Tenant identification rule: read `tenantId` and our internal `messageId`
 * from `event.mail.tags`, NEVER parse the SES messageId. This is the entire
 * justification for per-tenant configuration sets: SES tags every event
 * with the originating tenant.
 *
 * On bounce + complaint we ALSO trigger reputation evaluation (Phase 8 fills
 * in the actual state-machine logic; Phase 7 wires the dispatch).
 */

import { db } from "../../db/connection";
import logger from "../../utils/logger";
import { addSuppression } from "./suppression";
import { recordReputationEvent } from "./reputation-metrics.service";
import { evaluateTenant } from "./reputation.service";

// ---------------------------------------------------------------------------
// SES event shape (raw, after SNS RawMessageDelivery)
// ---------------------------------------------------------------------------

interface MailObject {
  timestamp?: string;
  source?: string;
  messageId?: string;
  destination?: string[];
  tags?: Record<string, string[]>;
}

interface BouncedRecipient {
  emailAddress?: string;
  status?: string;
  action?: string;
  diagnosticCode?: string;
}

interface ComplainedRecipient {
  emailAddress?: string;
}

interface SesEvent {
  eventType: string;
  mail?: MailObject;
  delivery?: { timestamp?: string };
  bounce?: {
    bounceType?: "Permanent" | "Transient" | "Undetermined";
    bounceSubType?: string;
    bouncedRecipients?: BouncedRecipient[];
    timestamp?: string;
    feedbackId?: string;
  };
  complaint?: {
    complaintFeedbackType?: string;
    complainedRecipients?: ComplainedRecipient[];
    timestamp?: string;
    feedbackId?: string;
    userAgent?: string;
  };
  reject?: { reason?: string };
  open?: { timestamp?: string };
  click?: { timestamp?: string; link?: string };
  failure?: { errorMessage?: string };
  deliveryDelay?: { delayType?: string };
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

interface TagsResolved {
  tenantId: string;
  messageId: string;
  category: string;
}

function readTag(
  tags: Record<string, string[]> | undefined,
  name: string,
): string | null {
  const arr = tags?.[name];
  if (!arr || arr.length === 0) return null;
  const first = arr[0];
  return typeof first === "string" ? first : null;
}

function resolveTags(event: SesEvent): TagsResolved | null {
  const tags = event.mail?.tags;
  const tenantId = readTag(tags, "tenantId");
  const messageId = readTag(tags, "messageId");
  const category = readTag(tags, "category");
  if (!tenantId || !messageId) return null;
  return { tenantId, messageId, category: category ?? "TRANSACTIONAL" };
}

function parseTimestamp(value: string | undefined): Date {
  if (!value) return new Date();
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts) : new Date();
}

// ---------------------------------------------------------------------------
// Per-event handlers
// ---------------------------------------------------------------------------

async function handleSend(tags: TagsResolved, event: SesEvent): Promise<void> {
  const ts = parseTimestamp(event.mail?.timestamp);
  await recordReputationEvent(
    tags.tenantId,
    "sent",
    `${tags.messageId}:send`,
    ts.getTime(),
  );
  // Status already SENT after the SendEmail RPC on the hot path; no DB write
  // needed here. The metric is the only thing recorded for SES `Send` events.
}

async function handleDelivery(
  tags: TagsResolved,
  event: SesEvent,
): Promise<void> {
  const deliveredAt = parseTimestamp(event.delivery?.timestamp);
  // Idempotent: only the first delivery event flips delivered_at + status.
  await db
    .updateTable("tenant_email_messages")
    .set({
      delivered_at: deliveredAt,
      status: "DELIVERED",
      updated_at: new Date(),
    })
    .where("id", "=", tags.messageId)
    .where("tenant_id", "=", tags.tenantId)
    .where("delivered_at", "is", null)
    .execute();
  await recordReputationEvent(
    tags.tenantId,
    "delivered",
    `${tags.messageId}:delivery`,
    deliveredAt.getTime(),
  );
}

async function handleBounce(
  tags: TagsResolved,
  event: SesEvent,
): Promise<void> {
  const bouncedAt = parseTimestamp(event.bounce?.timestamp);
  const bounceType = event.bounce?.bounceType ?? "Undetermined";
  const bounceSubType = event.bounce?.bounceSubType ?? null;
  const isPermanent = bounceType === "Permanent";

  await db
    .updateTable("tenant_email_messages")
    .set({
      bounced_at: bouncedAt,
      bounce_type: bounceType,
      bounce_sub_type: bounceSubType,
      status: "BOUNCED",
      updated_at: new Date(),
    })
    .where("id", "=", tags.messageId)
    .where("tenant_id", "=", tags.tenantId)
    .where("bounced_at", "is", null)
    .execute();

  // Metric: separate counters for permanent vs transient bounces. Phase 8
  // computes the permanent-bounce-rate against this.
  await recordReputationEvent(
    tags.tenantId,
    isPermanent ? "bounced_perm" : "bounced_trans",
    `${tags.messageId}:bounce`,
    bouncedAt.getTime(),
  );

  // Permanent bounces feed the global suppression list (NULL category scope)
  // so the recipient is blocked from every future category. Transient
  // bounces don't suppress; SES auto-retries them.
  if (isPermanent) {
    const recipients = event.bounce?.bouncedRecipients ?? [];
    for (const r of recipients) {
      if (!r.emailAddress) continue;
      await addSuppression({
        tenantId: tags.tenantId,
        email: r.emailAddress,
        reason: "HARD_BOUNCE",
        sourceMessageId: tags.messageId,
        categoryScope: null,
        notes: bounceSubType ? `bounce_sub_type=${bounceSubType}` : null,
      });
    }
  }

  // Phase 8 enforcer hook, every bounce triggers re-evaluation. The stub
  // logs only; the queue sweep in Phase 8 will do the actual transition.
  await evaluateTenant(tags.tenantId, { trigger: "AUTO_BOUNCE" });
}

async function handleComplaint(
  tags: TagsResolved,
  event: SesEvent,
): Promise<void> {
  const complainedAt = parseTimestamp(event.complaint?.timestamp);
  const feedbackType = event.complaint?.complaintFeedbackType ?? null;

  await db
    .updateTable("tenant_email_messages")
    .set({
      complained_at: complainedAt,
      complaint_feedback_type: feedbackType,
      status: "COMPLAINED",
      updated_at: new Date(),
    })
    .where("id", "=", tags.messageId)
    .where("tenant_id", "=", tags.tenantId)
    .where("complained_at", "is", null)
    .execute();

  await recordReputationEvent(
    tags.tenantId,
    "complained",
    `${tags.messageId}:complaint`,
    complainedAt.getTime(),
  );

  // Complaints suppress GLOBALLY (NULL scope), a recipient who marked us
  // as spam should never receive any category from this tenant again.
  const recipients = event.complaint?.complainedRecipients ?? [];
  for (const r of recipients) {
    if (!r.emailAddress) continue;
    await addSuppression({
      tenantId: tags.tenantId,
      email: r.emailAddress,
      reason: "COMPLAINT",
      sourceMessageId: tags.messageId,
      categoryScope: null,
      notes: feedbackType ? `feedback_type=${feedbackType}` : null,
    });
  }

  await evaluateTenant(tags.tenantId, { trigger: "AUTO_COMPLAINT" });
}

async function handleReject(
  tags: TagsResolved,
  event: SesEvent,
): Promise<void> {
  const reason = event.reject?.reason ?? "rejected_by_ses";
  await db
    .updateTable("tenant_email_messages")
    .set({
      status: "REJECTED",
      updated_at: new Date(),
      metadata: JSON.stringify({ sesReject: reason }),
    })
    .where("id", "=", tags.messageId)
    .where("tenant_id", "=", tags.tenantId)
    .execute();
}

async function handleOpen(
  tags: TagsResolved,
  event: SesEvent,
): Promise<void> {
  const openedAt = parseTimestamp(event.open?.timestamp);
  await db
    .updateTable("tenant_email_messages")
    .set({ opened_at: openedAt, updated_at: new Date() })
    .where("id", "=", tags.messageId)
    .where("tenant_id", "=", tags.tenantId)
    .where("opened_at", "is", null)
    .execute();
  await recordReputationEvent(
    tags.tenantId,
    "opened",
    `${tags.messageId}:open`,
    openedAt.getTime(),
  );
}

async function handleClick(
  tags: TagsResolved,
  event: SesEvent,
): Promise<void> {
  const clickedAt = parseTimestamp(event.click?.timestamp);
  await db
    .updateTable("tenant_email_messages")
    .set({ clicked_at: clickedAt, updated_at: new Date() })
    .where("id", "=", tags.messageId)
    .where("tenant_id", "=", tags.tenantId)
    .where("clicked_at", "is", null)
    .execute();
  await recordReputationEvent(
    tags.tenantId,
    "clicked",
    `${tags.messageId}:click`,
    clickedAt.getTime(),
  );
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Process one raw SES event (already parsed from the SQS message body).
 *
 * Throws on:
 *   - Missing tags (tenantId / messageId), surfaced so SQS retries before
 *     eventually moving to DLQ, where the operator can inspect.
 *   - DB / Redis errors, surfaced so the consumer worker keeps the message
 *     in the queue.
 *
 * Returns silently for unknown event types (RenderingFailure, DeliveryDelay
 * etc.), they're logged but don't fail processing.
 */
export async function handleSesEvent(event: SesEvent): Promise<void> {
  const tags = resolveTags(event);
  if (!tags) {
    throw new Error(
      `SES event missing required tags (tenantId, messageId): eventType=${event.eventType}`,
    );
  }

  switch (event.eventType) {
    case "Send":
      await handleSend(tags, event);
      break;
    case "Delivery":
      await handleDelivery(tags, event);
      break;
    case "Bounce":
      await handleBounce(tags, event);
      break;
    case "Complaint":
      await handleComplaint(tags, event);
      break;
    case "Reject":
      await handleReject(tags, event);
      break;
    case "Open":
      await handleOpen(tags, event);
      break;
    case "Click":
      await handleClick(tags, event);
      break;
    case "RenderingFailure":
      logger.warn(
        `[ses-event] RenderingFailure tenant=${tags.tenantId} messageId=${tags.messageId}: ${event.failure?.errorMessage ?? "unknown"}`,
      );
      break;
    case "DeliveryDelay":
      logger.info(
        `[ses-event] DeliveryDelay tenant=${tags.tenantId} messageId=${tags.messageId} type=${event.deliveryDelay?.delayType ?? "unknown"}`,
      );
      break;
    default:
      logger.info(
        `[ses-event] Unknown eventType=${event.eventType} tenant=${tags.tenantId} messageId=${tags.messageId}`,
      );
  }
}
