import { expect, test } from "@playwright/test";

import { ADMIN, ADMIN_API, apiLogin, call, DEMO, uiLogin, uniq } from "../helpers";

test.describe("tenant admin", () => {
  test("the owner sees the published courses and a new draft appears in the list", async ({ page, request }) => {
    const owner = DEMO.tenantOwner();
    const token = await apiLogin(request, "admin", owner);
    const me = await call<{ resolved_tenant_id?: string }>(request, "GET", `${ADMIN_API}/tenant/auth/me`, { token });
    const tenantId = me.resolved_tenant_id;
    expect(tenantId).toBeTruthy();
    const slug = uniq("draft");
    const created = await call<{ id: string }>(request, "POST", `${ADMIN_API}/tenant/courses`, {
      token,
      headers: { "X-Tenant-Id": tenantId! },
      data: { title: `E2E draft ${slug}`, slug, purchase_mode: "FREE" },
    });

    try {
      await uiLogin(page, "admin", owner);
      await page.goto(`${ADMIN}/dashboard/courses`);
      await expect(page.getByText("Python for Data Analysis").first()).toBeVisible();
      await expect(page.getByText(`E2E draft ${slug}`).first()).toBeVisible();
    } finally {
      await call(request, "DELETE", `${ADMIN_API}/tenant/courses/${created.id}`, { token, headers: { "X-Tenant-Id": tenantId! } });
    }
  });

  test("a Starter tenant cannot open test series or AI authoring", async ({ request }) => {
    const acme = { email: "arjun@acme.example.com", password: DEMO.tenantOwner().password };
    const token = await apiLogin(request, "admin", acme);
    const me = await call<{ resolved_tenant_id?: string }>(request, "GET", `${ADMIN_API}/tenant/auth/me`, { token });
    const tenantId = me.resolved_tenant_id ?? "";
    const headers = { "X-Tenant-Id": tenantId };
    await call(request, "POST", `${ADMIN_API}/tenant/test-series`, { token, headers, data: { title: "Locked", slug: uniq("ts") }, expect: 403 });
    await call(request, "POST", `${ADMIN_API}/tenant/pages/ai/plan-page`, { token, headers, data: { prompt: "A home page" }, expect: 403 });
  });
});
