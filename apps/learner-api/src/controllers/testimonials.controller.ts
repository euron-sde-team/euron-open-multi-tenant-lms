/**
 * Testimonial controller, thin handlers for listing and submitting testimonials.
 */

import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import testimonialService from "../services/testimonials.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

function getTenantMemberId(req: Request): string {
  const user = req.user as { id: string } | undefined;
  if (!user?.id) throw new UnauthorizedError("Authentication required");
  return user.id;
}

/**
 * GET /testimonials
 * List approved testimonials with pagination (public endpoint).
 * Query params: page, limit
 */
export const listTestimonials = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);

  const page =
    typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const limit =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 12;

  const data = await testimonialService.listApprovedTestimonials(tenantId, {
    page,
    limit,
  });

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Testimonials retrieved successfully",
  });
};

/**
 * POST /testimonials
 * Submit a new testimonial (auth required).
 * Body: { name?, text?, image_url?, social_links?, rating? }
 */
export const submitTestimonial = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const memberId = getTenantMemberId(req);

  const body = req.body as {
    name?: string;
    text?: string;
    image_url?: string;
    social_links?: any;
    rating?: number;
  };

  const data = await testimonialService.submitTestimonial(tenantId, memberId, body);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Testimonial submitted successfully",
  });
};
