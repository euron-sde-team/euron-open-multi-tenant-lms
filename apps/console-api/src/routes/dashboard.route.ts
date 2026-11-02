import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller";
import {
  authenticateAdmin,
  requirePermission,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

// All routes require admin authentication
router.use(asyncHandler(authenticateAdmin));

// ============================================
// DASHBOARD
// ============================================

// Get aggregated dashboard statistics
// GET /admin/dashboard/stats
router.get(
  "/stats",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(getDashboardStats)
);

export default router;
