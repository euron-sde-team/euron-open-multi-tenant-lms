/**
 * Local provider stubs: one dependency-free HTTP server standing in for Stripe, Razorpay,
 * EVS and an OpenAI-compatible API. See ../README.md.
 *
 *   node src/server.ts          (Node 22.18+ strips the types natively)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { config } from "./config.ts";
import { evsRoutes } from "./evs.ts";
import { parseBody } from "./form.ts";
import type { Handler, Req } from "./http.ts";
import { escapeHtml, html, json } from "./http.ts";
import { openaiRoutes } from "./openai.ts";
import { razorpayRoutes } from "./razorpay.ts";
import { stripeRoutes } from "./stripe.ts";
import { recentDeliveries } from "./webhooks.ts";

type Route = [method: string, pattern: string, handler: Handler];

const routes: Route[] = [
  ["GET", "/health", (_q, r) => json(r, 200, { ok: true })],
  ["GET", "/__stubs/webhooks", (_q, r) => json(r, 200, recentDeliveries())],

  // Stripe
  ["GET", "/v1/balance", stripeRoutes.balance],
  ["POST", "/v1/checkout/sessions", stripeRoutes.createSession],
  ["GET", "/v1/checkout/sessions/:id", stripeRoutes.getSession],
  ["POST", "/v1/payment_intents", stripeRoutes.createIntent],
  ["GET", "/v1/payment_intents/:id", stripeRoutes.getIntent],
  ["POST", "/v1/payment_intents/:id/confirm", stripeRoutes.confirmIntent],
  ["POST", "/v1/refunds", stripeRoutes.refund],
  ["GET", "/stripe/checkout/:id", stripeRoutes.hostedPage],
  ["POST", "/stripe/checkout/:id/pay", stripeRoutes.pay],
  ["POST", "/stripe/checkout/:id/cancel", stripeRoutes.cancel],

  // Razorpay
  ["POST", "/v1/orders", razorpayRoutes.createOrder],
  ["GET", "/v1/orders/:id", razorpayRoutes.getOrder],
  ["GET", "/v1/orders/:id/payments", razorpayRoutes.orderPayments],
  ["GET", "/v1/payments/:id", razorpayRoutes.getPayment],
  ["POST", "/v1/payments/:id/capture", razorpayRoutes.capture],
  ["POST", "/v1/payments/:id/refund", razorpayRoutes.refund],
  ["GET", "/v1/plans", razorpayRoutes.listPlans],
  ["POST", "/v1/plans", razorpayRoutes.createPlan],
  ["GET", "/v1/plans/:id", razorpayRoutes.getPlan],
  ["POST", "/v1/subscriptions", razorpayRoutes.createSubscription],
  ["GET", "/v1/subscriptions/:id", razorpayRoutes.getSubscription],
  ["POST", "/v1/subscriptions/:id/:action(cancel|pause|resume)", razorpayRoutes.subscriptionAction],
  ["GET", "/razorpay/checkout.js", razorpayRoutes.checkoutScript],
  ["GET", "/razorpay/pay", razorpayRoutes.hostedPage],
  ["POST", "/razorpay/pay", razorpayRoutes.pay],

  // EVS
  ["POST", "/v1/videos/:id/playback-sessions", evsRoutes.playbackSession],
  ["GET", "/evs/hls/sample/:file", evsRoutes.sample],

  // OpenAI-compatible
  ["GET", "/v1/models", openaiRoutes.models],
  ["POST", "/v1/chat/completions", openaiRoutes.chat],
];

/** "/v1/orders/:id" -> a regex with named groups; ":name(a|b)" restricts the segment. */
function compile(pattern: string): RegExp {
  const source = pattern.replace(/:([a-zA-Z]+)(\([^)]*\))?/g, (_m, name: string, alt?: string) => `(?<${name}>${alt ? alt.slice(1, -1) : "[^/]+"})`);
  return new RegExp(`^${source}/?$`);
}

const table = routes.map(([method, pattern, handler]) => ({ method, regex: compile(pattern), handler }));

/** `/stripe/v1/...` and `/razorpay/v1/...` are accepted too, for clients that need a distinct base. */
function normalise(path: string): string {
  return path.replace(/^\/(stripe|razorpay|evs|openai)(?=\/v1\/)/, "");
}

function index(res: ServerResponse): void {
  const rows = routes.map(([m, p]) => `<tr><td>${m}</td><td><code>${escapeHtml(p)}</code></td></tr>`).join("");
  html(
    res,
    200,
    `<!doctype html><meta charset="utf-8"><title>Provider stubs</title><body style="font-family:system-ui;margin:24px">
<h1>Provider stubs</h1><p>Stripe, Razorpay, EVS and an OpenAI-compatible API, simulated locally. Recent webhook deliveries: <a href="/__stubs/webhooks">/__stubs/webhooks</a>.</p>
<table cellpadding="4">${rows}</table></body>`,
  );
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 5 * 1024 * 1024) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", "http://stubs.local");
  // HEAD is answered as GET (node drops the body).
  const method = req.method === "HEAD" ? "GET" : (req.method ?? "GET");
  const path = normalise(url.pathname);
  if (method === "GET" && path === "/") return index(res);

  for (const route of table) {
    if (route.method !== method) continue;
    const match = route.regex.exec(path);
    if (!match) continue;
    const raw = method === "GET" ? "" : await readBody(req);
    const parsed: Req = {
      method,
      path,
      query: url.searchParams,
      headers: req.headers,
      raw,
      body: method === "GET" ? {} : parseBody(raw, req.headers["content-type"]),
    };
    await route.handler(parsed, res, { ...(match.groups ?? {}) });
    return;
  }
  json(res, 404, { error: { message: `No stub for ${method} ${url.pathname}` } });
}

export function start(): ReturnType<typeof createServer> {
  const server = createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      console.error("[stubs] handler failed", err);
      if (!res.headersSent) json(res, 500, { error: { message: err instanceof Error ? err.message : String(err) } });
      else res.end();
    });
  });
  server.listen(config.port, config.host, () => {
    console.log(`[stubs] listening on ${config.host}:${config.port} (public ${config.publicUrl})`);
    console.log(`[stubs] webhooks: learner ${config.learnerApiUrl}, admin ${config.adminApiUrl}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) start();
