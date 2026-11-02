import { Router } from "express";
import {
  createPermission,
  deletePermission,
  getCategories,
  getPermissionById,
  listPermissions,
  updatePermission,
} from "../controllers/admin.permission.controller";
import {
  authenticateAdmin,
  requirePermission,
  requireRole,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const adminPermissionRouter: Router = Router();

// All routes require authentication
adminPermissionRouter.use(asyncHandler(authenticateAdmin));

// Get all categories - requires view permission (placed before :id to avoid conflict)
adminPermissionRouter.get(
  "/categories",
  asyncHandler(requirePermission("admin_permissions.manage")),
  asyncHandler(getCategories)
);

// List all permissions - requires view permission
adminPermissionRouter.get(
  "/",
  asyncHandler(requirePermission("admin_permissions.manage")),
  asyncHandler(listPermissions)
);

// Create permission - requires SUPERADMIN
adminPermissionRouter.post(
  "/",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(createPermission)
);

// Get permission by ID - requires manage permission
adminPermissionRouter.get(
  "/:id",
  asyncHandler(requirePermission("admin_permissions.manage")),
  asyncHandler(getPermissionById)
);

// Update permission - requires SUPERADMIN
adminPermissionRouter.patch(
  "/:id",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(updatePermission)
);

// Delete permission - requires SUPERADMIN
adminPermissionRouter.delete(
  "/:id",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(deletePermission)
);

export default adminPermissionRouter;
