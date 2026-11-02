import { order_status } from "../db/enums";
import * as ordersRepo from "../repositories/orders.repository";
import * as webhookEventsRepo from "../repositories/payment-webhook-events.repository";
import { resolveConnectionById, getAdapter } from "./payment/gateway.factory";
import { queueWebhookFulfillment } from "../queues/webhook-fulfillment.queue";
import { chargeMatchesOrder } from "./payment/order-match";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import { ForbiddenError } from "../errors/forbidden.error";
import logger from "../utils/logger";

/**
 * Verify and fulfill a regular product order from the payment_orders table.
 */
export async function verifyAndFulfillOrder(
  tenantId: string,
  memberId: string,
  orderId: string
): Promise<{ status: string; fulfilled: boolean }> {
  const order = await ordersRepo.findOrderById(tenantId, orderId);
  if (!order) throw new NotFoundError("Order not found");
  if (order.tenant_member_id !== memberId) {
    throw new ForbiddenError("You do not have access to this order");
  }

  // Already fulfilled
  const meta = await ordersRepo.getOrderMetadata(tenantId, orderId);
  if (meta?.fulfilled === true) {
    return { status: "PAID", fulfilled: true };
  }

  // PAID but not yet fulfilled, queue fulfillment
  if (order.status === order_status.PAID) {
    logger.info(`[payment-verification] Order ${orderId} is PAID but not fulfilled, queueing fulfillment`);
    await queueWebhookFulfillment({
      tenantId,
      orderId: order.id,
      eventId: `fallback-${order.id}`,
      paymentId: "",
      eventType: "payment.captured",
      orderType: order.order_type,
      source: "VERIFICATION_FALLBACK",
    });
    return { status: "PAID", fulfilled: false };
  }

  // PAYMENT_PENDING, check gateway for actual payment status
  if (order.status === order_status.PAYMENT_PENDING) {
    // Unreachable in practice: a gateway-less order is marked PAID at creation
    // and never enters PAYMENT_PENDING. Guarded so it can never silently pass.
    if (!order.gateway_connection_id) {
      throw new BadRequestError("Payment gateway not configured");
    }

    const connection = await resolveConnectionById(order.gateway_connection_id);
    if (!connection) {
      throw new BadRequestError("Payment gateway not configured");
    }

    const adapter = getAdapter(connection);
    if (!adapter.fetchOrderPayments || !order.gateway_order_id) {
      return { status: "PAYMENT_PENDING", fulfilled: false };
    }

    try {
      const { payments } = await adapter.fetchOrderPayments(order.gateway_order_id);
      // Only a capture of exactly the order total settles the order.
      const capturedPayment = payments.find(
        (p) => p.status === "captured" && chargeMatchesOrder(order, p.amount, p.currency)
      );
      if (!capturedPayment && payments.some((p) => p.status === "captured")) {
        logger.error(`[payment-verification] Captured payment for order ${orderId} does not match its total; left unpaid`);
      }

      if (capturedPayment) {
        logger.info(`[payment-verification] Found captured payment ${capturedPayment.id} for order ${orderId}`);

        // Mark PAID
        await ordersRepo.updateOrderToPaid(tenantId, order.id, capturedPayment.id, null);

        // Insert idempotent webhook event
        const fallbackEventId = `fallback-${order.id}`;
        await webhookEventsRepo.insertEventIfNew(
          tenantId,
          connection.connection_id,
          connection.provider_name,
          "payment.captured",
          fallbackEventId,
          { source: "verification_fallback", payment_id: capturedPayment.id }
        );

        // Queue fulfillment
        await queueWebhookFulfillment({
          tenantId,
          orderId: order.id,
          eventId: fallbackEventId,
          paymentId: capturedPayment.id,
          eventType: "payment.captured",
          orderType: order.order_type,
          source: "VERIFICATION_FALLBACK",
        });

        return { status: "PAID", fulfilled: false };
      }
    } catch (err) {
      logger.error(`[payment-verification] Failed to fetch payments from gateway: ${err}`);
    }

    return { status: "PAYMENT_PENDING", fulfilled: false };
  }

  return { status: order.status, fulfilled: false };
}
