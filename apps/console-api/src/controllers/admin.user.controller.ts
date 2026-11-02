import { NextFunction, Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import adminUserService from "../services/admin.user.service";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * GET /api/v1/admin/users
 * List all admin users with optional filtering
 */
export const listUsers = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { status, search, page, limit } = req.query;

  const data = await adminUserService.listUsers({
    status: status as string | undefined,
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
 * POST /api/v1/admin/users
 * Create a new admin user
 */
export const createUser = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  if (!req.adminUser) {
    throw new UnauthorizedError("Authentication required");
  }

  const { email, password, name, avatar_url, roleIds } = req.body;

  if (!email || !password || !name) {
    throw new BadRequestError("Email, password, and name are required");
  }

  const data = await adminUserService.createUser(
    { email, password, name, avatar_url, roleIds },
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Admin user created successfully",
  });
};

/**
 * GET /api/v1/admin/users/:id
 * Get admin user by ID
 */
export const getUserById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;

  if (!id) {
    throw new BadRequestError("User ID is required");
  }

  const data = await adminUserService.getUserById(id);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
  });
};

/**
 * PATCH /api/v1/admin/users/:id
 * Update admin user
 */
export const updateUser = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const { name, avatar_url, email_verified } = req.body;

  if (!id) {
    throw new BadRequestError("User ID is required");
  }

  const data = await adminUserService.updateUser(
    id,
    {
      name,
      avatar_url,
      email_verified,
    },
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Admin user updated successfully",
  });
};

/**
 * DELETE /api/v1/admin/users/:id
 * Deactivate (soft delete) admin user
 */
export const deactivateUser = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  if (!req.adminUser) {
    throw new UnauthorizedError("Authentication required");
  }

  const id = req.params.id as string;

  if (!id) {
    throw new BadRequestError("User ID is required");
  }

  await adminUserService.deactivateUser(id, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: { message: "Admin user deactivated successfully" },
    statusCode: HttpSuccessStatus.OK,
    message: "Admin user deactivated successfully",
  });
};

/**
 * DELETE /api/v1/admin/users/:id/permanent
 * Permanently (hard) delete an admin user
 */
export const deleteUserPermanent = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;

  if (!id) {
    throw new BadRequestError("User ID is required");
  }

  await adminUserService.deleteUser(id, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: { message: "Admin user deleted permanently" },
    statusCode: HttpSuccessStatus.OK,
    message: "Admin user deleted permanently",
  });
};

/**
 * POST /api/v1/admin/users/:id/reactivate
 * Reactivate a deactivated admin user
 */
export const reactivateUser = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;

  if (!id) {
    throw new BadRequestError("User ID is required");
  }

  const data = await adminUserService.reactivateUser(id, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Admin user reactivated successfully",
  });
};

/**
 * POST /api/v1/admin/users/:id/roles
 * Assign role to user
 */
export const assignRole = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  if (!req.adminUser) {
    throw new UnauthorizedError("Authentication required");
  }

  const id = req.params.id as string;
  const { roleId } = req.body;

  if (!id) {
    throw new BadRequestError("User ID is required");
  }

  if (!roleId) {
    throw new BadRequestError("Role ID is required");
  }

  const data = await adminUserService.assignRoleToUser(
    id,
    roleId,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Role assigned successfully",
  });
};

/**
 * DELETE /api/v1/admin/users/:id/roles/:roleId
 * Revoke role from user
 */
export const revokeRole = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  if (!req.adminUser) {
    throw new UnauthorizedError("Authentication required");
  }

  const id = req.params.id as string;
  const roleId = req.params.roleId as string;

  if (!id || !roleId) {
    throw new BadRequestError("User ID and Role ID are required");
  }

  const data = await adminUserService.revokeRoleFromUser(
    id,
    roleId,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Role revoked successfully",
  });
};
