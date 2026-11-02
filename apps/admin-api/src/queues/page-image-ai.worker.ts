import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { PAGE_IMAGE_AI_QUEUE_NAME } from "./page-image-ai.queue";
import type { PageImageJobData, PageImageJobProgress } from "./page-image-ai.queue";
import pageAIService from "../services/page-ai.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job<PageImageJobData>): Promise<void> {
  const { tenantId, prompt, aspectRatio, sectionContext } = job.data;
  logger.info(`[page-image-ai-worker] Starting job ${job.id} for tenant ${tenantId}`);

  const updateProgress = async (progress: PageImageJobProgress) => {
    await job.updateProgress(progress);
  };

  await updateProgress({ status: "processing" });

  try {
    const result = await pageAIService.generateImage(prompt, tenantId, aspectRatio, sectionContext);

    await updateProgress({ status: "completed", result });
    logger.info(`[page-image-ai-worker] Job ${job.id} completed`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Image generation failed";
    await updateProgress({ status: "failed", error: errorMsg });
    logger.error(`[page-image-ai-worker] Job ${job.id} failed: ${errorMsg}`);
    throw err; // Mark job as failed in BullMQ
  }
}

export function startPageImageAIWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(PAGE_IMAGE_AI_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    logger.info(`[page-image-ai-worker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`[page-image-ai-worker] Job ${job?.id} failed: ${err.message}`);
  });

  logger.info("[page-image-ai-worker] Started");
  return worker;
}

export async function stopPageImageAIWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[page-image-ai-worker] Stopped");
}
