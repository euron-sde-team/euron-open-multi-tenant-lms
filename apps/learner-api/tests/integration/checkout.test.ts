/**
 * Single-item checkout for a paid course, end to end against the gateway stubs.
 *
 * Webhook path: the learner creates an order, pays on the stub, the stub sends the
 * signed webhook (through a recording relay), and the fulfilment worker enrols the
 * learner. The exact same delivery is then replayed: still one paid order, one
 * enrolment, one webhook event row.
 *
 * Fallback path: the webhook is lost (the relay drops it), and verify-payment confirms
 * the payment with the gateway itself and fulfils inline.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLearner, createTenant, seedCourse, type Learner, type SeededCourse, type Tenant } from "../../../admin-api/tests/integration/support/fixtures";
import { connectGateway, eventually, type Gateway } from "../../../admin-api/tests/integration/support/flows";
import { call, startStack, type Stack } from "../../../admin-api/tests/integration/support/stack";

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

async function setup(gateway: Gateway) {
  const tenant = await createTenant(stack.db, `pay-${gateway.toLowerCase()}`);
  await connectGateway(stack, tenant, gateway);
  const course = await seedCourse(stack.db, tenant.id, { purchaseMode: "PAID", priceInr: 1499, priceUsd: 49 });
  return { tenant, course };
}

async function createOrder(tenant: Tenant, learner: Learner, course: SeededCourse, currency: string) {
  const res = await call(stack.learner, "POST", "/checkout/create-order", {
    token: learner.token,
    host: tenant.host,
    body: { order_type: "COURSE", item_id: course.id, currency },
  });
  expect(res.status, res.text).toBe(201);
  return res.body.data as { order_id: string; gateway_order_id: string; amount: number; currency: string };
}

/** Pays on the stub's hosted screen; returns what the browser would hand to verify-payment. */
async function payOnStub(gateway: Gateway, gatewayOrderId: string) {
  if (gateway === "STRIPE") {
    const res = await fetch(`${stack.stubs}/stripe/checkout/${gatewayOrderId}/pay`, { method: "POST", redirect: "manual" });
    expect([302, 303]).toContain(res.status);
    return { gateway_order_id: gatewayOrderId, gateway_payment_id: "", signature: "" };
  }
  const res = await fetch(`${stack.stubs}/razorpay/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome: "paid", order_id: gatewayOrderId }),
  });
  const body = (await res.json()) as { status: string; response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string } };
  expect(body.status).toBe("paid");
  return { gateway_order_id: body.response.razorpay_order_id, gateway_payment_id: body.response.razorpay_payment_id, signature: body.response.razorpay_signature };
}

const state = async (tenantId: string, memberId: string, courseId: string, orderId: string) => {
  const [enrollments, order, events] = await Promise.all([
    stack.db.selectFrom("enrollments").select(["id", "source"]).where("tenant_id", "=", tenantId).where("tenant_member_id", "=", memberId).where("course_id", "=", courseId).execute(),
    stack.db.selectFrom("payment_orders").selectAll().where("tenant_id", "=", tenantId).where("id", "=", orderId).executeTakeFirstOrThrow(),
    stack.db.selectFrom("payment_webhook_events").select(["event_id", "event_type"]).where("tenant_id", "=", tenantId).execute(),
  ]);
  const paidOrders = await stack.db
    .selectFrom("payment_orders")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("status", "=", "PAID")
    .execute();
  return { enrollments, order, events, paidOrders };
};

describe.each<Gateway>(["STRIPE", "RAZORPAY"])("%s checkout", (gateway) => {
  let tenant: Tenant;
  let course: SeededCourse;

  beforeAll(async () => {
    ({ tenant, course } = await setup(gateway));
  });

  it("webhook fulfils once; a duplicate delivery is ignored", async () => {
    const learner = await createLearner(stack.db, tenant.id);
    const order = await createOrder(tenant, learner, course, CURRENCY[gateway]);
    expect(order.currency).toBe(CURRENCY[gateway]);
    expect(order.amount).toBe(gateway === "STRIPE" ? 4900 : 149900);

    const sent = stack.webhooks.length;
    await payOnStub(gateway, order.gateway_order_id);
    const delivered = stack.webhooks.slice(sent).filter((h) => h.target === "learner");
    expect(delivered.length).toBeGreaterThan(0);
    for (const hook of delivered) expect(hook.status).toBe(200);

    const enrolled = await eventually(async () => (await state(tenant.id, learner.id, course.id, order.order_id)).enrollments.length === 1);
    expect(enrolled).toBe(true);
    const after = await eventually(async () => {
      const s = await state(tenant.id, learner.id, course.id, order.order_id);
      return (s.order.metadata as { fulfilled?: boolean } | null)?.fulfilled ? s : null;
    });
    expect(after).toBeTruthy();
    const eventsBefore = after!.events.length;

    // The gateway retries the very same delivery (same body, same signature).
    for (const hook of delivered) {
      const replay = await stack.replay(hook);
      expect(replay.status).toBe(200);
      expect(replay.text).toContain("duplicate");
    }

    const s = await state(tenant.id, learner.id, course.id, order.order_id);
    expect(s.enrollments).toHaveLength(1);
    expect(s.enrollments[0].source).toBe("PURCHASED");
    expect(s.paidOrders).toHaveLength(1);
    expect(s.order.status).toBe("PAID");
    expect(s.events).toHaveLength(eventsBefore);
  });

  it("verify-payment fulfils when the webhook never arrives", async () => {
    const learner = await createLearner(stack.db, tenant.id);
    const order = await createOrder(tenant, learner, course, CURRENCY[gateway]);
    stack.relay.forward = false;
    let proof;
    try {
      proof = await payOnStub(gateway, order.gateway_order_id);
    } finally {
      stack.relay.forward = true;
    }

    const pending = await state(tenant.id, learner.id, course.id, order.order_id);
    expect(pending.order.status).toBe("PAYMENT_PENDING");
    expect(pending.enrollments).toHaveLength(0);

    const verified = await call(stack.learner, "POST", "/checkout/verify-payment", {
      token: learner.token,
      host: tenant.host,
      body: { order_id: order.order_id, ...proof },
    });
    expect(verified.status, verified.text).toBe(200);
    expect(verified.body.data.success).toBe(true);

    const s = await state(tenant.id, learner.id, course.id, order.order_id);
    expect(s.order.status).toBe("PAID");
    expect(s.enrollments).toHaveLength(1);
    expect((s.order.metadata as { fulfilled?: boolean }).fulfilled).toBe(true);

    // Verifying again is a no-op.
    const again = await call(stack.learner, "POST", "/checkout/verify-payment", { token: learner.token, host: tenant.host, body: { order_id: order.order_id, ...proof } });
    expect(again.status).toBe(200);
    expect((await state(tenant.id, learner.id, course.id, order.order_id)).enrollments).toHaveLength(1);
  });

  it("rejects a webhook with a bad signature", async () => {
    const learner = await createLearner(stack.db, tenant.id);
    const order = await createOrder(tenant, learner, course, CURRENCY[gateway]);
    stack.relay.forward = false;
    try {
      await payOnStub(gateway, order.gateway_order_id);
    } finally {
      stack.relay.forward = true;
    }
    const hook = stack.webhooks.filter((h) => h.target === "learner").at(-1)!;
    const forged = { ...hook, headers: { ...hook.headers } };
    if (gateway === "STRIPE") forged.headers["stripe-signature"] = forged.headers["stripe-signature"].replace(/v1=[0-9a-f]+/, `v1=${"0".repeat(64)}`);
    else forged.headers["x-razorpay-signature"] = "0".repeat(64);
    const res = await stack.replay(forged);
    expect(res.status).toBe(400);
    const s = await state(tenant.id, learner.id, course.id, order.order_id);
    expect(s.order.status).toBe("PAYMENT_PENDING");
    expect(s.enrollments).toHaveLength(0);
  });
});
