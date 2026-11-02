/**
 * Operator auth hardening: a suspended operator's token stops working at once, the
 * tenant-analytics routes check permissions like every other operator route, and
 * operator login is rate limited per IP and per email.
 */
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createOperator, createTenant, short, uid, type Operator } from "../../../admin-api/tests/integration/support/fixtures";
import { call, startStack, type Stack } from "../../../admin-api/tests/integration/support/stack";

let stack: Stack;
let operator: Operator;

// Low limits for this file only: every app reads its config at import.
process.env.AUTH_RATE_LIMIT_PER_EMAIL = "3";
process.env.AUTH_RATE_LIMIT_PER_IP = "8";

beforeAll(async () => {
  stack = await startStack();
  operator = await createOperator(stack.db);
});
afterAll(() => stack?.stop());

/** An ACTIVE operator holding one seeded role (or none). */
async function operatorWithRole(role: string | null): Promise<Operator> {
  const id = uid("OP");
  const email = `operator-${short()}@example.com`;
  const now = new Date();
  await stack.db.insertInto("admin_users").values({ id, email, name: "Scoped Operator", status: "ACTIVE", email_verified: true, created_at: now, updated_at: now }).execute();
  if (role) {
    const r = await stack.db.selectFrom("admin_roles").select("id").where("code", "=", role).executeTakeFirstOrThrow();
    await stack.db.insertInto("admin_user_roles").values({ admin_user_id: id, role_id: r.id }).execute();
  }
  return { id, email, token: jwt.sign({ id, email, type: "admin" }, process.env.JWT_SECRET!, { expiresIn: "1h" }) };
}

describe("operator auth", () => {
  it("rejects a valid token once the operator is suspended", async () => {
    const op = await operatorWithRole("SUPERADMIN");
    expect((await call(stack.console, "GET", "/admin/auth/me", { token: op.token })).status).toBe(200);

    await stack.db.updateTable("admin_users").set({ status: "SUSPENDED" }).where("id", "=", op.id).execute();
    const me = await call(stack.console, "GET", "/admin/auth/me", { token: op.token });
    expect(me.status).toBe(401);
    expect((await call(stack.console, "GET", "/admin/tenants", { token: op.token })).status).toBe(401);
  });

  it("guards tenant-analytics with tenants.view, and send-email with tenants.manage", async () => {
    const tenant = await createTenant(stack.db, "analytics");
    const nobody = await operatorWithRole(null);
    const finance = await operatorWithRole("FINANCE"); // tenants.view, not tenants.manage

    expect((await call(stack.console, "GET", "/admin/tenant-analytics", { token: nobody.token })).status).toBe(403);
    expect((await call(stack.console, "GET", `/admin/tenant-analytics/${tenant.id}`, { token: nobody.token })).status).toBe(403);
    expect((await call(stack.console, "GET", "/admin/tenant-analytics/export", { token: nobody.token })).status).toBe(403);

    const list = await call(stack.console, "GET", "/admin/tenant-analytics", { token: finance.token });
    expect(list.status, list.text).toBe(200);
    const send = await call(stack.console, "POST", `/admin/tenant-analytics/${tenant.id}/send-email`, {
      token: finance.token,
      body: { subject: "Hello", body: "Hi" },
    });
    expect(send.status).toBe(403);

    expect((await call(stack.console, "GET", "/admin/tenant-analytics", { token: operator.token })).status).toBe(200);
  });

  it("rate limits login per email, then per IP", async () => {
    const login = (email: string) => call(stack.console, "POST", "/admin/auth/login", { body: { email, password: "wrong-password" } });
    const target = `nobody-${short()}@example.com`;
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await login(target)).status);
    expect(statuses).toEqual([401, 401, 401, 429]);
    const blocked = await login(target);
    expect(blocked.status).toBe(429);

    // Fresh addresses from the same IP run into the per-IP ceiling (8 per window).
    const more: number[] = [];
    for (let i = 0; i < 4; i++) more.push((await login(`spray-${short()}@example.com`)).status);
    expect(more.slice(0, 3)).toEqual([401, 401, 401]);
    expect(more[3]).toBe(429);
  });
});
