/**
 * learner-api hardening, over HTTP against the gateway stubs:
 *
 *   - verify-payment checks the proof against the STORED gateway order: a valid
 *     Razorpay signature for one order cannot settle another pending order.
 *   - a capture (webhook or the verify fallback) whose amount or currency differs
 *     from the order total leaves the order unpaid; the webhook is still 2xx.
 *   - learners have no refund endpoint.
 *   - learner tokens: own secret, type "learner", tied to the host's tenant.
 *   - credential endpoints are rate limited per IP and per identifier.
 */
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLearner, createTenant, seedCourse, type Learner, type SeededCourse, type Tenant } from "../../../admin-api/tests/integration/support/fixtures";
import { connectGateway, eventually, type Gateway } from "../../../admin-api/tests/integration/support/flows";
import { call, startStack, type Stack } from "../../../admin-api/tests/integration/support/stack";

// Read by learner-api's config when startStack imports it, and by createLearner.
const LEARNER_SECRET = "integration-only-learner-jwt-secret-not-for-prod";
process.env.LEARNER_JWT_SECRET = LEARNER_SECRET;

let stack: Stack;
let stopWorker: () => Promise<void>;

beforeAll(async () => {
  stack = await startStack();
  const worker = await import("../../src/queues/webhook-fulfillment.worker");
  worker.startWebhookFulfillmentWorker();
  stopWorker = worker.stopWebhookFulfillmentWorker;
});
afterAll(async () => {
  await stopWorker?.();
  await stack?.stop();
});

const CURRENCY: Record<Gateway, string> = { STRIPE: "USD", RAZORPAY: "INR" };

async function createOrder(tenant: Tenant, learner: Learner, course: SeededCourse, currency: string) {
  const res = await call(stack.learner, "POST", "/checkout/create-order", {
    token: learner.token,
    host: tenant.host,
    body: { order_type: "COURSE", item_id: course.id, currency },
  });
  expect(res.status, res.text).toBe(201);
  return res.body.data as { order_id: string; gateway_order_id: string };
}

/** Pays on the stub with webhook delivery switched off; returns the browser's proof. */
async function payWithoutWebhook(gateway: Gateway, gatewayOrderId: string) {
  stack.relay.forward = false;
  try {
    if (gateway === "STRIPE") {
      await fetch(`${stack.stubs}/stripe/checkout/${gatewayOrderId}/pay`, { method: "POST", redirect: "manual" });
      return { gateway_order_id: gatewayOrderId, gateway_payment_id: "", signature: "" };
    }
    const res = await fetch(`${stack.stubs}/razorpay/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "paid", order_id: gatewayOrderId }),
    });
    const body = (await res.json()) as { response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string } };
    return { gateway_order_id: body.response.razorpay_order_id, gateway_payment_id: body.response.razorpay_payment_id, signature: body.response.razorpay_signature };
  } finally {
    stack.relay.forward = true;
  }
}

const orderRow = (tenantId: string, orderId: string) =>
  stack.db.selectFrom("payment_orders").select(["status", "total_amount", "metadata"]).where("tenant_id", "=", tenantId).where("id", "=", orderId).executeTakeFirstOrThrow();
const enrollments = (tenantId: string, memberId: string) =>
  stack.db.selectFrom("enrollments").select("id").where("tenant_id", "=", tenantId).where("tenant_member_id", "=", memberId).execute();

describe("verify-payment is bound to the stored gateway order", () => {
  it("rejects a valid Razorpay signature for another order", async () => {
    const tenant = await createTenant(stack.db, "bind");
    await connectGateway(stack, tenant, "RAZORPAY");
    const courseA = await seedCourse(stack.db, tenant.id, { purchaseMode: "PAID", priceInr: 1499, priceUsd: 49 });
    const courseB = await seedCourse(stack.db, tenant.id, { purchaseMode: "PAID", priceInr: 9999, priceUsd: 199 });
    const learner = await createLearner(stack.db, tenant.id);
    const a = await createOrder(tenant, learner, courseA, "INR");
    const b = await createOrder(tenant, learner, courseB, "INR");
    const proofA = await payWithoutWebhook("RAZORPAY", a.gateway_order_id);

    const swapped = await call(stack.learner, "POST", "/checkout/verify-payment", { token: learner.token, host: tenant.host, body: { order_id: b.order_id, ...proofA } });
    expect(swapped.status).toBe(400);
    expect(swapped.text).toContain("does not belong to this order");
    expect((await orderRow(tenant.id, b.order_id)).status).toBe("PAYMENT_PENDING");
    expect(await enrollments(tenant.id, learner.id)).toHaveLength(0);

    const own = await call(stack.learner, "POST", "/checkout/verify-payment", { token: learner.token, host: tenant.host, body: { order_id: a.order_id, ...proofA } });
    expect(own.status, own.text).toBe(200);
    expect((await orderRow(tenant.id, a.order_id)).status).toBe("PAID");
  });
});

describe.each<Gateway>(["STRIPE", "RAZORPAY"])("%s charge must equal the order total", (gateway) => {
  let tenant: Tenant;
  let course: SeededCourse;

  beforeAll(async () => {
    tenant = await createTenant(stack.db, `amt-${gateway.toLowerCase()}`);
    await connectGateway(stack, tenant, gateway);
    course = await seedCourse(stack.db, tenant.id, { purchaseMode: "PAID", priceInr: 1499, priceUsd: 49 });
  });

  /** An order whose stored total no longer matches what the gateway charged. */
  async function mismatchedOrder() {
    const learner = await createLearner(stack.db, tenant.id);
    const order = await createOrder(tenant, learner, course, CURRENCY[gateway]);
    const sent = stack.webhooks.length;
    const proof = await payWithoutWebhook(gateway, order.gateway_order_id);
    const hooks = stack.webhooks.slice(sent).filter((h) => h.target === "learner");
    const real = await orderRow(tenant.id, order.order_id);
    await stack.db.updateTable("payment_orders").set({ total_amount: String(Number(real.total_amount) + 1) }).where("id", "=", order.order_id).execute();
    return { learner, order, proof, hooks };
  }

  it("a webhook for a different amount is acknowledged and leaves the order unpaid", async () => {
    const { learner, order, hooks } = await mismatchedOrder();
    expect(hooks.length).toBeGreaterThan(0);
    for (const hook of hooks) expect((await stack.replay(hook)).status).toBe(200);
    // Give the fulfilment worker the chance it must not take.
    await eventually(async () => false, { timeoutMs: 500 });
    expect((await orderRow(tenant.id, order.order_id)).status).toBe("PAYMENT_PENDING");
    expect(await enrollments(tenant.id, learner.id)).toHaveLength(0);
  });

  it("verify-payment refuses a capture for a different amount", async () => {
    const { learner, order, proof } = await mismatchedOrder();
    if (gateway === "STRIPE") {
      // Stripe confirms server-side and reports the session total.
      const res = await call(stack.learner, "POST", "/checkout/verify-payment", { token: learner.token, host: tenant.host, body: { order_id: order.order_id, ...proof } });
      expect(res.status).toBe(400);
      expect(res.text).toContain("amount does not match");
      expect((await orderRow(tenant.id, order.order_id)).status).toBe("PAYMENT_PENDING");
    }
    // Razorpay: the client signature covers the gateway order, whose amount was
    // fixed at creation, so the capture comparison lives in the webhook and in the
    // verify-and-fulfill fallback, which looks the payments up.
    const fallback = await call(stack.learner, "POST", "/checkout/verify-and-fulfill", { token: learner.token, host: tenant.host, body: { order_id: order.order_id } });
    if (gateway === "RAZORPAY") {
      expect(fallback.status, fallback.text).toBe(200);
      expect(fallback.body.data.status).toBe("PAYMENT_PENDING");
    }
    expect(await enrollments(tenant.id, learner.id)).toHaveLength(0);
  });
});

describe("refunds", () => {
  it("learners have no refund endpoint", async () => {
    const tenant = await createTenant(stack.db, "norefund");
    const learner = await createLearner(stack.db, tenant.id);
    const res = await call(stack.learner, "POST", "/checkout/orders/ORDER123/refund", { token: learner.token, host: tenant.host, body: {} });
    expect(res.status).toBe(404);
  });
});

describe("learner tokens", () => {
  let a: Tenant;
  let b: Tenant;
  let learner: Learner;

  beforeAll(async () => {
    a = await createTenant(stack.db, "tok-a");
    b = await createTenant(stack.db, "tok-b");
    learner = await createLearner(stack.db, a.id);
  });

  const me = (token: string, host: string) => call(stack.learner, "GET", "/auth/me", { token, host });

  it("accepts the learner's token on its own tenant's host", async () => {
    expect((await me(learner.token, a.host)).status).toBe(200);
  });

  it("refuses it on another tenant's host", async () => {
    expect((await me(learner.token, b.host)).status).toBe(401);
  });

  it("refuses staff tokens and tokens signed with the shared JWT_SECRET", async () => {
    // The tenant owner's admin-api token (type "tenant", shared secret).
    expect((await me(a.token, a.host)).status).toBe(401);
    const shared = jwt.sign({ id: learner.id, tenantId: a.id, email: learner.email, type: "learner" }, process.env.JWT_SECRET!, { expiresIn: "1h" });
    expect((await me(shared, a.host)).status).toBe(401);
    const untyped = jwt.sign({ id: learner.id, tenantId: a.id, email: learner.email }, LEARNER_SECRET, { expiresIn: "1h" });
    expect((await me(untyped, a.host)).status).toBe(401);
  });
});

describe("credential endpoints are rate limited", () => {
  it("login: the 11th attempt for one email in the window is 429", async () => {
    const tenant = await createTenant(stack.db, "rl-login");
    const email = `nobody-${Date.now()}@example.com`;
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await call(stack.learner, "POST", "/auth/login", { host: tenant.host, body: { email, password: "wrong-password" } });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10)).not.toContain(429);
    expect(statuses[10]).toBe(429);
  });

  it("OTP verify: the 11th attempt for one identifier is 429", async () => {
    const tenant = await createTenant(stack.db, "rl-otp");
    const identifier = `otp-${Date.now()}@example.com`;
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await call(stack.learner, "POST", "/auth/otp/verify", { host: tenant.host, body: { identifier, channel: "email", code: "000000" } })).status;
    }
    expect(last).toBe(429);
  });
});
