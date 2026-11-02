/**
 * Razorpay: the REST calls the `razorpay` SDK makes (HTTP Basic key_id:key_secret, JSON),
 * a stand-in for checkout.js, and the hosted payment screen it opens.
 *
 *   POST /v1/orders                          create an order
 *   GET  /v1/orders/:id                      fetch
 *   GET  /v1/orders/:id/payments             payments of an order
 *   GET  /v1/payments/:id                    fetch
 *   POST /v1/payments/:id/capture            capture (already captured: echo)
 *   POST /v1/payments/:id/refund             refund
 *   POST /v1/plans, GET /v1/plans/:id        plans
 *   POST /v1/subscriptions                   create (short_url opens the hosted screen)
 *   GET  /v1/subscriptions/:id               fetch
 *   POST /v1/subscriptions/:id/cancel|pause|resume
 *   GET  /razorpay/checkout.js               window.Razorpay for the browser
 *   GET  /razorpay/pay?order_id=|subscription_id=   hosted screen
 *   POST /razorpay/pay                       pay: sign the result with the key secret the
 *                                            order was created with, send the signed
 *                                            webhooks, hand the handler its response
 *
 * Point the SDK here with `instance.api.rq.defaults.baseURL = RAZORPAY_API_BASE`.
 */
import type { ServerResponse } from "node:http";

import { config } from "./config.ts";
import type { Req } from "./http.ts";
import { credentials, escapeHtml, formatAmount, html, id, int, json, nowSeconds, page, record, str } from "./http.ts";
import { razorpayPaymentSignature, razorpaySubscriptionSignature, razorpayWebhookSignature } from "./signatures.ts";
import { deliver } from "./webhooks.ts";

interface Auth {
  keyId: string;
  keySecret: string;
}

interface Order {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

interface Payment {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: "captured" | "failed" | "refunded";
  order_id: string | null;
  subscription_id?: string;
  invoice_id: string | null;
  method: "card";
  captured: boolean;
  email: string;
  contact: string;
  notes: Record<string, string>;
  amount_refunded: number;
  created_at: number;
}

interface Plan {
  id: string;
  entity: "plan";
  period: string;
  interval: number;
  item: { id: string; name: string; description: string | null; amount: number; currency: string };
  notes: Record<string, string>;
  created_at: number;
}

interface Subscription {
  id: string;
  entity: "subscription";
  plan_id: string;
  customer_id: string | null;
  status: "created" | "authenticated" | "active" | "paused" | "cancelled";
  current_start: number | null;
  current_end: number | null;
  charge_at: number | null;
  start_at: number | null;
  end_at: number | null;
  total_count: number;
  paid_count: number;
  remaining_count: number;
  quantity: number;
  customer_notify: boolean;
  short_url: string;
  notes: Record<string, string>;
  created_at: number;
}

const orders = new Map<string, Order>();
const payments = new Map<string, Payment>();
const plans = new Map<string, Plan>();
const subscriptions = new Map<string, Subscription>();
/** Which credentials created each order and subscription: they sign the checkout result. */
const owners = new Map<string, Auth>();

function rzpError(res: ServerResponse, status: number, description: string, code = "BAD_REQUEST_ERROR"): void {
  json(res, status, { error: { code, description, source: "business", step: "payment_initiation", reason: "input_validation_failed" } });
}

function auth(req: Req, res: ServerResponse): Auth | null {
  const c = credentials(req.headers);
  if (c.scheme !== "basic" || !c.user.startsWith("rzp_") || !c.secret) {
    rzpError(res, 401, "The api key provided is invalid (the Razorpay stub expects rzp_ key id and secret).", "BAD_REQUEST_ERROR");
    return null;
  }
  return { keyId: c.user, keySecret: c.secret };
}

const PERIOD_SECONDS: Record<string, number> = { daily: 86_400, weekly: 604_800, monthly: 2_592_000, quarterly: 7_776_000, yearly: 31_536_000 };

function webhookUrl(keyId: string, subscription: boolean): string {
  return subscription && keyId === config.platformRazorpayKeyId
    ? `${config.adminApiUrl}${config.adminRazorpayWebhookPath}`
    : `${config.learnerApiUrl}${config.learnerRazorpayWebhookPath}`;
}

async function sendRazorpayEvent(event: string, payload: Record<string, unknown>, keyId: string, subscription: boolean): Promise<void> {
  const eventId = id("evt", 14);
  const body = JSON.stringify({
    entity: "event",
    account_id: "acc_StubAccount0001",
    event,
    id: eventId,
    contains: Object.keys(payload),
    payload,
    created_at: nowSeconds(),
  });
  await deliver("razorpay", event, webhookUrl(keyId, subscription), body, {
    "X-Razorpay-Signature": razorpayWebhookSignature(body, config.razorpayWebhookSecret),
    "X-Razorpay-Event-Id": eventId,
  });
}

const wrap = (entity: unknown) => ({ entity });

function newPayment(amount: number, currency: string, extra: Partial<Payment>): Payment {
  const payment: Payment = {
    id: id("pay", 14),
    entity: "payment",
    amount,
    currency,
    status: "captured",
    order_id: null,
    invoice_id: null,
    method: "card",
    captured: true,
    email: "learner@example.com",
    contact: "+10000000000",
    notes: {},
    amount_refunded: 0,
    created_at: nowSeconds(),
    ...extra,
  };
  payments.set(payment.id, payment);
  return payment;
}

/** The browser-side checkout: opens the hosted screen in a popup and relays its result. */
function checkoutJs(): string {
  const base = JSON.stringify(config.publicUrl);
  return `/* Razorpay checkout.js stand-in served by the local stubs. */
(function () {
  var BASE = ${base};
  function Razorpay(options) { this.options = options || {}; this.handlers = {}; }
  Razorpay.prototype.on = function (name, fn) { this.handlers[name] = fn; return this; };
  Razorpay.prototype.close = function () { if (this.win && !this.win.closed) this.win.close(); };
  Razorpay.prototype.open = function () {
    var o = this.options, self = this, done = false;
    var q = new URLSearchParams({ key: o.key || "", amount: String(o.amount || ""), currency: o.currency || "",
      name: o.name || "", description: o.description || "" });
    if (o.order_id) q.set("order_id", o.order_id);
    if (o.subscription_id) q.set("subscription_id", o.subscription_id);
    if (o.prefill && o.prefill.email) q.set("email", o.prefill.email);
    this.win = window.open(BASE + "/razorpay/pay?" + q.toString(), "razorpay_stub", "width=480,height=640");
    function dismiss() { if (o.modal && typeof o.modal.ondismiss === "function") o.modal.ondismiss(); }
    function onMessage(ev) {
      var d = ev.data || {};
      if (d.type !== "razorpay-stub") return;
      done = true; window.removeEventListener("message", onMessage);
      if (d.status === "paid" && typeof o.handler === "function") o.handler(d.response);
      else if (d.status === "failed" && self.handlers["payment.failed"]) self.handlers["payment.failed"]({ error: d.error });
      else dismiss();
    }
    window.addEventListener("message", onMessage);
    var timer = setInterval(function () {
      if (!self.win || self.win.closed) { clearInterval(timer); if (!done) { window.removeEventListener("message", onMessage); dismiss(); } }
    }, 500);
  };
  window.Razorpay = Razorpay;
})();
`;
}

export const razorpayRoutes = {
  createOrder(req: Req, res: ServerResponse): void {
    const a = auth(req, res);
    if (!a) return;
    const amount = int(req.body.amount);
    if (amount < 100) return rzpError(res, 400, "Order amount less than minimum amount allowed");
    const order: Order = {
      id: id("order", 14),
      entity: "order",
      amount,
      amount_paid: 0,
      amount_due: amount,
      currency: str(req.body.currency, "INR").toUpperCase(),
      receipt: str(req.body.receipt) || null,
      status: "created",
      attempts: 0,
      notes: record(req.body.notes),
      created_at: nowSeconds(),
    };
    orders.set(order.id, order);
    owners.set(order.id, a);
    json(res, 200, order);
  },

  getOrder(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (!auth(req, res)) return;
    const order = orders.get(p.id ?? "");
    if (!order) return rzpError(res, 400, "The id provided does not exist");
    json(res, 200, order);
  },

  orderPayments(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (!auth(req, res)) return;
    const items = [...payments.values()].filter((x) => x.order_id === p.id);
    json(res, 200, { entity: "collection", count: items.length, items });
  },

  getPayment(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (!auth(req, res)) return;
    const payment = payments.get(p.id ?? "");
    if (!payment) return rzpError(res, 400, "The id provided does not exist");
    json(res, 200, payment);
  },

  capture(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (!auth(req, res)) return;
    const payment = payments.get(p.id ?? "");
    if (!payment) return rzpError(res, 400, "The id provided does not exist");
    json(res, 200, payment);
  },

  refund(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (!auth(req, res)) return;
    const payment = payments.get(p.id ?? "");
    if (!payment) return rzpError(res, 400, "The id provided does not exist");
    const amount = int(req.body.amount, payment.amount - payment.amount_refunded);
    if (amount <= 0 || amount > payment.amount - payment.amount_refunded) {
      return rzpError(res, 400, "The refund amount provided is greater than amount captured");
    }
    payment.amount_refunded += amount;
    if (payment.amount_refunded === payment.amount) payment.status = "refunded";
    json(res, 200, {
      id: id("rfnd", 14),
      entity: "refund",
      amount,
      currency: payment.currency,
      payment_id: payment.id,
      notes: record(req.body.notes),
      status: "processed",
      speed_processed: "normal",
      created_at: nowSeconds(),
    });
  },

  /** GET /v1/plans: admin-api lists one plan to verify a tenant's key pair. */
  listPlans(req: Req, res: ServerResponse): void {
    if (!auth(req, res)) return;
    const items = [...plans.values()];
    json(res, 200, { entity: "collection", count: items.length, items });
  },

  createPlan(req: Req, res: ServerResponse): void {
    if (!auth(req, res)) return;
    const item = (req.body.item ?? {}) as Record<string, unknown>;
    const period = str(req.body.period, "monthly");
    if (!PERIOD_SECONDS[period]) return rzpError(res, 400, "The period provided is invalid");
    const plan: Plan = {
      id: id("plan", 14),
      entity: "plan",
      period,
      interval: Math.max(1, int(req.body.interval, 1)),
      item: {
        id: id("item", 14),
        name: str(item.name, "Plan"),
        description: str(item.description) || null,
        amount: int(item.amount),
        currency: str(item.currency, "INR").toUpperCase(),
      },
      notes: record(req.body.notes),
      created_at: nowSeconds(),
    };
    plans.set(plan.id, plan);
    json(res, 200, plan);
  },

  getPlan(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (!auth(req, res)) return;
    const plan = plans.get(p.id ?? "");
    if (!plan) return rzpError(res, 400, "The id provided does not exist");
    json(res, 200, plan);
  },

  createSubscription(req: Req, res: ServerResponse): void {
    const a = auth(req, res);
    if (!a) return;
    const planId = str(req.body.plan_id);
    if (!plans.has(planId)) return rzpError(res, 400, "The plan_id provided does not exist");
    const total = Math.max(1, int(req.body.total_count, 12));
    const subId = id("sub", 14);
    const sub: Subscription = {
      id: subId,
      entity: "subscription",
      plan_id: planId,
      customer_id: str(req.body.customer_id) || null,
      status: "created",
      current_start: null,
      current_end: null,
      charge_at: null,
      start_at: int(req.body.start_at) || null,
      end_at: null,
      total_count: total,
      paid_count: 0,
      remaining_count: total,
      quantity: Math.max(1, int(req.body.quantity, 1)),
      customer_notify: Boolean(req.body.customer_notify),
      short_url: `${config.publicUrl}/razorpay/pay?subscription_id=${subId}`,
      notes: record(req.body.notes),
      created_at: nowSeconds(),
    };
    subscriptions.set(sub.id, sub);
    owners.set(sub.id, a);
    json(res, 200, sub);
  },

  getSubscription(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (!auth(req, res)) return;
    const sub = subscriptions.get(p.id ?? "");
    if (!sub) return rzpError(res, 400, "The id provided does not exist");
    json(res, 200, sub);
  },

  async subscriptionAction(req: Req, res: ServerResponse, p: Record<string, string>): Promise<void> {
    const a = auth(req, res);
    if (!a) return;
    const sub = subscriptions.get(p.id ?? "");
    if (!sub) return rzpError(res, 400, "The id provided does not exist");
    const next = { cancel: "cancelled", pause: "paused", resume: "active" } as const;
    const action = p.action as keyof typeof next;
    sub.status = next[action];
    await sendRazorpayEvent(`subscription.${sub.status}`, { subscription: wrap(sub) }, owners.get(sub.id)?.keyId ?? a.keyId, true);
    json(res, 200, sub);
  },

  checkoutScript(_req: Req, res: ServerResponse): void {
    const body = checkoutJs();
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(body);
  },

  hostedPage(req: Req, res: ServerResponse): void {
    const orderId = req.query.get("order_id") ?? "";
    const subId = req.query.get("subscription_id") ?? "";
    const order = orders.get(orderId);
    const sub = subscriptions.get(subId);
    const plan = sub ? plans.get(sub.plan_id) : undefined;
    if (!order && !sub) return html(res, 404, page("Not found", "<h1>Order not found</h1><p>The stub keeps orders in memory; a restart forgets them.</p>"));
    const amount = order ? formatAmount(order.amount, order.currency) : plan ? `${formatAmount(plan.item.amount, plan.item.currency)} / ${plan.period}` : "";
    const ref = JSON.stringify({ order_id: orderId || undefined, subscription_id: subId || undefined });
    html(
      res,
      200,
      page(
        "Razorpay checkout (stub)",
        `<h1>${escapeHtml(req.query.get("name") || "Razorpay checkout")}</h1><p>${escapeHtml(req.query.get("description") || (sub ? "Subscription" : "Order"))}</p>
<div class="amount">${escapeHtml(amount)}</div>
<button class="primary" id="pay" type="button">Pay</button><button id="fail" type="button">Fail</button><button id="cancel" type="button">Cancel</button>
<p id="status"></p>
<script>
(function(){
  var ref = ${ref.replace(/</g, "\\u003c")};
  function finish(msg){
    if (window.opener) { window.opener.postMessage(Object.assign({ type: "razorpay-stub" }, msg), "*"); window.close(); }
    else { document.getElementById("status").textContent = msg.status === "paid" ? "Paid. You can close this window." : "Closed: " + msg.status; }
  }
  function go(outcome){
    fetch("/razorpay/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ outcome: outcome }, ref)) })
      .then(function(r){ return r.json(); }).then(finish)
      .catch(function(e){ document.getElementById("status").textContent = String(e); });
  }
  document.getElementById("pay").onclick = function(){ go("paid"); };
  document.getElementById("fail").onclick = function(){ go("failed"); };
  document.getElementById("cancel").onclick = function(){ finish({ status: "dismissed" }); };
})();
</script>`,
      ),
    );
  },

  async pay(req: Req, res: ServerResponse): Promise<void> {
    const outcome = str(req.body.outcome, "paid");
    const order = orders.get(str(req.body.order_id));
    const sub = subscriptions.get(str(req.body.subscription_id));
    const owner = owners.get(order?.id ?? sub?.id ?? "");
    if ((!order && !sub) || !owner) return rzpError(res, 404, "Unknown order or subscription");

    if (order) {
      const payment = newPayment(order.amount, order.currency, {
        order_id: order.id,
        notes: order.notes,
        status: outcome === "paid" ? "captured" : "failed",
        captured: outcome === "paid",
      });
      order.attempts += 1;
      if (outcome !== "paid") {
        order.status = "attempted";
        await sendRazorpayEvent("payment.failed", { payment: wrap(payment) }, owner.keyId, false);
        return json(res, 200, { status: "failed", error: { code: "BAD_REQUEST_ERROR", description: "Payment failed (simulated)", metadata: { payment_id: payment.id, order_id: order.id } } });
      }
      order.status = "paid";
      order.amount_paid = order.amount;
      order.amount_due = 0;
      await sendRazorpayEvent("payment.captured", { payment: wrap(payment) }, owner.keyId, false);
      await sendRazorpayEvent("order.paid", { payment: wrap(payment), order: wrap(order) }, owner.keyId, false);
      return json(res, 200, {
        status: "paid",
        response: {
          razorpay_payment_id: payment.id,
          razorpay_order_id: order.id,
          razorpay_signature: razorpayPaymentSignature(order.id, payment.id, owner.keySecret),
        },
      });
    }

    const s = sub as Subscription;
    const plan = plans.get(s.plan_id);
    const payment = newPayment((plan?.item.amount ?? 0) * s.quantity, plan?.item.currency ?? "INR", {
      subscription_id: s.id,
      invoice_id: id("inv", 14),
      notes: s.notes,
      status: outcome === "paid" ? "captured" : "failed",
      captured: outcome === "paid",
    });
    if (outcome !== "paid") {
      await sendRazorpayEvent("payment.failed", { payment: wrap(payment) }, owner.keyId, true);
      return json(res, 200, { status: "failed", error: { code: "BAD_REQUEST_ERROR", description: "Payment failed (simulated)" } });
    }
    const start = nowSeconds();
    const length = (PERIOD_SECONDS[plan?.period ?? "monthly"] ?? 2_592_000) * (plan?.interval ?? 1);
    s.status = "active";
    s.current_start = start;
    s.current_end = start + length;
    s.charge_at = s.current_end;
    s.paid_count += 1;
    s.remaining_count = Math.max(0, s.total_count - s.paid_count);
    await sendRazorpayEvent("subscription.authenticated", { subscription: wrap(s) }, owner.keyId, true);
    await sendRazorpayEvent("subscription.activated", { subscription: wrap(s) }, owner.keyId, true);
    await sendRazorpayEvent("subscription.charged", { subscription: wrap(s), payment: wrap(payment) }, owner.keyId, true);
    json(res, 200, {
      status: "paid",
      response: {
        razorpay_payment_id: payment.id,
        razorpay_subscription_id: s.id,
        razorpay_signature: razorpaySubscriptionSignature(payment.id, s.id, owner.keySecret),
      },
    });
  },
};
