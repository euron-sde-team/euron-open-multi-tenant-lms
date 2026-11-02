import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { QUEUE_NAME } from "./grace-period-expiry.queue";
import type { ProcessExpiredGracePeriodsJob } from "./grace-period-expiry.queue";
import subscriptionBillingService from "../services/billing/subscription-billing.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case "process-expired-grace-periods":
      await handleProcessExpiredGracePeriods(
        job.data as ProcessExpiredGracePeriodsJob
      );
      break;
    default:
      logger.warn(
        `[grace-period-expiry-worker] Unknown job name: ${job.name}`
      );
  }
}

async function handleProcessExpiredGracePeriods(
  _data: ProcessExpiredGracePeriodsJob
): Promise<void> {
  const graceCount = await subscriptionBillingService.processExpiredGracePeriods();
  if (graceCount > 0) {
    logger.info(
      `[grace-period-expiry-worker] Processed ${graceCount} expired grace period subscription(s)`
    );
  }

  // Safety net: process subscriptions scheduled for cancellation whose period has ended
  const cancelCount = await subscriptionBillingService.processScheduledCancellations();
  if (cancelCount > 0) {
    logger.info(
      `[grace-period-expiry-worker] Processed ${cancelCount} scheduled cancellation(s)`
    );
  }
}

export function startGracePeriodExpiryWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    logger.info(`[grace-period-expiry-worker] Job ${job.name} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `[grace-period-expiry-worker] Job ${job?.name ?? "unknown"} failed: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    logger.error("[grace-period-expiry-worker] Worker error:", err);
  });

  logger.info("[grace-period-expiry-worker] Started");
  return worker;
}

export async function stopGracePeriodExpiryWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[grace-period-expiry-worker] Stopped");
}
