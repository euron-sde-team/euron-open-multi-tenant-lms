/**
 * Signature helpers, byte-for-byte the schemes the real gateways use, so the APIs verify
 * stub traffic with exactly the code that verifies production traffic.
 *
 *   Stripe webhook      Stripe-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>
 *   Razorpay checkout   razorpay_signature = hex HMAC-SHA256(key_secret, "<order_id>|<payment_id>")
 *   Razorpay sub auth   razorpay_signature = hex HMAC-SHA256(key_secret, "<payment_id>|<subscription_id>")
 *   Razorpay webhook    X-Razorpay-Signature = hex HMAC-SHA256(webhook_secret, <raw body>)
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const hmacHex = (secret: string, payload: string): string =>
  createHmac("sha256", secret).update(payload, "utf8").digest("hex");

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]*$/i.test(a) || !/^[0-9a-f]*$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** The Stripe-Signature header value for `body` (timestamp in unix seconds). */
export function stripeSignatureHeader(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${hmacHex(secret, `${timestamp}.${body}`)}`;
}

/**
 * Verifies a Stripe-Signature header the way stripe.webhooks.constructEvent does: any v1
 * entry may match, and the timestamp must be within `toleranceSeconds` of `now`.
 */
export function verifyStripeSignature(
  body: string,
  header: string,
  secret: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
): boolean {
  const parts = header.split(",").map((p) => p.trim());
  const t = Number(parts.find((p) => p.startsWith("t="))?.slice(2));
  if (!Number.isFinite(t) || Math.abs(now - t) > toleranceSeconds) return false;
  const expected = hmacHex(secret, `${t}.${body}`);
  return parts.filter((p) => p.startsWith("v1=")).some((p) => safeEqualHex(p.slice(3), expected));
}

/** The razorpay_signature the checkout hands back after an order is paid. */
export function razorpayPaymentSignature(orderId: string, paymentId: string, keySecret: string): string {
  return hmacHex(keySecret, `${orderId}|${paymentId}`);
}

/** The razorpay_signature the checkout hands back after a subscription is authorised. */
export function razorpaySubscriptionSignature(paymentId: string, subscriptionId: string, keySecret: string): string {
  return hmacHex(keySecret, `${paymentId}|${subscriptionId}`);
}

/** The X-Razorpay-Signature header value for a webhook body. */
export function razorpayWebhookSignature(body: string, webhookSecret: string): string {
  return hmacHex(webhookSecret, body);
}

export function verifyRazorpayWebhookSignature(body: string, signature: string, webhookSecret: string): boolean {
  return safeEqualHex(signature, razorpayWebhookSignature(body, webhookSecret));
}
