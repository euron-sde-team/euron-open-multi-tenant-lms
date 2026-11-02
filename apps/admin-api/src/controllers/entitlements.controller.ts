import { Request, Response } from "express";
import entitlementsService from "../services/entitlements.service";
import reconciliationService from "../services/reconciliation.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Get entitlements for the authenticated tenant
 * GET /tenant/entitlements
 */
export const getEntitlements = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }
  const list = await entitlementsService.getEntitlementsForTenant(tenantId);
  sendSuccessResponse({
    res,
    data: list,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlements retrieved successfully",
  });
};

/**
 * Check capacity for a product (e.g. before create)
 * GET /tenant/entitlements/check?product_code=...&amount=1
 */
export const checkEntitlement = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }
  const productCode = req.query.product_code as string | undefined;
  if (!productCode) {
    throw new BadRequestError("product_code is required");
  }
  const amount = req.query.amount
    ? parseInt(req.query.amount as string, 10)
    : 1;
  if (Number.isNaN(amount) || amount < 1) {
    throw new BadRequestError("amount must be a positive number");
  }
  const result = await entitlementsService.checkCapacity(
    tenantId,
    productCode,
    amount
  );
  sendSuccessResponse({
    res,
    data: {
      allowed: result.allowed,
      currentUsed: result.currentUsed,
      limit: result.limit,
      isUnlimited: result.isUnlimited,
      remainingSlots: result.remainingSlots,
      warning: result.warning,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Check completed",
  });
};

/**
 * Get USER-scoped products available for content linking
 * GET /tenant/entitlements/linkable-products
 */
export const getLinkableProducts = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }
  const list = await entitlementsService.getLinkableProducts(tenantId);
  sendSuccessResponse({
    res,
    data: list,
    statusCode: HttpSuccessStatus.OK,
    message: "Linkable products retrieved successfully",
  });
};

/**
 * Reconcile usage counters for the authenticated tenant
 * POST /tenant/entitlements/reconcile
 */
export const reconcileUsage = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }
  const results = await reconciliationService.reconcileTenant(tenantId, true);
  // Convert Map to plain object for JSON serialization
  const data: Record<string, { previousValue: number; actualValue: number; drift: number; corrected: boolean }> = {};
  for (const [key, val] of results) {
    data[key] = val;
  }
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Usage reconciled",
  });
};
