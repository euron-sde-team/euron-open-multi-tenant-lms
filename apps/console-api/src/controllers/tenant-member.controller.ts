import { NextFunction, Request, Response } from "express";
import tenantMemberService from "../services/tenant-member.service";
import {
  GlobalMemberQueryParams,
  TenantMemberQueryParams,
  TenantMemberStatus,
} from "../types/tenant.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List all members (end-users) across all tenants
 * GET /admin/members
 */
export const listAllMembers = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: GlobalMemberQueryParams = {
    search: req.query.search as string | undefined,
    status: req.query.status as TenantMemberStatus | undefined,
    tenant_id: req.query.tenant_id as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  };

  const result = await tenantMemberService.listAllMembers(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Members retrieved successfully",
  });
};

/**
 * List tenant members (end-users)
 * GET /admin/tenants/:tenantId/members
 */
export const listTenantMembers = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const params: TenantMemberQueryParams = {
    search: req.query.search as string | undefined,
    status: req.query.status as TenantMemberStatus | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await tenantMemberService.listTenantMembers(
    tenantId as string,
    params
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant members retrieved successfully",
  });
};
