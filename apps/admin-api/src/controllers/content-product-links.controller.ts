import { Request, Response } from "express";
import { ForbiddenError } from "../errors/forbidden.error";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import contentProductLinksService from "../services/content-product-links.service";
import type { LinkableContentType } from "../types/content-product-link.type";

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
// Generic factory for content-product-link handlers
// ─────────────────────────────────────────────────────────────

function makeListHandler(contentType: LinkableContentType, paramName: string) {
  return async (req: Request, res: Response<IResponseFormat>) => {
    const tenantId = getTenantId(req);
    const contentId = param(req, paramName);

    const result = await contentProductLinksService.getLinkedProducts(
      tenantId,
      contentType,
      contentId
    );

    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Linked products retrieved successfully",
    });
  };
}

function makeSetHandler(contentType: LinkableContentType, paramName: string) {
  return async (req: Request, res: Response<IResponseFormat>) => {
    const tenantId = getTenantId(req);
    const contentId = param(req, paramName);
    const productCodes: string[] = req.body.product_codes ?? [];

    const result = await contentProductLinksService.setLinkedProducts(
      tenantId,
      contentType,
      contentId,
      productCodes
    );

    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Linked products updated successfully",
    });
  };
}

// ─────────────────────────────────────────────────────────────
// Course linked products
// ─────────────────────────────────────────────────────────────

export const listCourseLinkedProducts = makeListHandler("COURSE", "courseId");
export const setCourseLinkedProducts = makeSetHandler("COURSE", "courseId");

// ─────────────────────────────────────────────────────────────
// Book linked products
// ─────────────────────────────────────────────────────────────

export const listBookLinkedProducts = makeListHandler("BOOK", "bookId");
export const setBookLinkedProducts = makeSetHandler("BOOK", "bookId");

// ─────────────────────────────────────────────────────────────
// Bundle linked products
// ─────────────────────────────────────────────────────────────

export const listBundleLinkedProducts = makeListHandler("BUNDLE", "bundleId");
export const setBundleLinkedProducts = makeSetHandler("BUNDLE", "bundleId");
