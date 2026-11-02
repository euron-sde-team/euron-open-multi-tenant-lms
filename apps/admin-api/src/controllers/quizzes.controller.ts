import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import * as quizzesService from "../services/quizzes.service";
import { generateQuestionsCsvSample } from "../services/quiz-import.parser";

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

/** Downloadable CSV sample for the quiz questions bulk import. */
export async function downloadImportSample(
  _req: Request,
  res: Response
): Promise<void> {
  const body = generateQuestionsCsvSample();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="quiz-questions-sample.csv"`
  );
  res.status(200).send(body);
}

export async function create(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const dto = req.body as quizzesService.CreateQuizDto;
  if (!dto.title || dto.title.length < 3 || dto.title.length > 255) {
    throw new BadRequestError("title is required (3-255 characters)");
  }
  if (!dto.course_id) {
    throw new BadRequestError("course_id is required");
  }
  if (!dto.scope) {
    throw new BadRequestError("scope is required (COURSE | SECTION | LESSON)");
  }
  const quiz = await quizzesService.create(tenantId, dto);
  sendSuccessResponse({
    res,
    data: quiz,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Quiz created successfully",
  });
}

export async function findAll(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const course_id = (req.query.course_id as string) ?? "";
  if (!course_id) {
    throw new BadRequestError("course_id is required");
  }
  const dto: quizzesService.ListQuizzesDto = {
    course_id,
    section_id: req.query.section_id as string | undefined,
    lesson_id: req.query.lesson_id as string | undefined,
    scope: req.query.scope as "COURSE" | "SECTION" | "LESSON" | undefined,
    status: req.query.status as "DRAFT" | "PUBLISHED" | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  };
  const result = await quizzesService.findAll(tenantId, dto);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Quizzes retrieved successfully",
  });
}

export async function findOne(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const quiz = await quizzesService.findOne(tenantId, id);
  sendSuccessResponse({
    res,
    data: quiz,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz retrieved successfully",
  });
}

export async function update(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const dto = req.body as quizzesService.UpdateQuizDto;
  const quiz = await quizzesService.update(tenantId, id, dto);
  sendSuccessResponse({
    res,
    data: quiz,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz updated successfully",
  });
}

export async function publish(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const quiz = await quizzesService.publish(tenantId, id);
  sendSuccessResponse({
    res,
    data: quiz,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz published successfully",
  });
}

export async function unpublish(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const quiz = await quizzesService.unpublish(tenantId, id);
  sendSuccessResponse({
    res,
    data: quiz,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz unpublished successfully",
  });
}

export async function remove(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const force = req.query.force === "true";
  await quizzesService.remove(tenantId, id, force);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz deleted successfully",
  });
}

export async function generateFromTranscript(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const dto = req.body as quizzesService.GenerateFromTranscriptDto;
  if (!dto.lecture_id) {
    throw new BadRequestError("lecture_id is required");
  }
  if (!dto.course_id) {
    throw new BadRequestError("course_id is required");
  }
  if (!dto.scope) {
    throw new BadRequestError("scope is required (COURSE | SECTION | LESSON)");
  }
  const quiz = await quizzesService.generateFromTranscript(tenantId, dto);
  sendSuccessResponse({
    res,
    data: {
      quiz,
      note: "Quiz generated as DRAFT. Review questions and publish when ready.",
    },
    statusCode: HttpSuccessStatus.CREATED,
    message: "Quiz generated successfully",
  });
}

export async function generateQuestions(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const quizId = param(req, "id");
  const dto = req.body as quizzesService.GenerateQuestionsForQuizDto;
  if (!dto.input_text?.trim()) {
    throw new BadRequestError("input_text is required");
  }
  const questionLimit = Math.min(
    Math.max(Number(dto.question_limit) || 5, 1),
    20
  );
  const result = await quizzesService.generateQuestionsForQuiz(tenantId, quizId, {
    input_text: dto.input_text.trim(),
    question_limit: questionLimit,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `${result.added} question(s) generated successfully`,
  });
}
