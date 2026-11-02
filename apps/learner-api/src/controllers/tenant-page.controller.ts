/**
 * Tenant Page Controller
 *
 * Request handlers for tenant page APIs.
 * These endpoints require tenant context from middleware.
 */

import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import tenantPageService from "../services/tenant-page.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/** Safely extract a single route param as string (Express 5 types params as string | string[]). */
function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Get a page by slug
 * GET /pages/:slug
 *
 * Requires tenant context from middleware.
 */
export const getPage = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenant } = req;
  const slug = param(req, "slug");

  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  const page = await tenantPageService.getPage(tenant.id, slug);

  sendSuccessResponse({
    res,
    data: page,
    statusCode: HttpSuccessStatus.OK,
    message: "Page retrieved successfully",
  });
};

/**
 * List all published pages
 * GET /pages
 *
 * Requires tenant context from middleware.
 */
export const listPages = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenant } = req;

  if (!tenant) {
    throw new NotFoundError("Tenant not found");
  }

  const result = await tenantPageService.listPages(tenant.id);

  sendSuccessResponse({
    res,
    data: result.pages,
    statusCode: HttpSuccessStatus.OK,
    message: "Pages retrieved successfully",
  });
};
