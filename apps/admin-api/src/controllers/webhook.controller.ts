import { Request, Response } from "express";
import { db } from "../db/connection";
import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { findProviderByName } from "../repositories/billing-providers.repository";
import subscriptionBillingService from "../services/billing/subscription-billing.service";
import { getBillingGatewayAdapter } from "../services/billing/billing-gateway.factory";
import logger from "../utils/logger";

const RAZORPAY_SIGNATURE_HEADER = "x-razorpay-signature";
const STRIPE_SIGNATURE_HEADER = "stripe-signature";

/**
 * Razorpay subscription webhook handler.
 * Expects raw body (Buffer) for signature verification.
 * Idempotent via billing_webhooks event_id.
 */
export const razorpaySubscriptionWebhook = async (
  req: Request,
  res: Response
) => {
  logger.info(
    `Razorpay webhook received: hasBody=${!!req.body} bodyType=${req.body?.constructor?.name ?? "n/a"} contentType=${req.headers["content-type"] ?? "n/a"}`
  );
  const rawBody = req.body;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    throw new BadRequestError("Invalid webhook body");
  }
  const bodyStr = rawBody.toString("utf8");

  const signature = req.headers[RAZORPAY_SIGNATURE_HEADER] as string | undefined;
  if (!signature) {
    throw new BadRequestError("Missing Razorpay signature");
  }

  const adapter = getBillingGatewayAdapter("RAZORPAY");
  if (!adapter.verifyWebhookSignature(bodyStr, signature)) {
    throw new BadRequestError("Invalid webhook signature");
  }

  const parsed = adapter.parseWebhookPayload(bodyStr);
  const { event, event_id } = parsed;
  logger.info(`Razorpay webhook parsed: event=${event} event_id=${event_id}`);

  const provider = await findProviderByName("RAZORPAY");
  if (!provider) {
    throw new BadRequestError("Razorpay provider not configured");
  }

  const now = new Date();
  try {
    await db
      .insertInto("billing_webhooks")
      .values({
        id: ulid(),
        billing_provider_id: provider.id,
        event_type: event,
        event_id,
        payload: JSON.parse(bodyStr) as unknown as Record<string, unknown>,
        status: "PENDING",
        created_at: now,
      })
      .execute();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      res.status(200).json({ received: true });
      return;
    }
    throw err;
  }

  try {
    const payload = (parsed.payload ?? {}) as Record<string, unknown>;
    await subscriptionBillingService.processWebhookEvent(event, event_id, payload);

    await db
      .updateTable("billing_webhooks")
      .set({
        status: "COMPLETED",
        processed_at: new Date(),
      })
      .where("event_id", "=", event_id)
      .execute();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Razorpay webhook processing error: ${errorMessage}`);
    await db
      .updateTable("billing_webhooks")
      .set({
        status: "FAILED",
        error_message: errorMessage,
      })
      .where("event_id", "=", event_id)
      .execute();
  }

  res.status(200).json({ received: true });
};

/**
 * Stripe subscription webhook handler.
 * Expects raw body (Buffer) for signature verification.
 * Idempotent via billing_webhooks event_id.
 */
export const stripeSubscriptionWebhook = async (
  req: Request,
  res: Response
) => {
  logger.info(
    `Stripe webhook received: hasBody=${!!req.body} bodyType=${req.body?.constructor?.name ?? "n/a"} contentType=${req.headers["content-type"] ?? "n/a"}`
  );
  const rawBody = req.body;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    throw new BadRequestError("Invalid webhook body");
  }
  const bodyStr = rawBody.toString("utf8");

  const signature = req.headers[STRIPE_SIGNATURE_HEADER] as string | undefined;
  if (!signature) {
    throw new BadRequestError("Missing Stripe signature");
  }

  const adapter = getBillingGatewayAdapter("STRIPE");
  if (!adapter.verifyWebhookSignature(bodyStr, signature)) {
    throw new BadRequestError("Invalid webhook signature");
  }

  const parsed = adapter.parseWebhookPayload(bodyStr);
  const { event, event_id } = parsed;
  logger.info(`Stripe webhook parsed: event=${event} event_id=${event_id}`);

  const provider = await findProviderByName("STRIPE");
  if (!provider) {
    throw new BadRequestError("Stripe provider not configured");
  }

  const now = new Date();
  try {
    await db
      .insertInto("billing_webhooks")
      .values({
        id: ulid(),
        billing_provider_id: provider.id,
        event_type: event,
        event_id,
        payload: JSON.parse(bodyStr) as unknown as Record<string, unknown>,
        status: "PENDING",
        created_at: now,
      })
      .execute();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      res.status(200).json({ received: true });
      return;
    }
    throw err;
  }

  try {
    // The adapter translated the Stripe event into the subscription.* events
    // the billing service handles; anything else is stored for audit only.
    if (event.startsWith("subscription.")) {
      const payload = (parsed.payload ?? {}) as Record<string, unknown>;
      await subscriptionBillingService.processWebhookEvent(event, event_id, payload, "STRIPE");
    } else {
      logger.info(`Stripe webhook event=${event} event_id=${event_id} stored for audit`);
    }

    await db
      .updateTable("billing_webhooks")
      .set({
        status: "COMPLETED",
        processed_at: new Date(),
      })
      .where("event_id", "=", event_id)
      .execute();
  } catch (err) {
    logger.error(`Stripe webhook processing error: ${err instanceof Error ? err.message : String(err)}`);
    await db
      .updateTable("billing_webhooks")
      .set({
        status: "FAILED",
        error_message: err instanceof Error ? err.message : String(err),
      })
      .where("event_id", "=", event_id)
      .execute();
  }

  res.status(200).json({ received: true });
};
