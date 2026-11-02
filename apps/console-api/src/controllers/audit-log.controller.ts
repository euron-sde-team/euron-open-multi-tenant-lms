import { NextFunction, Request, Response } from "express";
import auditService from "../services/audit.service";
import { AuditLogQueryParams } from "../types/audit-log.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List admin audit log entries
 * GET /admin/audit-logs
 */
export const listAuditLogs = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: AuditLogQueryParams = {
    actor: req.query.actor as string | undefined,
    category: req.query.category as string | undefined,
    action: req.query.action as string | undefined,
    tenant_id: req.query.tenant_id as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 30,
  };

  const result = await auditService.listAuditLogs(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Audit logs retrieved successfully",
  });
};

/**
 * Get a single audit log entry by id
 * GET /admin/audit-logs/:id
 */
export const getAuditLogById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const result = await auditService.getAuditLogById(req.params.id as string);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Audit log entry retrieved successfully",
  });
};
