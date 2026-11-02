import { Request, Response } from "express";
import instructorsService from "../services/instructors.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
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

/* ------------------------------------------------------------------ */
/*  Instructors                                                        */
/* ------------------------------------------------------------------ */

export const listInstructors = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const search = req.query.search as string | undefined;
  const result = await instructorsService.getInstructors(tenantId, { page, limit, search });
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Instructors retrieved successfully" });
};

export const getInstructor = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const instructor = await instructorsService.getInstructorById(instructorId, tenantId);
  sendSuccessResponse({ res, data: instructor, statusCode: HttpSuccessStatus.OK, message: "Instructor retrieved successfully" });
};

export const createInstructor = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const { name, email, bio, expertise } = req.body;
  if (!name || !name.trim()) throw new BadRequestError("name is required");
  const instructor = await instructorsService.createInstructor(tenantId, { name: name.trim(), email, bio, expertise });
  sendSuccessResponse({ res, data: instructor, statusCode: HttpSuccessStatus.CREATED, message: "Instructor created successfully" });
};

export const updateInstructor = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const { name, email, bio, expertise } = req.body;
  const instructor = await instructorsService.updateInstructor(instructorId, tenantId, { name, email, bio, expertise });
  sendSuccessResponse({ res, data: instructor, statusCode: HttpSuccessStatus.OK, message: "Instructor updated successfully" });
};

export const deleteInstructor = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  await instructorsService.deleteInstructor(instructorId, tenantId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Instructor deleted successfully" });
};

/* ------------------------------------------------------------------ */
/*  Photo Upload/Delete                                                */
/* ------------------------------------------------------------------ */

export const uploadProfilePhoto = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  if (!req.file) throw new BadRequestError("No file provided");
  const result = await instructorsService.uploadProfilePhoto(tenantId, instructorId, req.file.buffer, req.file.mimetype);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Profile photo uploaded successfully" });
};

export const deleteProfilePhoto = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  await instructorsService.deleteProfilePhoto(tenantId, instructorId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Profile photo deleted successfully" });
};

export const uploadCompanyLogo = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const experienceId = param(req, "experienceId");
  if (!req.file) throw new BadRequestError("No file provided");
  const result = await instructorsService.uploadCompanyLogo(tenantId, instructorId, experienceId, req.file.buffer, req.file.mimetype);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Company logo uploaded successfully" });
};

export const deleteCompanyLogo = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const experienceId = param(req, "experienceId");
  await instructorsService.deleteCompanyLogo(tenantId, instructorId, experienceId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Company logo deleted successfully" });
};

/* ------------------------------------------------------------------ */
/*  Experiences                                                        */
/* ------------------------------------------------------------------ */

export const listExperiences = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const experiences = await instructorsService.getExperiences(instructorId, tenantId);
  sendSuccessResponse({ res, data: experiences, statusCode: HttpSuccessStatus.OK, message: "Experiences retrieved successfully" });
};

export const createExperience = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const { company, company_logo, years, details, sort_order } = req.body;
  if (!company) throw new BadRequestError("company is required");
  if (years === undefined || years === null) throw new BadRequestError("years is required");
  const experience = await instructorsService.createExperience(instructorId, tenantId, {
    company, company_logo, years: Number(years), details, sort_order,
  });
  sendSuccessResponse({ res, data: experience, statusCode: HttpSuccessStatus.CREATED, message: "Experience created successfully" });
};

export const updateExperience = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const experienceId = param(req, "experienceId");
  const { company, company_logo, years, details, sort_order } = req.body;
  const experience = await instructorsService.updateExperience(experienceId, instructorId, tenantId, {
    company, company_logo, years: years !== undefined ? Number(years) : undefined, details, sort_order,
  });
  sendSuccessResponse({ res, data: experience, statusCode: HttpSuccessStatus.OK, message: "Experience updated successfully" });
};

export const deleteExperience = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const experienceId = param(req, "experienceId");
  await instructorsService.deleteExperience(experienceId, instructorId, tenantId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Experience deleted successfully" });
};

/* ------------------------------------------------------------------ */
/*  Socials                                                            */
/* ------------------------------------------------------------------ */

export const getSocials = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const socials = await instructorsService.getSocials(instructorId, tenantId);
  sendSuccessResponse({ res, data: socials, statusCode: HttpSuccessStatus.OK, message: "Socials retrieved successfully" });
};

export const upsertSocials = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const instructorId = param(req, "instructorId");
  const { linkedin_url, twitter_url, youtube_url, github_url, website_url, facebook_url, instagram_url } = req.body;
  const socials = await instructorsService.upsertSocials(instructorId, tenantId, {
    linkedin_url, twitter_url, youtube_url, github_url, website_url, facebook_url, instagram_url,
  });
  sendSuccessResponse({ res, data: socials, statusCode: HttpSuccessStatus.OK, message: "Socials updated successfully" });
};
