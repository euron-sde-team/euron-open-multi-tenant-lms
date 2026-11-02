/**
 * Search controller, handles search and filter options requests.
 */

import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import searchService from "../services/search.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { SearchFilters } from "../repositories/search.repository";

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

/**
 * Parse array query params, supports both comma-separated and repeated keys.
 * e.g., ?categories=a,b or ?categories[]=a&categories[]=b
 */
function parseArrayParam(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => (typeof v === "string" ? v.split(",") : []))
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function parseFilters(req: Request): SearchFilters {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

  const contentType =
    typeof req.query.type === "string" ? req.query.type.toUpperCase() : undefined;
  const mode =
    typeof req.query.mode === "string" ? req.query.mode.toUpperCase() : undefined;
  const purchaseMode =
    typeof req.query.purchaseMode === "string"
      ? req.query.purchaseMode.toUpperCase()
      : undefined;
  const difficulty =
    typeof req.query.difficulty === "string"
      ? req.query.difficulty.toUpperCase()
      : undefined;

  const language = parseArrayParam(req.query.language);
  const categories = parseArrayParam(req.query.categories);
  const instructors = parseArrayParam(req.query.instructors);

  return {
    q: q || undefined,
    contentType: contentType || undefined,
    mode: mode || undefined,
    purchaseMode: purchaseMode || undefined,
    difficulty: difficulty || undefined,
    language: language.length > 0 ? language : undefined,
    categories: categories.length > 0 ? categories : undefined,
    instructors: instructors.length > 0 ? instructors : undefined,
  };
}

/**
 * GET /search
 * Full-text search with filters, trigram similarity, and 3-tier ranking.
 */
export const search = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const filters = parseFilters(req);
  const page =
    typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const limit =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 12;

  const data = await searchService.search(tenantId, filters, page, limit);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Search results retrieved successfully",
  });
};

/**
 * GET /search/filters
 * Dynamic filter options, returns only values present in the filtered result set.
 */
export const getFilterOptions = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const filters = parseFilters(req);

  const data = await searchService.getFilterOptions(tenantId, filters);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Filter options retrieved successfully",
  });
};
