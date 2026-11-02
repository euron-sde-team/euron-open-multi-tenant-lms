/**
 * Guards the route ordering that makes GET /pages/homepage reachable at all.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * "/homepage" and "/:id" are BOTH single-segment paths, so Express serves
 * whichever is registered first. Declared after "/:id", every homepage request
 * becomes getPageById("homepage") and 404s. Nothing catches that: the types are
 * identical either way, the frontend swallows the failure and falls back to
 * defaultThemeConfig, and the only symptom is that every tenant's editors
 * quietly render with default branding instead of their own. That is the exact
 * failure this endpoint was written to end, so it must not be reintroduced by a
 * later edit that appends a route in the "natural" place.
 *
 * Drives the REAL pagesRouter (real middleware chain, real asyncHandler, real
 * globalHandler) over a real socket. Only the two edges are stubbed: the auth
 * middleware, which would need a database and a JWT, and the controllers, which
 * would need a database. The routing table in between is the shipping code.
 */
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";

import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { globalHandler } from "../../src/middlewares/error-handler.middleware";

/** A tenant staff user holding pages.view, mutated per-test to drop the grant. */
const TENANT_USER = {
  id: "01TENANTUSER",
  email: "staff@example.com",
  name: "Staff User",
  status: "ACTIVE",
  email_verified: true,
  roles: ["STAFF"] as string[],
  permissions: ["pages.view"] as string[],
  isOwner: false,
  isPlatformAdmin: false,
};

let currentUser = { ...TENANT_USER };

vi.mock("../../src/middlewares/auth.middleware", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachTenantUser = (req: any, _res: any, next: any) => {
    req.tenantUser = { ...currentUser };
    req.user = { id: currentUser.id };
    req.tenantId = "01TENANTID";
    next();
  };
  return {
    authenticateTenantUser: attachTenantUser,
    authenticateTenantUserLenient: attachTenantUser,
  };
});

/**
 * Every controller reports its own name, so a response identifies which route
 * matched. That is the whole point: "/pages/homepage" reaching getPageById is
 * indistinguishable from success at the type level but is the bug.
 */
vi.mock("../../src/controllers/pages.controller", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reach = (name: string) => (_req: any, res: any) =>
    res.status(200).json({ success: true, data: { reached: name } });
  return {
    getPages: reach("getPages"),
    getPageById: reach("getPageById"),
    getPageBySlug: reach("getPageBySlug"),
    getTenantHomepage: reach("getTenantHomepage"),
    createPage: reach("createPage"),
    updatePage: reach("updatePage"),
    deletePage: reach("deletePage"),
    togglePublish: reach("togglePublish"),
    duplicatePage: reach("duplicatePage"),
    // Added when page revisions shipped. Their absence is why this whole file
    // was commented out rather than repaired: vi.mock replaces the module
    // wholesale, so a route importing an export the mock omits throws at import
    // time and takes the entire suite with it.
    getPageRevisions: reach("getPageRevisions"),
    restorePageRevision: reach("restorePageRevision"),
    // Added when the section catalogue shipped, for the reason spelled out
    // above: an export the mock omits throws at import time.
    listSectionTypes: reach("listSectionTypes"),
    listPageTemplates: reach("listPageTemplates"),
    applyPageTemplate: reach("applyPageTemplate"),
    // Added with the server-side section remove/insert routes, same rule.
    removePageSection: reach("removePageSection"),
    insertPageSection: reach("insertPageSection"),
    listSitePalettes: reach("listSitePalettes"),
    applySitePalette: reach("applySitePalette"),
    restoreSiteTheme: reach("restoreSiteTheme"),
  };
});

let baseUrl: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let server: any;

beforeAll(async () => {
  const { default: pagesRouter } = await import("../../src/routes/pages.route");

  const app = express();
  app.use(express.json());
  app.use("/pages", pagesRouter);
  app.use(globalHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const get = async (route: string) => {
  const res = await fetch(`${baseUrl}${route}`);
  return { status: res.status, body: await res.json() };
};

describe("GET /pages/homepage route ordering", () => {
  it("reaches getTenantHomepage, not getPageById", async () => {
    const res = await get("/pages/homepage?tenantId=01TENANTID");

    expect(res.status).toBe(200);
    expect(res.body.data.reached).toBe("getTenantHomepage");
  });

  it("still routes a real page id to getPageById, so the literal path did not shadow it", async () => {
    const res = await get("/pages/01JQZ8H3K5N7P9R1T3V5X7Z9AB");

    expect(res.status).toBe(200);
    expect(res.body.data.reached).toBe("getPageById");
  });

  it("still routes the list endpoint to getPages", async () => {
    const res = await get("/pages?tenantId=01TENANTID");

    expect(res.status).toBe(200);
    expect(res.body.data.reached).toBe("getPages");
  });

  it("is gated on pages.view, so it cannot be reached without the grant", async () => {
    currentUser = { ...TENANT_USER, roles: [], permissions: [] };
    try {
      const res = await get("/pages/homepage?tenantId=01TENANTID");
      expect(res.status).toBe(403);
    } finally {
      currentUser = { ...TENANT_USER };
    }
  });
});

/**
 * Source-level assertion, same approach as bootstrap-routes.test.ts: needs no
 * database, and the value it guards is a compatibility list that is easy to
 * "tidy up" without realising what it covers.
 */
describe("homepage slug compatibility", () => {
  const repoSource = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "repositories", "pages.repository.ts"),
    "utf8"
  );

  it('resolves the legacy "/" and "" homepage slugs alongside "home"', () => {
    const declaration = repoSource.match(
      /export const HOMEPAGE_SLUGS[^=]*=\s*\[([^\]]*)\]/
    );

    expect(declaration, "HOMEPAGE_SLUGS declaration not found").not.toBeNull();

    const slugs = declaration![1]!
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter((s, i, all) => s !== "" || all.indexOf(s) === i);

    // "home" must be first: it is what every tenant uses, and findHomepage
    // returns the first match, so ordering is the tie-break when a tenant
    // somehow carries more than one form.
    expect(slugs[0]).toBe("home");
    expect(slugs).toContain("/");
    expect(slugs).toContain("");
  });

  it("matches the slugs in SQL rather than through the normalising by-slug path", () => {
    // pagesService.normalizeSlug() strips slashes, so "/" would be rewritten to
    // "" before it ever reached the database. The IN clause is what keeps the
    // legacy forms reachable.
    expect(repoSource).toMatch(/\.where\(\s*"slug",\s*"in",\s*HOMEPAGE_SLUGS\s*\)/);
  });
});
