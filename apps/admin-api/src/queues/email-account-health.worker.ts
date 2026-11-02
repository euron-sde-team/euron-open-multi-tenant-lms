import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { EMAIL_ACCOUNT_HEALTH_QUEUE_NAME } from "./email-account-health.queue";
import accountHealthService from "../services/email-engine/account-health.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case "run-emergency-brake": {
      const result = await accountHealthService.runEmergencyBrake({ dryRun: false });
      if (result.pausedTenants.length > 0) {
        logger.warn(
          `[email-account-health-worker] Emergency brake fired: ${result.pausedTenants.length} tenant(s) paused (enforcement=${result.enforcementStatus}, bounceRate=${result.rates.bounceRate}, complaintRate=${result.rates.complaintRate})`,
        );
      }
      break;
    }
    default:
      logger.warn(`[email-account-health-worker] Unknown job: ${job.name}`);
  }
}

export function startEmailAccountHealthWorker(): void {
  worker = new Worker(EMAIL_ACCOUNT_HEALTH_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  });
  worker.on("completed", (job) => {
    logger.debug(
      `[email-account-health-worker] Job ${job.name} completed`,
    );
  });
  worker.on("failed", (job, err) => {
    logger.error(
      `[email-account-health-worker] Job ${job?.name} failed:`,
      err,
    );
  });
  logger.info("[email-account-health-worker] Worker started");
}

export async function stopEmailAccountHealthWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[email-account-health-worker] Worker stopped");
  }
}
