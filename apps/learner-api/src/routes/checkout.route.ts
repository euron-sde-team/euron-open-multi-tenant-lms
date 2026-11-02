import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { tenantResolverMiddleware } from "../middlewares/tenant-resolver.middleware";
import { authenticateUser, optionalAuth } from "../middlewares/auth.middleware";
import * as checkoutController from "../controllers/checkout.controller";

const router: Router = Router();

router.post(
  "/free-enroll",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(checkoutController.freeEnroll)
);

router.post(
  "/create-order",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(checkoutController.createOrder)
);

router.post(
  "/verify-payment",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(checkoutController.verifyPayment)
);

router.post(
  "/order-status",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(checkoutController.getOrderStatus)
);

// No learner refund endpoint: a learner refunding their own order would keep
// the access it bought. Refunds are tenant-staff actions in admin-api.

router.post(
  "/verify-and-fulfill",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(checkoutController.verifyAndFulfill)
);

// Optional auth: coupon validation is a price preview. Logged-out shoppers using
// Easy Checkout must be able to see the discounted price before signing up. The
// actual purchase (create-order) still requires auth and re-validates the coupon,
// including per-user usage limits, against the real member.
router.post(
  "/validate-coupon",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(optionalAuth),
  asyncHandler(checkoutController.validateCoupon)
);

// Same optional-auth reasoning as validate-coupon: the list is a price-preview
// affordance, and per-user limits are only filtered in when a member is known.
router.get(
  "/available-coupons",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(optionalAuth),
  asyncHandler(checkoutController.availableCoupons)
);

export default router;
