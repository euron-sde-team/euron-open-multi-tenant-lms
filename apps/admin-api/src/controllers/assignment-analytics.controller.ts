import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import * as assignmentAnalyticsService from "../services/assignment-analytics.service";

function getTenantId(req: Request): string {
  const tenantId = (req as Request & { tenantId?: string }).tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return (value as string) ?? "";
}

function query(req: Request, name: string): string | undefined {
  const v = req.query[name];
  if (Array.isArray(v)) return (v[0] as string) ?? undefined;
  return (v as string) ?? undefined;
}

export async function getOverviewAnalytics(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const search = query(req, "search");
  const page = parseInt(query(req, "page") ?? "1", 10);
  const limit = parseInt(query(req, "limit") ?? "20", 10);
  const result =
    await assignmentAnalyticsService.getOverviewAssignmentAnalytics(tenantId, {
      search: search || undefined,
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 20 : limit,
    });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment analytics overview retrieved successfully",
  });
}

export async function getCourseAnalytics(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  if (!courseId) {
    throw new BadRequestError("courseId is required");
  }
  const result =
    await assignmentAnalyticsService.getCourseAssignmentAnalytics(
      tenantId,
      courseId
    );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Course assignment analytics retrieved successfully",
  });
}

export async function getAssignmentAnalytics(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const assignmentId = param(req, "id");
  if (!assignmentId) {
    throw new BadRequestError("Assignment id is required");
  }
  const includeStudentResults =
    req.query.include_student_results === "true";
  const result =
    await assignmentAnalyticsService.getSingleAssignmentAnalytics(
      tenantId,
      assignmentId,
      { include_student_results: includeStudentResults }
    );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment analytics retrieved successfully",
  });
}
