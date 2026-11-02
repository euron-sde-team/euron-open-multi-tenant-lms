import { Queue } from "bullmq";

import type { BatchAIJobData } from "../types/batch-ai.type";

import { QUEUE_PREFIX, redisConnection } from "./connection";

export const BATCH_AI_QUEUE_NAME = "batch-ai-generation";

export const batchAIQueue = new Queue<BatchAIJobData>(BATCH_AI_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1, // section errors handled internally, no job retries
    removeOnComplete: { age: 300 }, // 5 min, payload includes large base64 thumbnails
    removeOnFail: { age: 1800 },
  },
});

/**
 * Submit a batch AI generation job. Deduplicated per (tenant, batch) so
 * multiple modal openings on the same batch collapse onto one running job
 * without queueing extra work.
 */
export async function submitBatchAIJob(data: BatchAIJobData): Promise<string> {
  const jobId = `batch-ai-${data.tenantId}-${data.batchId}`;

  const existing = await batchAIQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "active" || state === "waiting" || state === "delayed") {
      return jobId;
    }
    await existing.remove();
  }

  await batchAIQueue.add("generate-batch-content", data, { jobId });
  return jobId;
}
