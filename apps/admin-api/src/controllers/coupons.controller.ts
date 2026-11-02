import { Request, Response } from "express";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import couponsService from "../services/coupons.service";
import type { IResponseFormat } from "../types/response.type";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export const listCoupons = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await couponsService.listCoupons(tenantId, {
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
    search: req.query.search as string | undefined,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupons retrieved successfully",
  });
};

export const getCoupon = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await couponsService.getCoupon(tenantId, param(req, "id"));
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupon retrieved successfully",
  });
};

export const createCoupon = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await couponsService.createCoupon(tenantId, req.body);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Coupon created successfully",
  });
};

export const updateCoupon = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await couponsService.updateCoupon(tenantId, param(req, "id"), req.body);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupon updated successfully",
  });
};

export const toggleCoupon = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await couponsService.toggleCoupon(tenantId, param(req, "id"));
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupon status toggled",
  });
};

export const deleteCoupon = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  await couponsService.deleteCoupon(tenantId, param(req, "id"));
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupon deleted successfully",
  });
};

export const getCouponDetailedAnalytics = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const couponId = param(req, "id");
  const result = await couponsService.getDetailedAnalytics(tenantId, couponId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupon detailed analytics retrieved",
  });
};

export const getCouponAnalytics = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const couponId = param(req, "id");
  const result = await couponsService.getAnalytics(tenantId, couponId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupon analytics retrieved",
  });
};

export const getCouponRedemptions = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const couponId = param(req, "id");
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const result = await couponsService.getRedemptions(tenantId, couponId, page, limit);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Coupon redemptions retrieved",
  });
};
