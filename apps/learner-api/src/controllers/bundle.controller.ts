/**
 * Public bundle controller, serves published bundle data for the web app.
 */

import { Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import * as bundleService from "../services/bundle.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

/**
 * GET /bundles/:slug
 * Get a published bundle by slug.
 */
export const getBundleBySlug = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(String(req.params.slug || ""));
  if (!slug) throw new NotFoundError("Slug is required");

  const memberId = req.user?.id;
  const data = await bundleService.getBundleBySlug(tenantId, slug, memberId);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundle retrieved successfully",
  });
};

/**
 * GET /bundles
 * List published bundles with pagination.
 * Query params: page, limit, sortBy, sortOrder
 */
export const listPublishedBundles = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);

  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 8;
  const sortBy =
    typeof req.query.sortBy === "string"
      ? (req.query.sortBy as "created_at" | "title" | "sort_order")
      : "sort_order";
  const sortOrder =
    typeof req.query.sortOrder === "string"
      ? (req.query.sortOrder as "asc" | "desc")
      : "asc";

  const bookmarkedOnly =
    typeof req.query.bookmarked_only === "string" &&
    req.query.bookmarked_only.toLowerCase() === "true";

  const memberId = req.user?.id;
  const data = await bundleService.listPublishedBundles(
    tenantId,
    { page, limit, sortBy, sortOrder, bookmarkedOnly },
    memberId
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundles retrieved successfully",
  });
};
