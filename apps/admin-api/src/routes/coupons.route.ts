import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
  getCouponAnalytics,
  getCouponDetailedAnalytics,
  getCouponRedemptions,
} from "../controllers/coupons.controller";

const couponsRouter: Router = Router();

couponsRouter.use(asyncHandler(authenticateTenantUser));

couponsRouter.get("/", asyncHandler(requirePermission("coupons.view")), asyncHandler(listCoupons));
couponsRouter.get("/:id/analytics", asyncHandler(requirePermission("coupons.view")), asyncHandler(getCouponAnalytics));
couponsRouter.get("/:id/detailed-analytics", asyncHandler(requirePermission("coupons.view")), asyncHandler(getCouponDetailedAnalytics));
couponsRouter.get("/:id/redemptions", asyncHandler(requirePermission("coupons.view")), asyncHandler(getCouponRedemptions));
couponsRouter.get("/:id", asyncHandler(requirePermission("coupons.view")), asyncHandler(getCoupon));
couponsRouter.post("/", asyncHandler(requirePermission("coupons.create")), asyncHandler(createCoupon));
couponsRouter.put("/:id", asyncHandler(requirePermission("coupons.update")), asyncHandler(updateCoupon));
couponsRouter.patch("/:id/toggle", asyncHandler(requirePermission("coupons.update")), asyncHandler(toggleCoupon));
couponsRouter.delete("/:id", asyncHandler(requirePermission("coupons.delete")), asyncHandler(deleteCoupon));

export default couponsRouter;
