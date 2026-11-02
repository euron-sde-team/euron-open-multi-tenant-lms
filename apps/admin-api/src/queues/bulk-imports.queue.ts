import { Queue } from "bullmq";

import { QUEUE_PREFIX, redisConnection } from "./connection";

export const QUEUE_NAME = "bulk-imports";

export interface BulkImportJobPayload {
  jobId: string;
  tenantId: string;
  actingUserId: string;
  /** S3 key for the persisted parsed-rows + scope JSON. */
  inputS3Key: string;
}

export const bulkImportsQueue = new Queue<BulkImportJobPayload>(QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    // Idempotency is enforced inside the matcher (per-row), so a hard retry
    // is safe; but we keep attempts low to surface failures fast.
    attempts: 2,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export async function enqueueBulkImportJob(
  payload: BulkImportJobPayload,
): Promise<void> {
  await bulkImportsQueue.add("process-bulk-import", payload, {
    jobId: payload.jobId, // deduplicate by tenant_bulk_imports.id
  });
}
