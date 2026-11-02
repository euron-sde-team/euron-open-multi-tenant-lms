import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { QUEUE_NAME } from "./subscription-poll-reconciliation.queue";
import type { ReconcilePendingSubscriptionsJob } from "./subscription-poll-reconciliation.queue";
import subscriptionBillingService from "../services/billing/subscription-billing.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case "reconcile-pending-subscriptions":
      await handleReconcilePendingSubscriptions(
        job.data as ReconcilePendingSubscriptionsJob
      );
      break;
    default:
      logger.warn(
        `[subscription-poll-worker] Unknown job name: ${job.name}`
      );
  }
}

async function handleReconcilePendingSubscriptions(
  _data: ReconcilePendingSubscriptionsJob
): Promise<void> {
  const { processed, expired } =
    await subscriptionBillingService.reconcilePendingSubscriptions();
  if (processed > 0 || expired > 0) {
    logger.info(
      `[subscription-poll-worker] Processed ${processed} missed webhook(s), expired ${expired} pending checkout(s)`
    );
  }
}

export function startSubscriptionPollReconciliationWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    logger.info(`[subscription-poll-worker] Job ${job.name} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `[subscription-poll-worker] Job ${job?.name ?? "unknown"} failed: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    logger.error("[subscription-poll-worker] Worker error:", err);
  });

  logger.info("[subscription-poll-worker] Started");
  return worker;
}

export async function stopSubscriptionPollReconciliationWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[subscription-poll-worker] Stopped");
}
