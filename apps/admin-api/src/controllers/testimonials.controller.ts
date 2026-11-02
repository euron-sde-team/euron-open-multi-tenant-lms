import { Request, Response } from "express";
import testimonialsService from "../services/testimonials.service";
import { IResponseFormat } from "../types/response.type";
import { ForbiddenError } from "../errors/forbidden.error";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export const listTestimonials = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const search = req.query.search as string | undefined;
  const status = req.query.status as string | undefined;
  const result = await testimonialsService.listTestimonials(tenantId, { page, limit, search, status });
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Testimonials retrieved successfully" });
};

export const getTestimonial = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const testimonial = await testimonialsService.getTestimonialById(id, tenantId);
  sendSuccessResponse({ res, data: testimonial, statusCode: HttpSuccessStatus.OK, message: "Testimonial retrieved successfully" });
};

export const getTestimonialStats = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const stats = await testimonialsService.getStats(tenantId);
  sendSuccessResponse({ res, data: stats, statusCode: HttpSuccessStatus.OK, message: "Testimonial stats retrieved successfully" });
};

export const createTestimonial = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const { name, text, image_url, social_links, rating, tenant_member_id, member_email, status } = req.body;
  const testimonial = await testimonialsService.createTestimonial(tenantId, {
    name,
    text,
    image_url,
    social_links,
    rating,
    tenant_member_id,
    member_email,
    status,
  });
  sendSuccessResponse({ res, data: testimonial, statusCode: HttpSuccessStatus.CREATED, message: "Testimonial created successfully" });
};

export const updateTestimonial = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const { name, text, image_url, social_links, rating, tenant_member_id, member_email, status } = req.body;
  const testimonial = await testimonialsService.updateTestimonial(id, tenantId, {
    name,
    text,
    image_url,
    social_links,
    rating,
    tenant_member_id,
    member_email,
    status,
  });
  sendSuccessResponse({ res, data: testimonial, statusCode: HttpSuccessStatus.OK, message: "Testimonial updated successfully" });
};

export const deleteTestimonial = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  await testimonialsService.deleteTestimonial(id, tenantId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Testimonial deleted successfully" });
};

export const updateTestimonialStatus = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const { status } = req.body;
  if (!status) throw new BadRequestError("Status is required");
  const testimonial = await testimonialsService.updateStatus(id, tenantId, status);
  sendSuccessResponse({ res, data: testimonial, statusCode: HttpSuccessStatus.OK, message: "Testimonial status updated successfully" });
};
