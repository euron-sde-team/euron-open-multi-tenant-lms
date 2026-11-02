import { NextFunction, Request, Response } from "express";
import featureService from "../services/feature.service";
import {
  CreateFeatureRequest,
  FeatureQueryParams,
  UpdateFeatureRequest,
} from "../types/catalog.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List all features
 * GET /admin/features
 */
export const listFeatures = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: FeatureQueryParams = {
    application_id: req.query.application_id as string | undefined,
    category: req.query.category as string | undefined,
    is_deprecated:
      req.query.is_deprecated !== undefined
        ? req.query.is_deprecated === "true"
        : undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await featureService.listFeatures(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Features retrieved successfully",
  });
};

/**
 * Create a new feature
 * POST /admin/features
 */
export const createFeature = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: CreateFeatureRequest = {
    application_id: req.body.application_id,
    key: req.body.key,
    name: req.body.name,
    description: req.body.description,
    category: req.body.category,
    sort_order: req.body.sort_order,
    is_navigable: req.body.is_navigable,
    nav_route: req.body.nav_route,
    nav_label: req.body.nav_label,
    nav_icon: req.body.nav_icon,
    nav_sort_order: req.body.nav_sort_order,
  };

  const feature = await featureService.createFeature(
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: feature,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Feature created successfully",
  });
};

/**
 * Get feature by ID
 * GET /admin/features/:id
 */
export const getFeatureById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const feature = await featureService.getFeatureById(id);

  sendSuccessResponse({
    res,
    data: feature,
    statusCode: HttpSuccessStatus.OK,
    message: "Feature retrieved successfully",
  });
};

/**
 * Update a feature
 * PATCH /admin/features/:id
 */
export const updateFeature = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const data: UpdateFeatureRequest = {
    name: req.body.name,
    description: req.body.description,
    category: req.body.category,
    sort_order: req.body.sort_order,
    is_navigable: req.body.is_navigable,
    nav_route: req.body.nav_route,
    nav_label: req.body.nav_label,
    nav_icon: req.body.nav_icon,
    nav_sort_order: req.body.nav_sort_order,
  };

  const feature = await featureService.updateFeature(
    id,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: feature,
    statusCode: HttpSuccessStatus.OK,
    message: "Feature updated successfully",
  });
};

/**
 * Deprecate a feature
 * POST /admin/features/:id/deprecate
 */
export const deprecateFeature = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const feature = await featureService.deprecateFeature(
    id,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: feature,
    statusCode: HttpSuccessStatus.OK,
    message: "Feature deprecated successfully",
  });
};

/**
 * List features by application
 * GET /admin/applications/:appId/features
 */
export const listFeaturesByApplication = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const appId = req.params.appId as string;
  const result = await featureService.listFeaturesByApplication(appId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Features retrieved successfully",
  });
};

/**
 * Get unique feature categories
 * GET /admin/features/categories
 */
export const getCategories = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const categories = await featureService.getCategories();

  sendSuccessResponse({
    res,
    data: { categories },
    statusCode: HttpSuccessStatus.OK,
    message: "Categories retrieved successfully",
  });
};
