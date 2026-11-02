import { Router } from "express";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";
import {
  listRoles,
  getRole,
  createRole,
  duplicateRole,
  updateRole,
  deleteRole,
  listPermissions,
  updateRolePermissions,
  listCapabilities,
  getRoleCapabilities,
  updateRoleCapabilities,
  checkEmail,
  listStaff,
  assignStaffRoles,
  removeStaffRole,
  inviteMember,
  resetMemberPassword,
  removeMember,
  suspendMember,
  reactivateMember,
} from "../controllers/team.controller";

const teamRouter: Router = Router();

teamRouter.use(asyncHandler(authenticateTenantUser));

// Roles
teamRouter.get("/roles", asyncHandler(requirePermission("roles.view")), asyncHandler(listRoles));
teamRouter.get("/roles/:roleId", asyncHandler(requirePermission("roles.view")), asyncHandler(getRole));
teamRouter.post("/roles", asyncHandler(requirePermission("roles.manage")), asyncHandler(createRole));
// "Duplicate & edit", the only way into a custom role, since templates are read-only.
teamRouter.post("/roles/:roleId/duplicate", asyncHandler(requirePermission("roles.manage")), asyncHandler(duplicateRole));
teamRouter.put("/roles/:roleId", asyncHandler(requirePermission("roles.manage")), asyncHandler(updateRole));
teamRouter.delete("/roles/:roleId", asyncHandler(requirePermission("roles.manage")), asyncHandler(deleteRole));

// Capabilities, the plain-English layer the role editor uses by default.
// The admin ticks "Can create and publish courses"; we store the codes.
teamRouter.get("/capabilities", asyncHandler(requirePermission("roles.view")), asyncHandler(listCapabilities));
teamRouter.get("/roles/:roleId/capabilities", asyncHandler(requirePermission("roles.view")), asyncHandler(getRoleCapabilities));
teamRouter.put("/roles/:roleId/capabilities", asyncHandler(requirePermission("roles.manage")), asyncHandler(updateRoleCapabilities));

// Permissions, the raw codes, for the "Advanced" escape hatch.
teamRouter.get("/permissions", asyncHandler(requirePermission("roles.view")), asyncHandler(listPermissions));
teamRouter.put("/roles/:roleId/permissions", asyncHandler(requirePermission("roles.manage")), asyncHandler(updateRolePermissions));

// Email check (for invite flow)
teamRouter.get("/check-email", asyncHandler(requirePermission("staff.manage")), asyncHandler(checkEmail));

// Staff
teamRouter.get("/staff", asyncHandler(requirePermission("staff.view")), asyncHandler(listStaff));
teamRouter.put("/staff/:userId/roles", asyncHandler(requirePermission("staff.manage")), asyncHandler(assignStaffRoles));
teamRouter.delete("/staff/:userId/roles/:roleId", asyncHandler(requirePermission("staff.manage")), asyncHandler(removeStaffRole));

// Team member management
teamRouter.post("/members/invite", asyncHandler(requirePermission("staff.manage")), asyncHandler(inviteMember));
teamRouter.post("/members/:userId/reset-password", asyncHandler(requirePermission("staff.manage")), asyncHandler(resetMemberPassword));
// Switch access off without destroying the person's roles or their history.
teamRouter.put("/members/:userId/suspend", asyncHandler(requirePermission("staff.manage")), asyncHandler(suspendMember));
teamRouter.put("/members/:userId/reactivate", asyncHandler(requirePermission("staff.manage")), asyncHandler(reactivateMember));

teamRouter.delete("/members/:userId", asyncHandler(requirePermission("staff.manage")), asyncHandler(removeMember));

export default teamRouter;
