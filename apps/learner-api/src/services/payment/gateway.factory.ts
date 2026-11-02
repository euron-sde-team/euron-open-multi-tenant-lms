import logger from "../../utils/logger";
import { findActiveByTenantId, findById } from "../../repositories/tenant-gateway-connections.repository";
import type { ActiveConnectionRow } from "../../repositories/tenant-gateway-connections.repository";
import { openSecret } from "../../utils/crypto";
import type { PaymentGatewayAdapter } from "./adapters/gateway.interface";
import { RazorpayAdapter } from "./adapters/razorpay.adapter";
import { RazorpaySubscriptionAdapter } from "./adapters/razorpay-subscription.adapter";
import type { SubscriptionGatewayAdapter } from "./adapters/subscription-gateway.interface";
import { StripeAdapter } from "./adapters/stripe.adapter";
import type { ResolvedConnection } from "./payment-gateway.types";

/**
 * Read the stored credentials. admin-api writes
 * `credentials_encrypted = { cipher: sealSecret(JSON.stringify(credentials)) }`
 * (AES-256-GCM, `enc:v1:` prefix, key CREDENTIALS_ENCRYPTION_KEY).
 */
function openStoredCredentials(enc: unknown): Record<string, string> {
  const cipher =
    typeof enc === "string"
      ? enc
      : enc && typeof enc === "object" && typeof (enc as { cipher?: unknown }).cipher === "string"
        ? (enc as { cipher: string }).cipher
        : null;
  if (!cipher) {
    logger.error("Gateway connection has no stored credentials");
    throw new Error("Payment service is not properly configured. Please contact support.");
  }
  try {
    const parsed = JSON.parse(openSecret(cipher)) as unknown;
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    return parsed as Record<string, string>;
  } catch {
    logger.error("Gateway connection credentials could not be opened");
    throw new Error("Payment service is not properly configured. Please contact support.");
  }
}

/**
 * Build a ResolvedConnection from a DB row by opening its sealed credentials.
 * Only tenant-owned (SELF_MANAGED) connections are supported: the platform
 * never collects money on a tenant's behalf.
 */
function buildResolvedConnection(row: ActiveConnectionRow): ResolvedConnection {
  const providerName = row.billing_provider_name.toUpperCase();
  if (row.mode !== "SELF_MANAGED") {
    logger.error(`Unsupported gateway mode ${row.mode} for connection ${row.id}`);
    throw new Error("Payment service is not available. Please contact support.");
  }
  return {
    connection_id: row.id,
    tenant_id: row.tenant_id,
    provider_name: providerName,
    mode: "SELF_MANAGED",
    credentials: openStoredCredentials(row.credentials_encrypted),
  };
}

/**
 * Resolve the active gateway connection for a tenant.
 */
export async function resolveConnection(tenantId: string): Promise<ResolvedConnection | null> {
  const row = await findActiveByTenantId(tenantId);
  if (!row) return null;
  return buildResolvedConnection(row);
}

/**
 * Resolve a specific gateway connection by ID.
 * Used by webhooks/fulfillment to get the exact connection that processed the order,
 * rather than the currently active one (which may have changed since the order was created).
 */
export async function resolveConnectionById(connectionId: string): Promise<ResolvedConnection | null> {
  const row = await findById(connectionId);
  if (!row) return null;
  return buildResolvedConnection(row);
}

/**
 * Get the payment gateway adapter for a resolved connection.
 */
export function getAdapter(connection: ResolvedConnection): PaymentGatewayAdapter {
  const { provider_name: name, credentials } = connection;
  if (name === "RAZORPAY") {
    const keyId = credentials.key_id;
    const keySecret = credentials.key_secret;
    if (!keyId || !keySecret) {
      logger.error("Razorpay key_id and key_secret required");
      throw new Error("Payment service is not available. Please contact support.");
    }
    return new RazorpayAdapter({
      key_id: keyId,
      key_secret: keySecret,
      webhook_secret: credentials.webhook_secret,
    });
  }
  if (name === "STRIPE") {
    const secretKey = credentials.secret_key;
    const webhookSecret = credentials.webhook_secret;
    if (!secretKey || !webhookSecret) {
      // The webhook secret is as load-bearing as the API key: without it we
      // cannot tell a real payment notification from a forged one, so a
      // connection missing it must not be allowed to take money.
      logger.error("Stripe secret_key and webhook_secret required");
      throw new Error("Payment service is not available. Please contact support.");
    }
    return new StripeAdapter({
      secret_key: secretKey,
      webhook_secret: webhookSecret,
      publishable_key: credentials.publishable_key,
    });
  }
  logger.error(`Unsupported payment provider: ${name}`);
  throw new Error("Payment service is not available. Please contact support.");
}

/**
 * Get the subscription gateway adapter for a resolved connection.
 * Only SELF_MANAGED connections are supported for subscriptions.
 */
export function getSubscriptionAdapter(connection: ResolvedConnection): SubscriptionGatewayAdapter {
  const { provider_name: name, credentials } = connection;
  if (name === "RAZORPAY") {
    const keyId = credentials.key_id;
    const keySecret = credentials.key_secret;
    if (!keyId || !keySecret) {
      logger.error("Razorpay key_id and key_secret required for subscription adapter");
      throw new Error("Payment service is not available. Please contact support.");
    }
    return new RazorpaySubscriptionAdapter({ key_id: keyId, key_secret: keySecret });
  }
  logger.error(`Subscription not supported for provider: ${name}`);
  throw new Error("Subscription service is not available for this payment provider.");
}
