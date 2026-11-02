import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import * as quizAnalyticsService from "../services/quiz-analytics.service";

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
    await quizAnalyticsService.getOverviewQuizAnalytics(tenantId, {
      search: search || undefined,
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 20 : limit,
    });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz analytics overview retrieved successfully",
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
    await quizAnalyticsService.getCourseQuizAnalytics(
      tenantId,
      courseId
    );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Course quiz analytics retrieved successfully",
  });
}

export async function getQuizAnalytics(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const quizId = param(req, "id");
  if (!quizId) {
    throw new BadRequestError("Quiz id is required");
  }
  const includeStudentResults =
    req.query.include_student_results === "true";
  const studentPage = Math.max(1, parseInt(query(req, "student_page") ?? "1", 10) || 1);
  const studentLimit = Math.min(50, Math.max(1, parseInt(query(req, "student_limit") ?? "20", 10) || 20));
  const studentSearch = (query(req, "student_search") ?? "").trim() || undefined;
  const result =
    await quizAnalyticsService.getSingleQuizAnalytics(
      tenantId,
      quizId,
      {
        include_student_results: includeStudentResults,
        student_page: studentPage,
        student_limit: studentLimit,
        student_search: studentSearch,
      }
    );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz analytics retrieved successfully",
  });
}
