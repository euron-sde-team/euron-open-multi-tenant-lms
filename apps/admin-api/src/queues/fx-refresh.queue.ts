import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const FX_REFRESH_QUEUE_NAME = "fx-refresh";

/**
 * Daily FX rate refresh, matching the cadence the original platform has always used
 * for the same job. The rate is persisted, and `exchangeRateService` also
 * refreshes inline when what it finds is stale, so a missed run degrades to a
 * slightly older rate rather than to no rate at all. Hence few attempts and a
 * long backoff: nothing is urgent here.
 */
export const fxRefreshQueue = new Queue(FX_REFRESH_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "fixed", delay: 10 * 60 * 1000 },
    removeOnComplete: { age: 7 * 24 * 3_600, count: 50 },
    removeOnFail: { age: 30 * 24 * 3_600, count: 100 },
  },
});

export interface RefreshFxRatesJob {
  triggeredBy: "schedule";
}

/**
 * Register the repeatable refresh. Safe to call from every worker: BullMQ
 * deduplicates schedulers by key.
 */
export async function registerFxRefreshJob(): Promise<void> {
  await fxRefreshQueue.upsertJobScheduler(
    "fx-refresh-scheduler",
    { every: 24 * 60 * 60 * 1000 },
    {
      name: "refresh-fx-rates",
      data: { triggeredBy: "schedule" } satisfies RefreshFxRatesJob,
    },
  );
}
