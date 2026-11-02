import { Router } from "express";
import {
  assignRole,
  createUser,
  deactivateUser,
  deleteUserPermanent,
  getUserById,
  listUsers,
  reactivateUser,
  revokeRole,
  updateUser,
} from "../controllers/admin.user.controller";
import {
  authenticateAdmin,
  requirePermission,
  requireRole,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const adminUserRouter: Router = Router();

// All routes require authentication
adminUserRouter.use(asyncHandler(authenticateAdmin));

// List all admin users - requires view permission
adminUserRouter.get(
  "/",
  asyncHandler(requirePermission("admin_users.view")),
  asyncHandler(listUsers)
);

// Create admin user - requires manage permission
adminUserRouter.post(
  "/",
  asyncHandler(requirePermission("admin_users.manage")),
  asyncHandler(createUser)
);

// Get admin user by ID - requires view permission
adminUserRouter.get(
  "/:id",
  asyncHandler(requirePermission("admin_users.view")),
  asyncHandler(getUserById)
);

// Update admin user - requires manage permission
adminUserRouter.patch(
  "/:id",
  asyncHandler(requirePermission("admin_users.manage")),
  asyncHandler(updateUser)
);

// Deactivate admin user - requires delete permission
adminUserRouter.delete(
  "/:id",
  asyncHandler(requirePermission("admin_users.delete")),
  asyncHandler(deactivateUser)
);

// Permanently (hard) delete admin user - requires delete permission
adminUserRouter.delete(
  "/:id/permanent",
  asyncHandler(requirePermission("admin_users.delete")),
  asyncHandler(deleteUserPermanent)
);

// Reactivate admin user - requires manage permission
adminUserRouter.post(
  "/:id/reactivate",
  asyncHandler(requirePermission("admin_users.manage")),
  asyncHandler(reactivateUser)
);

// Assign role to user - requires SUPERADMIN (role management is sensitive)
adminUserRouter.post(
  "/:id/roles",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(assignRole)
);

// Revoke role from user - requires SUPERADMIN
adminUserRouter.delete(
  "/:id/roles/:roleId",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(revokeRole)
);

export default adminUserRouter;
