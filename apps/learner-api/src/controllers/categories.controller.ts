/**
 * Public categories controller - serves active categories for the web app.
 */

import { Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import * as categoriesRepository from "../repositories/categories.repository";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

/**
 * GET /categories
 * List active categories for the tenant (public, no auth).
 */
export const listCategories = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);

  const categories = await categoriesRepository.listActiveCategories(tenantId);

  sendSuccessResponse({
    res,
    data: { categories },
    statusCode: HttpSuccessStatus.OK,
    message: "Categories retrieved successfully",
  });
};

/**
 * GET /categories/:slug
 * Get a single category by slug (public, no auth).
 */
export const getCategoryBySlug = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent((req.params.slug as string) || "");
  if (!slug) throw new NotFoundError("Category slug is required");

  const category = await categoriesRepository.findBySlug(tenantId, slug);
  if (!category) throw new NotFoundError("Category not found");

  sendSuccessResponse({
    res,
    data: category,
    statusCode: HttpSuccessStatus.OK,
    message: "Category retrieved successfully",
  });
};
