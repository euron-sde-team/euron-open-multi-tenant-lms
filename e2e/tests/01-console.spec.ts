import { expect, test } from "@playwright/test";

import { CONSOLE, DEMO, uiLogin } from "../helpers";

test.describe("operator console", () => {
  test("an operator sees every tenant with its plan", async ({ page }) => {
    await uiLogin(page, "console", DEMO.operator());
    await page.goto(`${CONSOLE}/tenants`);
    await expect(page.getByText("Northwind Academy").first()).toBeVisible();
    await expect(page.getByText("Acme Robotics").first()).toBeVisible();
  });

  test("the catalogue lists the three published plans", async ({ page }) => {
    await uiLogin(page, "console", DEMO.operator());
    await page.goto(`${CONSOLE}/plans`);
    for (const plan of ["Starter", "Growth", "Scale"]) {
      await expect(page.getByText(plan, { exact: false }).first()).toBeVisible();
    }
  });
});
