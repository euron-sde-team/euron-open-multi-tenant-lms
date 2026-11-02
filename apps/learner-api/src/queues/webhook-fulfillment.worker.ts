import { Worker } from "bullmq";
import config from "../config";
import { bullmqConnection } from "../lib/redis";
import type { WebhookFulfillmentJob } from "./webhook-fulfillment.queue";
import { queuePurchaseNotifications } from "./notification.queue";
import { processOrderPaidInWebhook } from "../services/checkout.service";
import { processCartOrderPaidInWebhook } from "../services/cart.service";
import * as ordersRepo from "../repositories/orders.repository";
import * as webhookEventsRepo from "../repositories/payment-webhook-events.repository";
import { resolveConnectionById } from "../services/payment/gateway.factory";
import logger from "../utils/logger";

const redisConnection = bullmqConnection;

let worker: Worker | null = null;

async function processJob(job: { data: WebhookFulfillmentJob }) {
  const { tenantId, orderId, eventId, paymentId, orderType, source } = job.data;
  logger.info(`[webhook-fulfillment] Processing ${source} fulfillment for order ${orderId}`);

  // ─── Regular product orders ─────────────────────────────────────────────────
  // Re-check fulfillment status (idempotent)
  const orderMeta = await ordersRepo.getOrderMetadata(tenantId, orderId);
  if (orderMeta?.fulfilled === true) {
    logger.info(`[webhook-fulfillment] Order ${orderId} already fulfilled, skipping`);
    return;
  }

  // Load fresh order data
  const order = await ordersRepo.findOrderById(tenantId, orderId);
  if (!order) {
    logger.error(`[webhook-fulfillment] Order ${orderId} not found`);
    return;
  }

  // Settled inline at creation with no gateway involved, so it is already
  // fulfilled and no webhook should have queued it. Return rather than throw:
  // retrying cannot make a gateway appear.
  if (!order.gateway_connection_id) {
    logger.error(`[webhook-fulfillment] Order ${orderId} has no gateway connection; it was settled without one. Skipping.`);
    return;
  }

  const connection = await resolveConnectionById(order.gateway_connection_id);
  if (!connection) {
    throw new Error(`No gateway connection ${order.gateway_connection_id} for tenant ${tenantId}`);
  }

  if (orderType === "CART") {
    await processCartOrderPaidInWebhook(
      tenantId,
      {
        id: order.id,
        tenant_member_id: order.tenant_member_id,
        coupon_id: order.coupon_id,
        tenant_payout_amount: order.tenant_payout_amount,
        net_amount: order.net_amount,
        discount_amount: order.discount_amount,
        currency: order.currency,
      },
      connection
    );
  } else {
    await processOrderPaidInWebhook(
      tenantId,
      {
        id: order.id,
        tenant_member_id: order.tenant_member_id,
        order_type: order.order_type,
        item_id: order.item_id,
        coupon_id: order.coupon_id,
        tenant_payout_amount: order.tenant_payout_amount,
        net_amount: order.net_amount,
        discount_amount: order.discount_amount,
        currency: order.currency,
      },
      paymentId,
      connection
    );
  }

  // Mark fulfillment complete
  await ordersRepo.markOrderFulfilled(tenantId, orderId);
  await webhookEventsRepo.markProcessed(eventId, tenantId);
  logger.info(`[webhook-fulfillment] Order ${orderId} fulfilled successfully via ${source}`);

  // Fire-and-forget: buyer confirmation + tenant owner alert
  queuePurchaseNotifications({
    tenantId,
    orderId: order.id,
    memberId: order.tenant_member_id,
    orderType: order.order_type,
  });
}

export function startWebhookFulfillmentWorker() {
  worker = new Worker("webhook-fulfillment", async (job) => processJob(job), {
    connection: redisConnection,
    prefix: config.BULLMQ_PREFIX,
    concurrency: 5,
  });
  worker.on("failed", (job, err) => {
    logger.error(`[webhook-fulfillment] Job ${job?.id} failed: ${err.message}`);
  });
  logger.info("[webhook-fulfillment] Worker started");
}

export function stopWebhookFulfillmentWorker(): Promise<void> {
  if (!worker) return Promise.resolve();
  return worker.close();
}
