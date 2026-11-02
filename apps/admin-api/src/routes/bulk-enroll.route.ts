import { Router } from "express";

import { runBulkEnroll } from "../controllers/bulk-enroll.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const bulkEnrollRouter: Router = Router();

bulkEnrollRouter.use(asyncHandler(authenticateTenantUser));

bulkEnrollRouter.post(
  "/",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(runBulkEnroll),
);

export default bulkEnrollRouter;
