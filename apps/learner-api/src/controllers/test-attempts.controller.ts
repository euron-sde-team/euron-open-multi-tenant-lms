import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import testAttemptService from "../services/test-attempt.service";
import testResultService from "../services/test-result.service";
import testResultPdfService from "../services/test-result-pdf.service";

function requireCtx(req: Request): { tenantId: string; memberId: string } {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and member required");
  return { tenantId, memberId };
}

export async function startAttempt(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const { test_id, series_id } = req.body ?? {};
  if (!test_id || !series_id)
    throw new BadRequestError("test_id and series_id are required");
  const data = await testAttemptService.startAttempt(tenantId, memberId, {
    testId: test_id,
    seriesId: series_id,
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Attempt started",
  });
}

export async function getAttempt(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const attemptId = req.params.attemptId as string;
  const data = await testAttemptService.getAttempt(tenantId, memberId, attemptId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Attempt state retrieved",
  });
}

export async function listAttempts(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const testId = req.params.testId as string;
  const attempts = await testAttemptService.listAttempts(
    tenantId,
    memberId,
    testId
  );
  sendSuccessResponse({
    res,
    data: { attempts },
    statusCode: HttpSuccessStatus.OK,
    message: "Attempts retrieved",
  });
}

export async function patchAnswer(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const attemptId = req.params.attemptId as string;
  const { question_id, answer, time_spent_sec, marked_for_review } = req.body ?? {};
  if (!question_id) throw new BadRequestError("question_id is required");
  await testAttemptService.patchAnswer(tenantId, memberId, attemptId, {
    question_id,
    answer,
    time_spent_sec,
    marked_for_review,
  });
  sendSuccessResponse({
    res,
    data: { ok: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Answer saved",
  });
}

export async function submitAttempt(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const attemptId = req.params.attemptId as string;
  const tabSwitchCount =
    typeof req.body?.tab_switch_count === "number"
      ? req.body.tab_switch_count
      : undefined;
  const data = await testAttemptService.submitAttempt(
    tenantId,
    memberId,
    attemptId,
    { tabSwitchCount }
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Attempt submitted",
  });
}

export async function recordProctoringEvent(
  req: Request,
  res: Response
): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const attemptId = req.params.attemptId as string;
  const { type, count, detail } = req.body ?? {};
  if (!type) throw new BadRequestError("type is required");
  const data = await testAttemptService.recordProctoringEvent(
    tenantId,
    memberId,
    attemptId,
    { type, count, detail }
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Proctoring event recorded",
  });
}

export async function resumeBreak(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const attemptId = req.params.attemptId as string;
  const data = await testAttemptService.resumeBreak(tenantId, memberId, attemptId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Break ended; next section started",
  });
}

export async function submitModule(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const attemptId = req.params.attemptId as string;
  const attemptModuleId = req.params.attemptModuleId as string;
  const data = await testAttemptService.submitModule(
    tenantId,
    memberId,
    attemptId,
    attemptModuleId
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message:
      data.outcome === "COMPLETED" ? "Attempt submitted" : "Module submitted",
  });
}

export async function getResult(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const attemptId = req.params.attemptId as string;
  const data = await testResultService.getResult(tenantId, memberId, attemptId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Result retrieved",
  });
}

export async function downloadResultPdf(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const attemptId = req.params.attemptId as string;
  const stream = await testResultPdfService.generate(tenantId, memberId, attemptId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="report-${attemptId}.pdf"`
  );
  stream.pipe(res);
}
