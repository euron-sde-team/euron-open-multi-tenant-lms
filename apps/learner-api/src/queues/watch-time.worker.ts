/**
 * Watch-time worker, processes the three recurring jobs registered in
 * watch-time.queue.ts (rollup, sweeper, archive).
 *
 * Concurrency 1, these jobs scan the full sessions table; running multiple in
 * parallel would create lock contention with no upside. The 5-min sweeper and
 * hourly rollup are cheap enough that one-at-a-time is fine.
 */

import { Worker } from "bullmq";
import config from "../config";
import {
  WATCH_TIME_QUEUE_NAME,
  WATCH_TIME_JOB,
  watchTimeRedisConnection,
  ensureWatchTimeRecurringJobs,
} from "./watch-time.queue";
import * as rollupRepo from "../repositories/watch-time-rollup.repository";
import * as watchSessionRepo from "../repositories/watch-session.repository";
import logger from "../utils/logger";

const STALE_AFTER_MS = 5 * 60 * 1000;
const ARCHIVE_CUTOFF_DAYS = 90;
const ARCHIVE_BATCH_SIZE = 10_000;
const ARCHIVE_MAX_BATCHES_PER_RUN = 20; // cap to keep one job under ~20s

let worker: Worker | null = null;

async function processJob(jobName: string): Promise<void> {
  switch (jobName) {
    case WATCH_TIME_JOB.ROLLUP: {
      const tenants = await rollupRepo.getTenantsNeedingRollup();
      if (tenants.length === 0) {
        logger.info("[watch-time] rollup: no tenants need rollup");
        return;
      }
      logger.info(`[watch-time] rollup: processing ${tenants.length} tenants`);
      for (const t of tenants) {
        try {
          await rollupRepo.rollupTenant(t.tenant_id, t.watermark);
        } catch (err) {
          logger.error(
            `[watch-time] rollup failed for tenant=${t.tenant_id}: ${(err as Error).message}`
          );
          // Continue with the next tenant, we don't want one tenant's bad
          // data to halt the whole rollup.
        }
      }
      logger.info(`[watch-time] rollup: done`);
      return;
    }
    case WATCH_TIME_JOB.SWEEPER: {
      const closed = await watchSessionRepo.sweepStaleSessions(STALE_AFTER_MS);
      if (closed > 0) {
        logger.info(`[watch-time] sweeper closed ${closed} stale sessions`);
      }
      return;
    }
    case WATCH_TIME_JOB.ARCHIVE: {
      let totalDeleted = 0;
      for (let i = 0; i < ARCHIVE_MAX_BATCHES_PER_RUN; i++) {
        const deleted = await watchSessionRepo.archiveOldSessions(
          ARCHIVE_CUTOFF_DAYS,
          ARCHIVE_BATCH_SIZE
        );
        totalDeleted += deleted;
        if (deleted < ARCHIVE_BATCH_SIZE) break;
      }
      if (totalDeleted > 0) {
        logger.info(`[watch-time] archive deleted ${totalDeleted} old sessions`);
      }
      return;
    }
    default:
      logger.warn(`[watch-time] unknown job name: ${jobName}`);
  }
}

export async function startWatchTimeWorker(): Promise<void> {
  if (worker) return;
  await ensureWatchTimeRecurringJobs();
  worker = new Worker(
    WATCH_TIME_QUEUE_NAME,
    async (job) => processJob(job.name),
    {
      connection: watchTimeRedisConnection,
      prefix: config.BULLMQ_PREFIX,
      concurrency: 1,
    }
  );
  worker.on("failed", (job, err) => {
    logger.error(
      `[watch-time] job ${job?.name ?? "?"} (${job?.id ?? "?"}) failed: ${err.message}`
    );
  });
  logger.info("[watch-time] Worker started (rollup/sweeper/archive)");
}

export function stopWatchTimeWorker(): Promise<void> {
  if (!worker) return Promise.resolve();
  const w = worker;
  worker = null;
  return w.close();
}
