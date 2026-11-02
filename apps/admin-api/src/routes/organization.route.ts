import { Router } from "express";
import {
  createOrganization,
  updateOrganizationName,
} from "../controllers/organization.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const organizationRouter: Router = Router();

// All routes require authentication
organizationRouter.use(asyncHandler(authenticateTenantUser));

// POST /tenant/organization - Create organization
//
// DELIBERATELY UNGATED. Do not add requirePermission() here.
//
// This is the bootstrap route. A user who just signed up has no membership, so
// authenticateTenantUser never resolves req.tenantId and therefore never loads
// roles/permissions: they arrive with isOwner=false, roles=[], permissions=[].
// Any permission check is unsatisfiable by construction and 403s the very first
// thing a new account does, from both the "Set up your organization" card and
// the onboarding quiz, which post here. The owner/admin bypass hides it from
// everyone who already has an org, which is why it survived an audit.
//
// It is also not a tenant-scoped action: the caller becomes owner of a BRAND NEW
// tenant and gains no access to any existing one, so a tenant-scoped permission
// has nothing to say about it. A valid tenant JWT is the correct, complete gate
// (same posture as signup). Contrast PATCH /name below, which mutates the
// CURRENT tenant and is rightly gated.
organizationRouter.post("/", asyncHandler(createOrganization));

// PATCH /tenant/organization/name - Update organization name (owner only)
organizationRouter.patch("/name", asyncHandler(requirePermission("settings.organization")), asyncHandler(updateOrganizationName));

export default organizationRouter;
