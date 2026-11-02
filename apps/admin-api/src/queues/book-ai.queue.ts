import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import type { BookAIJobData } from "../types/book-ai.type";

export const BOOK_AI_QUEUE_NAME = "book-ai-generation";

export const bookAIQueue = new Queue<BookAIJobData>(BOOK_AI_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1, // no job-level retries, section errors handled internally
    removeOnComplete: { age: 300 }, // 5 min TTL, thumbnails are large base64
    removeOnFail: { age: 1800 }, // 30 min for debugging
  },
});

/**
 * Submit a book AI generation job. Deduplicates by tenant, one active job
 * per tenant. If a job is already active/waiting/delayed, returns existing jobId.
 * If completed/failed, removes old job and creates a new one.
 */
export async function submitBookAIJob(data: BookAIJobData): Promise<string> {
  const jobId = `book-ai-${data.tenantId}`;

  // Check for existing job
  const existingJob = await bookAIQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    // If active/waiting/delayed, return existing job
    if (state === "active" || state === "waiting" || state === "delayed") {
      return jobId;
    }

    // If completed/failed, remove and create new
    await existingJob.remove();
  }

  await bookAIQueue.add("generate-book-content", data, { jobId });
  return jobId;
}
