/**
 * Watch-time analytics queue.
 *
 * Three recurring jobs (BullMQ "repeat"):
 *   1. rollup, hourly. Reads lecture_watch_sessions newer than the
 *                      per-tenant watermark and upserts into
 *                      tenant_watch_time_daily / tenant_active_learners_daily /
 *                      lecture_dropoff_buckets.
 *   2. sweeper, every 5 min. Closes stale sessions (no heartbeat in 5 min).
 *   3. archive, daily 02:00 UTC. Deletes sessions older than 90 days
 *                      in batches (rolled-up data is preserved).
 *
 * Job keys are deterministic so re-registration on worker restart is safe.
 */

import { Queue } from "bullmq";
import config from "../config";
import { bullmqConnection } from "../lib/redis";

const redisConnection = bullmqConnection;

export const WATCH_TIME_QUEUE_NAME = "watch-time-rollup";

export const WATCH_TIME_JOB = {
  ROLLUP: "rollup",
  SWEEPER: "sweeper",
  ARCHIVE: "archive",
} as const;

export type WatchTimeJobName = (typeof WATCH_TIME_JOB)[keyof typeof WATCH_TIME_JOB];

const queue = new Queue(WATCH_TIME_QUEUE_NAME, {
  connection: redisConnection,
  prefix: config.BULLMQ_PREFIX,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential" as const, delay: 30_000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export async function ensureWatchTimeRecurringJobs(): Promise<void> {
  // Hourly rollup. Run at minute 5 of every hour to give in-flight sessions a moment to flush.
  await queue.add(
    WATCH_TIME_JOB.ROLLUP,
    {},
    {
      jobId: "watch-time-rollup-hourly",
      repeat: { pattern: "5 * * * *" },
    }
  );
  // Every 5 minutes sweep stale sessions.
  await queue.add(
    WATCH_TIME_JOB.SWEEPER,
    {},
    {
      jobId: "watch-time-sweeper",
      repeat: { every: 5 * 60 * 1000 },
    }
  );
  // Daily archive at 02:00 UTC.
  await queue.add(
    WATCH_TIME_JOB.ARCHIVE,
    {},
    {
      jobId: "watch-time-archive-daily",
      repeat: { pattern: "0 2 * * *" },
    }
  );
}

export const watchTimeQueue = queue;
export { redisConnection as watchTimeRedisConnection };
