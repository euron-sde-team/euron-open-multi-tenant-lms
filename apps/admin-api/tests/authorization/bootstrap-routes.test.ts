/**
 * Guards the routes a user must reach BEFORE they have an organization.
 *
 * THE BUG THIS EXISTS TO PREVENT
 * An RBAC audit put requirePermission("settings.organization") on
 * POST /tenant/organization. That route is how an account gets its first
 * tenant, and authenticateTenantUser only loads roles/permissions once it has
 * resolved a tenant, so the caller arrives with isOwner=false and an empty
 * permission set. The gate was unsatisfiable by construction: every brand-new
 * signup got "Insufficient permissions" from both the setup card and the
 * onboarding quiz. Nobody with an existing org could reproduce it, because
 * owners and admins bypass permission checks entirely.
 *
 * The same audit gated PATCH /tenant/users/profile, which writes the CALLER'S
 * OWN row, on staff.manage: a code in OWNER_ONLY_PERMISSIONS. That put editing
 * your own name out of reach of admins and every scoped role.
 *
 * Source-level assertions rather than HTTP ones: same approach as
 * scripts/validate-capabilities.ts, and it needs no database.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ForbiddenError } from "../../src/errors/forbidden.error";
import {
  requireAnyPermission,
  requirePermission,
} from "../../src/middlewares/permission.middleware";
import { OWNER_ONLY_PERMISSIONS } from "../../src/services/team.service";

const ROUTES_DIR = path.join(__dirname, "..", "..", "src", "routes");

/** Route handler chains that must never carry a tenant-scoped permission gate. */
const ACCOUNT_SCOPED_ROUTES = [
  {
    file: "organization.route.ts",
    matcher: /organizationRouter\.post\(\s*"\/"[^)]*\)/,
    why: "creates the caller's FIRST tenant, so no tenant context exists yet",
  },
  {
    file: "tenant-user.route.ts",
    matcher: /tenantUserRouter\.patch\(\s*"\/profile"[^)]*\)/,
    why: "writes req.tenantUser.id, the caller's own row, so no target to authorize",
  },
];

describe("account-scoped routes stay free of tenant-scoped permission gates", () => {
  for (const { file, matcher, why } of ACCOUNT_SCOPED_ROUTES) {
    it(`${file}: ${why}`, () => {
      const src = fs.readFileSync(path.join(ROUTES_DIR, file), "utf8");
      const registration = src.match(matcher);

      expect(registration, `route registration not found in ${file}`).not.toBeNull();
      expect(registration![0]).not.toMatch(/require(?:Any)?Permission/);
    });
  }
});

/** Minimal Request stand-in: the middleware only reads these fields. */
const fakeReq = (over: {
  tenantId?: string;
  roles?: string[];
  permissions?: string[];
  isOwner?: boolean;
}) =>
  ({
    tenantId: over.tenantId,
    tenantUser: {
      id: "user-1",
      roles: over.roles ?? [],
      permissions: over.permissions ?? [],
      isOwner: over.isOwner ?? false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const run = async (mw: ReturnType<typeof requirePermission>, req: unknown) => {
  let called = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mw(req as any, {} as any, (() => {
    called = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);
  return called;
};

describe("requirePermission reports a missing tenant as a missing tenant", () => {
  it("says 'Tenant context required', not 'Insufficient permissions'", async () => {
    const req = fakeReq({ tenantId: undefined });

    await expect(run(requirePermission("settings.organization"), req)).rejects.toThrow(
      ForbiddenError
    );
    await expect(run(requirePermission("settings.organization"), req)).rejects.toThrow(
      /Tenant context required/
    );
  });

  it("applies to requireAnyPermission too", async () => {
    await expect(
      run(requireAnyPermission("courses.view", "books.view"), fakeReq({}))
    ).rejects.toThrow(/Tenant context required/);
  });

  it("an owner without tenant context is still refused: no tenant, no scope", async () => {
    await expect(
      run(requirePermission("courses.author"), fakeReq({ isOwner: true }))
    ).rejects.toThrow(/Tenant context required/);
  });
});

describe("existing authorization behaviour is unchanged inside a tenant", () => {
  const T = { tenantId: "01TENANT" };

  it("owner passes", async () => {
    expect(
      await run(requirePermission("courses.author"), fakeReq({ ...T, isOwner: true }))
    ).toBe(true);
  });

  it("admin passes a normal code", async () => {
    expect(
      await run(requirePermission("courses.author"), fakeReq({ ...T, roles: ["admin"] }))
    ).toBe(true);
  });

  it("admin is still barred from an owner-only code", async () => {
    expect(OWNER_ONLY_PERMISSIONS.has("staff.manage")).toBe(true);
    await expect(
      run(requirePermission("staff.manage"), fakeReq({ ...T, roles: ["admin"] }))
    ).rejects.toThrow(/Insufficient permissions/);
  });

  it("a scoped role passes only what it holds", async () => {
    const scoped = fakeReq({ ...T, permissions: ["courses.author"] });
    expect(await run(requirePermission("courses.author"), scoped)).toBe(true);
    await expect(run(requirePermission("vault.manage"), scoped)).rejects.toThrow(
      /Insufficient permissions/
    );
  });
});
