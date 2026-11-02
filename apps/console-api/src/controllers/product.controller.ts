import { NextFunction, Request, Response } from "express";
import productService from "../services/product.service";
import {
  CreateProductRequest,
  ProductQueryParams,
  UpdateProductRequest,
  ConstraintType,
} from "../types/catalog.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List all products
 * GET /admin/products
 */
export const listProducts = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: ProductQueryParams = {
    feature_id: req.query.feature_id as string | undefined,
    application_id: req.query.application_id as string | undefined,
    constraint_type: req.query.constraint_type as ConstraintType | undefined,
    is_hard_limit:
      req.query.is_hard_limit === "true"
        ? true
        : req.query.is_hard_limit === "false"
          ? false
          : undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await productService.listProducts(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Products retrieved successfully",
  });
};

/**
 * Create a new product
 * POST /admin/products
 */
export const createProduct = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: CreateProductRequest = {
    feature_id: req.body.feature_id,
    code: req.body.code,
    title: req.body.title,
    constraint_type: req.body.constraint_type,
    unit: req.body.unit,
    is_hard_limit: req.body.is_hard_limit,
    usage_scope: req.body.usage_scope,
    usage_window: req.body.usage_window,
  };

  const product = await productService.createProduct(
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: product,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Product created successfully",
  });
};

/**
 * Get product by ID
 * GET /admin/products/:id
 */
export const getProductById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const product = await productService.getProductById(id);

  sendSuccessResponse({
    res,
    data: product,
    statusCode: HttpSuccessStatus.OK,
    message: "Product retrieved successfully",
  });
};

/**
 * Update a product
 * PATCH /admin/products/:id
 */
export const updateProduct = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const data: UpdateProductRequest = {
    title: req.body.title,
    unit: req.body.unit,
    is_hard_limit: req.body.is_hard_limit,
    usage_scope: req.body.usage_scope,
    usage_window: req.body.usage_window,
  };

  const product = await productService.updateProduct(
    id,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: product,
    statusCode: HttpSuccessStatus.OK,
    message: "Product updated successfully",
  });
};

/**
 * List products by feature
 * GET /admin/features/:featureId/products
 */
export const listProductsByFeature = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const featureId = req.params.featureId as string;
  const result = await productService.listProductsByFeature(featureId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Products retrieved successfully",
  });
};
