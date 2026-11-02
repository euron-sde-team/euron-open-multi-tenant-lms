/**
 * Multi-currency pricing: a tenant with INR (default, India) and USD (rest of world),
 * a course priced in both through admin-api. The currency context follows the buyer's
 * country, checkout charges the requested currency, and once USD is disabled a USD
 * request falls back to the default currency.
 *
 * learner-api caches a tenant's currency config for 60 s, so the disabled-currency case
 * uses its own tenant, configured before learner-api ever reads it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLearner, createTenant, grant, type Tenant } from "../../../admin-api/tests/integration/support/fixtures";
import { connectGateway } from "../../../admin-api/tests/integration/support/flows";
import { call, startStack, type Stack } from "../../../admin-api/tests/integration/support/stack";

let stack: Stack;

beforeAll(async () => {
  stack = await startStack();
});
afterAll(() => stack?.stop());

const BOTH = [
  { currency: "INR", is_default: true, countries: ["IN"] },
  { currency: "USD", is_default: false, countries: ["*"] },
];

async function pricedTenant(label: string) {
  const tenant = await createTenant(stack.db, label);
  await grant(stack.db, tenant.id, { self_paced_courses_enabled: true, self_paced_courses_count: "unlimited" });
  const settings = await call(stack.admin, "PUT", "/tenant/currency-settings", { token: tenant.token, tenantId: tenant.id, body: { currencies: BOTH } });
  expect(settings.status, settings.text).toBe(200);
  await connectGateway(stack, tenant, "STRIPE");

  const created = await call(stack.admin, "POST", "/tenant/courses", {
    token: tenant.token,
    tenantId: tenant.id,
    body: {
      title: "Priced course",
      slug: `priced-${label}`,
      purchase_mode: "PAID",
      prices: [
        { currency: "INR", amount: 2999, discount: 0 },
        { currency: "USD", amount: 39, discount: 0 },
      ],
    },
  });
  expect(created.status, created.text).toBe(201);
  const courseId = created.body.data.id as string;
  const published = await call(stack.admin, "POST", `/tenant/courses/${courseId}/toggle-publish`, { token: tenant.token, tenantId: tenant.id, body: { publish: true } });
  expect(published.status, published.text).toBe(200);

  const rows = await stack.db.selectFrom("content_prices").select(["currency", "amount"]).where("tenant_id", "=", tenant.id).where("entity_id", "=", courseId).execute();
  expect(rows.map((r) => r.currency).sort()).toEqual(["INR", "USD"]);
  return { tenant, courseId };
}

const order = (tenant: Tenant, token: string, courseId: string, currency: string, country: string) =>
  call(stack.learner, "POST", "/checkout/create-order", {
    token,
    host: tenant.host,
    headers: { "cf-ipcountry": country },
    body: { order_type: "COURSE", item_id: courseId, currency },
  });

describe("multi-currency", () => {
  it("currency context follows the buyer's country; checkout charges the requested currency", async () => {
    const { tenant, courseId } = await pricedTenant(`fx-${Date.now().toString(36)}`);

    const india = await call(stack.learner, "GET", "/currency-context", { host: tenant.host, headers: { "cf-ipcountry": "IN" } });
    expect(india.status, india.text).toBe(200);
    expect(india.body.data.currency).toBe("INR");
    expect(india.body.data.default_currency).toBe("INR");
    expect(india.body.data.enabled_currencies.map((c: { code: string }) => c.code).sort()).toEqual(["INR", "USD"]);

    const us = await call(stack.learner, "GET", "/currency-context", { host: tenant.host, headers: { "cf-ipcountry": "US" } });
    expect(us.body.data.currency).toBe("USD");

    const usd = await order(tenant, (await createLearner(stack.db, tenant.id)).token, courseId, "USD", "US");
    expect(usd.status, usd.text).toBe(201);
    expect(usd.body.data.currency).toBe("USD");
    expect(usd.body.data.amount).toBe(3900);

    const inr = await order(tenant, (await createLearner(stack.db, tenant.id)).token, courseId, "INR", "IN");
    expect(inr.status, inr.text).toBe(201);
    expect(inr.body.data.currency).toBe("INR");
    expect(inr.body.data.amount).toBe(299900);

    // The gateway was asked for exactly that amount and currency.
    const session = await fetch(`${stack.stubs}/v1/checkout/sessions/${usd.body.data.gateway_order_id}`, { headers: { Authorization: "Bearer sk_test_any" } });
    const s = (await session.json()) as { amount_total: number; currency: string };
    expect(s).toMatchObject({ amount_total: 3900, currency: "usd" });

    const stored = await stack.db.selectFrom("payment_orders").select(["currency", "total_amount"]).where("id", "=", usd.body.data.order_id).executeTakeFirstOrThrow();
    expect(stored.currency).toBe("USD");
    expect(Number(stored.total_amount)).toBe(39);
  });

  it("a disabled currency falls back to the tenant default", async () => {
    const { tenant, courseId } = await pricedTenant(`fxoff-${Date.now().toString(36)}`);
    // Disable USD (a dry run first: it reports the price rows it would delete).
    const dry = await call(stack.admin, "PUT", "/tenant/currency-settings", { token: tenant.token, tenantId: tenant.id, body: { currencies: [BOTH[0]] } });
    expect(dry.status).toBe(200);
    expect(dry.body.data.requires_confirmation).toBe(true);
    const applied = await call(stack.admin, "PUT", "/tenant/currency-settings", {
      token: tenant.token,
      tenantId: tenant.id,
      body: { currencies: [{ ...BOTH[0], countries: ["*"] }], confirm_removal: true },
    });
    expect(applied.status, applied.text).toBe(200);
    expect(applied.body.data.applied).toBe(true);

    const ctx = await call(stack.learner, "GET", "/currency-context", { host: tenant.host, headers: { "cf-ipcountry": "US" } });
    expect(ctx.body.data.currency).toBe("INR");
    expect(ctx.body.data.enabled_currencies.map((c: { code: string }) => c.code)).toEqual(["INR"]);

    const res = await order(tenant, (await createLearner(stack.db, tenant.id)).token, courseId, "USD", "US");
    expect(res.status, res.text).toBe(201);
    expect(res.body.data.currency).toBe("INR");
    expect(res.body.data.amount).toBe(299900);
  });
});
