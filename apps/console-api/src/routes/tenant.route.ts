import { Router } from "express";
import {
  createAdminEntitlement,
  getEntitlementById,
  getOverrideHistory,
  listEntitlements,
  overrideEntitlement,
  reconcileUsage,
  resetUsage,
  revokeAdminEntitlement,
  updateUsage,
} from "../controllers/entitlement.controller";
import {
  assignPlanToTenant,
  cancelSubscription,
  getSubscriptionById,
  listSubscriptions,
  upgradeSubscription,
} from "../controllers/subscription.controller";
import {
  cancelTenantAddon,
  getTenantAddonById,
  grantAddon,
  listTenantAddons,
} from "../controllers/tenant-addon.controller";
import {
  grantApplication,
  listTenantApplications,
  updateTenantApplication,
} from "../controllers/tenant-application.controller";
import { listTenantAuditLogs } from "../controllers/tenant-audit.controller";
import { listTenantMembers } from "../controllers/tenant-member.controller";
import {
  getOfferingBookDetail,
  getOfferingCourseDetail,
  getOfferingsSummary,
  listOfferingBatches,
  listOfferingBooks,
  listOfferingBundles,
  listOfferingCourses,
  listOfferingTestSeries,
} from "../controllers/tenant-offerings.controller";
import {
  getRevenueSummary,
  listSalesOrders,
} from "../controllers/tenant-sales.controller";
import {
  assignTenantUserRole,
  createTenantUser,
  exportTenantStaffMembers,
  getTenantUserById,
  inviteTenantUser,
  listTenantUsers,
  removeUserFromTenant,
  revokeTenantUserRole,
  updateTenantMembership,
  updateTenantUser,
} from "../controllers/tenant-user.controller";
import {
  addRolePermission,
  getRolePermissions,
  removeRolePermission,
  setRolePermissions,
} from "../controllers/tenant-permission.controller";
import {
  createTenant,
  createTenantRole,
  deleteTenant,
  exportTenants,
  getTenantById,
  listTenantRoles,
  listTenants,
  reactivateTenant,
  suspendTenant,
  updateTenant,
  updateTenantRole,
} from "../controllers/tenant.controller";
import {
  authenticateAdmin,
  requirePermission,
  requireRole,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

// All routes require admin authentication
router.use(asyncHandler(authenticateAdmin));

// ============================================
// TENANT CRUD
// ============================================

// List all tenants
// GET /admin/tenants
router.get("/", asyncHandler(requirePermission("tenants.view")), asyncHandler(listTenants));

// Create a new tenant with owner
// POST /admin/tenants
router.post("/", asyncHandler(requirePermission("tenants.manage")), asyncHandler(createTenant));

// Export tenants as Excel (before /:id so "export" is not captured as id)
// GET /admin/tenants/export?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
router.get("/export", asyncHandler(requirePermission("tenants.view")), asyncHandler(exportTenants));

// List global tenant roles (before /:id so "roles" is not captured as id)
// GET /admin/tenants/roles
router.get("/roles", asyncHandler(requirePermission("tenant_users.view")), asyncHandler(listTenantRoles));

// Create a global tenant role
// POST /admin/tenants/roles
router.post("/roles", asyncHandler(requirePermission("tenant_users.manage")), asyncHandler(createTenantRole));

// Update a global tenant role
// PATCH /admin/tenants/roles/:id
router.patch(
  "/roles/:id",
  asyncHandler(requirePermission("tenant_users.manage")),
  asyncHandler(updateTenantRole)
);

// ============================================
// ROLE-PERMISSION MAPPING
// ============================================

// Get role with its permissions
// GET /admin/tenants/roles/:id/permissions
router.get(
  "/roles/:id/permissions",
  asyncHandler(requirePermission("tenant_users.view")),
  asyncHandler(getRolePermissions)
);

// Set all permissions for a role (replace)
// PUT /admin/tenants/roles/:id/permissions
router.put(
  "/roles/:id/permissions",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(setRolePermissions)
);

// Add a single permission to a role
// POST /admin/tenants/roles/:id/permissions
router.post(
  "/roles/:id/permissions",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(addRolePermission)
);

// Remove a permission from a role
// DELETE /admin/tenants/roles/:id/permissions/:permissionId
router.delete(
  "/roles/:id/permissions/:permissionId",
  asyncHandler(requireRole("SUPERADMIN")),
  asyncHandler(removeRolePermission)
);

// Get tenant by ID
// GET /admin/tenants/:id
router.get("/:id", asyncHandler(requirePermission("tenants.view")), asyncHandler(getTenantById));

// Update a tenant
// PATCH /admin/tenants/:id
router.patch("/:id", asyncHandler(requirePermission("tenants.manage")), asyncHandler(updateTenant));

// Suspend a tenant
// POST /admin/tenants/:id/suspend
router.post("/:id/suspend", asyncHandler(requirePermission("tenants.manage")), asyncHandler(suspendTenant));

// Reactivate a suspended tenant
// POST /admin/tenants/:id/reactivate
router.post("/:id/reactivate", asyncHandler(requirePermission("tenants.manage")), asyncHandler(reactivateTenant));

// Permanently delete a tenant and all related data
// DELETE /admin/tenants/:id
router.delete("/:id", asyncHandler(requirePermission("tenants.manage")), asyncHandler(deleteTenant));

// ============================================
// TENANT USERS (M:M Model - Users can belong to multiple tenants)
// ============================================

// List users in a tenant (via memberships)
// GET /admin/tenants/:tenantId/users
router.get("/:tenantId/users", asyncHandler(requirePermission("tenant_users.view")), asyncHandler(listTenantUsers));

// Export tenant staff members as Excel (before /:tenantId/users/:id so "export" is not captured as id)
// GET /admin/tenants/:tenantId/users/export?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
router.get("/:tenantId/users/export", asyncHandler(requirePermission("tenant_users.view")), asyncHandler(exportTenantStaffMembers));

// Create new user and add to tenant, or add existing user to tenant
// POST /admin/tenants/:tenantId/users
router.post("/:tenantId/users", asyncHandler(requirePermission("tenant_users.manage")), asyncHandler(createTenantUser));

// Invite an existing user to a tenant by email
// POST /admin/tenants/:tenantId/users/invite
router.post("/:tenantId/users/invite", asyncHandler(requirePermission("tenant_users.manage")), asyncHandler(inviteTenantUser));

// Get user by ID within tenant context
// GET /admin/tenants/:tenantId/users/:id
router.get("/:tenantId/users/:id", asyncHandler(requirePermission("tenant_users.view")), asyncHandler(getTenantUserById));

// Update user's global profile fields
// PATCH /admin/tenants/:tenantId/users/:id
router.patch("/:tenantId/users/:id", asyncHandler(requirePermission("tenant_users.manage")), asyncHandler(updateTenantUser));

// Update user's membership status in tenant (ACTIVE, SUSPENDED, INVITED)
// PATCH /admin/tenants/:tenantId/users/:id/membership
router.patch(
  "/:tenantId/users/:id/membership",
  asyncHandler(requirePermission("tenant_users.manage")),
  asyncHandler(updateTenantMembership)
);

// Remove user from tenant (delete membership, not user)
// DELETE /admin/tenants/:tenantId/users/:id
router.delete("/:tenantId/users/:id", asyncHandler(requirePermission("tenant_users.manage")), asyncHandler(removeUserFromTenant));

// Assign role to user's membership in tenant
// POST /admin/tenants/:tenantId/users/:id/roles
router.post(
  "/:tenantId/users/:id/roles",
  asyncHandler(requirePermission("tenant_users.manage")),
  asyncHandler(assignTenantUserRole)
);

// Revoke role from user's membership in tenant
// DELETE /admin/tenants/:tenantId/users/:id/roles/:roleId
router.delete(
  "/:tenantId/users/:id/roles/:roleId",
  asyncHandler(requirePermission("tenant_users.manage")),
  asyncHandler(revokeTenantUserRole)
);

// ============================================
// TENANT APPLICATIONS
// ============================================

// List tenant applications
// GET /admin/tenants/:tenantId/applications
router.get(
  "/:tenantId/applications",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(listTenantApplications)
);

// Grant (assign) application to tenant
// POST /admin/tenants/:tenantId/applications
router.post(
  "/:tenantId/applications",
  asyncHandler(requirePermission("tenants.manage")),
  asyncHandler(grantApplication)
);

// Update tenant application (suspend, reactivate, cancel)
// PATCH /admin/tenants/:tenantId/applications/:id
router.patch(
  "/:tenantId/applications/:id",
  asyncHandler(requirePermission("tenants.manage")),
  asyncHandler(updateTenantApplication)
);

// List tenant members (end-users)
// GET /admin/tenants/:tenantId/members
router.get(
  "/:tenantId/members",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(listTenantMembers)
);

// List tenant audit logs (application + addon events)
// GET /admin/tenants/:tenantId/audit-logs
router.get(
  "/:tenantId/audit-logs",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(listTenantAuditLogs)
);

// ============================================
// TENANT OFFERINGS, SALES & REVENUE (read-only)
// ============================================

// Offerings summary (counts of courses/books/bundles/batches/test-series + access grants)
// GET /admin/tenants/:tenantId/offerings/summary
router.get(
  "/:tenantId/offerings/summary",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(getOfferingsSummary)
);

// Courses list + detail
// GET /admin/tenants/:tenantId/offerings/courses
router.get(
  "/:tenantId/offerings/courses",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(listOfferingCourses)
);
// GET /admin/tenants/:tenantId/offerings/courses/:courseId
router.get(
  "/:tenantId/offerings/courses/:courseId",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(getOfferingCourseDetail)
);

// Books list + detail
// GET /admin/tenants/:tenantId/offerings/books
router.get(
  "/:tenantId/offerings/books",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(listOfferingBooks)
);
// GET /admin/tenants/:tenantId/offerings/books/:bookId
router.get(
  "/:tenantId/offerings/books/:bookId",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(getOfferingBookDetail)
);

// Bundles / Batches / Test series lists
// GET /admin/tenants/:tenantId/offerings/bundles
router.get(
  "/:tenantId/offerings/bundles",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(listOfferingBundles)
);
// GET /admin/tenants/:tenantId/offerings/batches
router.get(
  "/:tenantId/offerings/batches",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(listOfferingBatches)
);
// GET /admin/tenants/:tenantId/offerings/test-series
router.get(
  "/:tenantId/offerings/test-series",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(listOfferingTestSeries)
);

// Platform sales orders
// GET /admin/tenants/:tenantId/sales/orders
router.get(
  "/:tenantId/sales/orders",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(listSalesOrders)
);

// Net revenue summary (INR + USD split)
// GET /admin/tenants/:tenantId/revenue/summary
router.get(
  "/:tenantId/revenue/summary",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(getRevenueSummary)
);

// ============================================
// SUBSCRIPTIONS
// ============================================

// List subscriptions for a tenant
// GET /admin/tenants/:tenantId/subscriptions
router.get(
  "/:tenantId/subscriptions",
  asyncHandler(requirePermission("subscriptions.view")),
  asyncHandler(listSubscriptions)
);

// Assign plan to tenant (create subscription)
// POST /admin/tenants/:tenantId/subscriptions
router.post(
  "/:tenantId/subscriptions",
  asyncHandler(requirePermission("subscriptions.manage")),
  asyncHandler(assignPlanToTenant)
);

// Get subscription by ID
// GET /admin/tenants/:tenantId/subscriptions/:id
router.get(
  "/:tenantId/subscriptions/:id",
  asyncHandler(requirePermission("subscriptions.view")),
  asyncHandler(getSubscriptionById)
);

// Cancel subscription
// POST /admin/tenants/:tenantId/subscriptions/:id/cancel
router.post(
  "/:tenantId/subscriptions/:id/cancel",
  asyncHandler(requirePermission("subscriptions.manage")),
  asyncHandler(cancelSubscription)
);

// Upgrade subscription
// POST /admin/tenants/:tenantId/subscriptions/:id/upgrade
router.post(
  "/:tenantId/subscriptions/:id/upgrade",
  asyncHandler(requirePermission("subscriptions.manage")),
  asyncHandler(upgradeSubscription)
);

// ============================================
// ENTITLEMENTS
// ============================================

// List entitlements for a tenant
// GET /admin/tenants/:tenantId/entitlements
router.get(
  "/:tenantId/entitlements",
  asyncHandler(requirePermission("entitlements.view")),
  asyncHandler(listEntitlements)
);

// Get entitlement by ID
// GET /admin/tenants/:tenantId/entitlements/:id
router.get(
  "/:tenantId/entitlements/:id",
  asyncHandler(requirePermission("entitlements.view")),
  asyncHandler(getEntitlementById)
);

// Override entitlement limit
// POST /admin/tenants/:tenantId/entitlements/:id/override
router.post(
  "/:tenantId/entitlements/:id/override",
  asyncHandler(requirePermission("entitlements.override")),
  asyncHandler(overrideEntitlement)
);

// Reset entitlement usage
// POST /admin/tenants/:tenantId/entitlements/:id/reset-usage
router.post(
  "/:tenantId/entitlements/:id/reset-usage",
  asyncHandler(requirePermission("entitlements.manage")),
  asyncHandler(resetUsage)
);

// Update entitlement usage value
// POST /admin/tenants/:tenantId/entitlements/:id/update-usage
router.post(
  "/:tenantId/entitlements/:id/update-usage",
  asyncHandler(requirePermission("entitlements.manage")),
  asyncHandler(updateUsage)
);

// Get entitlement override history
// GET /admin/tenants/:tenantId/entitlements/:id/overrides
router.get(
  "/:tenantId/entitlements/:id/overrides",
  asyncHandler(requirePermission("entitlements.view")),
  asyncHandler(getOverrideHistory)
);

// Reconcile usage counters for a tenant
// POST /admin/tenants/:tenantId/entitlements/reconcile
router.post(
  "/:tenantId/entitlements/reconcile",
  asyncHandler(requirePermission("entitlements.manage")),
  asyncHandler(reconcileUsage)
);

// Create an ADMIN-sourced entitlement (standalone, not tied to subscription/addon)
// POST /admin/tenants/:tenantId/entitlements/admin-grant
router.post(
  "/:tenantId/entitlements/admin-grant",
  asyncHandler(requirePermission("entitlements.manage")),
  asyncHandler(createAdminEntitlement)
);

// Revoke an ADMIN-sourced entitlement
// POST /admin/tenants/:tenantId/entitlements/:id/revoke
router.post(
  "/:tenantId/entitlements/:id/revoke",
  asyncHandler(requirePermission("entitlements.manage")),
  asyncHandler(revokeAdminEntitlement)
);

// ============================================
// TENANT ADDONS
// ============================================

// List tenant addons
// GET /admin/tenants/:tenantId/addons
router.get("/:tenantId/addons", asyncHandler(requirePermission("addons.view")), asyncHandler(listTenantAddons));

// Grant addon to tenant
// POST /admin/tenants/:tenantId/addons
router.post("/:tenantId/addons", asyncHandler(requirePermission("addons.manage")), asyncHandler(grantAddon));

// Get tenant addon by ID
// GET /admin/tenants/:tenantId/addons/:id
router.get("/:tenantId/addons/:id", asyncHandler(requirePermission("addons.view")), asyncHandler(getTenantAddonById));

// Cancel tenant addon
// POST /admin/tenants/:tenantId/addons/:id/cancel
router.post(
  "/:tenantId/addons/:id/cancel",
  asyncHandler(requirePermission("addons.manage")),
  asyncHandler(cancelTenantAddon)
);

export default router;
