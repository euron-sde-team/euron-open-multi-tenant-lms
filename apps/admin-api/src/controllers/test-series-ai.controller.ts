import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import {
  submitTestSeriesAIJob,
  testSeriesAIQueue,
  type TestSeriesAIJobInput,
  type TestSeriesAIJobProgress,
} from "../queues/test-series-ai.queue";
import testEntitlementsService from "../services/test-entitlements.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { IResponseFormat } from "../types/response.type";

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

function parseInput(body: Record<string, unknown>): TestSeriesAIJobInput {
  const kind = String(body.kind ?? "");
  if (kind === "title") {
    return {
      kind: "title",
      topic: typeof body.topic === "string" ? body.topic : null,
      category: typeof body.category === "string" ? body.category : null,
    };
  }
  if (kind === "description") {
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new BadRequestError("title is required for description generation");
    }
    return {
      kind: "description",
      title: body.title.trim(),
      category: typeof body.category === "string" ? body.category : null,
      extraContext: typeof body.extraContext === "string" ? body.extraContext : null,
    };
  }
  if (kind === "cover") {
    if (typeof body.title !== "string" || !body.title.trim()) {
      throw new BadRequestError("title is required for cover generation");
    }
    return {
      kind: "cover",
      title: body.title.trim(),
      category: typeof body.category === "string" ? body.category : null,
      description: typeof body.description === "string" ? body.description : null,
    };
  }
  throw new BadRequestError(
    "kind must be one of: title, description, cover"
  );
}

/**
 * POST /tenant/test-series/ai/generate
 * Body: { kind, ...kindSpecificFields }
 */
export const submitGeneration = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  await testEntitlementsService.ensureTestSeriesEnabled(tenantId);

  const input = parseInput(req.body as Record<string, unknown>);

  const jobId = await submitTestSeriesAIJob({
    tenantId,
    input,
    createdBy: getActorId(req) ?? null,
  });

  sendSuccessResponse({
    res,
    data: { jobId, kind: input.kind },
    statusCode: HttpSuccessStatus.ACCEPTED,
    message: "Generation started",
  });
};

/**
 * GET /tenant/test-series/ai/status/:jobId
 */
export const getGenerationStatus = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const jobId = param(req, "jobId");
  if (!jobId) throw new BadRequestError("jobId is required");

  // Tenant-scope guard: job IDs are namespaced by tenant
  if (!jobId.startsWith(`test-series-ai-${tenantId}-`)) {
    throw new ForbiddenError("You do not have access to this job");
  }

  const job = await testSeriesAIQueue.getJob(jobId);
  if (!job) {
    sendSuccessResponse({
      res,
      data: { jobId, state: "not_found", progress: null },
      statusCode: HttpSuccessStatus.OK,
      message: "Job not found (may have expired)",
    });
    return;
  }

  const state = await job.getState();
  const progress = (job.progress ?? null) as TestSeriesAIJobProgress | null;
  const failedReason = job.failedReason ?? null;

  sendSuccessResponse({
    res,
    data: { jobId, state, progress, failedReason },
    statusCode: HttpSuccessStatus.OK,
    message: "Job status",
  });
};
