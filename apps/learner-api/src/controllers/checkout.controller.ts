import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict.error";
import type { order_type } from "../db/enums";
import * as checkoutService from "../services/checkout.service";
import * as couponValidationService from "../services/coupon-validation.service";
import * as paymentVerificationService from "../services/payment-verification.service";
import { getCountryFromIp } from "../utils/geo-country";
import { normalizeCurrencyForTenant } from "../utils/price-resolver";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/** Buyer country snapshot for the order row: cf-ipcountry > geoip > null. */
export async function resolveRequestCountry(req: Request): Promise<string | null> {
  const cf = req.headers["cf-ipcountry"];
  if (typeof cf === "string" && /^[A-Z]{2}$/i.test(cf) && cf.toUpperCase() !== "XX" && cf.toUpperCase() !== "T1") {
    return cf.toUpperCase();
  }
  const xff = req.headers["x-forwarded-for"];
  const ip =
    typeof xff === "string" && xff.length > 0
      ? xff.split(",")[0]?.trim()
      : (req.ip ?? req.socket?.remoteAddress ?? null);
  return getCountryFromIp(ip);
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const tenantMemberId = req.user?.id;
  if (!tenantId || !tenantMemberId) {
    throw new BadRequestError("Tenant and user required");
  }
  const idempotencyKey = (req.headers["idempotency-key"] as string)?.trim() || null;
  try {
    const country = await resolveRequestCountry(req);
    const result = await checkoutService.createOrder(tenantId, tenantMemberId, req.body, idempotencyKey, { country });

    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.CREATED,
      message: "Order created",
    });
  } catch (err) {
    // Structured "already has access" conflict: surface slug/title to the frontend
    // so it can render a "Start learning now" CTA instead of a generic error.
    if (err instanceof ConflictError && err.message.startsWith("{")) {
      try {
        const payload = JSON.parse(err.message) as {
          kind: string;
          orderType: string;
          itemId: string;
          slug: string | null;
          title: string | null;
        };
        if (payload.kind === "ALREADY_HAS_ACCESS") {
          const friendly = `You already have access to this ${payload.orderType.toLowerCase()}.`;
          res.status(409).json({
            success: false,
            error: { message: friendly },
            kind: payload.kind,
            orderType: payload.orderType,
            itemId: payload.itemId,
            slug: payload.slug,
            title: payload.title,
            message: friendly,
            statusCode: 409,
          });
          return;
        }
      } catch {
        // fall through to default error handler
      }
    }
    throw err;
  }
}

export async function verifyPayment(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const tenantMemberId = req.user?.id;
  if (!tenantId || !tenantMemberId) {
    throw new BadRequestError("Tenant and user required");
  }
  const result = await checkoutService.verifyPayment(tenantId, tenantMemberId, req.body);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Payment verified",
  });
}

export async function freeEnroll(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const tenantMemberId = req.user?.id;
  if (!tenantId || !tenantMemberId) {
    throw new BadRequestError("Tenant and user required");
  }
  const { order_type, item_id } = req.body;
  if (!order_type || !item_id) {
    throw new BadRequestError("order_type and item_id are required");
  }
  const ALLOWED_FREE_ENROLL_TYPES = new Set([
    "COURSE",
    "BOOK",
    "BUNDLE",
    "BATCH",
    "TEST_SERIES",
  ]);
  if (!ALLOWED_FREE_ENROLL_TYPES.has(order_type)) {
    throw new BadRequestError(
      "order_type must be COURSE, BOOK, BUNDLE, BATCH, or TEST_SERIES"
    );
  }
  const result = await checkoutService.freeEnroll(tenantId, tenantMemberId, { order_type, item_id });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Enrolled successfully",
  });
}

export async function getOrderStatus(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const tenantMemberId = req.user?.id;
  if (!tenantId || !tenantMemberId) {
    throw new BadRequestError("Tenant and user required");
  }
  const { order_id } = req.body;
  if (!order_id) throw new BadRequestError("order_id is required");
  const result = await checkoutService.getOrderStatus(tenantId, tenantMemberId, order_id);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Order status retrieved",
  });
}

export async function verifyAndFulfill(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  const tenantMemberId = req.user?.id;
  if (!tenantId || !tenantMemberId) {
    throw new BadRequestError("Tenant and user required");
  }
  const { order_id } = req.body;
  if (!order_id) throw new BadRequestError("order_id is required");
  const result = await paymentVerificationService.verifyAndFulfillOrder(tenantId, tenantMemberId, order_id);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Order verification complete",
  });
}

export async function validateCoupon(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    throw new BadRequestError("Tenant required");
  }
  // optionalAuth: member id is present for logged-in users, null for logged-out
  // Easy Checkout shoppers previewing a coupon before signup.
  const tenantMemberId = req.user?.id ?? null;
  const { coupon_code, order_type, item_id, currency } = req.body;
  if (!coupon_code || !order_type || !item_id || !currency) {
    throw new BadRequestError("coupon_code, order_type, item_id, and currency are required");
  }
  const result = await couponValidationService.validateCoupon(tenantId, tenantMemberId, coupon_code, order_type, item_id, currency);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupon validated",
  });
}

/**
 * Coupons the buyer could redeem on this item right now. Checkout calls this
 * before starting payment: an empty list means go straight to the payment sheet,
 * a non-empty one means show the coupon step (and the codes on offer).
 */
export async function availableCoupons(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenant?.id;
  if (!tenantId) {
    throw new BadRequestError("Tenant required");
  }
  const tenantMemberId = req.user?.id ?? null;
  const orderType = String(req.query.order_type ?? "").trim();
  const itemId = String(req.query.item_id ?? "").trim();
  if (!orderType || !itemId) {
    throw new BadRequestError("order_type and item_id are required");
  }
  // Savings are quoted in the buyer's currency. The param is optional so an
  // older client keeps working; it falls back to the tenant default.
  const currency = await normalizeCurrencyForTenant(
    tenantId,
    String(req.query.currency ?? "").trim()
  );
  const coupons = await couponValidationService.listAvailableCoupons(
    tenantId,
    tenantMemberId,
    orderType as order_type,
    itemId,
    currency
  );
  sendSuccessResponse({
    res,
    data: { coupons },
    statusCode: HttpSuccessStatus.OK,
    message: "Available coupons retrieved",
  });
}
