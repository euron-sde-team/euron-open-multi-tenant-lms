/**
 * Entitlements are the runtime source of truth: a missing row is a denial, a plan
 * assignment snapshots every plan product into entitlement rows, and COUNT products are
 * consumed on publish and released on unpublish.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createOperator, createTenant, grant, type Operator } from "./support/fixtures";
import { call, startStack, type Stack } from "./support/stack";

let stack: Stack;
let operator: Operator;

beforeAll(async () => {
  stack = await startStack();
  operator = await createOperator(stack.db);
});
afterAll(() => stack?.stop());

const createCourse = (t: { token: string; id: string }, slug: string) =>
  call(stack.admin, "POST", "/tenant/courses", {
    token: t.token,
    tenantId: t.id,
    body: { title: `Course ${slug}`, slug, purchase_mode: "FREE" },
  });

const publish = (t: { token: string; id: string }, courseId: string, on: boolean) =>
  call(stack.admin, "POST", `/tenant/courses/${courseId}/toggle-publish`, { token: t.token, tenantId: t.id, body: { publish: on } });

describe("entitlements", () => {
  it("denies course creation when the tenant has no self_paced_courses_enabled row", async () => {
    const tenant = await createTenant(stack.db, "noent");
    const res = await createCourse(tenant, "first-course");
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain("ENTITLEMENT_FEATURE_DISABLED");
    const rows = await stack.db.selectFrom("courses").select("id").where("tenant_id", "=", tenant.id).execute();
    expect(rows).toHaveLength(0);
  });

  it("assigning a plan through console-api snapshots every plan product into entitlements", async () => {
    const tenant = await createTenant(stack.db, "plan");
    const version = await stack.db
      .selectFrom("plan_versions")
      .innerJoin("plans", "plans.id", "plan_versions.plan_id")
      .select(["plan_versions.id"])
      .where("plans.code", "=", "growth")
      .where("plan_versions.is_active", "=", true)
      .executeTakeFirstOrThrow();
    const planProducts = await stack.db
      .selectFrom("plan_version_products")
      .innerJoin("products", "products.id", "plan_version_products.product_id")
      .select(["products.code", "plan_version_products.limit_value", "plan_version_products.is_unlimited"])
      .where("plan_version_products.plan_version_id", "=", version.id)
      .execute();
    expect(planProducts.length).toBeGreaterThan(0);

    const res = await call(stack.console, "POST", `/admin/tenants/${tenant.id}/subscriptions`, {
      token: operator.token,
      body: { plan_version_id: version.id, billing_cycle: "MONTHLY", currency: "USD" },
    });
    expect(res.status, res.text).toBe(201);

    const ents = await stack.db
      .selectFrom("entitlements")
      .select(["product_code", "limit_value", "is_unlimited", "source", "source_plan_version_id"])
      .where("tenant_id", "=", tenant.id)
      .where("is_active", "=", true)
      .execute();
    const byCode = new Map(ents.map((e) => [e.product_code, e]));
    for (const p of planProducts) {
      const e = byCode.get(p.code);
      expect(e, `entitlement for ${p.code}`).toBeDefined();
      expect(e!.source).toBe("PLAN");
      expect(e!.source_plan_version_id).toBe(version.id);
      expect(Boolean(e!.is_unlimited)).toBe(Boolean(p.is_unlimited));
      if (!p.is_unlimited) expect(e!.limit_value).toBe(p.limit_value);
    }
    expect(ents).toHaveLength(planProducts.length);

    // The snapshot is what the runtime reads: the tenant can now create a course.
    const created = await createCourse(tenant, "after-plan");
    expect(created.status, created.text).toBe(201);
  });

  it("enforces self_paced_courses_count on publish and releases the slot on unpublish", async () => {
    const tenant = await createTenant(stack.db, "cap");
    await grant(stack.db, tenant.id, { self_paced_courses_enabled: true, self_paced_courses_count: 1 });

    const a = await createCourse(tenant, "cap-a");
    const b = await createCourse(tenant, "cap-b");
    expect(a.status, a.text).toBe(201);
    expect(b.status, b.text).toBe(201);
    const idA = a.body.data.id as string;
    const idB = b.body.data.id as string;

    expect((await publish(tenant, idA, true)).status).toBe(200);

    const over = await publish(tenant, idB, true);
    expect(over.status).toBe(403);
    expect(JSON.stringify(over.body)).toContain("ENTITLEMENT_LIMIT_REACHED");

    const counter = () =>
      stack.db
        .selectFrom("tenant_usage_counters")
        .select("current_value")
        .where("tenant_id", "=", tenant.id)
        .where("product_code", "=", "self_paced_courses_count")
        .executeTakeFirst()
        .then((r) => Number(r?.current_value ?? 0));
    expect(await counter()).toBe(1);

    expect((await publish(tenant, idA, false)).status).toBe(200);
    expect(await counter()).toBe(0);

    const retry = await publish(tenant, idB, true);
    expect(retry.status, retry.text).toBe(200);
    expect(await counter()).toBe(1);
  });
});
