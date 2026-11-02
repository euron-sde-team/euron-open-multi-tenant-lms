import { NextFunction, Request, Response } from "express";
import tenantPermissionService from "../services/tenant-permission.service";
import {
  CreateTenantPermissionRequest,
  TenantPermissionQueryParams,
  UpdateTenantPermissionRequest,
} from "../types/tenant-permission.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

// ============================================
// TENANT PERMISSION CRUD
// ============================================

/**
 * List all tenant permissions
 * GET /admin/tenants/permissions
 */
export const listTenantPermissions = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: TenantPermissionQueryParams = {
    category: req.query.category as string | undefined,
    search: req.query.search as string | undefined,
  };

  const permissions = await tenantPermissionService.listPermissions(params);

  sendSuccessResponse({
    res,
    data: permissions,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant permissions retrieved successfully",
  });
};

/**
 * Create a tenant permission
 * POST /admin/tenants/permissions
 */
export const createTenantPermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: CreateTenantPermissionRequest = {
    code: req.body.code,
    name: req.body.name,
    category: req.body.category,
    description: req.body.description,
  };

  const permission = await tenantPermissionService.createPermission(data);

  sendSuccessResponse({
    res,
    data: permission,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Tenant permission created successfully",
  });
};

/**
 * Update a tenant permission
 * PATCH /admin/tenants/permissions/:id
 */
export const updateTenantPermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const data: UpdateTenantPermissionRequest = {
    name: req.body.name,
    description: req.body.description,
    category: req.body.category,
  };

  const permission = await tenantPermissionService.updatePermission(
    id as string,
    data
  );

  sendSuccessResponse({
    res,
    data: permission,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant permission updated successfully",
  });
};

/**
 * Delete a tenant permission
 * DELETE /admin/tenants/permissions/:id
 */
export const deleteTenantPermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  await tenantPermissionService.deletePermission(id as string);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant permission deleted successfully",
  });
};

/**
 * List distinct permission categories
 * GET /admin/tenants/permissions/categories
 */
export const listPermissionCategories = async (
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const categories = await tenantPermissionService.listCategories();

  sendSuccessResponse({
    res,
    data: categories,
    statusCode: HttpSuccessStatus.OK,
    message: "Permission categories retrieved successfully",
  });
};

// ============================================
// ROLE-PERMISSION MAPPING
// ============================================

/**
 * Get role with its permissions
 * GET /admin/tenants/roles/:id/permissions
 */
export const getRolePermissions = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const role = await tenantPermissionService.getRolePermissions(id as string);

  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.OK,
    message: "Role permissions retrieved successfully",
  });
};

/**
 * Set all permissions for a role (replace)
 * PUT /admin/tenants/roles/:id/permissions
 */
export const setRolePermissions = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const { permission_ids } = req.body;

  const role = await tenantPermissionService.setRolePermissions(
    id as string,
    permission_ids ?? []
  );

  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.OK,
    message: "Role permissions updated successfully",
  });
};

/**
 * Add a single permission to a role
 * POST /admin/tenants/roles/:id/permissions
 */
export const addRolePermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const { permission_id } = req.body;

  const role = await tenantPermissionService.addRolePermission(
    id as string,
    permission_id
  );

  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.OK,
    message: "Permission added to role successfully",
  });
};

/**
 * Remove a permission from a role
 * DELETE /admin/tenants/roles/:id/permissions/:permissionId
 */
export const removeRolePermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id, permissionId } = req.params;

  const role = await tenantPermissionService.removeRolePermission(
    id as string,
    permissionId as string
  );

  sendSuccessResponse({
    res,
    data: role,
    statusCode: HttpSuccessStatus.OK,
    message: "Permission removed from role successfully",
  });
};
