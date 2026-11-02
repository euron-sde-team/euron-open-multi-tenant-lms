import { Request, Response } from "express";

import { ForbiddenError } from "../errors/forbidden.error";
import examWorkflowsService from "../services/exam-workflows.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * The composite exam endpoints: one request per job an admin describes, rather
 * than one per table the job touches. See exam-workflows.service.ts for why.
 */

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function getActorId(req: Request): string | undefined {
  return (req as Request & { tenantUser?: { id?: string } }).tenantUser?.id;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const getQuestionInventory = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await examWorkflowsService.questionInventory(tenantId, {
    ...(str(req.query.bank_id) ? { bankId: str(req.query.bank_id)! } : {}),
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Question inventory retrieved successfully",
  });
};

export const importQuestionsIntoBank = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await examWorkflowsService.importQuestions(tenantId, req.body ?? {}, getActorId(req));
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Questions imported successfully",
  });
};

export const getTestResults = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await examWorkflowsService.testResults(tenantId, param(req, "testId"), {
    ...(num(req.query.below_percentage) !== undefined
      ? { belowPercentage: num(req.query.below_percentage)! }
      : {}),
    ...(num(req.query.above_percentage) !== undefined
      ? { abovePercentage: num(req.query.above_percentage)! }
      : {}),
    ...(num(req.query.limit) !== undefined ? { limit: num(req.query.limit)! } : {}),
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Test results retrieved successfully",
  });
};

export const getGradingQueue = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await examWorkflowsService.gradingQueue(tenantId, {
    ...(str(req.query.test_id) ? { testId: str(req.query.test_id)! } : {}),
    ...(str(req.query.test_series_id) ? { seriesId: str(req.query.test_series_id)! } : {}),
    ...(num(req.query.limit) !== undefined ? { limit: num(req.query.limit)! } : {}),
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Grading queue retrieved successfully",
  });
};

export const gradeAnswers = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await examWorkflowsService.gradeAnswers(
    tenantId,
    req.body?.marks,
    getActorId(req) ?? null
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Answers marked successfully",
  });
};

export const decideAwards = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await examWorkflowsService.decideAwards(tenantId, req.body ?? {}, getActorId(req));
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Scholarship awards decided successfully",
  });
};

