import { Router } from "express";
import {
  assignPermission,
  createRole,
  deleteRole,
  getRoleById,
  listRoles,
  revokePermission,
  updateRole,
} from "../controllers/admin.role.controller";
import {
  authenticateAdmin,
  requirePermission,
  requireRole,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const adminRoleRouter: Router = Router();

// All routes require authentication
adminRoleRouter.use(asyncHandler(authenticateAdmin));

// List all roles - requires view permission
adminRoleRouter.get(
  "/",
  asyncHandler(requirePermission("admin_roles.view")),
  asyncHandler(listRoles)
);

// Create role - requires SUPERADMIN (creating roles is highly sensitive)
adminRoleRouter.post(
  "/",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(createRole)
);

// Get role by ID - requires view permission
adminRoleRouter.get(
  "/:id",
  asyncHandler(requirePermission("admin_roles.view")),
  asyncHandler(getRoleById)
);

// Update role - requires manage permission
adminRoleRouter.patch(
  "/:id",
  asyncHandler(requirePermission("admin_roles.manage")),
  asyncHandler(updateRole)
);

// Delete role - requires SUPERADMIN
adminRoleRouter.delete(
  "/:id",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(deleteRole)
);

// Assign permission to role - requires SUPERADMIN
adminRoleRouter.post(
  "/:id/permissions",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(assignPermission)
);

// Revoke permission from role - requires SUPERADMIN
adminRoleRouter.delete(
  "/:id/permissions/:permissionId",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(revokePermission)
);

export default adminRoleRouter;
