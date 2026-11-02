import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { batchAIQueue, submitBatchAIJob } from "../queues/batch-ai.queue";
import {
  ALL_BATCH_AI_SECTION_KEYS,
  type BatchAISectionKey,
} from "../services/batch-ai.service";
import type { BatchAIJobProgress } from "../types/batch-ai.type";
import { IResponseFormat } from "../types/response.type";
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

export const submitGeneration = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  if (!batchId) throw new BadRequestError("batchId is required");

  const {
    batchTitle,
    sections,
    extraContext,
    referenceDocument,
    thumbnailContext,
  } = req.body;

  if (!batchTitle || typeof batchTitle !== "string" || !batchTitle.trim()) {
    throw new BadRequestError(
      "batchTitle is required and must be a non-empty string"
    );
  }
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    throw new BadRequestError(
      "sections is required and must be a non-empty array"
    );
  }
  const validSections = sections.filter(
    (s: unknown): s is BatchAISectionKey =>
      typeof s === "string" &&
      ALL_BATCH_AI_SECTION_KEYS.includes(s as BatchAISectionKey)
  );
  if (validSections.length === 0) {
    throw new BadRequestError(
      `Invalid sections. Valid options: ${ALL_BATCH_AI_SECTION_KEYS.join(", ")}`
    );
  }

  const jobId = await submitBatchAIJob({
    tenantId,
    batchId,
    batchTitle: batchTitle.trim(),
    sections: validSections,
    extraContext: extraContext?.trim() || undefined,
    referenceDocument: referenceDocument?.trim() || undefined,
    thumbnailContext: thumbnailContext || undefined,
  });

  sendSuccessResponse({
    res,
    data: { jobId },
    statusCode: HttpSuccessStatus.ACCEPTED,
    message: "Batch AI generation job submitted",
  });
};

export const getGenerationStatus = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const batchId = param(req, "batchId");
  const jobId = param(req, "jobId");
  if (!jobId) throw new BadRequestError("jobId is required");

  // Tenant + batch ownership: jobId must match this tenant + batch.
  const expected = `batch-ai-${tenantId}-${batchId}`;
  if (jobId !== expected) {
    throw new ForbiddenError("Access denied to this job");
  }

  const job = await batchAIQueue.getJob(jobId);
  if (!job) {
    throw new NotFoundError("Job not found or expired. Please try again.");
  }

  const state = await job.getState();
  const progress = (job.progress as BatchAIJobProgress) || null;

  let status: string;
  switch (state) {
    case "active":
      status = "processing";
      break;
    case "completed":
      status = "completed";
      break;
    case "failed":
      status = "failed";
      break;
    case "waiting":
    case "delayed":
      status = "queued";
      break;
    default:
      status = state;
  }

  sendSuccessResponse({
    res,
    data: {
      jobId,
      status,
      progress,
      failedReason: state === "failed" ? job.failedReason : undefined,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Generation status retrieved",
  });
};
