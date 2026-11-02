import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { EMAIL_DOMAIN_HEALTH_QUEUE_NAME } from "./email-domain-health.queue";
import domainHealthService from "../services/email-engine/domain-health.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case "sweep-domain-health":
      await domainHealthService.sweepAllVerifiedDomains();
      break;
    default:
      logger.warn(`[email-domain-health-worker] Unknown job: ${job.name}`);
  }
}

export function startEmailDomainHealthWorker(): void {
  worker = new Worker(EMAIL_DOMAIN_HEALTH_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  });
  worker.on("completed", (job) => {
    logger.debug(
      `[email-domain-health-worker] Job ${job.name} completed`,
    );
  });
  worker.on("failed", (job, err) => {
    logger.error(
      `[email-domain-health-worker] Job ${job?.name} failed:`,
      err,
    );
  });
  logger.info("[email-domain-health-worker] Worker started");
}

export async function stopEmailDomainHealthWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[email-domain-health-worker] Worker stopped");
  }
}
