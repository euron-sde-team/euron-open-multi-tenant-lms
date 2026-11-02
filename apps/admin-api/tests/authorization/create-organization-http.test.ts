/**
 * End-to-end HTTP proof that a signed-in user with NO organization can create
 * their first one.
 *
 * This drives the REAL organizationRouter (real middleware chain, real
 * asyncHandler, real globalHandler) over a real socket. Only the two edges are
 * stubbed: the auth middleware, which would need a database and a JWT, and the
 * controller, which would need a database and would create an actual tenant.
 * Everything between them, which is where the bug lived, is the shipping code.
 *
 * The stubbed user is exactly what authenticateTenantUser produces for a
 * brand-new account: a valid identity, no tenant, no roles, no permissions,
 * isOwner=false. That is the state that used to return 403.
 */
import type { AddressInfo } from "node:net";

import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { globalHandler } from "../../src/middlewares/error-handler.middleware";
import { requirePermission } from "../../src/middlewares/permission.middleware";
import { asyncHandler } from "../../src/utils/asynchandler";

/** A freshly signed-up user: authenticated, but member of nothing. */
const FRESH_SIGNUP = {
  id: "01FRESHUSER",
  email: "new@example.com",
  name: "New User",
  avatar_url: null,
  status: "ACTIVE",
  email_verified: true,
  roles: [] as string[],
  permissions: [] as string[],
  isOwner: false,
  isPlatformAdmin: false,
};

vi.mock("../../src/middlewares/auth.middleware", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachFreshSignup = (req: any, _res: any, next: any) => {
    req.tenantUser = { ...FRESH_SIGNUP };
    req.user = { id: FRESH_SIGNUP.id };
    req.tenantId = undefined; // no membership resolves, so no tenant context
    next();
  };
  return {
    authenticateTenantUser: attachFreshSignup,
    authenticateTenantUserLenient: attachFreshSignup,
  };
});

vi.mock("../../src/controllers/organization.controller", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createOrganization: (_req: any, res: any) =>
    res.status(201).json({ success: true, data: { reached: "controller" } }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateOrganizationName: (_req: any, res: any) => res.status(200).json({ success: true }),
}));

let baseUrl: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let server: any;

beforeAll(async () => {
  const { default: organizationRouter } = await import(
    "../../src/routes/organization.route"
  );

  const app = express();
  app.use(express.json());
  app.use("/tenant/organization", organizationRouter);

  // Control route: proves this harness WOULD surface a permission gate. Mounted
  // behind the same stubbed tenant-less user as the route under test.
  app.post(
    "/control/gated",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    asyncHandler(async (req: any, _res, next) => {
      req.tenantUser = { ...FRESH_SIGNUP };
      req.tenantId = undefined;
      next();
    }),
    asyncHandler(requirePermission("settings.organization")),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_req: any, res: any) => res.status(201).json({ success: true })
  );

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

const post = async (path: string, body: unknown) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

describe("POST /tenant/organization as a user with no organization", () => {
  it("reaches the controller instead of 403 (the bare setup-card payload)", async () => {
    const res = await post("/tenant/organization", { name: "Physics Learning Academy" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ data: { reached: "controller" } });
  });

  it("reaches the controller for the onboarding-quiz payload too", async () => {
    const res = await post("/tenant/organization", {
      name: "Physics Learning Academy",
      quiz_answers: { tools: ["offline_coaching"] },
      timezone: "Asia/Kolkata",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ data: { reached: "controller" } });
  });

  it("control: a permission-gated route DOES refuse the same user, so this test can fail", async () => {
    const res = await post("/control/gated", { name: "Physics Learning Academy" });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("Tenant context required");
  });
});
