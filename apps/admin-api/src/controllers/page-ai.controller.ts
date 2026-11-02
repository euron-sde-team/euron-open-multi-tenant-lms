import { NextFunction, Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import pageAIService from "../services/page-ai.service";
import {
  submitPageImageJob,
  pageImageAIQueue,
  type PageImageJobProgress,
  submitPagePlanJob,
  pagePlanAIQueue,
  type PagePlanJobProgress,
} from "../queues";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

export const generateSection = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);

  const { sectionType, prompt, businessContext, pageLayout, clientSchema, clientInstructions } = req.body;

  if (!sectionType || typeof sectionType !== "string") {
    throw new BadRequestError("sectionType is required");
  }

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new BadRequestError("prompt is required and must be a non-empty string");
  }

  // Validate optional pageLayout
  let validPageLayout: { type: string; order: number }[] | undefined;
  if (pageLayout && Array.isArray(pageLayout)) {
    validPageLayout = pageLayout
      .filter(
        (item: unknown): item is { type: string; order: number } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).type === "string" &&
          typeof (item as Record<string, unknown>).order === "number"
      )
      .slice(0, 20);
  }

  const result = await pageAIService.generateSection({
    sectionType,
    prompt: prompt.trim(),
    businessContext: businessContext?.trim() || undefined,
    tenantId,
    pageLayout: validPageLayout,
    clientSchema: clientSchema || undefined,
    clientInstructions: clientInstructions || undefined,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Section content generated successfully",
  });
};

export const planPage = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);

  const { prompt, businessContext, availableSections } = req.body;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new BadRequestError("prompt is required and must be a non-empty string");
  }
  if (!Array.isArray(availableSections) || availableSections.length === 0) {
    throw new BadRequestError("availableSections is required");
  }

  const validSections = availableSections
    .filter(
      (s: unknown): s is { type: string; label?: string; description?: string } =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Record<string, unknown>).type === "string"
    )
    .map((s) => ({
      type: String(s.type),
      label: String(s.label ?? s.type),
      description: String(s.description ?? ""),
    }))
    .slice(0, 150);

  // Planning does grounded web research + a large structured generation, which
  // is too slow to run inside the request (it trips the gateway's 504 timeout).
  // Submit it as a background job and let the client poll /plan-status.
  const jobId = await submitPagePlanJob({
    prompt: prompt.trim(),
    businessContext: typeof businessContext === "string" ? businessContext.trim() || undefined : undefined,
    tenantId,
    availableSections: validSections,
  });

  sendSuccessResponse({
    res,
    data: { jobId },
    statusCode: HttpSuccessStatus.ACCEPTED,
    message: "Page plan job submitted",
  });
};

export const getPagePlanStatus = async (
  req: Request,
  res: Response<IResponseFormat>,
  _next: NextFunction
) => {
  const tenantId = getTenantId(req);
  const { jobId } = req.params;

  // Verify tenant owns this job
  const expectedJobId = `page-plan-${tenantId}`;
  if (jobId !== expectedJobId) {
    throw new ForbiddenError("Access denied to this job");
  }

  const job = await pagePlanAIQueue.getJob(jobId);
  if (!job) {
    throw new NotFoundError("Job not found or expired.");
  }

  const state = await job.getState();
  const progress = (job.progress as PagePlanJobProgress) || null;

  const statusMap: Record<string, string> = {
    active: "processing",
    completed: "completed",
    failed: "failed",
    waiting: "queued",
    delayed: "queued",
  };

  sendSuccessResponse({
    res,
    data: {
      jobId,
      status: statusMap[state] || state,
      progress,
      failedReason: state === "failed" ? job.failedReason : undefined,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Page plan status retrieved",
  });
};

export const generateImage = async (
  req: Request,
  res: Response<IResponseFormat>,
  _next: NextFunction
) => {
  const tenantId = getTenantId(req);
  const { prompt, aspectRatio, sectionContext } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new BadRequestError("Prompt is required for image generation");
  }

  if (prompt.trim().length < 3) {
    throw new BadRequestError("Prompt must be at least 3 characters long");
  }

  // Validate and sanitize sectionContext if provided
  let validSectionContext: { sectionType?: string; headline?: string; description?: string; badge?: string } | undefined;
  if (sectionContext && typeof sectionContext === "object") {
    validSectionContext = {
      sectionType: typeof sectionContext.sectionType === "string" ? sectionContext.sectionType.slice(0, 100) : undefined,
      headline: typeof sectionContext.headline === "string" ? sectionContext.headline.slice(0, 200) : undefined,
      description: typeof sectionContext.description === "string" ? sectionContext.description.slice(0, 500) : undefined,
      badge: typeof sectionContext.badge === "string" ? sectionContext.badge.slice(0, 200) : undefined,
    };
  }

  const jobId = await submitPageImageJob({
    tenantId,
    prompt: prompt.trim(),
    aspectRatio,
    sectionContext: validSectionContext,
  });

  sendSuccessResponse({
    res,
    data: { jobId },
    statusCode: HttpSuccessStatus.ACCEPTED,
    message: "Image generation job submitted",
  });
};

export const getImageGenerationStatus = async (
  req: Request,
  res: Response<IResponseFormat>,
  _next: NextFunction
) => {
  const tenantId = getTenantId(req);
  const { jobId } = req.params;

  // Verify tenant owns this job
  const expectedPrefix = `page-image-${tenantId}`;
  if (jobId !== expectedPrefix) {
    throw new ForbiddenError("Access denied to this job");
  }

  const job = await pageImageAIQueue.getJob(jobId);
  if (!job) {
    throw new NotFoundError("Job not found or expired.");
  }

  const state = await job.getState();
  const progress = (job.progress as PageImageJobProgress) || null;

  const statusMap: Record<string, string> = {
    active: "processing",
    completed: "completed",
    failed: "failed",
    waiting: "queued",
    delayed: "queued",
  };

  sendSuccessResponse({
    res,
    data: {
      jobId,
      status: statusMap[state] || state,
      progress,
      failedReason: state === "failed" ? job.failedReason : undefined,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Image generation status retrieved",
  });
};
