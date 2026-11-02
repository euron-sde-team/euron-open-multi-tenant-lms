import config from "../../config";
import logger from "../../utils/logger";
import type { BillingGatewayAdapter } from "./adapters/billing-gateway.interface";
import { RazorpayBillingAdapter } from "./adapters/razorpay.adapter";
import { StripeBillingAdapter } from "./adapters/stripe.adapter";

export type BillingProviderName = "RAZORPAY" | "STRIPE";

/**
 * Get the billing gateway adapter for platform subscription billing.
 * Uses NODE_ENV-based credentials from config.
 */
export function getBillingGatewayAdapter(
  provider: BillingProviderName = "RAZORPAY"
): BillingGatewayAdapter {
  if (provider === "RAZORPAY") {
    const keyId = config.CORE_RAZORPAY_KEY_ID;
    const keySecret = config.CORE_RAZORPAY_KEY_SECRET;
    const webhookSecret = config.CORE_RAZORPAY_WEBHOOK_SECRET;
    if (!keyId || !keySecret) {
      logger.error("Core Razorpay credentials not configured for platform billing");
      throw new Error("Payment service is not available. Please contact support.");
    }
    return new RazorpayBillingAdapter({
      key_id: keyId,
      key_secret: keySecret,
      webhook_secret: webhookSecret,
    });
  }
  if (provider === "STRIPE") {
    const secretKey = config.CORE_STRIPE_SECRET_KEY;
    const webhookSecret = config.CORE_STRIPE_WEBHOOK_SECRET;
    const publishableKey = config.CORE_STRIPE_PUBLISHABLE_KEY;
    if (!secretKey || !webhookSecret) {
      logger.error("Core Stripe credentials not configured for platform billing");
      throw new Error("Payment service is not available. Please contact support.");
    }
    return new StripeBillingAdapter({
      secret_key: secretKey,
      webhook_secret: webhookSecret,
      publishable_key: publishableKey,
    });
  }
  throw new Error(`Unsupported billing provider: ${provider}`);
}
