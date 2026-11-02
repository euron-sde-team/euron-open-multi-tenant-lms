import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import * as plansController from "../controllers/plans.controller";

const router: Router = Router();

router.use(asyncHandler(authenticateTenantUser));

// Reads stay auth-only: the plans list is the reactivation surface the global
// subscription-status overlay sends EVERY staffer to when a plan lapses.
router.get("/", asyncHandler(plansController.listPlans));
router.get("/with-products", asyncHandler(plansController.listPlansWithProducts));
router.get("/:planVersionId/eligibility", asyncHandler(plansController.getEligibility));
// Activating a plan changes the tenant's own subscription, an owner-only
// billing action (previously ungated: any staffer could activate a plan).
router.post("/:planVersionId/activate-free", asyncHandler(requirePermission("billing.manage")), asyncHandler(plansController.activateFreePlan));

export default router;
