import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { QUEUE_NAME } from "./usage-reconciliation.queue";
import type { UsageReconciliationJob } from "./usage-reconciliation.queue";
import reconciliationService from "../services/reconciliation.service";
import logger from "../utils/logger";

let worker: Worker | null = null;

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case "reconcile-all-tenants":
      await handleReconcileAll();
      break;
    case "reconcile-tenant":
      await handleReconcileTenant(job.data as UsageReconciliationJob);
      break;
    default:
      logger.warn(
        `[usage-reconciliation-worker] Unknown job name: ${job.name}`
      );
  }
}

async function handleReconcileAll(): Promise<void> {
  const result = await reconciliationService.reconcileAll(true);
  logger.info(
    `[usage-reconciliation-worker] Reconciled all: ${result.tenantsProcessed} tenants, ` +
      `${result.driftsFound} drifts, ${result.corrected} corrected`
  );
}

async function handleReconcileTenant(
  data: UsageReconciliationJob
): Promise<void> {
  if (!data.tenantId) {
    logger.warn("[usage-reconciliation-worker] reconcile-tenant job missing tenantId");
    return;
  }
  const results = await reconciliationService.reconcileTenant(data.tenantId, true);
  let drifts = 0;
  for (const result of results.values()) {
    if (result.drift !== 0) drifts++;
  }
  if (drifts > 0) {
    logger.info(
      `[usage-reconciliation-worker] Tenant ${data.tenantId}: ${drifts} drift(s) corrected`
    );
  }
}

export function startUsageReconciliationWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    logger.info(`[usage-reconciliation-worker] Job ${job.name} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `[usage-reconciliation-worker] Job ${job?.name ?? "unknown"} failed: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    logger.error("[usage-reconciliation-worker] Worker error:", err);
  });

  logger.info("[usage-reconciliation-worker] Started");
  return worker;
}

export async function stopUsageReconciliationWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[usage-reconciliation-worker] Stopped");
}
