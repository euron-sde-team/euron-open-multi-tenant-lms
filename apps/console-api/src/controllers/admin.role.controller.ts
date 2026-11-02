import { NextFunction, Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import adminRoleService from "../services/admin.role.service";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * GET /api/v1/admin/roles
 * List all roles
 */
export const listRoles = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { search, page, limit } = req.query;

  const data = await adminRoleService.listRoles({
    search: search as string | undefined,
    page: page ? parseInt(page as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  });

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
  });
};

/**
 * POST /api/v1/admin/roles
 * Create a new role
 */
export const createRole = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { code, name, description, permissionIds } = req.body;

  if (!code || !name) {
    throw new BadRequestError("Code and name are required");
  }

  const data = await adminRoleService.createRole(
    {
      code,
      name,
      description,
      permissionIds,
    },
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Role created successfully",
  });
};

/**
 * GET /api/v1/admin/roles/:id
 * Get role by ID
 */
export const getRoleById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;

  if (!id) {
    throw new BadRequestError("Role ID is required");
  }

  const data = await adminRoleService.getRoleById(id);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
  });
};

/**
 * PATCH /api/v1/admin/roles/:id
 * Update role
 */
export const updateRole = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const { name, description } = req.body;

  if (!id) {
    throw new BadRequestError("Role ID is required");
  }

  const data = await adminRoleService.updateRole(
    id,
    {
      name,
      description,
    },
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Role updated successfully",
  });
};

/**
 * DELETE /api/v1/admin/roles/:id
 * Delete role
 */
export const deleteRole = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;

  if (!id) {
    throw new BadRequestError("Role ID is required");
  }

  await adminRoleService.deleteRole(id, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: { message: "Role deleted successfully" },
    statusCode: HttpSuccessStatus.OK,
    message: "Role deleted successfully",
  });
};

/**
 * POST /api/v1/admin/roles/:id/permissions
 * Assign permission to role
 */
export const assignPermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const { permissionId } = req.body;

  if (!id) {
    throw new BadRequestError("Role ID is required");
  }

  if (!permissionId) {
    throw new BadRequestError("Permission ID is required");
  }

  const data = await adminRoleService.assignPermissionToRole(
    id,
    permissionId,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Permission assigned successfully",
  });
};

/**
 * DELETE /api/v1/admin/roles/:id/permissions/:permissionId
 * Revoke permission from role
 */
export const revokePermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const permissionId = req.params.permissionId as string;

  if (!id || !permissionId) {
    throw new BadRequestError("Role ID and Permission ID are required");
  }

  const data = await adminRoleService.revokePermissionFromRole(
    id,
    permissionId,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Permission revoked successfully",
  });
};
