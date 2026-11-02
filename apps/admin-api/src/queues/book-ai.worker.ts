import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { BOOK_AI_QUEUE_NAME } from "./book-ai.queue";
import bookAIService, {
  type BookAISectionKey,
  type GeneratedBookContent,
} from "../services/book-ai.service";
import type {
  BookAIJobData,
  BookAIJobProgress,
  SectionProgress,
} from "../types/book-ai.type";
import logger from "../utils/logger";

/** Processing order, thumbnail always last. */
const SECTION_ORDER: BookAISectionKey[] = ["description", "thumbnail"];

let worker: Worker | null = null;

// ---------------------------------------------------------------------------
// Job Handler
// ---------------------------------------------------------------------------

async function processJob(job: Job<BookAIJobData>): Promise<void> {
  const { tenantId, bookTitle, sections } = job.data;
  logger.info(
    `[book-ai-worker] Starting job ${job.id} for tenant ${tenantId}: "${bookTitle}", sections: [${sections.join(", ")}]`
  );

  const requestedSet = new Set(sections);
  const orderedSections = SECTION_ORDER.filter((s) => requestedSet.has(s));

  // Initialize progress
  const sectionProgress: Partial<Record<BookAISectionKey, SectionProgress>> = {};
  for (const s of orderedSections) {
    sectionProgress[s] = { status: "pending" };
  }
  const aggregateResult: Partial<GeneratedBookContent> = {};

  const updateProgress = async (
    currentSection?: BookAISectionKey,
    status: "processing" | "completed" | "failed" = "processing",
    error?: string
  ) => {
    const completedCount = Object.values(sectionProgress).filter(
      (sp) => sp?.status === "completed"
    ).length;

    const progress: BookAIJobProgress = {
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

  // Process each section sequentially
  for (const sectionKey of orderedSections) {
    sectionProgress[sectionKey] = { status: "processing" };
    await updateProgress(sectionKey);

    try {
      const sectionResult = await bookAIService.generateContent({
        bookTitle: job.data.bookTitle,
        sections: [sectionKey],
        epubUrl: job.data.epubUrl,
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
        `[book-ai-worker] Section "${sectionKey}" completed for "${bookTitle}"`
      );
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error";
      logger.error(
        `[book-ai-worker] Section "${sectionKey}" failed for "${bookTitle}": ${errorMsg}`
      );
      sectionProgress[sectionKey] = { status: "failed", error: errorMsg };
    }

    await updateProgress(sectionKey);
  }

  // ── Final status ──
  const allFailed = Object.values(sectionProgress).every(
    (sp) => sp?.status === "failed"
  );

  await updateProgress(
    undefined,
    allFailed ? "failed" : "completed",
    allFailed ? "All sections failed to generate" : undefined
  );

  logger.info(
    `[book-ai-worker] Job ${job.id} finished for tenant ${tenantId}`
  );
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startBookAIWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(BOOK_AI_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    logger.info(`[book-ai-worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `[book-ai-worker] Job ${job?.id ?? "unknown"} failed: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    logger.error("[book-ai-worker] Worker error:", err);
  });

  logger.info("[book-ai-worker] Started");
  return worker;
}

export async function stopBookAIWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[book-ai-worker] Stopped");
}
