/**
 * Guards what lands in a tenant's Activity Log, for the surfaces a support
 * ticket found silent ("my new admin logged in and nothing shows").
 *
 * THE BUGS THIS EXISTS TO PREVENT
 * - auditLog() was mounted over /pages, but every lookup inside it searched the
 *   URL for "/tenant/", found nothing, and dropped the entry. Page edits made
 *   by any admin never reached the log, and nothing failed to say so.
 * - A derived route ending in a verb named itself after the verb:
 *   "published the publish "Test 1"".
 * - An assistant's dry-run preview read as though it had replaced a page.
 *
 * Drives the REAL auditLog() middleware through real Express routing over a
 * real socket. Only the edges are stubbed: auth (needs a JWT + database) and
 * the audit service's database calls. The URL parsing and naming in between is
 * the shipping code.
 */
import type { AddressInfo } from "node:net";

import express, { Router, type RequestHandler } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const written: Array<{ action: string; category: string; summary: string }> = [];
let recentlyRecorded = false;

vi.mock("../../src/services/tenant-audit.service", async (importOriginal) => {
  const real = (await importOriginal()) as { default: Record<string, unknown> };
  const svc = real.default;
  svc.record = async (p: (typeof written)[number]) => {
    written.push(p);
  };
  svc.snapshot = async () => null;
  svc.resolveNames = async () => ({});
  svc.recentlyRecorded = async () => recentlyRecorded;
  return real;
});

const { auditLog } = await import("../../src/middlewares/audit.middleware");

const ID = "01KAAAAAAAAAAAAAAAAAAAAAAA";

const fakeAuth: RequestHandler = (req, _res, next) => {
  req.tenantId = "01TENANT";
  req.tenantUser = { id: "01STAFF", name: "Staff Admin", email: "a@x" } as never;
  next();
};
const ok: RequestHandler = (_req, res) => {
  res.json({ success: true, data: { id: ID, title: "Home" } });
};

let base = "";
let server: ReturnType<express.Express["listen"]>;

beforeAll(async () => {
  const pages = Router();
  pages.use(fakeAuth);
  pages.put("/:id", ok);
  pages.post("/:id/publish", ok);
  pages.post("/templates/apply", ok);

  const auth = Router();
  auth.post("/login", ok);
  auth.post("/logout", fakeAuth, ok);

  const tests = Router();
  tests.use(fakeAuth);
  tests.post("/:id/publish", ok);

  const v1 = Router();
  v1.use("/tenant", auditLog());
  v1.use("/tenant/auth", auth);
  v1.use("/tenant/tests", tests);
  v1.use("/pages", auditLog());
  v1.use("/pages", pages);

  const app = express();
  app.use(express.json());
  app.use("/api/v1", v1);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

afterAll(() => server?.close());

beforeEach(() => {
  written.length = 0;
  recentlyRecorded = false;
});

/** Fire a request and wait for the after-response write to land. */
async function send(method: string, url: string, body: unknown = {}) {
  await fetch(base + url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  // The entry is written after the response is sent, fire-and-forget.
  await new Promise((r) => setTimeout(r, 200));
  return written[0];
}

describe("activity log coverage", () => {
  it("records page edits made under the /pages mount", async () => {
    const entry = await send("PUT", `/pages/${ID}`);
    expect(entry?.action).toBe("pages.update");
    expect(entry?.summary).toBe('Staff Admin edited the page "Home"');
  });

  it("names a verb route after its resource, not the verb", async () => {
    expect((await send("POST", `/pages/${ID}/publish`))?.summary).toBe(
      'Staff Admin published the page "Home"'
    );
    written.length = 0;
    expect((await send("POST", `/tenant/tests/${ID}/publish`))?.summary).toBe(
      'Staff Admin published the test "Home"'
    );
  });

  it("names a template apply, and skips its dry-run preview", async () => {
    expect((await send("POST", "/pages/templates/apply", { templateId: "x" }))?.action).toBe(
      "pages.template.apply"
    );
    written.length = 0;
    expect(
      await send("POST", "/pages/templates/apply", { templateId: "x", dryRun: true })
    ).toBeUndefined();
  });

  it("folds an autosave burst into the first page edit", async () => {
    recentlyRecorded = true;
    expect(await send("PUT", `/pages/${ID}`)).toBeUndefined();
  });

  it("records a page the route guard turned someone away from, once per window", async () => {
    const { default: svc } = await import("../../src/services/tenant-audit.service");
    const call = () =>
      svc.recordDeniedView({
        tenantId: "01TENANT",
        actor: { id: "01RAKESH", name: "Rakesh", email: "r@x" },
        path: "/dashboard/payment",
        label: "Payments",
        request: { get: () => undefined, ip: "203.0.113.4" } as never,
      });

    await call();
    expect(written[0]).toMatchObject({
      action: "page.view.denied",
      category: "Access",
      succeeded: false,
      summary: 'Rakesh tried to open the "Payments" page without access, denied',
    });

    written.length = 0;
    recentlyRecorded = true; // a refresh, or a second tab
    await call();
    expect(written).toHaveLength(0);
  });

  it("records sign-out; sign-in is left to the login service", async () => {
    expect((await send("POST", "/tenant/auth/logout"))?.summary).toBe("Staff Admin signed out");
    written.length = 0;
    // Nobody is authenticated yet at login, the middleware must not guess.
    expect(await send("POST", "/tenant/auth/login", { email: "a", password: "b" })).toBeUndefined();
  });
});
