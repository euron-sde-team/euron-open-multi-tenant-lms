import { Router } from "express";
import {
    exportAllStaffMembers,
    getStaffMemberDetails,
    listAllStaffMembers,
    updateStaffMemberProfile,
} from "../controllers/tenant-user.controller";
import {
    authenticateAdmin,
    requirePermission,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

// All routes require admin authentication
router.use(asyncHandler(authenticateAdmin));

/**
 * GET /admin/staff-members
 * List all staff members globally (tenant users)
 */
router.get("/", asyncHandler(requirePermission("tenant_users.view")), asyncHandler(listAllStaffMembers));

/**
 * GET /admin/staff-members/export
 * Export all staff members as Excel
 */
router.get("/export", asyncHandler(requirePermission("tenant_users.view")), asyncHandler(exportAllStaffMembers));

/**
 * GET /admin/staff-members/:userId
 * Get detailed staff member info
 */
router.get(
    "/:userId",
    asyncHandler(requirePermission("tenant_users.view")),
    asyncHandler(getStaffMemberDetails)
);

/**
 * PATCH /admin/staff-members/:userId
 * Update a staff member's global profile (email/phone). Works regardless of tenant memberships.
 */
router.patch(
    "/:userId",
    asyncHandler(requirePermission("tenant_users.manage")),
    asyncHandler(updateStaffMemberProfile)
);

export default router;
