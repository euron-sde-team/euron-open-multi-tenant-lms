/**
 * Platform billing webhooks on admin-api (/api/v1/webhook/{stripe,razorpay}/subscription):
 * a correctly signed activation event creates the tenant's ACTIVE subscription and
 * snapshots its plan into entitlements; the same event_id again changes nothing; a bad
 * (or, for Stripe, stale) signature is refused with 400 and nothing is stored.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { razorpayWebhookSignature, stripeSignatureHeader } from "../../../stubs/src/signatures.ts";
import { createTenant, short, type Tenant } from "./support/fixtures";
import { call, startStack, TEST_SECRETS, type Stack } from "./support/stack";

let stack: Stack;
let planVersionId: string;

beforeAll(async () => {
  stack = await startStack();
  const v = await stack.db
    .selectFrom("plan_versions")
    .innerJoin("plans", "plans.id", "plan_versions.plan_id")
    .select("plan_versions.id")
    .where("plans.code", "=", "starter")
    .where("plan_versions.is_active", "=", true)
    .executeTakeFirstOrThrow();
  planVersionId = v.id;
});
afterAll(() => stack?.stop());

type Provider = "stripe" | "razorpay";

function activationEvent(provider: Provider, tenant: Tenant, externalSubId: string, eventId: string): string {
  const notes = { tenant_id: tenant.id, plan_version_id: planVersionId, billing_cycle: "MONTHLY", currency: "USD" };
  const now = Math.floor(Date.now() / 1000);
  if (provider === "stripe") {
    return JSON.stringify({
      id: eventId,
      object: "event",
      type: "customer.subscription.created",
      created: now,
      data: { object: { id: externalSubId, object: "subscription", status: "active", metadata: notes, current_period_start: now, current_period_end: now + 30 * 86400 } },
    });
  }
  return JSON.stringify({
    entity: "event",
    id: eventId,
    event: "subscription.activated",
    created_at: now,
    payload: { subscription: { entity: { id: externalSubId, entity: "subscription", status: "active", notes, current_start: now, current_end: now + 30 * 86400 } } },
  });
}

function signatureHeaders(provider: Provider, body: string, opts: { forge?: boolean; timestamp?: number } = {}): Record<string, string> {
  if (provider === "stripe") {
    const secret = opts.forge ? "whsec_not_the_platform_secret" : TEST_SECRETS.platformStripeWebhookSecret;
    return { "stripe-signature": stripeSignatureHeader(body, secret, opts.timestamp) };
  }
  const secret = opts.forge ? "not_the_platform_secret" : TEST_SECRETS.platformRazorpayWebhookSecret;
  return { "x-razorpay-signature": razorpayWebhookSignature(body, secret) };
}

const deliver = (provider: Provider, body: string, headers: Record<string, string>) =>
  call(stack.admin, "POST", `/webhook/${provider}/subscription`, { raw: body, headers });

describe.each<Provider>(["stripe", "razorpay"])("%s platform billing webhook", (provider) => {
  it("a signed activation event activates the subscription; a duplicate event_id is ignored", async () => {
    const tenant = await createTenant(stack.db, `bill-${provider}`);
    await stack.db.updateTable("tenants").set({ status: "PENDING" }).where("id", "=", tenant.id).execute();
    const externalSubId = `sub_${short()}${short()}`;
    const eventId = `evt_${short()}${short()}`;
    const body = activationEvent(provider, tenant, externalSubId, eventId);

    const first = await deliver(provider, body, signatureHeaders(provider, body));
    expect(first.status, first.text).toBe(200);

    const subs = () => stack.db.selectFrom("subscriptions").selectAll().where("tenant_id", "=", tenant.id).execute();
    const created = await subs();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ status: "ACTIVE", external_subscription_id: externalSubId, plan_version_id: planVersionId, billing_provider_name: provider.toUpperCase() });

    const tenantRow = await stack.db.selectFrom("tenants").select("status").where("id", "=", tenant.id).executeTakeFirstOrThrow();
    expect(tenantRow.status).toBe("ACTIVE");

    const ents = () => stack.db.selectFrom("entitlements").select(["id", "product_code"]).where("tenant_id", "=", tenant.id).where("is_active", "=", true).execute();
    const planProducts = await stack.db.selectFrom("plan_version_products").select("id").where("plan_version_id", "=", planVersionId).execute();
    const entsBefore = await ents();
    expect(entsBefore).toHaveLength(planProducts.length);

    const hook = await stack.db.selectFrom("billing_webhooks").select(["status"]).where("event_id", "=", eventId).execute();
    expect(hook).toEqual([{ status: "COMPLETED" }]);

    // Same event delivered again (a gateway retry), freshly signed.
    const again = await deliver(provider, body, signatureHeaders(provider, body));
    expect(again.status).toBe(200);
    expect(await subs()).toEqual(created);
    expect((await ents()).map((e) => e.id).sort()).toEqual(entsBefore.map((e) => e.id).sort());
    expect(await stack.db.selectFrom("billing_webhooks").select("id").where("event_id", "=", eventId).execute()).toHaveLength(1);
  });

  it("refuses a bad signature with 400 and stores nothing", async () => {
    const tenant = await createTenant(stack.db, `billbad-${provider}`);
    const eventId = `evt_${short()}${short()}`;
    const body = activationEvent(provider, tenant, `sub_${short()}`, eventId);

    const forged = await deliver(provider, body, signatureHeaders(provider, body, { forge: true }));
    expect(forged.status).toBe(400);
    const missing = await deliver(provider, body, {});
    expect(missing.status).toBe(400);
    // A valid signature over a different body does not carry over.
    const tampered = await deliver(provider, body.replace(planVersionId, "01TAMPEREDPLANVERSION00000"), signatureHeaders(provider, body));
    expect(tampered.status).toBe(400);

    expect(await stack.db.selectFrom("billing_webhooks").select("id").where("event_id", "=", eventId).execute()).toHaveLength(0);
    expect(await stack.db.selectFrom("subscriptions").select("id").where("tenant_id", "=", tenant.id).execute()).toHaveLength(0);
  });

  if (provider === "stripe") {
    it("refuses a correctly signed but stale delivery (replay window)", async () => {
      const tenant = await createTenant(stack.db, "billold-stripe");
      const body = activationEvent("stripe", tenant, `sub_${short()}`, `evt_${short()}`);
      const stale = await deliver("stripe", body, signatureHeaders("stripe", body, { timestamp: Math.floor(Date.now() / 1000) - 3600 }));
      expect(stale.status).toBe(400);
      expect(await stack.db.selectFrom("subscriptions").select("id").where("tenant_id", "=", tenant.id).execute()).toHaveLength(0);
    });
  }
});
