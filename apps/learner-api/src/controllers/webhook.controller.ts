import type { Request, Response } from "express";
import * as webhookService from "../services/webhook.service";
import logger from "../utils/logger";

export async function razorpayWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = webhookService.getRawBodyAsString(req);
  const signature = webhookService.getRazorpaySignature(req);

  logger.info(
    `[webhook:ctrl] Incoming POST /webhooks/razorpay, body_len=${rawBody.length} has_signature=${!!signature} ip=${req.ip}`
  );

  const result = await webhookService.handleRazorpayWebhook(rawBody, signature);

  if (result.duplicate) {
    logger.info("[webhook:ctrl] Response: 200 (duplicate)");
    res.status(200).json({ received: true, duplicate: true });
    return;
  }
  if (!result.ok) {
    logger.warn(`[webhook:ctrl] Response: 400, ${result.error}`);
    res.status(400).json({ received: false, error: result.error });
    return;
  }

  logger.info("[webhook:ctrl] Response: 200 OK");
  res.status(200).json({ received: true });
}

export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = webhookService.getRawBodyAsString(req);
  logger.info(
    `[webhook:ctrl] Incoming POST /webhooks/stripe, body_len=${rawBody.length} has_signature=${!!req.headers["stripe-signature"]} ip=${req.ip}`
  );

  const result = await webhookService.handleStripeWebhook(rawBody, req.headers);

  if (result.duplicate) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }
  if (!result.ok) {
    logger.warn(`[webhook:ctrl] Stripe response: 400, ${result.error}`);
    res.status(400).json({ received: false, error: result.error });
    return;
  }
  res.status(200).json({ received: true });
}
