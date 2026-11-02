import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import {
  TEST_SERIES_AI_QUEUE_NAME,
  type TestSeriesAIJobData,
  type TestSeriesAIJobProgress,
} from "./test-series-ai.queue";
import testSeriesAIService from "../services/test-series-ai.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job<TestSeriesAIJobData>): Promise<void> {
  const { tenantId, input } = job.data;

  const update = async (p: TestSeriesAIJobProgress) => {
    await job.updateProgress(p as unknown as Record<string, unknown>);
  };

  logger.info(
    `[test-series-ai-worker] Job ${job.id} starting: tenant=${tenantId} kind=${input.kind}`
  );

  await update({ status: "generating", kind: input.kind });

  try {
    if (input.kind === "title") {
      const text = await testSeriesAIService.generateTitle({
        topic: input.topic ?? null,
        category: input.category ?? null,
      });
      await update({
        status: "completed",
        kind: "title",
        result: { kind: "title", text },
      });
    } else if (input.kind === "description") {
      const text = await testSeriesAIService.generateDescription({
        title: input.title,
        category: input.category ?? null,
        extraContext: input.extraContext ?? null,
      });
      await update({
        status: "completed",
        kind: "description",
        result: { kind: "description", text },
      });
    } else if (input.kind === "cover") {
      const dataUrl = await testSeriesAIService.generateCover({
        title: input.title,
        category: input.category ?? null,
        description: input.description ?? null,
      });
      await update({
        status: "completed",
        kind: "cover",
        result: { kind: "cover", dataUrl },
      });
    } else {
      throw new Error(
        `Unknown test-series AI kind: ${(input as { kind: string }).kind}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await update({ status: "failed", kind: input.kind, error: message });
    throw err;
  }

  logger.info(`[test-series-ai-worker] Job ${job.id} completed`);
}

export function startTestSeriesAIWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(TEST_SERIES_AI_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 4,
  });

  worker.on("completed", (job) => {
    logger.info(`[test-series-ai-worker] Job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    logger.error(
      `[test-series-ai-worker] Job ${job?.id ?? "unknown"} failed: ${err.message}`
    );
  });
  worker.on("error", (err) => {
    logger.error("[test-series-ai-worker] Worker error:", err);
  });

  logger.info("[test-series-ai-worker] Started");
  return worker;
}

export async function stopTestSeriesAIWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[test-series-ai-worker] Stopped");
}
