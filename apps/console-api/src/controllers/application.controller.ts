import { NextFunction, Request, Response } from "express";
import applicationService from "../services/application.service";
import {
  ApplicationQueryParams,
  CreateApplicationRequest,
  UpdateApplicationRequest,
} from "../types/catalog.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List all applications
 * GET /admin/applications
 */
export const listApplications = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: ApplicationQueryParams = {
    is_active:
      req.query.is_active !== undefined
        ? req.query.is_active === "true"
        : undefined,
    is_public:
      req.query.is_public !== undefined
        ? req.query.is_public === "true"
        : undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await applicationService.listApplications(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Applications retrieved successfully",
  });
};

/**
 * Create a new application
 * POST /admin/applications
 */
export const createApplication = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: CreateApplicationRequest = {
    code: req.body.code,
    name: req.body.name,
    description: req.body.description,
    icon_url: req.body.icon_url,
    config: req.body.config,
    is_public: req.body.is_public,
    sort_order: req.body.sort_order,
  };

  const application = await applicationService.createApplication(
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: application,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Application created successfully",
  });
};

/**
 * Get application by ID
 * GET /admin/applications/:id
 */
export const getApplicationById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const application = await applicationService.getApplicationById(id);

  sendSuccessResponse({
    res,
    data: application,
    statusCode: HttpSuccessStatus.OK,
    message: "Application retrieved successfully",
  });
};

/**
 * Update an application
 * PATCH /admin/applications/:id
 */
export const updateApplication = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const data: UpdateApplicationRequest = {
    name: req.body.name,
    description: req.body.description,
    icon_url: req.body.icon_url,
    config: req.body.config,
    is_active: req.body.is_active,
    is_public: req.body.is_public,
    sort_order: req.body.sort_order,
  };

  const application = await applicationService.updateApplication(
    id,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: application,
    statusCode: HttpSuccessStatus.OK,
    message: "Application updated successfully",
  });
};

/**
 * Deactivate an application
 * DELETE /admin/applications/:id
 */
export const deactivateApplication = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  await applicationService.deactivateApplication(id, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Application deactivated successfully",
  });
};
