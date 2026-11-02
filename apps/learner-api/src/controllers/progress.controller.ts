/**
 * Progress controller, get and update lecture progress.
 * All routes require authentication and enrollment.
 */

import type { Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import progressService from "../services/progress.service";
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

function getMemberId(req: Request): string {
  const user = req.user as { id: string } | undefined;
  if (!user?.id) throw new UnauthorizedError("Authentication required");
  return user.id;
}

/** GET /courses/:courseId/progress */
export async function getProgress(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");

  const result = await progressService.getProgress(
    tenantId,
    courseId,
    memberId
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Progress retrieved",
  });
}

/** GET /courses/:courseId/analytics */
export async function getCourseAnalytics(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");

  const result = await progressService.getUserCourseAnalytics(
    tenantId,
    courseId,
    memberId
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Analytics retrieved",
  });
}

/** GET /courses/:courseId/video-analytics */
export async function getCourseVideoAnalytics(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");

  const result = await progressService.getCourseVideoAnalytics(
    tenantId,
    courseId,
    memberId
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Video analytics retrieved",
  });
}

/** POST /courses/:courseId/progress, body: { lecture_id, completed?: boolean, watched_duration?: number } */
export async function markLectureComplete(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");

  const body = req.body as {
    lecture_id?: string;
    completed?: boolean;
    watched_duration?: number;
    last_position?: number;
  };
  const lectureId = typeof body?.lecture_id === "string" ? body.lecture_id.trim() : "";
  if (!lectureId) throw new NotFoundError("lecture_id is required");
  const completed = body?.completed !== undefined ? body.completed : undefined;
  const watchedDuration =
    typeof body?.watched_duration === "number" && body.watched_duration >= 0
      ? Math.round(body.watched_duration)
      : undefined;
  const lastPosition =
    typeof body?.last_position === "number" && body.last_position >= 0
      ? Math.round(body.last_position)
      : undefined;

  if (completed === undefined && watchedDuration === undefined && lastPosition === undefined) {
    throw new NotFoundError("At least one of completed, watched_duration, or last_position is required");
  }

  const payload: { completed?: boolean; watchedDuration?: number; lastPosition?: number } = {};
  if (completed !== undefined) payload.completed = completed;
  if (watchedDuration !== undefined) payload.watchedDuration = watchedDuration;
  if (lastPosition !== undefined) payload.lastPosition = lastPosition;

  const result = await progressService.upsertProgress(
    tenantId,
    courseId,
    lectureId,
    memberId,
    payload
  );

  let message = "Progress updated";
  if (completed !== undefined) {
    message = completed ? "Lecture marked as complete" : "Lecture marked as incomplete";
  }

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message,
  });
}

/** POST /courses/:courseId/lessons/:lessonId/complete, body: { completed?: boolean } */
export async function markLessonComplete(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  if (!courseId) throw new NotFoundError("Course ID is required");
  if (!lessonId) throw new NotFoundError("Lesson ID is required");

  const body = req.body as { completed?: boolean };
  const completed = body?.completed !== undefined ? !!body.completed : true;

  const result = await progressService.markLessonComplete(
    tenantId,
    courseId,
    lessonId,
    memberId,
    completed
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: completed ? "Lesson marked as complete" : "Lesson marked as incomplete",
  });
}
