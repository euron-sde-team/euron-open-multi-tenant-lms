/**
 * Tenant status is enforced on the content routes. requireActiveTenant is
 * mounted in front of each router, before that router authenticates, so this
 * guards the hand-off: a SUSPENDED tenant keeps read access but cannot write,
 * and a CANCELLED tenant cannot even read content.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTenant, grant } from "./support/fixtures";
import { call, startStack, type Stack } from "./support/stack";

let stack: Stack;

beforeAll(async () => {
  stack = await startStack();
});
afterAll(() => stack?.stop());

const setStatus = (tenantId: string, status: "ACTIVE" | "SUSPENDED" | "CANCELLED") =>
  stack.db.updateTable("tenants").set({ status }).where("id", "=", tenantId).execute();

describe("tenant status", () => {
  it("lets an ACTIVE tenant write, a SUSPENDED one only read, and a CANCELLED one neither", async () => {
    const tenant = await createTenant(stack.db, "status");
    await grant(stack.db, tenant.id, { self_paced_courses_enabled: true, self_paced_courses_count: "unlimited" });
    const auth = { token: tenant.token, tenantId: tenant.id };
    const create = (slug: string) =>
      call(stack.admin, "POST", "/tenant/courses", {
        ...auth,
        body: { title: `Course ${slug}`, slug, purchase_mode: "FREE" },
      });

    expect((await create("while-active")).status).toBeLessThan(300);

    await setStatus(tenant.id, "SUSPENDED");
    expect((await call(stack.admin, "GET", "/tenant/courses", auth)).status).toBe(200);
    const blocked = await create("while-suspended");
    expect(blocked.status).toBe(403);
    expect(JSON.stringify(blocked.body)).toContain("suspended");

    await setStatus(tenant.id, "CANCELLED");
    expect((await call(stack.admin, "GET", "/tenant/courses", auth)).status).toBe(403);

    const rows = await stack.db.selectFrom("courses").select("slug").where("tenant_id", "=", tenant.id).execute();
    expect(rows.map((r) => r.slug)).toEqual(["while-active"]);
  });
});
