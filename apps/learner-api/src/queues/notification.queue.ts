import { Queue } from "bullmq";
import config from "../config";
import { bullmqConnection } from "../lib/redis";
import logger from "../utils/logger";

const redisConnection = bullmqConnection;

export type NotificationJobType =
  | "user-welcome"
  | "purchase-confirmation"
  | "course-welcome"
  | "tenant-purchase-alert"
  | "enrollment-confirmation"
  | "subscription-charged"
  | "subscription-activated"
  | "subscription-payment-failed"
  | "subscription-halted"
  | "subscription-cancelled"
  | "subscription-paused"
  | "subscription-resumed"
  | "subscription-completed"
  | "subscription-renewal-reminder"
  | "subscription-grace-warning"
  | "subscription-grace-expired";

export interface NotificationJob {
  type: NotificationJobType;
  tenantId: string;
  memberId?: string;
  orderId?: string;
  orderType?: string;
  subscriptionId?: string;
  metadata?: Record<string, unknown>;
}

export const notificationQueue = new Queue<NotificationJob>("user-notification", {
  connection: redisConnection,
  prefix: config.BULLMQ_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

/**
 * Enqueue a notification job.
 *
 * `jobId` gives BullMQ-level deduplication, which matters for the purchase
 * emails: `markOrderFulfilled` is a plain UPDATE (not a CAS), so a webhook and
 * a `verify-payment` call that read `fulfilled === false` at the same instant
 * can both fulfil and both enqueue. A stable id per order collapses those to
 * one send. `delay` defers the job (see the tenant purchase alert, which waits
 * for the buyer job to generate the invoice PDF it links to).
 */
export async function queueNotification(
  job: NotificationJob,
  opts?: { jobId?: string; delay?: number },
): Promise<void> {
  await notificationQueue.add(job.type, job, opts);
}

/**
 * The tenant owner alert waits for the buyer job, which generates and uploads
 * the invoice PDF, so the alert can link that same invoice instead of racing
 * it. The alert sends with full order details either way; this only decides
 * whether it carries the PDF link.
 *
 * 20s is ~5x the measured worst case: end-to-end invoice generation (S3 logo
 * fetch + WebP->PNG conversion + PDF render + upload + DB row) took ~2s on a
 * COLD logo cache, and warm runs are faster because `_convertedLogoCache` in
 * notification.service.ts holds the converted logo for the worker's lifetime.
 * Don't raise this without a measurement, it is a delay the owner feels.
 */
const TENANT_PURCHASE_ALERT_DELAY_MS = 20_000;

/**
 * Both emails owed on a fulfilled order: the buyer's confirmation and the
 * tenant owner's alert. Call once, immediately after `markOrderFulfilled`.
 * every fulfilment path (webhook worker, verify-payment fallback, zero-payable
 * checkout) owes both.
 *
 * Fire-and-forget by design: enqueueing must never fail or slow a payment
 * response. Two independent jobs, not one, so a bounced owner address cannot
 * make BullMQ re-send the buyer's receipt.
 */
export function queuePurchaseNotifications(args: {
  tenantId: string;
  orderId: string;
  memberId: string;
  orderType?: string;
}): void {
  const { tenantId, orderId, memberId, orderType } = args;

  // Store orders have their own branded confirmation + owner alert, queued by
  // `markStoreOrderPaid`. The generic pair here has no resolver for a
  // store_orders item_id, so it would ALSO go out reading "Purchase: Item"
  // with a non-itemised invoice: two confirmations for every physical sale.
  // Gated here, once, so every fulfilment path (webhook worker, verify
  // fallback, cart, free orders) inherits the rule.
  if (orderType === "STORE_ORDER") return;

  // NOTE: job ids must not contain ":": BullMQ rejects them outright
  // ("Custom Id cannot contain :") because ":" is its Redis key separator.
  // Keep the hyphen form.
  queueNotification(
    { type: "purchase-confirmation", tenantId, orderId, memberId, orderType },
    { jobId: `purchase-${orderId}` },
  ).catch((err) =>
    logger.error(
      `[notification] Failed to queue purchase confirmation for order ${orderId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    ),
  );

  // The receipt proves the payment; this one tells the buyer how to get in and
  // where their course now lives. Its own job so a bounce or a retry on one
  // can never re-send the other.
  queueNotification(
    { type: "course-welcome", tenantId, orderId, memberId, orderType },
    { jobId: `welcome-${orderId}` },
  ).catch((err) =>
    logger.error(
      `[notification] Failed to queue course welcome for order ${orderId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    ),
  );

  queueNotification(
    { type: "tenant-purchase-alert", tenantId, orderId, memberId, orderType },
    {
      jobId: `tenant-purchase-${orderId}`,
      delay: TENANT_PURCHASE_ALERT_DELAY_MS,
    },
  ).catch((err) =>
    logger.error(
      `[notification] Failed to queue tenant purchase alert for order ${orderId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    ),
  );
}
