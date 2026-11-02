import { Router } from "express";

import {
  exportTenantAnalytics,
  getTenantAnalyticsDetail,
  listTenantAnalytics,
  sendTenantEmail,
} from "../controllers/tenant-analytics.controller";
import { authenticateAdmin, requirePermission } from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

router.use(asyncHandler(authenticateAdmin));

router.get("/", asyncHandler(requirePermission("tenants.view")), asyncHandler(listTenantAnalytics));
router.get("/export", asyncHandler(requirePermission("tenants.view")), asyncHandler(exportTenantAnalytics));
router.get("/:id", asyncHandler(requirePermission("tenants.view")), asyncHandler(getTenantAnalyticsDetail));
// Emails the tenant's owner from the platform address: an operator write.
router.post("/:id/send-email", asyncHandler(requirePermission("tenants.manage")), asyncHandler(sendTenantEmail));

export default router;
