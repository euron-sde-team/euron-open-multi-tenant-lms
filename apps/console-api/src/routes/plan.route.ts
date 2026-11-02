import { Router } from "express";
import {
  addVersionProduct,
  applyEntitlementSync,
  createPlan,
  createPlanVersion,
  createPlanWithVersion,
  deactivatePlan,
  getPlanApplications,
  getPlanById,
  getPlanVersionById,
  linkApplication,
  listPlans,
  listPlanVersions,
  previewEntitlementSync,
  publishPlanVersion,
  removeVersionProduct,
  retirePlanVersion,
  unlinkApplication,
  updatePlan,
  updatePlanVersion,
} from "../controllers/plan.controller";
import {
  authenticateAdmin,
  requirePermission,
} from "../middlewares/admin.auth.middleware";

const router: Router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// ============================================
// PLAN CRUD
// ============================================

// List all plans
// GET /admin/plans
router.get("/", requirePermission("plans.view"), listPlans);

// Create a new plan
// POST /admin/plans
router.post("/", requirePermission("plans.manage"), createPlan);

// Create a new plan with its first version (transaction)
// POST /admin/plans/with-version
router.post("/with-version", requirePermission("plans.manage"), createPlanWithVersion);

// Get plan by ID
// GET /admin/plans/:id
router.get("/:id", requirePermission("plans.view"), getPlanById);

// Update a plan
// PATCH /admin/plans/:id
router.patch("/:id", requirePermission("plans.manage"), updatePlan);

// Deactivate a plan
// DELETE /admin/plans/:id
router.delete("/:id", requirePermission("plans.manage"), deactivatePlan);

// ============================================
// PLAN VERSIONS
// ============================================

// List plan versions
// GET /admin/plans/:planId/versions
router.get("/:planId/versions", requirePermission("plans.view"), listPlanVersions);

// Create a new plan version
// POST /admin/plans/:planId/versions
router.post("/:planId/versions", requirePermission("plans.manage"), createPlanVersion);

// Get plan version by ID
// GET /admin/plans/:planId/versions/:versionId
router.get("/:planId/versions/:versionId", requirePermission("plans.view"), getPlanVersionById);

// Update a draft plan version
// PATCH /admin/plans/:planId/versions/:versionId
router.patch("/:planId/versions/:versionId", requirePermission("plans.manage"), updatePlanVersion);

// Publish a plan version
// POST /admin/plans/:planId/versions/:versionId/publish
router.post("/:planId/versions/:versionId/publish", requirePermission("plans.manage"), publishPlanVersion);

// Retire a plan version
// POST /admin/plans/:planId/versions/:versionId/retire
router.post("/:planId/versions/:versionId/retire", requirePermission("plans.manage"), retirePlanVersion);

// ============================================
// PLAN VERSION PRODUCTS
// ============================================

// Add product to plan version
// POST /admin/plans/:planId/versions/:versionId/products
router.post("/:planId/versions/:versionId/products", requirePermission("plans.manage"), addVersionProduct);

// Remove product from plan version
// DELETE /admin/plans/:planId/versions/:versionId/products/:productId
router.delete("/:planId/versions/:versionId/products/:productId", requirePermission("plans.manage"), removeVersionProduct);

// ============================================
// ENTITLEMENT SYNC (backfill a version's products to existing tenants)
// ============================================

// Preview the sync (dry run, writes nothing)
// POST /admin/plans/:planId/entitlement-sync/preview
router.post("/:planId/entitlement-sync/preview", requirePermission("entitlements.view"), previewEntitlementSync);

// Apply the sync to the plan's existing tenants
// POST /admin/plans/:planId/entitlement-sync/apply
router.post("/:planId/entitlement-sync/apply", requirePermission("entitlements.manage"), applyEntitlementSync);

// ============================================
// PLAN APPLICATIONS
// ============================================

// Get applications linked to a plan
// GET /admin/plans/:planId/applications
router.get("/:planId/applications", requirePermission("plans.view"), getPlanApplications);

// Link application to plan
// POST /admin/plans/:planId/applications
router.post("/:planId/applications", requirePermission("plans.manage"), linkApplication);

// Unlink application from plan
// DELETE /admin/plans/:planId/applications/:appId
router.delete("/:planId/applications/:appId", requirePermission("plans.manage"), unlinkApplication);

export default router;
