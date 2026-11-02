import { Router } from "express";
import {
  getProfile,
  getTenants,
  updateProfile,
} from "../controllers/tenant-user.controller";
import { authenticateTenantUserLenient } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const tenantUserRouter: Router = Router();

// All routes here are user-scoped (not tenant-data-scoped), so a stale
// X-Tenant-Id must never 403, use the lenient authenticator like /me.
tenantUserRouter.use(asyncHandler(authenticateTenantUserLenient));

// Profile routes.
//
// Self-scoped, so DELIBERATELY UNGATED: updateProfile writes req.tenantUser.id
// (the caller's own row) and the body carries only name/avatar_url. There is no
// target user to authorize against.
//
// It was briefly gated on staff.manage, the permission for managing OTHER
// people. That code lives in OWNER_ONLY_PERMISSIONS, so the admin bypass in
// requirePermission does not apply to it and admins are never granted it:
// in practice only the account owner could edit their own name or avatar, and
// a user with no organization yet could not at all.
tenantUserRouter.get("/profile", asyncHandler(getProfile));
tenantUserRouter.patch("/profile", asyncHandler(updateProfile));

// Tenants the caller is a member of
tenantUserRouter.get("/tenants", asyncHandler(getTenants));

export default tenantUserRouter;
