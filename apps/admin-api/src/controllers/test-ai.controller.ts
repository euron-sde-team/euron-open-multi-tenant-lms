import type { Request, Response } from "express";
import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import {
  testAIQueue,
  type TestAIJobProgress,
} from "../queues/test-ai.queue";
import testEntitlementsService from "../services/test-entitlements.service";
import testQuestionsRepository from "../repositories/test-questions.repository";
import uploadService from "../services/upload.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { IResponseFormat } from "../types/response.type";

const VALID_TYPES = new Set(["MCQ_SINGLE", "MCQ_MULTI", "TRUE_FALSE", "FIB", "NAT"]);
const VALID_LANGS = new Set(["en", "hi"]);
const MAX_TEST_AI_PDF_BYTES = 25 * 1024 * 1024; // 25 MB, matches uploadTestAiPdf ceiling

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

interface ParsedConfig {
  count: number;
  types: Array<"MCQ_SINGLE" | "MCQ_MULTI" | "TRUE_FALSE" | "FIB" | "NAT">;
  difficultyMix: { easy: number; medium: number; hard: number };
  language: "en" | "hi";
  subject: string | null;
  chapter: string | null;
  topic: string | null;
}

function parseConfig(body: Record<string, unknown>): ParsedConfig {
  const count = parseInt(String(body.count ?? "0"), 10);
  if (!Number.isFinite(count) || count < 5 || count > 50) {
    throw new BadRequestError("count must be between 5 and 50");
  }

  // multer/multipart sends arrays as `types[]=...&types[]=...` or comma-separated;
  // handle both common shapes.
  let typesRaw: unknown = body.types ?? body["types[]"];
  if (typeof typesRaw === "string") typesRaw = typesRaw.split(",");
  const types: ParsedConfig["types"] = [];
  if (Array.isArray(typesRaw)) {
    for (const t of typesRaw) {
      const v = String(t).trim();
      if (VALID_TYPES.has(v))
        types.push(v as "MCQ_SINGLE" | "MCQ_MULTI" | "TRUE_FALSE" | "FIB" | "NAT");
    }
  }
  if (types.length === 0) {
    throw new BadRequestError(
      "At least one question type is required (MCQ_SINGLE, MCQ_MULTI, TRUE_FALSE, FIB, NAT)"
    );
  }

  const easy = parseInt(String(body.easy ?? "33"), 10);
  const medium = parseInt(String(body.medium ?? "34"), 10);
  const hard = parseInt(String(body.hard ?? "33"), 10);
  if (!Number.isFinite(easy) || !Number.isFinite(medium) || !Number.isFinite(hard)) {
    throw new BadRequestError("Difficulty mix values must be numeric");
  }
  if (easy + medium + hard !== 100) {
    throw new BadRequestError("Difficulty mix must sum to 100");
  }

  const language = (body.language as string) ?? "en";
  if (!VALID_LANGS.has(language)) {
    throw new BadRequestError("Language must be 'en' or 'hi'");
  }

  return {
    count,
    types,
    difficultyMix: { easy, medium, hard },
    language: language as "en" | "hi",
    subject: (body.subject as string)?.trim() || null,
    chapter: (body.chapter as string)?.trim() || null,
    topic: (body.topic as string)?.trim() || null,
  };
}

/**
 * GET /tenant/test-questions/banks/:bankId/ai-generate/upload-url
 * Returns a short-lived presigned PUT URL the browser uses to upload the
 * source PDF directly to S3. This sidesteps the Amplify SSR proxy's ~6 MB
 * Lambda payload limit that was producing 413s on the previous multipart route.
 */
export const getUploadUrl = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");

  await testEntitlementsService.ensureTestSeriesEnabled(tenantId);

  const bankExists = await testQuestionsRepository.questionBankExistsForTenant(
    bankId,
    tenantId
  );
  if (!bankExists) throw new NotFoundError("Question bank not found");

  const { uploadUrl, key, expiresIn } =
    await uploadService.getTestAiPdfPresignedUrl(tenantId);

  sendSuccessResponse({
    res,
    data: {
      uploadUrl,
      s3Key: key,
      expiresIn,
      maxFileSizeBytes: MAX_TEST_AI_PDF_BYTES,
      contentType: "application/pdf",
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Upload URL minted",
  });
};

/**
 * POST /tenant/test-questions/banks/:bankId/ai-generate
 * JSON body: { s3Key, count, types[], easy, medium, hard, language, subject, chapter, topic }
 *
 * The PDF has already been uploaded to S3 via the presigned URL returned by
 * GET /ai-generate/upload-url. We verify the object exists, is sane, and is
 * scoped to this tenant before queueing the worker job.
 */
export const submitGeneration = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");

  await testEntitlementsService.ensureTestSeriesEnabled(tenantId);

  const bankExists = await testQuestionsRepository.questionBankExistsForTenant(
    bankId,
    tenantId
  );
  if (!bankExists) throw new NotFoundError("Question bank not found");

  const body = req.body as Record<string, unknown>;
  const s3Key = typeof body.s3Key === "string" ? body.s3Key.trim() : "";
  if (!s3Key) throw new BadRequestError("s3Key is required");

  // Tenant-scope guard: the key must live under this tenant's test-ai prefix.
  // Without this a tenant could replay any test-ai key it has guessed/leaked.
  const requiredPrefix = `tenants/${tenantId}/test-ai/`;
  if (!s3Key.startsWith(requiredPrefix) || !s3Key.endsWith(".pdf")) {
    throw new BadRequestError("Invalid s3Key");
  }

  const head = await uploadService.headTestAiPdf(s3Key);
  if (!head) {
    throw new BadRequestError(
      "Uploaded PDF not found in S3, upload may have failed or expired"
    );
  }
  if (head.size <= 0) {
    throw new BadRequestError("Uploaded PDF is empty");
  }
  if (head.size > MAX_TEST_AI_PDF_BYTES) {
    throw new BadRequestError(
      `PDF too large. Max ${MAX_TEST_AI_PDF_BYTES / 1024 / 1024} MB`
    );
  }
  if (head.contentType && head.contentType !== "application/pdf") {
    throw new BadRequestError("Only PDF files are supported");
  }

  const config = parseConfig(body);

  const jobId = `test-ai-${tenantId}-${ulid()}`;
  await testAIQueue.add(
    "generate-test-questions",
    {
      tenantId,
      questionBankId: bankId,
      pdfKey: s3Key,
      count: config.count,
      types: config.types,
      difficultyMix: config.difficultyMix,
      language: config.language,
      subject: config.subject,
      chapter: config.chapter,
      topic: config.topic,
      createdBy: getActorId(req) ?? null,
    },
    { jobId }
  );

  sendSuccessResponse({
    res,
    data: { jobId },
    statusCode: HttpSuccessStatus.ACCEPTED,
    message: "AI question generation started",
  });
};

/**
 * GET /tenant/test-questions/ai/status/:jobId
 * Returns current job state + progress for client-side polling.
 */
export const getGenerationStatus = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const jobId = param(req, "jobId");
  if (!jobId) throw new BadRequestError("jobId is required");

  // Tenant-scope guard: job IDs are namespaced by tenant
  if (!jobId.startsWith(`test-ai-${tenantId}-`)) {
    throw new ForbiddenError("You do not have access to this job");
  }

  const job = await testAIQueue.getJob(jobId);
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
  const progress = (job.progress ?? null) as TestAIJobProgress | null;
  const failedReason = job.failedReason ?? null;

  sendSuccessResponse({
    res,
    data: { jobId, state, progress, failedReason },
    statusCode: HttpSuccessStatus.OK,
    message: "Job status",
  });
};
