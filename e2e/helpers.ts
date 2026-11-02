/**
 * Shared helpers for the end-to-end suite. Setup goes through the real REST APIs (never the
 * database) so each test spends browser time only on the behaviour under test.
 *
 * Three tiers, each a Next.js app and its API:
 *   console (operator)   E2E_CONSOLE_URL   http://localhost:3600   console-api  E2E_CONSOLE_API_URL
 *   admin (tenant staff) E2E_ADMIN_URL     http://localhost:3610   admin-api    E2E_ADMIN_API_URL
 *   web (learners)       E2E_WEB_URL       http://northwind.lvh.me:3620  learner-api  E2E_LEARNER_API_URL
 *
 * The demo accounts come from the demo seed (`make demo`). Every one signs in with the
 * demo password: E2E_DEMO_PASSWORD, else MTLMS_DEMO_PASSWORD from deploy/compose/.env
 * (`make env`). Account emails can be overridden with E2E_*_EMAIL.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";

const trim = (u: string) => u.replace(/\/+$/, "");
const env = process.env;

export const ROOT_DOMAIN = env.E2E_ROOT_DOMAIN || "lvh.me";
export const DEMO_TENANT = env.E2E_TENANT || "northwind";

export const CONSOLE = trim(env.E2E_CONSOLE_URL || "http://localhost:3600");
export const ADMIN = trim(env.E2E_ADMIN_URL || "http://localhost:3610");
/** The demo tenant's storefront. */
export const WEB = trim(env.E2E_WEB_URL || `http://${DEMO_TENANT}.${ROOT_DOMAIN}:3620`);

export const CONSOLE_API = trim(env.E2E_CONSOLE_API_URL || "http://localhost:5076/api/v1");
export const ADMIN_API = trim(env.E2E_ADMIN_API_URL || "http://localhost:5086/api/v1");
export const LEARNER_API = trim(env.E2E_LEARNER_API_URL || "http://localhost:5096/api/v1");

export const MAILPIT = trim(env.E2E_MAILPIT_URL || "http://localhost:8096");
export const STUBS = trim(env.E2E_STUBS_URL || "http://localhost:5189");

/** The tenant the learner API resolves for requests made outside a browser. */
export const TENANT_HOST = new URL(WEB).host;

export type Tier = "console" | "admin" | "learner";

/** Sign-in route of each API (relative to its /api/v1). */
const LOGIN: Record<Tier, { base: string; path: string; headers?: Record<string, string> }> = {
  console: { base: CONSOLE_API, path: "/admin/auth/login" },
  admin: { base: ADMIN_API, path: "/tenant/auth/login" },
  learner: { base: LEARNER_API, path: "/auth/login", headers: { "X-Tenant-Host": TENANT_HOST } },
};

export interface Account {
  email: string;
  password: string;
}

/** The password `make demo` seeded every account with. */
export function demoPassword(): string {
  if (env.E2E_DEMO_PASSWORD) return env.E2E_DEMO_PASSWORD;
  const file = path.join(__dirname, "..", "deploy", "compose", ".env");
  const line = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").find((l) => l.startsWith("MTLMS_DEMO_PASSWORD="))
    : undefined;
  if (!line) throw new Error("No demo password: run `make env && make demo`, or set E2E_DEMO_PASSWORD");
  return line.slice("MTLMS_DEMO_PASSWORD=".length).trim().replace(/^["']|["']$/g, "");
}

const demo = (email: string): Account => ({ email, password: demoPassword() });

/** Seeded demo accounts. */
export const DEMO = {
  operator: () => demo(env.E2E_OPERATOR_EMAIL || "root@example.com"),
  tenantOwner: () => demo(env.E2E_TENANT_OWNER_EMAIL || `maya@${DEMO_TENANT}.example.com`),
  learner: () => demo(env.E2E_LEARNER_EMAIL || "lee@example.com"),
} satisfies Record<string, () => Account>;

const run = randomBytes(3).toString("hex");
let seq = 0;

/** A unique suffix for names and addresses (lowercase letters and digits). */
export function uniq(prefix = "e2e"): string {
  seq += 1;
  return `${prefix}${run}${seq}${randomBytes(2).toString("hex")}`;
}

type Json = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Calls an API, failing the test on an unexpected status. Returns the `data` of the
 * response envelope ({ success, data, message, statusCode }).
 */
export async function call<T = Json>(
  request: APIRequestContext,
  method: Method,
  url: string,
  opts: { token?: string; data?: unknown; expect?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const r = await request.fetch(url, { method, headers, data: opts.data as never, maxRedirects: 0 });
  const text = await r.text();
  if (opts.expect !== undefined) expect(r.status(), `${method} ${url}: ${text}`).toBe(opts.expect);
  else expect(r.ok(), `${method} ${url} -> ${r.status()}: ${text}`).toBe(true);
  try {
    const body = text ? JSON.parse(text) : {};
    return (body && typeof body === "object" && "data" in body ? body.data : body) as T;
  } catch {
    return {} as T;
  }
}

/** Written by global-setup: one API session per demo account for the run. */
export const SESSIONS_FILE = path.join(__dirname, ".results", "sessions.json");

const sessions = new Map<string, { token: string }>(
  fs.existsSync(SESSIONS_FILE) ? Object.entries(JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"))) : [],
);

/** Signs in through a tier's API once per account and process; returns the bearer token. */
export async function apiLogin(request: APIRequestContext, tier: Tier, account: Account): Promise<string> {
  const key = `${tier}:${account.email}`;
  const cached = sessions.get(key);
  if (cached?.token) return cached.token;
  const { base, path: route, headers } = LOGIN[tier];
  const r = await call<{ token?: string; accessToken?: string }>(request, "POST", `${base}${route}`, { data: account, headers });
  const token = r.token ?? r.accessToken ?? "";
  sessions.set(key, { token });
  return token;
}

/** A call to one tier's API (route relative to its /api/v1). The learner API gets the tenant host. */
export function tierApi<T = Json>(request: APIRequestContext, tier: Tier, token: string | undefined, method: Method, route: string, data?: unknown) {
  return call<T>(request, method, `${LOGIN[tier].base}${route}`, { token, data, headers: LOGIN[tier].headers });
}

/** The newest mail Mailpit received for `to` (SES on Floci relays every send there). */
export async function latestMail(request: APIRequestContext, to: string): Promise<{ Subject: string; Text: string; HTML: string }> {
  let message: { Subject: string; Text: string; HTML: string } | undefined;
  await expect
    .poll(
      async () => {
        const r = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=1`).catch(() => null);
        const id = r?.ok() ? (((await r.json()).messages ?? []) as { ID: string }[])[0]?.ID : undefined;
        if (!id) return false;
        message = await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json();
        return true;
      },
      { timeout: 30_000, message: `mail to ${to}` },
    )
    .toBe(true);
  return message!;
}

/** The last webhooks the provider stubs delivered (target, status, response). */
export async function stubWebhooks(request: APIRequestContext): Promise<Array<{ provider: string; event: string; url: string; status: number | null }>> {
  return (await request.get(`${STUBS}/__stubs/webhooks`)).json();
}

/** Signs in through a tier's real login page (each app keeps its own session store). */
export async function uiLogin(page: import("@playwright/test").Page, tier: Tier, account: Account): Promise<void> {
  const url = tier === "console" ? `${CONSOLE}/login` : tier === "admin" ? `${ADMIN}/login` : `${WEB}/login`;
  await page.goto(url);
  await page.getByLabel(/email/i).first().fill(account.email);
  await page.getByLabel(/password/i).first().fill(account.password);
  await page.getByRole("button", { name: /sign in|log in|login|continue/i }).last().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 });
}
