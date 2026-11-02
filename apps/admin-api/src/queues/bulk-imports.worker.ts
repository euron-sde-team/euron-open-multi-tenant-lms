import { Worker, type Job } from "bullmq";

import bulkImportsRepository from "../repositories/bulk-imports.repository";
import {
  buildReportCsv,
  deserializeScope,
  executeImport,
} from "../services/bulk-imports.service";
import { downloadInput, uploadReport } from "../services/bulk-imports.s3";
import type { RawParsedRow } from "../types/bulk-imports.type";
import logger from "../utils/logger";

import { QUEUE_PREFIX, redisConnection } from "./connection";
import { QUEUE_NAME, type BulkImportJobPayload } from "./bulk-imports.queue";

let worker: Worker | null = null;

interface PersistedInput {
  rows: RawParsedRow[];
  scope: {
    scopeType: "TENANT" | "COURSE" | "BOOK";
    scopeId: string | null;
    batchId: string | null;
    validTill: string | null;
  };
}

async function processJob(job: Job<BulkImportJobPayload>): Promise<void> {
  const { jobId, tenantId, actingUserId, inputS3Key } = job.data;
  logger.info(
    `[bulk-imports-worker] Processing job ${jobId} for tenant ${tenantId}`,
  );
  await bulkImportsRepository.markProcessing(tenantId, jobId);

  const buffer = await downloadInput(inputS3Key);
  const persisted = JSON.parse(buffer.toString("utf-8")) as PersistedInput;
  const scope = deserializeScope(persisted.scope);

  const result = await executeImport(
    tenantId,
    actingUserId,
    persisted.rows,
    scope,
    { dryRun: false },
  );

  const reportKey = await uploadReport(
    tenantId,
    jobId,
    buildReportCsv(result.perRow),
  );
  await bulkImportsRepository.markCompleted(
    tenantId,
    jobId,
    result.counters,
    reportKey,
  );
  logger.info(
    `[bulk-imports-worker] Completed job ${jobId} (${result.totalRows} rows, ${result.counters.errorCount} errors)`,
  );
}

export function startBulkImportsWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    // Low concurrency: row-level locks on tenant_members during merges are
    // the bottleneck; running too many parallel imports across tenants is
    // unnecessary and can starve other queues.
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    logger.info(`[bulk-imports-worker] Job ${job?.data?.jobId ?? "?"} completed`);
  });

  worker.on("failed", async (job, err) => {
    logger.error(
      `[bulk-imports-worker] Job ${job?.data?.jobId ?? "?"} failed (attempt ${job?.attemptsMade ?? "?"}/${job?.opts?.attempts ?? "?"}): ${err.message}`,
    );
    // Mark the DB row failed only after the final retry.
    if (
      job &&
      job.attemptsMade >= (job.opts?.attempts ?? 1) &&
      job.data?.tenantId &&
      job.data?.jobId
    ) {
      try {
        await bulkImportsRepository.markFailed(
          job.data.tenantId,
          job.data.jobId,
          err.message,
        );
      } catch (markErr) {
        logger.error(
          `[bulk-imports-worker] Failed to mark job failed: ${(markErr as Error).message}`,
        );
      }
    }
  });

  worker.on("error", (err) => {
    logger.error("[bulk-imports-worker] Worker error:", err);
  });

  logger.info("[bulk-imports-worker] Started");
  return worker;
}

export async function stopBulkImportsWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[bulk-imports-worker] Stopped");
}
