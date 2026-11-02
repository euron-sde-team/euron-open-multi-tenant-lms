import { NextFunction, Request, Response } from "express";
import billingProviderService from "../services/billing-provider.service";
import { BillingProviderQueryParams } from "../types/billing-provider.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List billing providers
 * GET /admin/billing-providers
 */
export const listProviders = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: BillingProviderQueryParams = {
    is_active:
      req.query.is_active !== undefined ? req.query.is_active === "true" : undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await billingProviderService.listProviders(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Billing providers retrieved successfully",
  });
};

/**
 * Get billing provider analytics
 * GET /admin/billing-providers/analytics
 */
export const getAnalytics = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const result = await billingProviderService.getAnalytics();

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Analytics retrieved successfully",
  });
};

/**
 * Get billing provider by ID
 * GET /admin/billing-providers/:id
 */
export const getProviderById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const result = await billingProviderService.getProviderById(id);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Billing provider retrieved successfully",
  });
};

/**
 * Create billing provider
 * POST /admin/billing-providers
 */
export const createProvider = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const result = await billingProviderService.createProvider(
    req.body,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Billing provider created successfully",
  });
};

/**
 * Update billing provider
 * PATCH /admin/billing-providers/:id
 */
export const updateProvider = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const result = await billingProviderService.updateProvider(
    id,
    req.body,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Billing provider updated successfully",
  });
};

/**
 * Delete billing provider
 * DELETE /admin/billing-providers/:id
 */
export const deleteProvider = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  await billingProviderService.deleteProvider(id, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Billing provider deleted successfully",
  });
};
