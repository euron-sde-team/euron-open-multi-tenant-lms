import { Router } from "express";
import { authenticateUser } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asynchandler";
import {
  listPlans,
  subscribe,
  verifyAuth,
  getMySubscription,
  cancelMySubscription,
  getPaymentUpdateLink,
  checkAccess,
} from "../controllers/user-subscriptions.controller";

const router: Router = Router();

// Public: list active subscription plans
router.get("/plans", asyncHandler(listPlans));

// Authenticated: subscribe, manage, check access
router.post("/subscribe", asyncHandler(authenticateUser), asyncHandler(subscribe));
router.post("/verify-auth", asyncHandler(authenticateUser), asyncHandler(verifyAuth));
router.get("/my", asyncHandler(authenticateUser), asyncHandler(getMySubscription));
router.post("/my/cancel", asyncHandler(authenticateUser), asyncHandler(cancelMySubscription));
router.get("/my/update-payment", asyncHandler(authenticateUser), asyncHandler(getPaymentUpdateLink));
router.get("/my/access", asyncHandler(authenticateUser), asyncHandler(checkAccess));

export default router;
