import { NextFunction, Request, Response } from "express";
import tenantAuditService from "../services/tenant-audit.service";
import { TenantAuditLogQueryParams } from "../types/tenant.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List tenant audit logs (application + addon events)
 * GET /admin/tenants/:tenantId/audit-logs
 */
export const listTenantAuditLogs = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const params: TenantAuditLogQueryParams = {
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await tenantAuditService.listTenantAuditLogs(
    tenantId as string,
    params
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant audit logs retrieved successfully",
  });
};
