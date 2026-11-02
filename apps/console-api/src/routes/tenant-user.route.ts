import { Router } from "express";
import {
  searchGlobalTenantUsers,
  listUserTenants,
  getGlobalUser,
} from "../controllers/tenant-user.controller";
import {
  authenticateAdmin,
  requirePermission,
} from "../middlewares/admin.auth.middleware";

const router: Router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// ============================================
// USER-CENTRIC ROUTES (Global Tenant User View)
// ============================================

// Search global tenant users (must be before /:userId)
// GET /admin/tenant-users?search=...&page=1&limit=20
router.get("/", requirePermission("tenant_users.view"), searchGlobalTenantUsers);

// Get global user by ID
// GET /admin/tenant-users/:userId
router.get("/:userId", requirePermission("tenant_users.view"), getGlobalUser);

// List tenants a user belongs to
// GET /admin/tenant-users/:userId/tenants
router.get("/:userId/tenants", requirePermission("tenant_users.view"), listUserTenants);

export default router;
