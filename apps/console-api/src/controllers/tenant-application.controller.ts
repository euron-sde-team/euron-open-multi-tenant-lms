import { NextFunction, Request, Response } from "express";
import tenantApplicationService from "../services/tenant-application.service";
import {
  GrantApplicationRequest,
  TenantApplicationQueryParams,
  TenantAppStatus,
  TenantAppSource,
  UpdateTenantApplicationRequest,
} from "../types/tenant.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List tenant applications
 * GET /admin/tenants/:tenantId/applications
 */
export const listTenantApplications = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const params: TenantApplicationQueryParams = {
    search: req.query.search as string | undefined,
    status: req.query.status as TenantAppStatus | undefined,
    source: req.query.source as TenantAppSource | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await tenantApplicationService.listTenantApplications(
    tenantId as string,
    params
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant applications retrieved successfully",
  });
};

/**
 * Grant (assign) an application to a tenant
 * POST /admin/tenants/:tenantId/applications
 */
export const grantApplication = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const data: GrantApplicationRequest = {
    application_id: req.body.application_id,
    source: req.body.source,
    reason: req.body.reason,
    trial_ends_at: req.body.trial_ends_at,
  };

  const tenantApp = await tenantApplicationService.grantApplication(
    tenantId as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: tenantApp,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Application assigned to tenant successfully",
  });
};

/**
 * Update a tenant application (suspend, reactivate, cancel)
 * PATCH /admin/tenants/:tenantId/applications/:id
 */
export const updateTenantApplication = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const data: UpdateTenantApplicationRequest = {
    status: req.body.status,
    reason: req.body.reason,
  };

  const tenantApp = await tenantApplicationService.updateTenantApplication(
    tenantId as string,
    id as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: tenantApp,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant application updated successfully",
  });
};
