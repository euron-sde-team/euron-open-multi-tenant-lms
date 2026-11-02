import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import * as quizzesService from "../services/quizzes.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new BadRequestError("Tenant not found");
  return tenant.id;
}

function getMemberId(req: Request): string {
  const user = req.user as { id: string } | undefined;
  if (!user?.id) throw new BadRequestError("Authentication required");
  return user.id;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return (value as string) ?? "";
}

export async function listQuizzes(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = (req.query.course_id as string) ?? "";
  if (!courseId) {
    throw new BadRequestError("course_id is required");
  }
  const result = await quizzesService.listQuizzesForUser(
    tenantId,
    memberId,
    courseId,
    {
      section_id: req.query.section_id as string | undefined,
      lesson_id: req.query.lesson_id as string | undefined,
      scope: req.query.scope as string | undefined,
    }
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Quizzes retrieved successfully",
  });
}

export async function getQuizDetail(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const includeCorrect = req.query.include_correct === "true";
  const result = await quizzesService.getQuizDetail(
    tenantId,
    memberId,
    id,
    includeCorrect
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz retrieved successfully",
  });
}

export async function startAttempt(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const result = await quizzesService.startAttempt(
    tenantId,
    memberId,
    id
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz attempt started",
  });
}

export async function submitAttempt(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const body = req.body as {
    answers?: Array<{ question_id: string; option_id: string; answer?: unknown }>;
    tab_switch_count?: number;
  };
  if (!body?.answers || !Array.isArray(body.answers)) {
    throw new BadRequestError("answers array is required");
  }
  const result = await quizzesService.submitAttempt(
    tenantId,
    memberId,
    id,
    body.answers,
    typeof body.tab_switch_count === "number" ? body.tab_switch_count : undefined
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz submitted successfully",
  });
}

export async function getAttempt(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const result = await quizzesService.getAttempt(
    tenantId,
    memberId,
    id
  );
  sendSuccessResponse({
    res,
    data: { attempt: result },
    statusCode: HttpSuccessStatus.OK,
    message: "Attempt retrieved successfully",
  });
}

export async function listAttempts(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const result = await quizzesService.listAttempts(tenantId, memberId, id);
  sendSuccessResponse({
    res,
    data: { attempts: result },
    statusCode: HttpSuccessStatus.OK,
    message: "Attempts retrieved successfully",
  });
}

export async function getAttemptReview(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const attemptId = param(req, "attemptId");
  const result = await quizzesService.getAttemptReview(
    tenantId,
    memberId,
    id,
    attemptId
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Attempt review retrieved successfully",
  });
}

export async function markComplete(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const result = await quizzesService.markQuizComplete(
    tenantId,
    memberId,
    id
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz marked complete",
  });
}
