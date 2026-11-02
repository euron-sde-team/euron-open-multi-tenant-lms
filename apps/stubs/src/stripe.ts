/**
 * Stripe: the REST calls the `stripe` SDK makes for hosted Checkout, plus the hosted page.
 *
 *   POST /v1/checkout/sessions              create (form-encoded, as the SDK sends it)
 *   GET  /v1/checkout/sessions/:id          retrieve (confirmPayment)
 *   POST /v1/payment_intents                create
 *   GET  /v1/payment_intents/:id            retrieve
 *   POST /v1/payment_intents/:id/confirm    succeed, and send payment_intent.succeeded
 *   POST /v1/refunds                        refund a payment intent or charge
 *   GET  /stripe/checkout/:id               the hosted checkout page (session.url)
 *   POST /stripe/checkout/:id/pay           pay: complete the session, send the signed
 *                                           checkout.session.completed webhook, redirect
 *                                           to success_url
 *   POST /stripe/checkout/:id/cancel        back to cancel_url
 *
 * Point the SDK here with `new Stripe(key, { host, port, protocol })` (STRIPE_API_BASE).
 */
import type { ServerResponse } from "node:http";

import { config } from "./config.ts";
import type { Req } from "./http.ts";
import { credentials, escapeHtml, formatAmount, html, id, int, json, nowSeconds, page, record, redirect, str } from "./http.ts";
import { stripeSignatureHeader } from "./signatures.ts";
import { deliver } from "./webhooks.ts";

interface Session {
  id: string;
  object: "checkout.session";
  mode: string;
  status: "open" | "complete" | "expired";
  payment_status: "unpaid" | "paid" | "no_payment_required";
  amount_total: number;
  currency: string;
  client_reference_id: string | null;
  customer_email: string | null;
  metadata: Record<string, string>;
  payment_intent: string | null;
  success_url: string;
  cancel_url: string;
  url: string;
  created: number;
  livemode: false;
  /** Not part of Stripe's object: which key created it (decides the webhook target). */
  _key: string;
}

interface PaymentIntent {
  id: string;
  object: "payment_intent";
  amount: number;
  amount_received: number;
  currency: string;
  status: "requires_payment_method" | "succeeded" | "canceled";
  client_secret: string;
  metadata: Record<string, string>;
  latest_charge: string | null;
  created: number;
  livemode: false;
  _key: string;
}

const sessions = new Map<string, Session>();
const intents = new Map<string, PaymentIntent>();

const publicView = <T extends { _key: string }>(o: T): Omit<T, "_key"> => {
  const { _key, ...rest } = o;
  void _key;
  return rest;
};

function stripeError(res: ServerResponse, status: number, message: string, type = "invalid_request_error"): void {
  json(res, status, { error: { type, message } });
}

function apiKey(req: Req, res: ServerResponse): string | null {
  const c = credentials(req.headers);
  const key = c.user;
  if (!key.startsWith("sk_") && !key.startsWith("rk_")) {
    stripeError(res, 401, "Invalid API Key provided (the Stripe stub expects an sk_ test key).", "authentication_error");
    return null;
  }
  return key;
}

const isPlatform = (key: string): boolean => key === config.platformStripeSecretKey;

function webhookUrl(key: string): string {
  return isPlatform(key)
    ? `${config.adminApiUrl}${config.adminStripeWebhookPath}`
    : `${config.learnerApiUrl}${config.learnerStripeWebhookPath}`;
}

export async function sendStripeEvent(type: string, object: unknown, key: string): Promise<void> {
  const event = {
    id: id("evt", 24),
    object: "event",
    api_version: "2025-01-27.acacia",
    created: nowSeconds(),
    type,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: { object },
  };
  const body = JSON.stringify(event);
  await deliver("stripe", type, webhookUrl(key), body, {
    "Stripe-Signature": stripeSignatureHeader(body, config.stripeWebhookSecret),
  });
}

function lineItemsTotal(body: Record<string, unknown>): { amount: number; currency: string; name: string } {
  const items = Array.isArray(body.line_items) ? (body.line_items as Record<string, unknown>[]) : [];
  let amount = 0;
  let currency = str(body.currency, "usd");
  let name = "Order";
  for (const item of items) {
    const price = (item.price_data ?? {}) as Record<string, unknown>;
    const product = (price.product_data ?? {}) as Record<string, unknown>;
    amount += int(price.unit_amount) * Math.max(1, int(item.quantity, 1));
    currency = str(price.currency, currency);
    name = str(product.name, name);
  }
  return { amount, currency, name };
}

function newIntent(amount: number, currency: string, metadata: Record<string, string>, key: string): PaymentIntent {
  const intentId = id("pi", 24);
  const intent: PaymentIntent = {
    id: intentId,
    object: "payment_intent",
    amount,
    amount_received: 0,
    currency,
    status: "requires_payment_method",
    client_secret: `${intentId}_secret_${id("cs", 16).slice(3)}`,
    metadata,
    latest_charge: null,
    created: nowSeconds(),
    livemode: false,
    _key: key,
  };
  intents.set(intent.id, intent);
  return intent;
}

function succeed(intent: PaymentIntent): void {
  intent.status = "succeeded";
  intent.amount_received = intent.amount;
  intent.latest_charge = id("ch", 24);
}

export const stripeRoutes = {
  /** GET /v1/balance: admin-api calls it to verify a tenant's secret key. */
  balance(req: Req, res: ServerResponse): void {
    if (!apiKey(req, res)) return;
    json(res, 200, {
      object: "balance",
      livemode: false,
      available: [{ amount: 0, currency: "usd", source_types: { card: 0 } }],
      pending: [{ amount: 0, currency: "usd", source_types: { card: 0 } }],
    });
  },

  createSession(req: Req, res: ServerResponse): void {
    const key = apiKey(req, res);
    if (!key) return;
    const b = req.body;
    const successUrl = str(b.success_url);
    if (!successUrl) return stripeError(res, 400, "Missing required param: success_url.");
    const { amount, currency } = lineItemsTotal(b);
    const sessionId = id("cs_test", 40);
    const session: Session = {
      id: sessionId,
      object: "checkout.session",
      mode: str(b.mode, "payment"),
      status: "open",
      payment_status: "unpaid",
      amount_total: amount,
      currency: currency.toLowerCase(),
      client_reference_id: str(b.client_reference_id) || null,
      customer_email: str(b.customer_email) || null,
      metadata: record(b.metadata),
      payment_intent: null,
      success_url: successUrl,
      cancel_url: str(b.cancel_url, successUrl),
      url: `${config.publicUrl}/stripe/checkout/${sessionId}`,
      created: nowSeconds(),
      livemode: false,
      _key: key,
    };
    sessions.set(session.id, session);
    json(res, 200, publicView(session));
  },

  getSession(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (!apiKey(req, res)) return;
    const s = sessions.get(p.id ?? "");
    if (!s) return stripeError(res, 404, `No such checkout.session: '${p.id}'`);
    json(res, 200, publicView(s));
  },

  createIntent(req: Req, res: ServerResponse): void {
    const key = apiKey(req, res);
    if (!key) return;
    const amount = int(req.body.amount);
    if (amount <= 0) return stripeError(res, 400, "Missing required param: amount.");
    json(res, 200, publicView(newIntent(amount, str(req.body.currency, "usd").toLowerCase(), record(req.body.metadata), key)));
  },

  getIntent(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (!apiKey(req, res)) return;
    const intent = intents.get(p.id ?? "");
    if (!intent) return stripeError(res, 404, `No such payment_intent: '${p.id}'`);
    json(res, 200, publicView(intent));
  },

  async confirmIntent(req: Req, res: ServerResponse, p: Record<string, string>): Promise<void> {
    if (!apiKey(req, res)) return;
    const intent = intents.get(p.id ?? "");
    if (!intent) return stripeError(res, 404, `No such payment_intent: '${p.id}'`);
    if (intent.status !== "succeeded") {
      succeed(intent);
      await sendStripeEvent("payment_intent.succeeded", publicView(intent), intent._key);
    }
    json(res, 200, publicView(intent));
  },

  refund(req: Req, res: ServerResponse): void {
    if (!apiKey(req, res)) return;
    const pi = str(req.body.payment_intent);
    const charge = str(req.body.charge);
    const intent = pi ? intents.get(pi) : [...intents.values()].find((i) => i.latest_charge === charge);
    if (!pi && !charge) return stripeError(res, 400, "One of payment_intent or charge is required.");
    json(res, 200, {
      id: id("re", 24),
      object: "refund",
      amount: int(req.body.amount, intent?.amount ?? 0),
      currency: intent?.currency ?? "usd",
      payment_intent: pi || intent?.id || null,
      charge: charge || intent?.latest_charge || null,
      status: "succeeded",
      metadata: record(req.body.metadata),
      created: nowSeconds(),
    });
  },

  hostedPage(_req: Req, res: ServerResponse, p: Record<string, string>): void {
    const s = sessions.get(p.id ?? "");
    if (!s) return html(res, 404, page("Not found", "<h1>Checkout session not found</h1><p>The stub keeps sessions in memory; a restart forgets them.</p>"));
    if (s.status !== "open") return redirect(res, s.success_url.replace("{CHECKOUT_SESSION_ID}", s.id));
    html(
      res,
      200,
      page(
        "Stripe checkout (stub)",
        `<h1>Stripe checkout</h1><p>${escapeHtml(s.customer_email ?? "Guest")}</p>
<div class="amount">${escapeHtml(formatAmount(s.amount_total, s.currency))}</div>
<form method="post" action="/stripe/checkout/${escapeHtml(s.id)}/pay" style="display:inline"><button class="primary" type="submit" id="pay">Pay</button></form>
<form method="post" action="/stripe/checkout/${escapeHtml(s.id)}/cancel" style="display:inline"><button type="submit" id="cancel">Cancel</button></form>`,
      ),
    );
  },

  async pay(_req: Req, res: ServerResponse, p: Record<string, string>): Promise<void> {
    const s = sessions.get(p.id ?? "");
    if (!s) return html(res, 404, page("Not found", "<h1>Checkout session not found</h1>"));
    if (s.status === "open") {
      const intent = newIntent(s.amount_total, s.currency, s.metadata, s._key);
      succeed(intent);
      s.payment_intent = intent.id;
      s.status = "complete";
      s.payment_status = s.amount_total > 0 ? "paid" : "no_payment_required";
      // Delivered before the redirect, as Stripe usually manages, so the order is paid
      // by the time the success page asks.
      await sendStripeEvent("checkout.session.completed", publicView(s), s._key);
    }
    redirect(res, s.success_url.replace("{CHECKOUT_SESSION_ID}", s.id));
  },

  cancel(_req: Req, res: ServerResponse, p: Record<string, string>): void {
    const s = sessions.get(p.id ?? "");
    if (!s) return html(res, 404, page("Not found", "<h1>Checkout session not found</h1>"));
    redirect(res, s.cancel_url.replace("{CHECKOUT_SESSION_ID}", s.id));
  },
};
