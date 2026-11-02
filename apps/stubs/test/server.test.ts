/**
 * The stub server end to end: a fake API receives the webhooks, and each flow is driven
 * the way the real clients drive it (SDK-shaped REST calls, then the hosted page).
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyRazorpayWebhookSignature, verifyStripeSignature, razorpayPaymentSignature } from "../src/signatures.ts";

interface Received {
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

// Response bodies in these tests are provider-shaped JSON read field by field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = Record<string, any>;

const received: Received[] = [];
let receiver: Server;
let stubs: Server;
let base = "";

const listen = (server: Server) =>
  new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)));

beforeAll(async () => {
  receiver = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ path: req.url ?? "", headers: req.headers, body });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true}');
    });
  });
  const apiPort = await listen(receiver);
  process.env.PORT = "0";
  process.env.HOST = "127.0.0.1";
  process.env.STUBS_LEARNER_API_URL = `http://127.0.0.1:${apiPort}/learner`;
  process.env.STUBS_ADMIN_API_URL = `http://127.0.0.1:${apiPort}/admin`;
  process.env.STUBS_STRIPE_WEBHOOK_SECRET = "whsec_test_only";
  process.env.STUBS_RAZORPAY_WEBHOOK_SECRET = "test-only-rzp-webhook";
  process.env.STUBS_EVS_API_KEY = "test-only-evs";
  const { handle } = await import("../src/server.ts");
  stubs = createServer((req, res) => void handle(req, res));
  const port = await listen(stubs);
  base = `http://127.0.0.1:${port}`;
  const { config } = await import("../src/config.ts");
  config.publicUrl = base;
});

afterAll(() => {
  stubs?.close();
  receiver?.close();
});

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

describe("Stripe checkout", () => {
  it("creates a session, pays on the hosted page, signs the webhook, redirects to success_url", async () => {
    const form = new URLSearchParams({
      mode: "payment",
      success_url: "https://shop.example.com/checkout/return?provider=stripe&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://shop.example.com/checkout/return?status=cancelled",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": "4900",
      "line_items[0][price_data][product_data][name]": "Course",
      "metadata[order_id]": "ord_test",
    });
    const created = await fetch(`${base}/v1/checkout/sessions`, {
      method: "POST",
      headers: { Authorization: "Bearer sk_test_tenant", "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    expect(created.status).toBe(200);
    const session = (await created.json()) as { id: string; url: string; amount_total: number; payment_status: string };
    expect(session.amount_total).toBe(4900);
    expect(session.payment_status).toBe("unpaid");
    expect(session.url).toContain(`/stripe/checkout/${session.id}`);

    const pageRes = await fetch(`${base}/stripe/checkout/${session.id}`);
    expect(await pageRes.text()).toContain("USD 49.00");

    const before = received.length;
    const paid = await fetch(`${base}/stripe/checkout/${session.id}/pay`, { method: "POST", redirect: "manual" });
    expect(paid.status).toBe(303);
    expect(paid.headers.get("location")).toBe(`https://shop.example.com/checkout/return?provider=stripe&session_id=${session.id}`);

    const hook = received[before]!;
    expect(hook.path).toBe("/learner/api/v1/webhooks/stripe");
    expect(verifyStripeSignature(hook.body, String(hook.headers["stripe-signature"]), "whsec_test_only")).toBe(true);
    const event = JSON.parse(hook.body);
    expect(event.type).toBe("checkout.session.completed");
    expect(event.data.object.id).toBe(session.id);
    expect(event.data.object.metadata.order_id).toBe("ord_test");
    expect(event.data.object._key).toBeUndefined();

    const fetched = await (await fetch(`${base}/v1/checkout/sessions/${session.id}`, { headers: { Authorization: "Bearer sk_test_tenant" } })).json() as J;
    expect(fetched.payment_status).toBe("paid");
    expect(fetched.payment_intent).toMatch(/^pi_/);
  });

  it("refuses a request without an sk_ key", async () => {
    const r = await fetch(`${base}/v1/checkout/sessions`, { method: "POST", body: "" });
    expect(r.status).toBe(401);
  });
});

describe("Razorpay", () => {
  const auth = basic("rzp_test_tenant", "test-only-secret");

  it("creates an order, pays it, returns a verifiable signature and signed webhooks", async () => {
    const order = await (
      await fetch(`${base}/v1/orders`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 49900, currency: "INR", receipt: "r1", notes: { order_id: "ord_1" } }),
      })
    ).json() as J;
    expect(order.id).toMatch(/^order_/);

    const before = received.length;
    const result = await (
      await fetch(`${base}/razorpay/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: order.id, outcome: "paid" }) })
    ).json() as J;
    expect(result.status).toBe("paid");
    const { razorpay_payment_id: paymentId, razorpay_signature: signature } = result.response;
    expect(signature).toBe(razorpayPaymentSignature(order.id, paymentId, "test-only-secret"));

    const hooks = received.slice(before);
    expect(hooks.map((h) => JSON.parse(h.body).event)).toEqual(["payment.captured", "order.paid"]);
    for (const h of hooks) {
      expect(h.path).toBe("/learner/api/v1/webhooks/razorpay");
      expect(verifyRazorpayWebhookSignature(h.body, String(h.headers["x-razorpay-signature"]), "test-only-rzp-webhook")).toBe(true);
    }
    expect(JSON.parse(hooks[0]!.body).payload.payment.entity.order_id).toBe(order.id);

    const list = await (await fetch(`${base}/v1/orders/${order.id}/payments`, { headers: { Authorization: auth } })).json() as J;
    expect(list.items).toHaveLength(1);
  });

  it("sends platform subscription events to admin-api", async () => {
    const platform = basic("rzp_test_stubplatform", "test-only-platform");
    const plan = await (
      await fetch(`${base}/v1/plans`, {
        method: "POST",
        headers: { Authorization: platform, "Content-Type": "application/json" },
        body: JSON.stringify({ period: "monthly", interval: 1, item: { name: "Growth", amount: 99900, currency: "INR" } }),
      })
    ).json() as J;
    const sub = await (
      await fetch(`${base}/v1/subscriptions`, {
        method: "POST",
        headers: { Authorization: platform, "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plan.id, total_count: 12, notes: { tenant_id: "ten_1" } }),
      })
    ).json() as J;
    expect(sub.short_url).toContain(`subscription_id=${sub.id}`);

    const before = received.length;
    const result = await (
      await fetch(`${base}/razorpay/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription_id: sub.id }) })
    ).json() as J;
    expect(result.response.razorpay_subscription_id).toBe(sub.id);
    const hooks = received.slice(before);
    expect(hooks.map((h) => JSON.parse(h.body).event)).toEqual(["subscription.authenticated", "subscription.activated", "subscription.charged"]);
    expect(hooks.every((h) => h.path === "/admin/api/v1/webhook/razorpay/subscription")).toBe(true);

    const fetched = await (await fetch(`${base}/v1/subscriptions/${sub.id}`, { headers: { Authorization: platform } })).json() as J;
    expect(fetched.status).toBe("active");
    expect(fetched.paid_count).toBe(1);
  });
});

describe("EVS and the HLS sample", () => {
  it("issues a playback session whose manifest is served", async () => {
    const unauthorised = await fetch(`${base}/v1/videos/vid_1/playback-sessions`, { method: "POST", body: "{}" });
    expect(unauthorised.status).toBe(401);
    const r = await fetch(`${base}/v1/videos/vid_1/playback-sessions`, {
      method: "POST",
      headers: { Authorization: "Bearer test-only-evs", "Content-Type": "application/json" },
      body: JSON.stringify({ viewerId: "ten_1:mem_1", ttlSeconds: 600 }),
    });
    expect(r.status).toBe(201);
    const s = (await r.json()) as { manifestUrl: string; token: string; expiresAt: string };
    expect(new Date(s.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const manifest = await fetch(s.manifestUrl);
    expect(manifest.headers.get("content-type")).toContain("mpegurl");
    expect(await manifest.text()).toContain("#EXTM3U");
    const segment = await fetch(`${base}/evs/hls/sample/seg000.m4s`);
    expect(segment.status).toBe(200);
  });
});

describe("OpenAI-compatible", () => {
  it("returns a chat completion", async () => {
    const r = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "any", messages: [{ role: "user", content: "hello" }], response_format: { type: "json_object" } }),
    });
    const body = (await r.json()) as J;
    expect(body.object).toBe("chat.completion");
    expect(JSON.parse(body.choices[0].message.content).stub).toBe(true);
  });
});
