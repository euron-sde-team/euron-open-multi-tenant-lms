import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const QUEUE_NAME = "subscription-poll-reconciliation";

export const subscriptionPollReconciliationQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export interface ReconcilePendingSubscriptionsJob {
  triggeredBy: "schedule";
}

/**
 * Register the repeatable job to poll Razorpay for pending subscriptions (webhook fallback).
 * Runs every 2 minutes. Safe to call from every worker: BullMQ deduplicates repeatables by key.
 */
export async function registerSubscriptionPollReconciliationJob(): Promise<void> {
  await subscriptionPollReconciliationQueue.upsertJobScheduler(
    "subscription-poll-reconciliation-scheduler",
    { every: 2 * 60 * 1000 },
    {
      name: "reconcile-pending-subscriptions",
      data: { triggeredBy: "schedule" } satisfies ReconcilePendingSubscriptionsJob,
    }
  );
}
