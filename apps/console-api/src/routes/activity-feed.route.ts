import { Router } from "express";
import { getActivityFeed } from "../controllers/activity-feed.controller";
import {
  authenticateAdmin,
  requirePermission,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

// All routes require admin authentication
router.use(asyncHandler(authenticateAdmin));

// ============================================
// GLOBAL ACTIVITY FEED
// ============================================

// Get global activity feed (application + addon + usage events)
// GET /admin/activity-feed
router.get(
  "/",
  asyncHandler(requirePermission("tenants.view")),
  asyncHandler(getActivityFeed)
);

export default router;
