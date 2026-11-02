import { expect, test } from "@playwright/test";

import { call, DEMO, LEARNER_API, TENANT_HOST, tierApi, uiLogin, WEB } from "../helpers";

test.describe("learner storefront", () => {
  test("the home page renders in the tenant's brand with its courses", async ({ page }) => {
    await page.goto(WEB);
    await expect(page.getByRole("link", { name: "Northwind Academy" }).first()).toBeVisible();
    await page.mouse.wheel(0, 2500);
    await expect(page.getByText("Python for Data Analysis").first()).toBeVisible();
  });

  test("an enrolled learner signs in and gets a playable lecture", async ({ page, request }) => {
    const learner = DEMO.learner();
    await uiLogin(page, "learner", learner);
    await page.goto(`${WEB}/my-learning`);
    await expect(page.getByText("Python for Data Analysis").first()).toBeVisible();

    // The playback route returns a session or URL only after its enrollment check.
    // Learners hold one session at a time, so the browser sign-in above revoked
    // any cached token: sign in again through the API.
    const { accessToken: token } = await call<{ accessToken: string }>(request, "POST", `${LEARNER_API}/auth/login`, {
      data: learner,
      headers: { "X-Tenant-Host": TENANT_HOST },
    });
    const detail = await tierApi<{
      course: { id: string };
      sections: Array<{ lessons: Array<{ lecture: { id: string } | null }> }>;
    }>(request, "learner", token, "GET", "/courses/by-slug/python-for-data-analysis");
    const lectureId = detail.sections.flatMap((s) => s.lessons).map((l) => l.lecture?.id).find(Boolean) ?? "";
    expect(lectureId).not.toBe("");
    const playback = await tierApi<{ provider: string; url?: string; manifestUrl?: string }>(
      request, "learner", token, "POST", `/courses/${detail.course.id}/lectures/${lectureId}/playback`,
    );
    expect(["EVS", "HLS", "MP4", "YOUTUBE"]).toContain(playback.provider);
    expect(playback.url ?? playback.manifestUrl).toBeTruthy();
  });

  test("the learner API refuses a course from another tenant's host", async ({ request }) => {
    const r = await request.get(`${LEARNER_API}/courses/by-slug/python-for-data-analysis`, { headers: { "X-Tenant-Host": `acme.${TENANT_HOST.split(".").slice(1).join(".")}` } });
    expect(r.status()).toBe(404);
  });
});
