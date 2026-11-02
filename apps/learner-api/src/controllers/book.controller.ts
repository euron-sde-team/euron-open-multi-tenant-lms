/**
 * Public book controller, serves published book data for the reader.
 */

import { Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import * as bookService from "../services/book.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

/**
 * GET /books
 * List published books with pagination.
 * Query params: page, limit, sortBy, sortOrder
 */
export const listPublishedBooks = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);

  // Parse query params
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 8;
  const sortBy = typeof req.query.sortBy === "string"
    ? (req.query.sortBy as "created_at" | "title" | "sort_order")
    : "sort_order";
  const sortOrder = typeof req.query.sortOrder === "string"
    ? (req.query.sortOrder as "asc" | "desc")
    : "asc";
  const purchaseMode = typeof req.query.purchaseMode === "string" &&
    (req.query.purchaseMode === "FREE" || req.query.purchaseMode === "PAID")
    ? req.query.purchaseMode
    : undefined;
  const categorySlug = typeof req.query.category === "string" ? req.query.category.trim() : undefined;

  const bookmarkedOnly =
    typeof req.query.bookmarked_only === "string" &&
    req.query.bookmarked_only.toLowerCase() === "true";
  const ownedOnly =
    typeof req.query.owned_only === "string" &&
    req.query.owned_only.toLowerCase() === "true";

  const memberId = req.user?.id;
  const data = await bookService.listPublishedBooks(
    tenantId,
    { page, limit, sortBy, sortOrder, purchaseMode, categorySlug, bookmarkedOnly, ownedOnly },
    memberId
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Books retrieved successfully",
  });
};

/**
 * GET /books/:slug
 * Returns published book data (id, title, slug, url, etc.) for the reader.
 * Tenant is resolved from request host. No auth required.
 */
export const getBookBySlug = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(param(req, "slug") || "");
  if (!slug) throw new NotFoundError("Slug is required");

  const memberId = req.user?.id;
  const data = await bookService.getBookBySlug(tenantId, slug, memberId);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Book retrieved successfully",
  });
};

/**
 * GET /books/:slug/sample
 * Returns the book EPUB for sample preview. No auth required.
 * Page limiting is handled client-side by epubjs (samplePages prop).
 */
export const getBookSample = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(param(req, "slug") || "");
  if (!slug) throw new NotFoundError("Slug is required");

  const buffer = await bookService.getBookSample(tenantId, slug);

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", "inline");

  res.send(buffer);
};

/**
 * GET /books/:slug/content
 * Streams the book content (EPUB) directly to the client as an ArrayBuffer.
 * Requires authentication and active book access.
 */
export const getBookContent = async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(param(req, "slug") || "");
  if (!slug) throw new NotFoundError("Slug is required");

  const memberId = req.user?.id;
  if (!memberId) throw new UnauthorizedError("Authentication required");

  const buffer = await bookService.getBookContent(tenantId, slug, memberId);

  // Set security headers to prevent caching and direct downloads
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent the content from being embedded in iframes on other domains
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Content-Disposition set to inline to prevent download dialog
  res.setHeader("Content-Disposition", "inline");

  // Send the buffer
  res.send(buffer);
};
