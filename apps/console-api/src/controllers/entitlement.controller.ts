import { NextFunction, Request, Response } from "express";
import entitlementService from "../services/entitlement.service";
import {
    CreateAdminEntitlementRequest,
    EntitlementCheckRequest,
    EntitlementConsumeRequest,
    EntitlementQueryParams,
    EntitlementSource,
    OverrideEntitlementRequest,
    ResetUsageRequest,
    RevokeAdminEntitlementRequest,
    UpdateUsageRequest,
} from "../types/tenant.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List entitlements for a tenant
 * GET /admin/tenants/:tenantId/entitlements
 */
export const listEntitlements = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const params: EntitlementQueryParams = {
    application_code: req.query.application_code as string | undefined,
    feature_key: req.query.feature_key as string | undefined,
    source: req.query.source as EntitlementSource | undefined,
    is_active:
      req.query.is_active !== undefined
        ? req.query.is_active === "true"
        : undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await entitlementService.listEntitlements(tenantId as string, params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlements retrieved successfully",
  });
};

/**
 * Get entitlement by ID
 * GET /admin/tenants/:tenantId/entitlements/:id
 */
export const getEntitlementById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const entitlement = await entitlementService.getEntitlementById(
    tenantId as string,
    id as string
  );

  sendSuccessResponse({
    res,
    data: entitlement,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlement retrieved successfully",
  });
};

/**
 * Override entitlement limit (with audit trail)
 * POST /admin/tenants/:tenantId/entitlements/:id/override
 */
export const overrideEntitlement = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const data: OverrideEntitlementRequest = {
    new_limit_value: req.body.new_limit_value,
    reason: req.body.reason,
  };

  const entitlement = await entitlementService.overrideEntitlement(
    tenantId as string,
    id as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: entitlement,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlement limit overridden successfully",
  });
};

/**
 * Reset entitlement usage
 * POST /admin/tenants/:tenantId/entitlements/:id/reset-usage
 */
export const resetUsage = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const adminId = req.adminUser!.id;
  const data: ResetUsageRequest = {
    reason: req.body.reason,
  };

  const entitlement = await entitlementService.resetUsage(
    tenantId as string,
    id as string,
    data,
    adminId
  );

  sendSuccessResponse({
    res,
    data: entitlement,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlement usage reset successfully",
  });
};

/**
 * Update entitlement usage value
 * POST /admin/tenants/:tenantId/entitlements/:id/update-usage
 */
export const updateUsage = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const adminId = req.adminUser!.id;
  const data: UpdateUsageRequest = {
    new_used_value: req.body.new_used_value,
    reason: req.body.reason,
  };

  const entitlement = await entitlementService.updateUsage(
    tenantId as string,
    id as string,
    data,
    adminId
  );

  sendSuccessResponse({
    res,
    data: entitlement,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlement usage updated successfully",
  });
};

/**
 * Get entitlement override history
 * GET /admin/tenants/:tenantId/entitlements/:id/overrides
 */
export const getOverrideHistory = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const overrides = await entitlementService.getOverrideHistory(
    tenantId as string,
    id as string
  );

  sendSuccessResponse({
    res,
    data: overrides,
    statusCode: HttpSuccessStatus.OK,
    message: "Override history retrieved successfully",
  });
};

/**
 * Create an ADMIN-sourced entitlement for a tenant
 * POST /admin/tenants/:tenantId/entitlements/admin-grant
 */
export const createAdminEntitlement = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const adminId = req.adminUser!.id;
  const data: CreateAdminEntitlementRequest = {
    product_id: req.body.product_id,
    limit_value: req.body.limit_value,
    is_unlimited: req.body.is_unlimited,
    reason: req.body.reason,
  };

  const result = await entitlementService.createAdminEntitlement(
    tenantId as string,
    data,
    adminId
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Admin entitlement created successfully",
  });
};

/**
 * Revoke an ADMIN-sourced entitlement
 * POST /admin/tenants/:tenantId/entitlements/:id/revoke
 */
export const revokeAdminEntitlement = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const adminId = req.adminUser!.id;
  const data: RevokeAdminEntitlementRequest = {
    reason: req.body.reason,
  };

  const entitlement = await entitlementService.revokeAdminEntitlement(
    tenantId as string,
    id as string,
    data,
    adminId
  );

  sendSuccessResponse({
    res,
    data: entitlement,
    statusCode: HttpSuccessStatus.OK,
    message: "Admin entitlement revoked successfully",
  });
};

/**
 * Check entitlement (canConsume)
 * POST /admin/entitlements/check
 */
export const checkEntitlement = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: EntitlementCheckRequest = {
    tenant_id: req.body.tenant_id,
    feature_key: req.body.feature_key,
    amount: req.body.amount,
  };

  const result = await entitlementService.checkEntitlement(data);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlement check completed",
  });
};

/**
 * Reconcile usage counters for a tenant
 * POST /admin/tenants/:tenantId/entitlements/reconcile
 */
export const reconcileUsage = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const result = await entitlementService.reconcileUsage(tenantId as string);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Usage reconciled successfully",
  });
};

/**
 * Consume entitlement (increment usage)
 * POST /admin/entitlements/consume
 */
export const consumeEntitlement = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: EntitlementConsumeRequest = {
    tenant_id: req.body.tenant_id,
    feature_key: req.body.feature_key,
    amount: req.body.amount,
    resource_type: req.body.resource_type,
    resource_id: req.body.resource_id,
    idempotency_key: req.body.idempotency_key,
  };

  const result = await entitlementService.consumeEntitlement(data);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlement consumed successfully",
  });
};
