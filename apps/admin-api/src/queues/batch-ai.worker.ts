import { Worker, type Job } from "bullmq";

import batchAIService, {
  type BatchAISectionKey,
  type GeneratedBatchContent,
} from "../services/batch-ai.service";
import type {
  BatchAIJobData,
  BatchAIJobProgress,
  SectionProgress,
} from "../types/batch-ai.type";
import logger from "../utils/logger";

import { BATCH_AI_QUEUE_NAME } from "./batch-ai.queue";
import { QUEUE_PREFIX, redisConnection } from "./connection";

/** Processing order, thumbnails always last so the modal can show text
 *  results first while images are still rendering. */
const SECTION_ORDER: BatchAISectionKey[] = [
  "subtitle",
  "description",
  "learningOutcomes",
  "webThumbnail",
  "mobileThumbnail",
];

let worker: Worker | null = null;

async function processJob(job: Job<BatchAIJobData>): Promise<void> {
  const { tenantId, batchId, batchTitle, sections } = job.data;
  logger.info(
    `[batch-ai-worker] Starting job ${job.id} for tenant ${tenantId} batch ${batchId}: "${batchTitle}", sections: [${sections.join(", ")}]`
  );

  const requestedSet = new Set(sections);
  const orderedSections = SECTION_ORDER.filter((s) => requestedSet.has(s));

  const sectionProgress: Partial<Record<BatchAISectionKey, SectionProgress>> = {};
  for (const s of orderedSections) {
    sectionProgress[s] = { status: "pending" };
  }
  const aggregateResult: Partial<GeneratedBatchContent> = {};

  const updateProgress = async (
    currentSection?: BatchAISectionKey,
    status: "processing" | "completed" | "failed" = "processing",
    error?: string
  ) => {
    const completedCount = Object.values(sectionProgress).filter(
      (sp) => sp?.status === "completed"
    ).length;
    const progress: BatchAIJobProgress = {
      status,
      currentSection,
      sections: sectionProgress,
      result: aggregateResult,
      completedCount,
      totalCount: orderedSections.length,
      error,
    };
    await job.updateProgress(progress);
  };

  // Sequential per section. Each section is its own the AI model call so a single
  // failure (e.g. image model rate limit on the mobile thumbnail) doesn't
  // wipe out the text results.
  for (const sectionKey of orderedSections) {
    sectionProgress[sectionKey] = { status: "processing" };
    await updateProgress(sectionKey);
    try {
      const sectionResult = await batchAIService.generateContent({
        batchTitle: job.data.batchTitle,
        sections: [sectionKey],
        extraContext: job.data.extraContext,
        referenceDocument: job.data.referenceDocument,
        thumbnailContext: job.data.thumbnailContext,
      });
      sectionProgress[sectionKey] = {
        status: "completed",
        result: sectionResult,
      };
      Object.assign(aggregateResult, sectionResult);
      logger.info(
        `[batch-ai-worker] Section "${sectionKey}" completed for "${batchTitle}"`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      logger.error(
        `[batch-ai-worker] Section "${sectionKey}" failed for "${batchTitle}": ${errorMsg}`
      );
      sectionProgress[sectionKey] = { status: "failed", error: errorMsg };
    }
    await updateProgress(sectionKey);
  }

  const allFailed = Object.values(sectionProgress).every(
    (sp) => sp?.status === "failed"
  );

  await updateProgress(
    undefined,
    allFailed ? "failed" : "completed",
    allFailed ? "All sections failed to generate" : undefined
  );

  logger.info(
    `[batch-ai-worker] Job ${job.id} finished for tenant ${tenantId} batch ${batchId}`
  );
}

export function startBatchAIWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(BATCH_AI_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 2,
  });
  worker.on("completed", (job) => {
    logger.info(`[batch-ai-worker] Job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    logger.error(
      `[batch-ai-worker] Job ${job?.id ?? "unknown"} failed: ${err.message}`
    );
  });
  worker.on("error", (err) => {
    logger.error("[batch-ai-worker] Worker error:", err);
  });
  logger.info("[batch-ai-worker] Started");
  return worker;
}

export async function stopBatchAIWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[batch-ai-worker] Stopped");
}
