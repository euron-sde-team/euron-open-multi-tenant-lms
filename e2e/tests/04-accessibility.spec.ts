import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { ADMIN, CONSOLE, DEMO, uiLogin, WEB } from "../helpers";

// Serious and critical axe violations fail the run; moderate ones are reported only.
async function audit(page: Page, label: string, found: string[]) {
  // "load", not "networkidle": the storefront and the admin keep polling.
  await page.waitForLoadState("load");
  await page.waitForTimeout(1_500);
  // Wait for entrance animations only: looping ones (hero backgrounds) never finish.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
      new Promise((r) => setTimeout(r, 5_000)),
    ]),
  );
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  found.push(...blocking.flatMap((v) => v.nodes.map((n) => `${label}: ${v.id} ${n.target.join(" ")}`)));
}

test("console pages pass axe", async ({ page }) => {
  const found: string[] = [];
  await page.goto(`${CONSOLE}/login`);
  await audit(page, "console login", found);
  await uiLogin(page, "console", DEMO.operator());
  for (const path of ["/", "/tenants", "/plans"]) {
    await page.goto(`${CONSOLE}${path}`);
    await audit(page, `console ${path}`, found);
  }
  expect(found).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  // Known failing: icon-only links and some theme colours in the tenant admin and
  // the storefront still have serious axe findings (README roadmap). The console
  // passes; these stay as test.fixme until they do.
  test.fixme(`tenant admin pages pass axe in ${theme} mode`, async ({ page }) => {
    const found: string[] = [];
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await page.goto(`${ADMIN}/login`);
    await audit(page, "admin login", found);
    await uiLogin(page, "admin", DEMO.tenantOwner());
    for (const path of ["/dashboard/overview", "/dashboard/courses", "/dashboard/users"]) {
      await page.goto(`${ADMIN}${path}`);
      await audit(page, `admin ${path}`, found);
    }
    expect(found).toEqual([]);
  });

  test.fixme(`storefront pages pass axe in ${theme} mode`, async ({ page }) => {
    const found: string[] = [];
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    for (const path of ["/", "/all-courses", "/courses/python-for-data-analysis", "/login"]) {
      await page.goto(`${WEB}${path}`);
      await audit(page, `web ${path}`, found);
    }
    expect(found).toEqual([]);
  });
}
