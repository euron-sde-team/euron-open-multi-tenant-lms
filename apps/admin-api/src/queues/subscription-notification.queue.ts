import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import logger from "../utils/logger";

export const QUEUE_NAME = "subscription-notification";

export const subscriptionNotificationQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

export type SubscriptionNotificationType =
  | "PAYMENT_FAILED"
  | "GRACE_WARNING"
  | "GRACE_MIDPOINT"
  | "GRACE_EXPIRED"
  | "SUSPENSION_NOTICE"
  | "REACTIVATION_REMINDER"
  | "DATA_DELETION_WARNING"
  | "PAYMENT_RECOVERED"
  | "PLAN_PURCHASED"
  | "FREE_PLAN_ACTIVATED"
  | "REACTIVATION_CONFIRMED"
  | "CANCELLATION_SCHEDULED";

export interface SubscriptionNotificationJob {
  type: SubscriptionNotificationType;
  tenantId: string;
  subscriptionId: string;
  metadata?: Record<string, unknown>;
}

export interface QueueNotificationOptions {
  /** Append timestamp to job ID to bypass stuck/failed jobs with the same dedup key */
  forceNew?: boolean;
}

/**
 * Queue a subscription notification for async delivery.
 *
 * Dedup key: tenant+type+subscriptionId (one notification per subscription per type).
 * Use `forceNew: true` for safety-net re-queuing to bypass stuck/failed jobs.
 */
export async function queueSubscriptionNotification(
  job: SubscriptionNotificationJob,
  options?: QueueNotificationOptions
): Promise<void> {
  const baseId = `${job.tenantId}-${job.type}-${job.subscriptionId}`;
  const jobId = options?.forceNew ? `${baseId}-${Date.now()}` : baseId;

  logger.info(
    `[subscription-notification-queue] Queueing: type=${job.type} tenant=${job.tenantId} sub=${job.subscriptionId} jobId=${jobId} forceNew=${!!options?.forceNew}`
  );

  await subscriptionNotificationQueue.add(
    `notify-${job.type.toLowerCase()}`,
    job,
    { jobId }
  );
}

/**
 * Register the daily notification schedule check job.
 * Checks dunning subscriptions and suspended tenants for scheduled notifications.
 */
export async function registerNotificationScheduleJob(): Promise<void> {
  await subscriptionNotificationQueue.upsertJobScheduler(
    "notification-schedule-check",
    { every: 24 * 60 * 60 * 1000 }, // 24 hours
    {
      name: "check-notification-schedule",
      data: { type: "SCHEDULE_CHECK" } as unknown as SubscriptionNotificationJob,
    }
  );
}
