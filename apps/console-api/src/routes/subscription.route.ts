import { Router } from "express";
import { listAllSubscriptions } from "../controllers/subscription.controller";
import {
  authenticateAdmin,
  requirePermission,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

// All routes require admin authentication
router.use(asyncHandler(authenticateAdmin));

// ============================================
// GLOBAL SUBSCRIPTION OPERATIONS
// ============================================

// List all subscriptions across all tenants
// GET /admin/subscriptions
router.get(
  "/",
  asyncHandler(requirePermission("subscriptions.view")),
  asyncHandler(listAllSubscriptions)
);

export default router;
