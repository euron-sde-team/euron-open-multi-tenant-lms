import { Request, Response } from "express";
import booksService from "../services/books.service";
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

// --- Books ---
export const listBooks = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const status = req.query.status as string | undefined;
  const purchaseMode = req.query.purchaseMode as string | undefined;
  const result = await booksService.getBooks(tenantId, {
    page,
    limit,
    status,
    purchaseMode,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Books retrieved successfully",
  });
};

export const getBook = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bookId = param(req, "bookId");
  const book = await booksService.getBookById(bookId, tenantId);
  sendSuccessResponse({
    res,
    data: book,
    statusCode: HttpSuccessStatus.OK,
    message: "Book retrieved successfully",
  });
};

/**
 * Get book by slug.
 * Returns 200 with book or 404 if not found.
 */
export const getBookBySlug = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(param(req, "slug") || "");
  if (!slug) {
    throw new BadRequestError("Slug is required");
  }
  const book = await booksService.getBookBySlug(tenantId, slug);
  if (!book) {
    throw new NotFoundError("Book not found for this slug");
  }
  sendSuccessResponse({
    res,
    data: book,
    statusCode: HttpSuccessStatus.OK,
    message: "Book retrieved successfully",
  });
};

export const createBook = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const body = req.body;
  if (!body?.title || !body?.slug) {
    throw new BadRequestError("title and slug are required");
  }
  const book = await booksService.createBook(tenantId, {
    title: body.title,
    slug: body.slug,
    author: body.author,
    description: body.description,
    summary: body.summary,
    pages: body.pages,
    url: body.url,
    page_images: body.page_images,
    price_inr: body.price_inr,
    price_usd: body.price_usd,
    discount_inr: body.discount_inr,
    discount_usd: body.discount_usd,
    prices: body.prices,
    purchase_mode: body.purchase_mode,
    status: body.status,
    language: body.language,
    thumbnail_url: body.thumbnail_url,
    preview_url: body.preview_url,
    sort_order: body.sort_order,
    validity_days: body.validity_days,
    rating: body.rating,
    rating_total_count: body.rating_total_count,
    file_format: body.file_format,
  });
  sendSuccessResponse({
    res,
    data: book,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Book created successfully",
  });
};

export const updateBook = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bookId = param(req, "bookId");
  const body = req.body;
  const book = await booksService.updateBook(bookId, tenantId, {
    title: body.title,
    slug: body.slug,
    author: body.author,
    description: body.description,
    summary: body.summary,
    pages: body.pages,
    url: body.url,
    page_images: body.page_images,
    price_inr: body.price_inr,
    price_usd: body.price_usd,
    discount_inr: body.discount_inr,
    discount_usd: body.discount_usd,
    prices: body.prices,
    purchase_mode: body.purchase_mode,
    status: body.status,
    language: body.language,
    thumbnail_url: body.thumbnail_url,
    preview_url: body.preview_url,
    sort_order: body.sort_order,
    validity_days: body.validity_days,
    rating: body.rating,
    rating_total_count: body.rating_total_count,
    file_format: body.file_format,
    author_ids: body.author_ids,
    category_ids: body.category_ids,
  });
  sendSuccessResponse({
    res,
    data: book,
    statusCode: HttpSuccessStatus.OK,
    message: "Book updated successfully",
  });
};

export const togglePublishBook = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bookId = param(req, "bookId");
  const { publish } = req.body;
  if (typeof publish !== "boolean") {
    throw new BadRequestError("publish (boolean) is required in body");
  }
  const book = await booksService.togglePublish(bookId, tenantId, publish);
  sendSuccessResponse({
    res,
    data: book,
    statusCode: HttpSuccessStatus.OK,
    message: publish ? "Book published successfully" : "Book unpublished successfully",
  });
};

export const deleteBook = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bookId = param(req, "bookId");
  await booksService.deleteBook(bookId, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Book deleted successfully",
  });
};

// --- Book Recommendations ---

export const getBookRecommendations = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bookId = param(req, "bookId");
  const recommendations = await booksService.getRecommendations(bookId, tenantId);
  sendSuccessResponse({
    res,
    data: recommendations,
    statusCode: HttpSuccessStatus.OK,
    message: "Book recommendations retrieved successfully",
  });
};

export const syncBookRecommendations = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bookId = param(req, "bookId");
  const { recommendedBookIds } = req.body;
  if (!Array.isArray(recommendedBookIds)) {
    throw new BadRequestError("recommendedBookIds (array) is required in body");
  }
  const recommendations = await booksService.syncRecommendations(
    bookId,
    tenantId,
    recommendedBookIds
  );
  sendSuccessResponse({
    res,
    data: recommendations,
    statusCode: HttpSuccessStatus.OK,
    message: "Book recommendations synced successfully",
  });
};
