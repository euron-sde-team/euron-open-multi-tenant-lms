import { Request, Response } from "express";
import bundlesService from "../services/bundles.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

/** Safely extract a single route param as string (Express 5 types params as string | string[]). */
function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// ─────────────────────────────────────────────────────────────
// Bundles CRUD
// ─────────────────────────────────────────────────────────────

export const listBundles = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const result = await bundlesService.getBundles(tenantId, {
    page,
    limit,
    status,
    search,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundles retrieved successfully",
  });
};

export const getBundle = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bundleId = param(req, "bundleId");
  const bundle = await bundlesService.getBundleById(bundleId, tenantId);
  sendSuccessResponse({
    res,
    data: bundle,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundle retrieved successfully",
  });
};

/**
 * Get bundle by slug.
 * Returns 200 with bundle or 404 if not found.
 */
export const getBundleBySlug = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(param(req, "slug") || "");
  if (!slug) {
    throw new BadRequestError("Slug is required");
  }
  const bundle = await bundlesService.getBundleBySlug(tenantId, slug);
  if (!bundle) {
    throw new NotFoundError("Bundle not found for this slug");
  }
  sendSuccessResponse({
    res,
    data: bundle,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundle retrieved successfully",
  });
};

export const createBundle = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const body = req.body;
  if (!body?.title || !body?.slug) {
    throw new BadRequestError("title and slug are required");
  }
  const bundle = await bundlesService.createBundle(tenantId, {
    title: body.title,
    slug: body.slug,
    subtitle: body.subtitle,
    description: body.description,
    price_inr: body.price_inr,
    price_usd: body.price_usd,
    discount_inr: body.discount_inr,
    discount_usd: body.discount_usd,
    prices: body.prices,
    thumbnail_url: body.thumbnail_url,
    preview_url: body.preview_url,
    status: body.status,
    purchase_mode: body.purchase_mode,
    validity_days: body.validity_days,
    sort_order: body.sort_order,
  });
  sendSuccessResponse({
    res,
    data: bundle,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Bundle created successfully",
  });
};

export const updateBundle = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bundleId = param(req, "bundleId");
  const body = req.body;
  const bundle = await bundlesService.updateBundle(bundleId, tenantId, {
    title: body.title,
    slug: body.slug,
    subtitle: body.subtitle,
    description: body.description,
    price_inr: body.price_inr,
    price_usd: body.price_usd,
    discount_inr: body.discount_inr,
    discount_usd: body.discount_usd,
    prices: body.prices,
    thumbnail_url: body.thumbnail_url,
    preview_url: body.preview_url,
    status: body.status,
    purchase_mode: body.purchase_mode,
    validity_days: body.validity_days,
    sort_order: body.sort_order,
  });
  sendSuccessResponse({
    res,
    data: bundle,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundle updated successfully",
  });
};

export const togglePublishBundle = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bundleId = param(req, "bundleId");
  const { publish } = req.body;
  if (typeof publish !== "boolean") {
    throw new BadRequestError("publish (boolean) is required in body");
  }
  const bundle = await bundlesService.togglePublish(bundleId, tenantId, publish);
  sendSuccessResponse({
    res,
    data: bundle,
    statusCode: HttpSuccessStatus.OK,
    message: publish ? "Bundle published successfully" : "Bundle unpublished successfully",
  });
};

export const deleteBundle = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bundleId = param(req, "bundleId");
  await bundlesService.deleteBundle(bundleId, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundle deleted successfully",
  });
};

// ─────────────────────────────────────────────────────────────
// Bundle Items
// ─────────────────────────────────────────────────────────────

export const listBundleItems = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bundleId = param(req, "bundleId");
  const items = await bundlesService.getBundleItems(bundleId, tenantId);
  sendSuccessResponse({
    res,
    data: items,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundle items retrieved successfully",
  });
};

export const addBundleItem = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bundleId = param(req, "bundleId");
  const body = req.body;
  if (!body?.item_type) {
    throw new BadRequestError(
      "item_type is required (COURSE, BOOK, or TEST_SERIES)"
    );
  }
  const item = await bundlesService.addBundleItem(bundleId, tenantId, {
    itemType: body.item_type,
    courseId: body.course_id,
    bookId: body.book_id,
    testSeriesId: body.test_series_id,
  });
  sendSuccessResponse({
    res,
    data: item,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Item added to bundle successfully",
  });
};

export const removeBundleItem = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bundleId = param(req, "bundleId");
  const itemId = param(req, "itemId");
  await bundlesService.removeBundleItem(bundleId, itemId, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Item removed from bundle successfully",
  });
};

export const reorderBundleItems = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bundleId = param(req, "bundleId");
  const { item_ids } = req.body;
  if (!Array.isArray(item_ids) || item_ids.length === 0) {
    throw new BadRequestError("item_ids (array of strings) is required");
  }
  const items = await bundlesService.reorderBundleItems(bundleId, tenantId, item_ids);
  sendSuccessResponse({
    res,
    data: items,
    statusCode: HttpSuccessStatus.OK,
    message: "Bundle items reordered successfully",
  });
};
