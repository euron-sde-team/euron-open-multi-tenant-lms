import type { Request, Response } from "express";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { BadRequestError } from "../errors/bad-request.error";
import * as cartService from "../services/cart.service";
import * as couponValidationService from "../services/coupon-validation.service";

export async function getCart(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  const result = await cartService.getCart(tenantId, memberId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Cart fetched" });
}

export async function addToCart(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  await cartService.addToCart(tenantId, memberId, req.body);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.CREATED, message: "Item added to cart" });
}

export async function removeFromCart(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  await cartService.removeFromCart(tenantId, memberId, req.body);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Item removed from cart" });
}

export async function clearCart(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  await cartService.clearCartAction(tenantId, memberId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Cart cleared" });
}

export async function createCartOrder(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  const idempotencyKey = (req.headers["idempotency-key"] as string)?.trim() || null;
  const result = await cartService.createCartOrder(tenantId, memberId, req.body, idempotencyKey);

  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.CREATED, message: "Cart order created" });
}

export async function verifyCartPayment(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  const result = await cartService.verifyCartPayment(tenantId, memberId, req.body);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Payment verified" });
}

export async function validateCartCoupon(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  const { coupon_code, currency } = req.body;
  if (!coupon_code || !currency) throw new BadRequestError("coupon_code and currency are required");

  const result = await couponValidationService.validateCartCoupon(tenantId, memberId, coupon_code, currency);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Coupon validated" });
}

export async function removeItemCoupon(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and user required");

  const itemId = String(req.params.itemId);
  if (!itemId) throw new BadRequestError("itemId is required");

  await cartService.removeItemCoupon(tenantId, memberId, itemId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Coupon removed from item" });
}
