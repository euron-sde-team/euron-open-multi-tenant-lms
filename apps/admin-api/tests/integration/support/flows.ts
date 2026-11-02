/**
 * Multi-step flows over HTTP that several specs share.
 */
import { setTimeout as sleep } from "node:timers/promises";

import { short, type Tenant } from "./fixtures";
import { call, TEST_SECRETS, type Stack } from "./stack";

export type Gateway = "STRIPE" | "RAZORPAY";

export interface GatewayCredentials {
  STRIPE: { secret_key: string; webhook_secret: string; publishable_key: string };
  RAZORPAY: { key_id: string; key_secret: string; webhook_secret: string };
}

/** Tenant gateway credentials; the webhook secrets match the ones the stubs sign with. */
export function gatewayCredentials<G extends Gateway>(gateway: G): GatewayCredentials[G] {
  const s = short();
  const creds: GatewayCredentials = {
    STRIPE: { secret_key: `sk_test_tenant_${s}`, webhook_secret: TEST_SECRETS.stubStripeWebhookSecret, publishable_key: `pk_test_tenant_${s}` },
    RAZORPAY: { key_id: `rzp_test_tenant${s}`, key_secret: `rzp_secret_tenant_${s}`, webhook_secret: TEST_SECRETS.stubRazorpayWebhookSecret },
  };
  return creds[gateway];
}

/** Connects a tenant's own Stripe or Razorpay account through admin-api (verified against the stubs). */
export async function connectGateway<G extends Gateway>(stack: Stack, tenant: Tenant, gateway: G, credentials = gatewayCredentials(gateway)) {
  const provider = await stack.db.selectFrom("billing_providers").select("id").where("name", "=", gateway).executeTakeFirstOrThrow();
  const res = await call(stack.admin, "POST", "/tenant/payment/gateway-connections", {
    token: tenant.token,
    tenantId: tenant.id,
    body: { provider_id: provider.id, mode: "SELF_MANAGED", label: `${gateway} test`, credentials, is_active: true },
  });
  if (res.status !== 201) throw new Error(`connect ${gateway}: ${res.status} ${res.text}`);
  return { connection: res.body.data, credentials, response: res };
}

/** Polls until `check` returns a truthy value (the fulfilment worker runs asynchronously). */
export async function eventually<T>(check: () => Promise<T>, { timeoutMs = 15_000, intervalMs = 100 } = {}): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  do {
    last = await check();
    if (last) return last;
    await sleep(intervalMs);
  } while (Date.now() < deadline);
  return last;
}
