import { NextFunction, Request, Response } from "express";
import tenantService from "../services/tenant.service";
import {
  CreateTenantRequest,
  CreateTenantRoleRequest,
  SuspendTenantRequest,
  TenantQueryParams,
  TenantStatus,
  UpdateTenantRequest,
  UpdateTenantRoleRequest,
} from "../types/tenant.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List all tenants
 * GET /admin/tenants
 */
export const listTenants = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: TenantQueryParams = {
    status: req.query.status as TenantStatus | undefined,
    search: req.query.search as string | undefined,
    sort: req.query.sort === "oldest" ? "oldest" : "latest",
    plan: (req.query.plan as string | undefined) || undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await tenantService.listTenants(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenants retrieved successfully",
  });
};

/**
 * Create a new tenant with owner
 * POST /admin/tenants
 */
export const createTenant = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: CreateTenantRequest = {
    name: req.body.name,
    slug: req.body.slug,
    custom_domain: req.body.custom_domain,
    owner_user_id: req.body.owner_user_id,
  };

  const tenant = await tenantService.createTenant(data, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: tenant,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Tenant created successfully",
  });
};

/**
 * Get tenant by ID
 * GET /admin/tenants/:id
 */
export const getTenantById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const tenant = await tenantService.getTenantById(id as string);

  sendSuccessResponse({
    res,
    data: tenant,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant retrieved successfully",
  });
};

/**
 * Update a tenant
 * PATCH /admin/tenants/:id
 */
export const updateTenant = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const data: UpdateTenantRequest = {
    name: req.body.name,
    custom_domain: req.body.custom_domain,
  };

  const tenant = await tenantService.updateTenant(
    id as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: tenant,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant updated successfully",
  });
};

/**
 * Suspend a tenant
 * POST /admin/tenants/:id/suspend
 */
export const suspendTenant = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const data: SuspendTenantRequest = {
    reason: req.body.reason,
  };

  const tenant = await tenantService.suspendTenant(
    id as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: tenant,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant suspended successfully",
  });
};

/**
 * Reactivate a suspended tenant
 * POST /admin/tenants/:id/reactivate
 */
export const reactivateTenant = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const tenant = await tenantService.reactivateTenant(
    id as string,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: tenant,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant reactivated successfully",
  });
};

/**
 * Permanently delete a tenant and all related data
 * DELETE /admin/tenants/:id
 */
export const deleteTenant = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const result = await tenantService.deleteTenant(
    id as string,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant and all related data deleted permanently",
  });
};

/**
 * Export tenants as Excel file, filtered by signup date range
 * GET /admin/tenants/export?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
export const exportTenants = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const startDate = req.query.start_date
    ? new Date(req.query.start_date as string)
    : undefined;
  const endDate = req.query.end_date
    ? new Date((req.query.end_date as string) + "T23:59:59.999Z")
    : undefined;

  const buffer = await tenantService.exportTenants(startDate, endDate);
  const filename = `tenants-${new Date().toISOString().split("T")[0]}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
};

/**
 * List global tenant roles
 * GET /admin/tenants/roles
 */
export const listTenantRoles = async (
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const roles = await tenantService.listTenantRoles();

  sendSuccessResponse({
    res,
    data: roles,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant roles retrieved successfully",
  });
};

/**
 * Create a global tenant role
 * POST /admin/tenants/roles
 */
export const createTenantRole = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: CreateTenantRoleRequest = {
    code: req.body.code,
    name: req.body.name,
    description: req.body.description,
  };

  const role = await tenantService.createTenantRole(data);

  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Tenant role created successfully",
  });
};

/**
 * Update a global tenant role
 * PATCH /admin/tenants/roles/:id
 */
export const updateTenantRole = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const roleId = req.params.id as string;
  const data: UpdateTenantRoleRequest = {
    code: req.body.code,
    name: req.body.name,
    description: req.body.description,
  };

  const role = await tenantService.updateTenantRole(roleId, data);

  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant role updated successfully",
  });
};

