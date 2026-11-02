import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { DOMAIN_QUEUE_NAME } from "./domain-verification.queue";
import tenantDomainService from "../services/tenant-domain.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case "poll-pending-domains":
      await tenantDomainService.pollPendingDomains();
      break;
    default:
      logger.warn(`[domain-verification-worker] Unknown job name: ${job.name}`);
  }
}

export function startDomainVerificationWorker(): void {
  worker = new Worker(DOMAIN_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    logger.debug(`[domain-verification-worker] Job ${job.name} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`[domain-verification-worker] Job ${job?.name} failed:`, err);
  });

  logger.info("[domain-verification-worker] Worker started");
}

export async function stopDomainVerificationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[domain-verification-worker] Worker stopped");
  }
}
