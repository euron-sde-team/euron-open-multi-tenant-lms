import { Router } from "express";
import {
  checkEntitlement,
  consumeEntitlement,
} from "../controllers/entitlement.controller";
import {
  createAddon,
  getAddonById,
  listAvailableAddons,
  updateAddon,
} from "../controllers/tenant-addon.controller";
import {
  authenticateAdmin,
  requirePermission,
} from "../middlewares/admin.auth.middleware";

const router: Router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// ============================================
// ENTITLEMENT OPERATIONS
// ============================================

// Check entitlement (canConsume)
// POST /admin/entitlements/check
router.post("/check", requirePermission("entitlements.view"), checkEntitlement);

// Consume entitlement (increment usage)
// POST /admin/entitlements/consume
router.post("/consume", requirePermission("entitlements.manage"), consumeEntitlement);

// ============================================
// ADDON CATALOG
// ============================================

// List available addons (catalog)
// GET /admin/entitlements/addons
router.get("/addons", requirePermission("addons.view"), listAvailableAddons);

// Get addon by ID (catalog)
// GET /admin/entitlements/addons/:id
router.get("/addons/:id", requirePermission("addons.view"), getAddonById);

// Create addon (catalog)
// POST /admin/entitlements/addons
router.post("/addons", requirePermission("addons.manage"), createAddon);

// Update addon (catalog)
// PUT /admin/entitlements/addons/:id
router.put("/addons/:id", requirePermission("addons.manage"), updateAddon);

export default router;
