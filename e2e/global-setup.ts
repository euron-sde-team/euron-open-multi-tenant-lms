/**
 * Wait until the stack answers before the first test: `make up` returns as soon as the
 * containers report healthy, and the first requests can still race the servers' warm-up.
 * Polls the three APIs, the three apps (the storefront on the demo tenant's host) and the
 * provider stubs, then signs each demo account in once and shares the sessions through a
 * file, so the sign-in rate limits do not trip across a run.
 */
import fs from "node:fs";
import path from "node:path";
import { request as pwRequest } from "@playwright/test";

import { ADMIN, ADMIN_API, apiLogin, CONSOLE, CONSOLE_API, DEMO, LEARNER_API, SESSIONS_FILE, STUBS, WEB, type Tier } from "./helpers";

async function ready(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3_000), redirect: "manual" });
    return r.status < 500;
  } catch {
    return false;
  }
}

export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + 120_000;
  const urls = [`${CONSOLE_API}/health`, `${ADMIN_API}/health`, `${LEARNER_API}/health`, `${CONSOLE}/`, `${ADMIN}/`, `${WEB}/`, `${STUBS}/health`];
  for (const url of urls) {
    let ok = await ready(url);
    while (!ok && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1_000));
      ok = await ready(url);
    }
    if (!ok) throw new Error(`${url} did not answer within 120 seconds: is the stack up (make up)?`);
  }

  const request = await pwRequest.newContext();
  const accounts: Array<[Tier, ReturnType<(typeof DEMO)[keyof typeof DEMO]>]> = [
    ["console", DEMO.operator()],
    ["admin", DEMO.tenantOwner()],
  ];
  const sessions: Record<string, { token: string }> = {};
  for (const [tier, account] of accounts) {
    sessions[`${tier}:${account.email}`] = { token: await apiLogin(request, tier, account) };
  }
  await request.dispose();
  fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
}
