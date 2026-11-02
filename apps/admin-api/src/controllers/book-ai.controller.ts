import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { type BookAISectionKey, ALL_BOOK_AI_SECTION_KEYS } from "../services/book-ai.service";
import { IResponseFormat } from "../types/response.type";
import type { BookAIJobProgress } from "../types/book-ai.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { bookAIQueue, submitBookAIJob } from "../queues";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

export const submitGeneration = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);

  const { bookTitle, sections, epubUrl, extraContext, referenceDocument, thumbnailContext } = req.body;

  if (!bookTitle || typeof bookTitle !== "string" || !bookTitle.trim()) {
    throw new BadRequestError("bookTitle is required and must be a non-empty string");
  }

  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    throw new BadRequestError("sections is required and must be a non-empty array");
  }

  const validSections = sections.filter(
    (s: unknown): s is BookAISectionKey =>
      typeof s === "string" && ALL_BOOK_AI_SECTION_KEYS.includes(s as BookAISectionKey)
  );

  if (validSections.length === 0) {
    throw new BadRequestError(
      `Invalid sections. Valid options: ${ALL_BOOK_AI_SECTION_KEYS.join(", ")}`
    );
  }

  const jobId = await submitBookAIJob({
    tenantId,
    bookTitle: bookTitle.trim(),
    sections: validSections,
    epubUrl: epubUrl?.trim() || undefined,
    extraContext: extraContext?.trim() || undefined,
    referenceDocument: referenceDocument?.trim() || undefined,
    thumbnailContext: thumbnailContext || undefined,
  });

  sendSuccessResponse({
    res,
    data: { jobId },
    statusCode: HttpSuccessStatus.ACCEPTED,
    message: "Book AI generation job submitted",
  });
};

export const getGenerationStatus = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { jobId } = req.params;

  if (!jobId) {
    throw new BadRequestError("jobId is required");
  }

  // Verify tenant ownership, jobId must match tenant
  const expectedPrefix = `book-ai-${tenantId}`;
  if (jobId !== expectedPrefix) {
    throw new ForbiddenError("Access denied to this job");
  }

  const job = await bookAIQueue.getJob(jobId);
  if (!job) {
    throw new NotFoundError("Job not found or expired. Please try again.");
  }

  const state = await job.getState();
  const progress = (job.progress as BookAIJobProgress) || null;

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
