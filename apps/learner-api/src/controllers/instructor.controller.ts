/**
 * Public instructor controller, serves instructor data for end users.
 */

import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import instructorService from "../services/instructor.service";
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
 * GET /instructors/course/:courseId
 * Get instructors assigned to a course (with socials).
 */
export const getCourseInstructors = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");

  const data = await instructorService.getInstructorsByCourseId(tenantId, courseId);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Course instructors retrieved successfully",
  });
};

/**
 * GET /instructors
 * List instructors for a tenant with pagination.
 */
export const listInstructors = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;

  const data = await instructorService.listInstructors(tenantId, { page, limit });

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Instructors retrieved successfully",
  });
};

/**
 * GET /instructors/:id
 * Get instructor detail with experiences, socials, courses, and books.
 */
export const getInstructorDetail = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  if (!id) throw new NotFoundError("Instructor ID is required");

  const data = await instructorService.getInstructorDetail(tenantId, id);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Instructor retrieved successfully",
  });
};
