import { Router } from "express";
import {
  createTenantPermission,
  deleteTenantPermission,
  listPermissionCategories,
  listTenantPermissions,
  updateTenantPermission,
} from "../controllers/tenant-permission.controller";
import {
  authenticateAdmin,
  requirePermission,
  requireRole,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

// All routes require admin authentication
router.use(asyncHandler(authenticateAdmin));

// List all tenant permissions (with optional category/search filters)
// GET /admin/tenants/permissions
router.get(
  "/",
  asyncHandler(requirePermission("tenant_users.view")),
  asyncHandler(listTenantPermissions)
);

// List distinct permission categories
// GET /admin/tenants/permissions/categories
router.get(
  "/categories",
  asyncHandler(requirePermission("tenant_users.view")),
  asyncHandler(listPermissionCategories)
);

// Create a new tenant permission
// POST /admin/tenants/permissions
router.post(
  "/",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(createTenantPermission)
);

// Update a tenant permission
// PATCH /admin/tenants/permissions/:id
router.patch(
  "/:id",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(updateTenantPermission)
);

// Delete a tenant permission
// DELETE /admin/tenants/permissions/:id
router.delete(
  "/:id",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(deleteTenantPermission)
);

export default router;
