import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { FX_REFRESH_QUEUE_NAME } from "./fx-refresh.queue";
import exchangeRateService from "../services/exchange-rate.service";
import exchangeRatesRepository from "../repositories/exchange-rates.repository";
import logger from "../utils/logger";

/** Keep two years of rate history so past statements stay re-derivable. */
const RATE_HISTORY_RETENTION_DAYS = 730;

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  if (job.name !== "refresh-fx-rates") return;

  const table = await exchangeRateService.refresh();
  if (!table) {
    // Throw so BullMQ retries. Readers are unaffected meanwhile: they fall back
    // to the last persisted table, which is exactly what this job maintains.
    throw new Error("FX provider unreachable; rates not refreshed");
  }

  const purged = await exchangeRatesRepository.purgeOlderThan(
    RATE_HISTORY_RETENTION_DAYS,
  );
  if (purged > 0) {
    logger.info(`[fx-refresh-worker] purged ${purged} historical rate rows`);
  }
}

export function startFxRefreshWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(FX_REFRESH_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `[fx-refresh-worker] Job ${job?.name ?? "unknown"} failed (attempt ${job?.attemptsMade ?? "?"}/${job?.opts?.attempts ?? "?"}): ${err.message}`,
    );
  });

  worker.on("error", (err) => {
    logger.error("[fx-refresh-worker] Worker error:", err);
  });

  logger.info("[fx-refresh-worker] Started");
  return worker;
}

export async function stopFxRefreshWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[fx-refresh-worker] Stopped");
}
