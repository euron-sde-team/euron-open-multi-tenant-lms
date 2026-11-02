/**
 * Published plan versions are immutable: console-api refuses to edit their pricing or
 * their product list, while a draft stays editable.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createOperator, short, type Operator } from "../../../admin-api/tests/integration/support/fixtures";
import { call, startStack, type Stack } from "../../../admin-api/tests/integration/support/stack";

let stack: Stack;
let operator: Operator;

beforeAll(async () => {
  stack = await startStack();
  operator = await createOperator(stack.db);
});
afterAll(() => stack?.stop());

const op = (method: string, path: string, body?: unknown) => call(stack.console, method, path, { token: operator.token, body });

describe("plan versions", () => {
  it("a draft is editable; once published, edits and product changes are rejected", async () => {
    const products = await stack.db.selectFrom("products").select(["id", "code"]).where("code", "in", ["books_enabled", "books_count"]).execute();
    const booksEnabled = products.find((p) => p.code === "books_enabled")!;
    const booksCount = products.find((p) => p.code === "books_count")!;

    const plan = await op("POST", "/admin/plans", { code: `it_plan_${short()}`, name: "Immutable plan" });
    expect(plan.status, plan.text).toBe(201);
    const planId = plan.body.data.id as string;

    const version = await op("POST", `/admin/plans/${planId}/versions`, {
      purchase_mode: "FREE",
      products: [{ product_id: booksEnabled.id, limit_value: 1 }],
    });
    expect(version.status, version.text).toBe(201);
    const versionId = version.body.data.id as string;

    // Draft: editable, products can be added.
    expect((await op("PATCH", `/admin/plans/${planId}/versions/${versionId}`, { offer_name: "Draft edit" })).status).toBe(200);
    const added = await op("POST", `/admin/plans/${planId}/versions/${versionId}/products`, { product_id: booksCount.id, limit_value: 3 });
    expect(added.status, added.text).toBe(201);

    const published = await op("POST", `/admin/plans/${planId}/versions/${versionId}/publish`);
    expect(published.status, published.text).toBe(200);

    const before = await stack.db.selectFrom("plan_versions").selectAll().where("id", "=", versionId).executeTakeFirstOrThrow();

    const edit = await op("PATCH", `/admin/plans/${planId}/versions/${versionId}`, { price_monthly_usd: 999, offer_name: "Sneaky" });
    expect(edit.status).toBe(403);
    expect(edit.text).toMatch(/immutable/i);

    const addProduct = await op("POST", `/admin/plans/${planId}/versions/${versionId}/products`, {
      product_id: (await stack.db.selectFrom("products").select("id").where("code", "=", "bundles_count").executeTakeFirstOrThrow()).id,
      limit_value: 10,
    });
    expect(addProduct.status).toBe(403);

    const removeProduct = await op("DELETE", `/admin/plans/${planId}/versions/${versionId}/products/${booksCount.id}`);
    expect(removeProduct.status).toBe(403);

    const after = await stack.db.selectFrom("plan_versions").selectAll().where("id", "=", versionId).executeTakeFirstOrThrow();
    expect(after).toEqual(before);
    const rows = await stack.db.selectFrom("plan_version_products").select("product_id").where("plan_version_id", "=", versionId).execute();
    expect(rows.map((r) => r.product_id).sort()).toEqual([booksEnabled.id, booksCount.id].sort());

    // Retiring does not reopen it for edits either.
    expect((await op("POST", `/admin/plans/${planId}/versions/${versionId}/retire`)).status).toBe(200);
    expect((await op("PATCH", `/admin/plans/${planId}/versions/${versionId}`, { offer_name: "Retired edit" })).status).toBe(403);
  });
});
