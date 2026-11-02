import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateUser } from "../middlewares/auth.middleware";
import {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  createCartOrder,
  verifyCartPayment,
  validateCartCoupon,
  removeItemCoupon,
} from "../controllers/cart.controller";

const router: Router = Router();

// All cart routes require authentication
router.use(asyncHandler(authenticateUser));

// Cart CRUD
router.get("/", asyncHandler(getCart));
router.post("/items", asyncHandler(addToCart));
router.delete("/items", asyncHandler(removeFromCart));
router.delete("/", asyncHandler(clearCart));

// Per-item coupon management
router.delete("/items/:itemId/coupon", asyncHandler(removeItemCoupon));

// Cart checkout
router.post("/checkout", asyncHandler(createCartOrder));
router.post("/checkout/verify", asyncHandler(verifyCartPayment));
router.post("/validate-coupon", asyncHandler(validateCartCoupon));

export default router;
