import { Router } from "express";
import {
  createProvider,
  deleteProvider,
  getAnalytics,
  getProviderById,
  listProviders,
  updateProvider,
} from "../controllers/billing-provider.controller";
import {
  authenticateAdmin,
  requirePermission,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

router.use(asyncHandler(authenticateAdmin));

// GET /admin/billing-providers/analytics, must be before /:id
router.get(
  "/analytics",
  asyncHandler(requirePermission("billing.view")),
  asyncHandler(getAnalytics)
);

// GET /admin/billing-providers
router.get(
  "/",
  asyncHandler(requirePermission("billing.view")),
  asyncHandler(listProviders)
);

// GET /admin/billing-providers/:id
router.get(
  "/:id",
  asyncHandler(requirePermission("billing.view")),
  asyncHandler(getProviderById)
);

// POST /admin/billing-providers
router.post(
  "/",
  asyncHandler(requirePermission("billing.manage")),
  asyncHandler(createProvider)
);

// PATCH /admin/billing-providers/:id
router.patch(
  "/:id",
  asyncHandler(requirePermission("billing.manage")),
  asyncHandler(updateProvider)
);

// DELETE /admin/billing-providers/:id
router.delete(
  "/:id",
  asyncHandler(requirePermission("billing.manage")),
  asyncHandler(deleteProvider)
);

export default router;
