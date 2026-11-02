import { Request, Response } from "express";
import testsService from "../services/tests.service";
import testAnalyticsService from "../services/test-analytics.service";
import testAnalyticsExportService from "../services/test-analytics-export.service";
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

function getActorId(req: Request): string | undefined {
  return (req as Request & { tenantUser?: { id?: string } }).tenantUser?.id;
}

export const listTests = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const result = await testsService.list(tenantId, { page, limit, status, search });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tests retrieved successfully",
  });
};

export const getTest = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testsService.getById(tenantId, testId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Test retrieved successfully",
  });
};

export const getTestAnalytics = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testAnalyticsService.getTestAnalytics(tenantId, testId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Test analytics retrieved successfully",
  });
};

export const exportTestAnalytics = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const { buffer, fileName } = await testAnalyticsExportService.buildWorkbook(
    tenantId,
    testId
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.status(HttpSuccessStatus.OK).end(buffer);
};

export const getTestFull = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testsService.getFullTree(tenantId, testId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Test retrieved successfully",
  });
};

export const createTest = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await testsService.create(tenantId, req.body, getActorId(req));
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Test created successfully",
  });
};

export const createTestFull = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await testsService.createFull(tenantId, req.body, getActorId(req));
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Test created successfully",
  });
};

export const updateTest = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testsService.update(tenantId, testId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Test updated successfully",
  });
};

export const listTestAttempts = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const attempts = await testsService.listAttempts(tenantId, testId);
  sendSuccessResponse({
    res,
    data: { attempts },
    statusCode: HttpSuccessStatus.OK,
    message: "Attempts retrieved successfully",
  });
};

/** Learners who have sat any test, for the staff learner picker. */
export const listTestLearners = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const result = await testsService.listLearners(tenantId, {
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 25,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Learners retrieved successfully",
  });
};

/** Every test one learner has taken, across all series. */
export const listLearnerAttempts = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const learnerId = param(req, "learnerId");
  const result = await testsService.listLearnerAttempts(tenantId, learnerId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Learner attempts retrieved successfully",
  });
};

/** One learner's attempt, question by question, the faculty review screen. */
export const getAttemptReview = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const attemptId = param(req, "attemptId");
  const review = await testsService.getAttemptReview(tenantId, attemptId);
  sendSuccessResponse({
    res,
    data: review,
    statusCode: HttpSuccessStatus.OK,
    message: "Attempt review retrieved successfully",
  });
};

export const deleteTest = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  await testsService.delete(tenantId, testId);
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Test deleted successfully",
  });
};

export const publishTest = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testsService.publish(tenantId, testId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Test published successfully",
  });
};

export const unpublishTest = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testsService.unpublish(tenantId, testId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Test unpublished successfully",
  });
};

// ---------- Sections ----------
export const listSections = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testsService.listSections(tenantId, testId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Sections retrieved successfully",
  });
};

export const createSection = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testsService.createSection(tenantId, testId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Section created successfully",
  });
};

export const updateSection = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const sectionId = param(req, "sectionId");
  const data = await testsService.updateSection(tenantId, sectionId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Section updated successfully",
  });
};

export const deleteSection = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const sectionId = param(req, "sectionId");
  await testsService.deleteSection(tenantId, sectionId);
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Section deleted successfully",
  });
};

// ---------- Section questions ----------
export const addSectionQuestions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const sectionId = param(req, "sectionId");
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError("items array is required");
  }
  const data = await testsService.addSectionQuestions(
    tenantId,
    testId,
    sectionId,
    items
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Questions added to section",
  });
};

export const removeSectionQuestion = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const sectionId = param(req, "sectionId");
  const questionId = param(req, "questionId");
  await testsService.removeSectionQuestion(tenantId, sectionId, questionId);
  sendSuccessResponse({
    res,
    data: { removed: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Question removed from section",
  });
};

export const reorderSectionQuestions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const sectionId = param(req, "sectionId");
  const orderedQuestionIds = req.body?.orderedQuestionIds;
  if (!Array.isArray(orderedQuestionIds)) {
    throw new BadRequestError("orderedQuestionIds array is required");
  }
  const data = await testsService.reorderSectionQuestions(
    tenantId,
    sectionId,
    orderedQuestionIds
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Section questions reordered",
  });
};
