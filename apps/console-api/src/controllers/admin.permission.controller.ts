import { NextFunction, Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import adminPermissionService from "../services/admin.permission.service";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * GET /api/v1/admin/permissions
 * List all permissions with optional filtering
 */
export const listPermissions = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { category, search, page, limit } = req.query;

  const data = await adminPermissionService.listPermissions({
    category: category as string | undefined,
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
 * POST /api/v1/admin/permissions
 * Create a new permission
 */
export const createPermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { code, name, description, category } = req.body;

  if (!code || !name) {
    throw new BadRequestError("Code and name are required");
  }

  const data = await adminPermissionService.createPermission(
    {
      code,
      name,
      description,
      category,
    },
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Permission created successfully",
  });
};

/**
 * GET /api/v1/admin/permissions/:id
 * Get permission by ID
 */
export const getPermissionById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;

  if (!id) {
    throw new BadRequestError("Permission ID is required");
  }

  const data = await adminPermissionService.getPermissionById(id);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
  });
};

/**
 * PATCH /api/v1/admin/permissions/:id
 * Update permission
 */
export const updatePermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const { name, description, category } = req.body;

  if (!id) {
    throw new BadRequestError("Permission ID is required");
  }

  const data = await adminPermissionService.updatePermission(
    id,
    {
      name,
      description,
      category,
    },
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Permission updated successfully",
  });
};

/**
 * DELETE /api/v1/admin/permissions/:id
 * Delete permission
 */
export const deletePermission = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;

  if (!id) {
    throw new BadRequestError("Permission ID is required");
  }

  await adminPermissionService.deletePermission(id, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: { message: "Permission deleted successfully" },
    statusCode: HttpSuccessStatus.OK,
    message: "Permission deleted successfully",
  });
};

/**
 * GET /api/v1/admin/permissions/categories
 * Get all unique permission categories
 */
export const getCategories = async (
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const categories = await adminPermissionService.getCategories();

  sendSuccessResponse({
    res,
    data: { categories },
    statusCode: HttpSuccessStatus.OK,
  });
};
