import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { PAGE_PLAN_AI_QUEUE_NAME } from "./page-plan-ai.queue";
import type { PagePlanJobData, PagePlanJobProgress } from "./page-plan-ai.queue";
import pageAIService from "../services/page-ai.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job<PagePlanJobData>): Promise<void> {
  const { tenantId, prompt, businessContext, availableSections } = job.data;
  logger.info(`[page-plan-ai-worker] Starting job ${job.id} for tenant ${tenantId}`);

  const updateProgress = async (progress: PagePlanJobProgress) => {
    await job.updateProgress(progress);
  };

  await updateProgress({ status: "processing" });

  try {
    const result = await pageAIService.planPage({
      prompt,
      businessContext,
      tenantId,
      availableSections,
    });

    await updateProgress({ status: "completed", result });
    logger.info(`[page-plan-ai-worker] Job ${job.id} completed`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Page plan failed";
    await updateProgress({ status: "failed", error: errorMsg });
    logger.error(`[page-plan-ai-worker] Job ${job.id} failed: ${errorMsg}`);
    throw err; // Mark job as failed in BullMQ
  }
}

export function startPagePlanAIWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(PAGE_PLAN_AI_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    logger.info(`[page-plan-ai-worker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`[page-plan-ai-worker] Job ${job?.id} failed: ${err.message}`);
  });

  logger.info("[page-plan-ai-worker] Started");
  return worker;
}

export async function stopPagePlanAIWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[page-plan-ai-worker] Stopped");
}
