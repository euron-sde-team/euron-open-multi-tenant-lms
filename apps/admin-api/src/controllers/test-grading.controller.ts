import { Request, Response } from "express";
import testGradingService from "../services/test-grading.service";
import { IResponseFormat } from "../types/response.type";
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

function getActorId(req: Request): string | null {
  return (
    (req as Request & { tenantUser?: { id?: string } }).tenantUser?.id ?? null
  );
}

export const listPendingAttempts = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const result = await testGradingService.listPendingAttempts(tenantId, {
    testId: (req.query.test_id as string | undefined) || undefined,
    seriesId: (req.query.test_series_id as string | undefined) || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Attempts pending grading retrieved",
  });
};

export const getAttemptForGrading = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const result = await testGradingService.getAttemptForGrading(
    getTenantId(req),
    param(req, "attemptId")
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
  });
};

export const gradeAnswer = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const body = (req.body ?? {}) as { marksAwarded?: unknown; remarks?: unknown };
  const result = await testGradingService.gradeAnswer(
    getTenantId(req),
    param(req, "answerId"),
    getActorId(req),
    {
      marksAwarded: Number(body.marksAwarded),
      remarks: typeof body.remarks === "string" ? body.remarks : null,
    }
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Answer graded",
  });
};
