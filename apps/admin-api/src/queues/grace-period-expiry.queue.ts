import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const QUEUE_NAME = "grace-period-expiry";

export const gracePeriodExpiryQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export interface ProcessExpiredGracePeriodsJob {
  triggeredBy: "schedule";
}

/**
 * Register the repeatable job to process expired grace periods.
 * Runs hourly. Safe to call from every worker: BullMQ deduplicates repeatables by key.
 */
export async function registerGracePeriodExpiryJob(): Promise<void> {
  await gracePeriodExpiryQueue.upsertJobScheduler(
    "grace-period-expiry-scheduler",
    { every: 60 * 60 * 1000 }, // 1 hour
    {
      name: "process-expired-grace-periods",
      data: { triggeredBy: "schedule" } satisfies ProcessExpiredGracePeriodsJob,
    }
  );
}
