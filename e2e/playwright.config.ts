import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end tests against a running local stack (`make up && make demo`, or the
 * dev servers): the three tiers (console, admin, storefront) and their APIs, Postgres,
 * Redis, the Floci emulator and the provider stubs. Stripe, Razorpay, the video system
 * and the AI endpoint are the stubs and AI authoring runs offline, so results are
 * reproducible.
 *
 *   pnpm e2e                                         every spec
 *   pnpm e2e e2e/tests/checkout.spec.ts              one spec
 *   E2E_HEADED=1 pnpm e2e                            watch it
 *
 * Env: E2E_CONSOLE_URL, E2E_ADMIN_URL, E2E_WEB_URL (the demo tenant's storefront),
 * E2E_CONSOLE_API_URL, E2E_ADMIN_API_URL, E2E_LEARNER_API_URL, E2E_MAILPIT_URL,
 * E2E_STUBS_URL (see helpers.ts for the defaults).
 *
 * The specs share the seeded demo tenants, so they run one file at a time and each spec
 * cleans up what it creates.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: ".report", open: "never" }]],
  outputDir: ".results",
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: process.env.E2E_WEB_URL || "http://northwind.lvh.me:3620",
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    headless: !process.env.E2E_HEADED,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
