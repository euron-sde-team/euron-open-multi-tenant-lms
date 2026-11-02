/**
 * Boots the real Express apps in-process on ephemeral ports, plus the provider stubs
 * (Stripe, Razorpay, EVS), and hands back their base URLs and a Kysely handle on the
 * test database.
 *
 * Order matters: every app reads its config once, at import. So the HTTP servers are
 * bound first (with a placeholder handler), the stub and API URLs are written into
 * process.env, and only then are the apps imported and plugged into their servers.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

import type { DB } from "../../../src/db/types";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/** A webhook the stubs sent, as it arrived (raw body + headers), for replays. */
export interface CapturedWebhook {
  target: "learner" | "admin";
  path: string;
  headers: Record<string, string>;
  body: string;
  status: number | null;
}

export interface Stack {
  console: string;
  admin: string;
  learner: string;
  stubs: string;
  db: Kysely<DB>;
  /** Every webhook the stubs delivered (or tried to), oldest first. */
  webhooks: CapturedWebhook[];
  /** While false, stub webhooks are recorded but not forwarded (a lost delivery). */
  relay: { forward: boolean };
  /** Re-send a captured webhook byte for byte, as a gateway retry would. */
  replay: (hook: CapturedWebhook) => Promise<{ status: number; text: string }>;
  stop: () => Promise<void>;
}

/** Secrets every app and the stubs agree on for the run. Never used outside tests. */
export const TEST_SECRETS = {
  stubStripeWebhookSecret: "whsec_integration_test_only",
  stubRazorpayWebhookSecret: "rzp_whsec_integration_test_only",
  platformStripeSecretKey: "sk_test_integration_platform",
  platformStripeWebhookSecret: "whsec_integration_platform_only",
  platformRazorpayKeyId: "rzp_test_integrationplatform",
  platformRazorpayKeySecret: "rzp_secret_integration_platform",
  platformRazorpayWebhookSecret: "rzp_whsec_integration_platform",
  evsApiKey: "evs_integration_test_key",
};

async function bind(): Promise<{ server: Server; url: string; set: (h: Handler) => void }> {
  let handler: Handler = (_req, res) => {
    res.statusCode = 503;
    res.end("booting");
  };
  const server = createServer((req, res) => handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}`, set: (h) => (handler = h) };
}

function assertTestDatabase(): void {
  const name = process.env.PG_DATABASE ?? "";
  if (!/_test$/.test(name)) {
    throw new Error(`integration tests refuse to run against '${name}': PG_DATABASE must end in _test`);
  }
}

export function testDb(): Kysely<DB> {
  assertTestDatabase();
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        host: process.env.PG_DATABASE_HOST,
        port: Number(process.env.PG_DATABASE_PORT),
        user: process.env.PG_DATABASE_USER,
        password: process.env.PG_DATABASE_PASSWORD,
        database: process.env.PG_DATABASE,
        max: 4,
      }),
    }),
  });
}

export async function startStack(): Promise<Stack> {
  assertTestDatabase();
  const [consoleSrv, adminSrv, learnerSrv, stubsSrv, learnerRelay, adminRelay] = await Promise.all([bind(), bind(), bind(), bind(), bind(), bind()]);

  // The stubs post webhooks to these relays, which record them and (unless told to
  // drop them) forward them to the real API.
  const webhooks: CapturedWebhook[] = [];
  const relay = { forward: true };
  const targetUrl = { learner: learnerSrv.url, admin: adminSrv.url };
  const forward = async (hook: CapturedWebhook) => {
    const res = await fetch(`${targetUrl[hook.target]}${hook.path}`, { method: "POST", headers: hook.headers, body: hook.body });
    return { status: res.status, text: await res.text() };
  };
  const relayHandler =
    (target: CapturedWebhook["target"]): Handler =>
    (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", async () => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === "string" && !["host", "content-length", "connection"].includes(k)) headers[k] = v;
        }
        const hook: CapturedWebhook = { target, path: req.url ?? "/", headers, body: Buffer.concat(chunks).toString("utf8"), status: null };
        webhooks.push(hook);
        if (!relay.forward) {
          res.writeHead(503);
          res.end("dropped by test relay");
          return;
        }
        try {
          const out = await forward(hook);
          hook.status = out.status;
          res.writeHead(out.status, { "Content-Type": "application/json" });
          res.end(out.text);
        } catch (err) {
          res.writeHead(502);
          res.end(String(err));
        }
      });
    };
  learnerRelay.set(relayHandler("learner"));
  adminRelay.set(relayHandler("admin"));

  Object.assign(process.env, {
    STUBS_PUBLIC_URL: stubsSrv.url,
    STUBS_LEARNER_API_URL: learnerRelay.url,
    STUBS_ADMIN_API_URL: adminRelay.url,
    STUBS_STRIPE_WEBHOOK_SECRET: TEST_SECRETS.stubStripeWebhookSecret,
    STUBS_RAZORPAY_WEBHOOK_SECRET: TEST_SECRETS.stubRazorpayWebhookSecret,
    STUBS_PLATFORM_STRIPE_SECRET_KEY: TEST_SECRETS.platformStripeSecretKey,
    STUBS_PLATFORM_RAZORPAY_KEY_ID: TEST_SECRETS.platformRazorpayKeyId,
    STUBS_EVS_API_KEY: TEST_SECRETS.evsApiKey,
    STRIPE_API_BASE: stubsSrv.url,
    RAZORPAY_API_BASE: stubsSrv.url,
    EVS_API_URL: stubsSrv.url,
    EVS_API_KEY: TEST_SECRETS.evsApiKey,
    PLATFORM_STRIPE_SECRET_KEY: TEST_SECRETS.platformStripeSecretKey,
    PLATFORM_STRIPE_WEBHOOK_SECRET: TEST_SECRETS.platformStripeWebhookSecret,
    PLATFORM_RAZORPAY_KEY_ID: TEST_SECRETS.platformRazorpayKeyId,
    PLATFORM_RAZORPAY_KEY_SECRET: TEST_SECRETS.platformRazorpayKeySecret,
    PLATFORM_RAZORPAY_WEBHOOK_SECRET: TEST_SECRETS.platformRazorpayWebhookSecret,
    LEARNER_API_INTERNAL_URL: learnerSrv.url,
    CONSOLE_API_INTERNAL_URL: consoleSrv.url,
  });

  const stubs = await import("../../../../stubs/src/server.ts");
  stubsSrv.set((req, res) => {
    stubs.handle(req, res).catch((err: unknown) => {
      if (!res.headersSent) res.writeHead(500);
      res.end(String(err));
    });
  });

  const [consoleApp, adminApp, learnerApp] = await Promise.all([
    import("../../../../console-api/src/app"),
    import("../../../../admin-api/src/app"),
    import("../../../../learner-api/src/app"),
  ]);
  consoleSrv.set(consoleApp.default as unknown as Handler);
  adminSrv.set(adminApp.default as unknown as Handler);
  learnerSrv.set(learnerApp.default as unknown as Handler);

  const db = testDb();

  return {
    console: `${consoleSrv.url}/api/v1`,
    admin: `${adminSrv.url}/api/v1`,
    learner: `${learnerSrv.url}/api/v1`,
    stubs: stubsSrv.url,
    db,
    webhooks,
    relay,
    replay: forward,
    stop: async () => {
      await Promise.all(
        [consoleSrv, adminSrv, learnerSrv, stubsSrv, learnerRelay, adminRelay].map(
          ({ server }) =>
            new Promise<void>((resolve) => {
              server.closeAllConnections();
              server.close(() => resolve());
            })
        )
      );
      await db.destroy();
    },
  };
}

// Response bodies are loosely typed on purpose: specs assert on their shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CallResult<T = any> {
  status: number;
  body: T;
  text: string;
}

/** fetch + JSON with a bearer token, tenant header and learner host when given. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function call<T = any>(
  base: string,
  method: string,
  path: string,
  opts: { token?: string; tenantId?: string; host?: string; body?: unknown; raw?: string; headers?: Record<string, string> } = {}
): Promise<CallResult<T>> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers["X-Tenant-Id"] = opts.tenantId;
  if (opts.host) headers["X-Tenant-Host"] = opts.host;
  let payload: string | undefined;
  if (opts.raw !== undefined) {
    payload = opts.raw;
    headers["Content-Type"] ??= "application/json";
  } else if (opts.body !== undefined) {
    payload = JSON.stringify(opts.body);
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${base}${path}`, { method, headers, body: payload, redirect: "manual" });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, body, text };
}
