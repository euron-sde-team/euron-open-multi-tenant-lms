import { Request, Response } from "express";
import batchesService from "../services/batches.service";
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

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// ─────────────────────────────────────────────────────────────
// Batches CRUD
// ─────────────────────────────────────────────────────────────

export const listBatches = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const result = await batchesService.getBatches(tenantId, {
    page,
    limit,
    status,
    search,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Batches retrieved successfully",
  });
};

export const getBatch = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  const batch = await batchesService.getBatchById(batchId, tenantId);
  sendSuccessResponse({
    res,
    data: batch,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch retrieved successfully",
  });
};

export const getBatchBySlug = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(param(req, "slug") || "");
  if (!slug) {
    throw new BadRequestError("Slug is required");
  }
  const batch = await batchesService.getBatchBySlug(tenantId, slug);
  if (!batch) {
    throw new NotFoundError("Batch not found for this slug");
  }
  sendSuccessResponse({
    res,
    data: batch,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch retrieved successfully",
  });
};

export const createBatch = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const userId = req.tenantUser?.id;
  const body = req.body;
  if (!body?.title || !body?.slug) {
    throw new BadRequestError("title and slug are required");
  }
  if (!body?.start_date) {
    throw new BadRequestError("start_date is required");
  }
  const batch = await batchesService.createBatch(
    tenantId,
    {
      title: body.title,
      slug: body.slug,
      subtitle: body.subtitle,
      description: body.description,
      thumbnail_url: body.thumbnail_url,
      cover_image_url: body.cover_image_url,
      preview_url: body.preview_url,
      web_thumbnail_key: body.web_thumbnail_key,
      mobile_thumbnail_key: body.mobile_thumbnail_key,
      learning_outcomes: body.learning_outcomes,
      start_date: body.start_date,
      end_date: body.end_date,
      enrollment_open_date: body.enrollment_open_date,
      enrollment_close_date: body.enrollment_close_date,
      duration_days: body.duration_days,
      validity_days: body.validity_days,
      price_inr: body.price_inr,
      price_usd: body.price_usd,
      discount_inr: body.discount_inr,
      discount_usd: body.discount_usd,
      prices: body.prices,
      status: body.status,
      purchase_mode: body.purchase_mode,
      sort_order: body.sort_order,
    },
    userId
  );
  sendSuccessResponse({
    res,
    data: batch,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Batch created successfully",
  });
};

export const updateBatch = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  const body = req.body;
  const batch = await batchesService.updateBatch(batchId, tenantId, {
    title: body.title,
    slug: body.slug,
    subtitle: body.subtitle,
    description: body.description,
    thumbnail_url: body.thumbnail_url,
    cover_image_url: body.cover_image_url,
    preview_url: body.preview_url,
    web_thumbnail_key: body.web_thumbnail_key,
    mobile_thumbnail_key: body.mobile_thumbnail_key,
    learning_outcomes: body.learning_outcomes,
    start_date: body.start_date,
    end_date: body.end_date,
    enrollment_open_date: body.enrollment_open_date,
    enrollment_close_date: body.enrollment_close_date,
    duration_days: body.duration_days,
    validity_days: body.validity_days,
    price_inr: body.price_inr,
    price_usd: body.price_usd,
    discount_inr: body.discount_inr,
    discount_usd: body.discount_usd,
    prices: body.prices,
    status: body.status,
    purchase_mode: body.purchase_mode,
    sort_order: body.sort_order,
  });
  sendSuccessResponse({
    res,
    data: batch,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch updated successfully",
  });
};

export const togglePublishBatch = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  const { publish } = req.body;
  if (typeof publish !== "boolean") {
    throw new BadRequestError("publish (boolean) is required in body");
  }
  const batch = await batchesService.togglePublish(batchId, tenantId, publish);
  sendSuccessResponse({
    res,
    data: batch,
    statusCode: HttpSuccessStatus.OK,
    message: publish
      ? "Batch published successfully"
      : "Batch unpublished successfully",
  });
};

export const deleteBatch = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  await batchesService.deleteBatch(batchId, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch deleted successfully",
  });
};

// ─────────────────────────────────────────────────────────────
// Batch Items
// ─────────────────────────────────────────────────────────────

export const listBatchItems = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  const items = await batchesService.getBatchItems(batchId, tenantId);
  sendSuccessResponse({
    res,
    data: items,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch items retrieved successfully",
  });
};

export const addBatchItem = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  const body = req.body;
  if (!body?.item_type) {
    throw new BadRequestError("item_type is required (COURSE or BOOK)");
  }
  const item = await batchesService.addBatchItem(batchId, tenantId, {
    itemType: body.item_type,
    courseId: body.course_id,
    bookId: body.book_id,
  });
  sendSuccessResponse({
    res,
    data: item,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Item added to batch successfully",
  });
};

export const removeBatchItem = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  const itemId = param(req, "itemId");
  await batchesService.removeBatchItem(batchId, itemId, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Item removed from batch successfully",
  });
};

export const reorderBatchItems = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  const { item_ids } = req.body;
  if (!Array.isArray(item_ids) || item_ids.length === 0) {
    throw new BadRequestError("item_ids (array of strings) is required");
  }
  const items = await batchesService.reorderBatchItems(
    batchId,
    tenantId,
    item_ids
  );
  sendSuccessResponse({
    res,
    data: items,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch items reordered successfully",
  });
};

// ─────────────────────────────────────────────────────────────
// Enrollments (admin)
// ─────────────────────────────────────────────────────────────

export const listBatchEnrollments = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const result = await batchesService.listEnrollments(
    batchId,
    tenantId,
    page,
    limit
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch enrollments retrieved successfully",
  });
};
