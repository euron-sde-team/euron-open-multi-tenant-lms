import { Request, Response } from "express";

import questionLibraryService from "../services/question-library.service";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { IResponseFormat } from "../types/response.type";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function intParam(value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

/**
 * GET /tenant/question-library/courses
 * Query: search, status (DRAFT|PUBLISHED), limit, offset
 */
export const listCourses = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const search =
    typeof req.query.search === "string" ? req.query.search : undefined;
  const status =
    req.query.status === "DRAFT" || req.query.status === "PUBLISHED"
      ? req.query.status
      : undefined;
  const limit = intParam(req.query.limit, 50, 100);
  const offset = intParam(req.query.offset, 0, 10_000);
  const result = await questionLibraryService.listCourses(tenantId, {
    search,
    status,
    limit,
    offset,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Question library courses fetched",
  });
};

/**
 * GET /tenant/question-library/courses/:courseId/tree
 */
export const getCourseTree = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { courseId } = req.params;
  if (!courseId || typeof courseId !== "string") {
    throw new BadRequestError("courseId is required");
  }
  const tree = await questionLibraryService.getCourseTree(tenantId, courseId);
  sendSuccessResponse({
    res,
    data: tree,
    statusCode: HttpSuccessStatus.OK,
    message: "Question library course tree fetched",
  });
};

/**
 * GET /tenant/question-library/search?q=...&limit=
 */
export const searchQuestions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limit = intParam(req.query.limit, 30, 100);
  const hits = await questionLibraryService.searchQuestions(tenantId, q, limit);
  sendSuccessResponse({
    res,
    data: hits,
    statusCode: HttpSuccessStatus.OK,
    message: "Question library search results fetched",
  });
};

/**
 * POST /tenant/question-library/questions/detail
 * Body: { questionIds: string[] }
 */
export const getQuestionsDetail = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { questionIds } = req.body ?? {};
  if (!Array.isArray(questionIds)) {
    throw new BadRequestError("questionIds must be an array");
  }
  const details = await questionLibraryService.getQuestionsDetail(
    tenantId,
    questionIds.filter((x: unknown): x is string => typeof x === "string")
  );
  sendSuccessResponse({
    res,
    data: details,
    statusCode: HttpSuccessStatus.OK,
    message: "Question details fetched",
  });
};

/**
 * POST /tenant/question-library/import
 * Body: { quizId: string, questions: [{ question, marks, options: [...] }] }
 */
export const importQuestions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { quizId, questions } = req.body ?? {};
  if (!quizId || typeof quizId !== "string") {
    throw new BadRequestError("quizId is required");
  }
  if (!Array.isArray(questions)) {
    throw new BadRequestError("questions must be an array");
  }
  const result = await questionLibraryService.importQuestionsToQuiz(
    tenantId,
    quizId,
    questions
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: `${result.added} question(s) imported`,
  });
};
