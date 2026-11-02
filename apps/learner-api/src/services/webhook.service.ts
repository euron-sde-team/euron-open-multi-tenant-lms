import { verifyRazorpayWebhookSignature } from "./payment/adapters/razorpay.adapter";
import { isStripePaidEvent } from "./payment/adapters/stripe.adapter";
import { resolveConnectionById, getAdapter } from "./payment/gateway.factory";
import { order_status } from "../db/enums";
import * as ordersRepo from "../repositories/orders.repository";
import * as webhookEventsRepo from "../repositories/payment-webhook-events.repository";
import tenantUserSubscriptionsRepo from "../repositories/tenant-user-subscriptions.repository";
import { queueWebhookFulfillment } from "../queues/webhook-fulfillment.queue";
import { chargeMatchesOrder } from "./payment/order-match";
import userSubscriptionService from "./user-subscription.service";
import logger from "../utils/logger";

const RAZORPAY_SIGNATURE_HEADER = "x-razorpay-signature";

export function getRawBodyAsString(req: { body: Buffer | string }): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return "";
}

export function getRazorpaySignature(req: { headers: Record<string, string | string[] | undefined> }): string {
  const v = req.headers[RAZORPAY_SIGNATURE_HEADER];
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

/**
 * Process Razorpay webhook: verify signature, idempotency, then handle payment.captured.
 * Returns true if processed (or duplicate), false if signature invalid or order not found.
 */
export async function handleRazorpayWebhook(rawBody: string, signature: string): Promise<{
  ok: boolean;
  duplicate?: boolean;
  error?: string;
}> {
  if (!signature) {
    logger.warn("[webhook] Rejected: missing x-razorpay-signature header");
    return { ok: false, error: "Missing signature" };
  }

  let payload: {
    id?: string;
    event?: string;
    payload?: {
      payment?: {
        entity?: { id: string; order_id?: string; subscription_id?: string; amount?: number; currency?: string };
      };
      subscription?: { entity?: { id: string } };
    };
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    logger.warn("[webhook] Rejected: invalid JSON body");
    return { ok: false, error: "Invalid JSON" };
  }

  const eventType = payload.event ?? "";
  const eventId = payload.id ?? `evt-${Date.now()}`;

  logger.info(`[webhook] Received event=${eventType} id=${eventId}`);

  // ─── Subscription events ────────────────────────────────────────────────
  if (eventType.startsWith("subscription.")) {
    return handleSubscriptionEvent(rawBody, signature, eventType, payload);
  }

  // ─── Payment events for subscriptions (not orders) ──────────────────────
  // Razorpay sends payment.authorized/captured for subscription charges too.
  // These don't have a matching order_id in our system. Acknowledge them
  // gracefully to prevent Razorpay retries.
  const paymentEntity = payload.payload?.payment?.entity;
  if (paymentEntity?.subscription_id) {
    logger.info(
      `[webhook] Acknowledging subscription payment event: event=${eventType} payment_id=${paymentEntity.id} subscription_id=${paymentEntity.subscription_id}`
    );
    return { ok: true };
  }

  const paymentId = paymentEntity?.id;
  const gatewayOrderId = paymentEntity?.order_id;

  if (!gatewayOrderId) {
    logger.warn(`[webhook] Rejected: missing order_id in payload for event=${eventType} payment_id=${paymentId ?? "none"}`);
    return { ok: false, error: "Missing order_id in payload" };
  }

  // ─── Regular product orders ─────────────────────────────────────────────────
  const order = await ordersRepo.findOrderByGatewayOrderIdAnyTenant(gatewayOrderId);
  if (!order) {
    // Razorpay auto-creates internal orders for subscription charges. These orders
    // don't exist in our payment_orders table, the subscription.* events handle the
    // business logic. Acknowledge gracefully to prevent Razorpay retries (48h).
    logger.info(
      `[webhook] Acknowledging unmatched order: gateway_order_id=${gatewayOrderId} event=${eventType} ` +
      `subscription_id=${paymentEntity?.subscription_id ?? "none"} (likely subscription charge, no action needed)`
    );
    return { ok: true };
  }

  // A gateway-less order is settled inline at creation and never has a
  // gateway_order_id, so no webhook can legitimately reference one. Reject
  // rather than resolve, so a spoofed or misrouted callback cannot latch
  // onto a zero-payable order.
  if (!order.gateway_connection_id) {
    logger.warn(`[webhook] Rejected: order=${order.id} tenant=${order.tenant_id} was settled without a gateway`);
    return { ok: false, error: "Order has no gateway connection" };
  }

  const connection = await resolveConnectionById(order.gateway_connection_id);
  if (!connection) {
    logger.warn(`[webhook] Rejected: no gateway connection for tenant=${order.tenant_id} order=${order.id} connection=${order.gateway_connection_id}`);
    return { ok: false, error: "No gateway connection" };
  }

  const webhookSecret = connection.credentials.webhook_secret ?? connection.credentials.key_secret;
  if (!webhookSecret) {
    logger.warn(`[webhook] Rejected: no webhook secret configured for tenant=${order.tenant_id} connection=${connection.connection_id}`);
    return { ok: false, error: "Webhook secret not configured" };
  }

  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    logger.warn(`[webhook] Rejected: invalid signature for order=${order.id} tenant=${order.tenant_id}`);
    return { ok: false, error: "Invalid signature" };
  }

  const insertedId = await webhookEventsRepo.insertEventIfNew(
    order.tenant_id,
    order.gateway_connection_id,
    "RAZORPAY",
    eventType,
    eventId,
    payload
  );

  if (!insertedId) {
    logger.info(`[webhook] Duplicate event=${eventId} for order=${order.id}`);
    return { ok: true, duplicate: true };
  }

  if (eventType === "payment.captured") {
    // Check if fulfillment was already completed (by a previous webhook delivery)
    const orderMeta = await ordersRepo.getOrderMetadata(order.tenant_id, order.id);
    if (orderMeta?.fulfilled === true) {
      logger.info(`[webhook] Order ${order.id} already fulfilled, skipping`);
      await webhookEventsRepo.markProcessed(eventId, order.tenant_id);
      return { ok: true };
    }

    // A valid signature proves Razorpay sent this, not that it paid this order
    // in full. A short or other-currency capture leaves the order unpaid; the
    // event is acknowledged (retrying cannot change the amount) and logged.
    if (!chargeMatchesOrder(order, paymentEntity?.amount, paymentEntity?.currency)) {
      logger.error(
        `[webhook] Charge mismatch for order=${order.id} tenant=${order.tenant_id}: captured ` +
          `${paymentEntity?.amount ?? "none"} ${paymentEntity?.currency ?? "none"}, order ${order.total_amount} ${order.currency}; left unpaid`
      );
      await webhookEventsRepo.markProcessed(eventId, order.tenant_id);
      return { ok: true };
    }

    // Mark PAID if not already (fast, single UPDATE, stays in request cycle)
    if (order.status !== order_status.PAID) {
      await ordersRepo.updateOrderToPaid(order.tenant_id, order.id, paymentId ?? "", null);
      logger.info(`[webhook] Order ${order.id} marked PAID`);
    }

    // Queue fulfillment asynchronously to avoid webhook timeout
    await queueWebhookFulfillment({
      tenantId: order.tenant_id,
      orderId: order.id,
      eventId,
      paymentId: paymentId ?? "",
      eventType,
      orderType: order.order_type,
      source: "WEBHOOK",
    });
    logger.info(`[webhook] Queued fulfillment for order ${order.id}`);
  } else {
    await webhookEventsRepo.markProcessed(eventId, order.tenant_id);
  }

  return { ok: true };
}

/**
 * Handle Razorpay subscription webhook events (subscription.authenticated, .activated, etc.)
 * These have a different payload structure: payload.subscription.entity instead of payload.payment.entity
 */
async function handleSubscriptionEvent(
  rawBody: string,
  signature: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const subscriptionEntity = (payload as any)?.payload?.subscription?.entity;
  if (!subscriptionEntity?.id) {
    logger.warn(`[webhook:sub] Rejected: missing subscription entity in payload for event=${eventType}`);
    return { ok: false, error: "Missing subscription entity in payload" };
  }

  const gatewaySubId = subscriptionEntity.id as string;
  logger.info(`[webhook:sub] Processing event=${eventType} gateway_subscription_id=${gatewaySubId}`);

  // Look up the subscription to find the tenant
  const sub = await tenantUserSubscriptionsRepo.findByGatewaySubscriptionId(gatewaySubId);
  if (!sub) {
    logger.warn(`[webhook:sub] Rejected: subscription not found for gateway_subscription_id=${gatewaySubId}`);
    return { ok: false, error: "Subscription not found" };
  }

  logger.info(
    `[webhook:sub] Found subscription: id=${sub.id} tenant=${sub.tenant_id} member=${sub.member_id} current_status=${sub.status}`
  );

  // Verify signature using the connection that created the subscription
  const connection = await resolveConnectionById(sub.gateway_connection_id);
  if (!connection) {
    logger.warn(`[webhook:sub] Rejected: no gateway connection for tenant=${sub.tenant_id} connection=${sub.gateway_connection_id}`);
    return { ok: false, error: "No gateway connection for tenant" };
  }

  const webhookSecret = connection.credentials.webhook_secret ?? connection.credentials.key_secret;
  if (!webhookSecret) {
    logger.warn(
      `[webhook:sub] Rejected: no webhook secret configured for tenant=${sub.tenant_id} connection=${connection.connection_id} ` +
      `(has webhook_secret=${!!connection.credentials.webhook_secret}, has key_secret=${!!connection.credentials.key_secret})`
    );
    return { ok: false, error: "Webhook secret not configured" };
  }

  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    logger.warn(
      `[webhook:sub] Rejected: invalid signature for subscription=${sub.id} tenant=${sub.tenant_id} ` +
      `(secret_source=${connection.credentials.webhook_secret ? "webhook_secret" : "key_secret"}, ` +
      `secret_len=${webhookSecret.length}, sig_len=${signature.length})`
    );
    return { ok: false, error: "Invalid signature" };
  }

  const eventId = (payload as any).id ?? `sub-${eventType}-${Date.now()}`;
  logger.info(`[webhook:sub] Signature verified. Dispatching event=${eventType} eventId=${eventId} to subscription service`);

  // Delegate to subscription service for stateful handling
  try {
    await userSubscriptionService.handleSubscriptionWebhook(
      sub.tenant_id,
      connection.connection_id,
      eventType,
      eventId,
      payload
    );
    logger.info(`[webhook:sub] Successfully handled event=${eventType} for subscription=${sub.id}`);
  } catch (err) {
    logger.error(`[webhook:sub] Error handling event=${eventType} for subscription=${sub.id}:`, err);
    // Still return ok=true to Razorpay to prevent retries for application-level errors
  }

  return { ok: true };
}

// ───────────────────────────────────────────────────────────────────────────
// Stripe
// ───────────────────────────────────────────────────────────────────────────

/**
 * Handle a Stripe Checkout webhook.
 *
 * Ordering note: the body is parsed BEFORE the signature is checked, which looks
 * backwards but is forced by the design. Signatures are per-tenant (each tenant
 * brings their own webhook secret), so we have to read the session id out of the
 * body to find the order, and the order to find the connection, before we can
 * know which secret to verify against. Nothing is acted on until parseWebhook
 * has verified; an unverified body is only ever used to look something up.
 *
 * Events handled:
 *   checkout.session.completed               - the normal path
 *   checkout.session.async_payment_succeeded - delayed methods (bank debits)
 *   checkout.session.async_payment_failed    - the same, having failed
 * Anything else is acknowledged so Stripe stops retrying it.
 */
export async function handleStripeWebhook(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  if (!rawBody) {
    logger.warn("[webhook:stripe] Rejected: empty body");
    return { ok: false, error: "Empty body" };
  }

  let unverified: {
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        payment_intent?: string | null;
        amount_total?: number | null;
        currency?: string | null;
      };
    };
  };
  try {
    unverified = JSON.parse(rawBody) as typeof unverified;
  } catch {
    logger.warn("[webhook:stripe] Rejected: invalid JSON body");
    return { ok: false, error: "Invalid JSON" };
  }

  const sessionId = unverified.data?.object?.id;
  const eventType = unverified.type ?? "unknown";

  if (!sessionId) {
    logger.warn(`[webhook:stripe] Rejected: no session id on event=${eventType}`);
    return { ok: false, error: "Missing session id" };
  }

  logger.info(`[webhook:stripe] Received event=${eventType} session=${sessionId}`);

  const order = await ordersRepo.findOrderByGatewayOrderIdAnyTenant(sessionId);
  if (!order) {
    // Not an error: the same Stripe account may be used for things this service
    // does not own. Acknowledge so Stripe stops retrying for 3 days.
    logger.info(`[webhook:stripe] Acknowledging unmatched session=${sessionId} event=${eventType}`);
    return { ok: true };
  }

  if (!order.gateway_connection_id) {
    // The order was not placed through a tenant gateway connection (e.g. a
    // free/wallet order), so a gateway webhook cannot belong to it. Acknowledge
    // to stop retries.
    logger.info(`[webhook:stripe] Acknowledging order=${order.id} with no gateway connection`);
    return { ok: true };
  }

  const connection = await resolveConnectionById(order.gateway_connection_id);
  if (!connection || connection.provider_name !== "STRIPE") {
    logger.warn(
      `[webhook:stripe] Rejected: connection mismatch for order=${order.id} provider=${connection?.provider_name ?? "none"}`
    );
    return { ok: false, error: "Connection not Stripe" };
  }

  // Verifies the Stripe-Signature header, including its replay-window check.
  let parsed;
  try {
    parsed = await getAdapter(connection).parseWebhook(headers, rawBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    logger.warn(`[webhook:stripe] Rejected: ${message} for order=${order.id} tenant=${order.tenant_id}`);
    return { ok: false, error: "Invalid signature" };
  }

  const insertedId = await webhookEventsRepo.insertEventIfNew(
    order.tenant_id,
    order.gateway_connection_id,
    "STRIPE",
    parsed.event_type,
    parsed.event_id,
    parsed.payload
  );
  if (!insertedId) {
    logger.info(`[webhook:stripe] Duplicate event=${parsed.event_id} for order=${order.id}`);
    return { ok: true, duplicate: true };
  }

  if (isStripePaidEvent(parsed.event_type)) {
    // checkout.session.completed also fires for delayed payment methods where no
    // money has moved yet. "not unpaid" rather than "is paid" is Stripe's own
    // guidance: a fully-discounted session settles as no_payment_required.
    const paymentStatus = unverified.data?.object?.payment_status;
    if (paymentStatus === "unpaid") {
      logger.info(
        `[webhook:stripe] Session ${sessionId} completed but still unpaid (delayed method); awaiting async_payment_succeeded`
      );
      await webhookEventsRepo.markProcessed(parsed.event_id, order.tenant_id);
      return { ok: true };
    }

    const orderMeta = await ordersRepo.getOrderMetadata(order.tenant_id, order.id);
    if (orderMeta?.fulfilled === true) {
      logger.info(`[webhook:stripe] Order ${order.id} already fulfilled, skipping`);
      await webhookEventsRepo.markProcessed(parsed.event_id, order.tenant_id);
      return { ok: true };
    }

    // Same rule as Razorpay: the session must have charged exactly this order.
    const session = unverified.data?.object;
    if (!chargeMatchesOrder(order, session?.amount_total, session?.currency)) {
      logger.error(
        `[webhook:stripe] Charge mismatch for order=${order.id} tenant=${order.tenant_id}: session ` +
          `${session?.amount_total ?? "none"} ${session?.currency ?? "none"}, order ${order.total_amount} ${order.currency}; left unpaid`
      );
      await webhookEventsRepo.markProcessed(parsed.event_id, order.tenant_id);
      return { ok: true };
    }

    const paymentIntent = unverified.data?.object?.payment_intent ?? "";
    if (order.status !== order_status.PAID) {
      await ordersRepo.updateOrderToPaid(order.tenant_id, order.id, paymentIntent, null);
      logger.info(`[webhook:stripe] Order ${order.id} marked PAID`);
    }

    await queueWebhookFulfillment({
      tenantId: order.tenant_id,
      orderId: order.id,
      eventId: parsed.event_id,
      paymentId: paymentIntent,
      eventType: parsed.event_type,
      orderType: order.order_type,
      source: "WEBHOOK",
    });
    logger.info(`[webhook:stripe] Queued fulfillment for order ${order.id}`);
    return { ok: true };
  }

  if (
    parsed.event_type === "checkout.session.async_payment_failed" ||
    parsed.event_type === "checkout.session.expired"
  ) {
    if (order.status === order_status.PAYMENT_PENDING || order.status === order_status.CREATED) {
      await ordersRepo.updateOrderToFailed(
        order.tenant_id,
        order.id,
        parsed.event_type === "checkout.session.expired"
          ? "Stripe checkout session expired"
          : "Stripe reported the payment failed"
      );
      logger.info(`[webhook:stripe] Order ${order.id} marked FAILED`);
    }
  }

  await webhookEventsRepo.markProcessed(parsed.event_id, order.tenant_id);
  return { ok: true };
}
