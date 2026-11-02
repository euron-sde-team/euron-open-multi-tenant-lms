import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { EMAIL_REPUTATION_SWEEP_QUEUE_NAME } from "./email-reputation-sweep.queue";
import { sweepReputationRecovery } from "../services/email-engine/reputation.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case "sweep-reputation":
      await sweepReputationRecovery();
      break;
    default:
      logger.warn(`[email-reputation-sweep-worker] Unknown job: ${job.name}`);
  }
}

export function startEmailReputationSweepWorker(): void {
  worker = new Worker(EMAIL_REPUTATION_SWEEP_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    logger.debug(
      `[email-reputation-sweep-worker] Job ${job.name} completed`,
    );
  });
  worker.on("failed", (job, err) => {
    logger.error(
      `[email-reputation-sweep-worker] Job ${job?.name} failed:`,
      err,
    );
  });
  logger.info("[email-reputation-sweep-worker] Worker started");
}

export async function stopEmailReputationSweepWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[email-reputation-sweep-worker] Worker stopped");
  }
}
