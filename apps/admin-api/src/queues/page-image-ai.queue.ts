import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export interface PageImageJobData {
  tenantId: string;
  prompt: string;
  aspectRatio?: string;
  sectionContext?: {
    sectionType?: string;
    headline?: string;
    description?: string;
    badge?: string;
  };
}

export interface PageImageJobProgress {
  status: "processing" | "completed" | "failed";
  result?: { url: string };
  error?: string;
}

export const PAGE_IMAGE_AI_QUEUE_NAME = "page-image-ai-generation";

export const pageImageAIQueue = new Queue<PageImageJobData>(PAGE_IMAGE_AI_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 300 }, // 5 min TTL
    removeOnFail: { age: 1800 }, // 30 min for debugging
  },
});

/**
 * Submit a page image generation job. One active job per tenant.
 * If already active/waiting, returns existing jobId.
 */
export async function submitPageImageJob(data: PageImageJobData): Promise<string> {
  const jobId = `page-image-${data.tenantId}`;

  const existingJob = await pageImageAIQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    if (state === "active" || state === "waiting" || state === "delayed") {
      return jobId;
    }

    await existingJob.remove();
  }

  await pageImageAIQueue.add("generate-page-image", data, { jobId });
  return jobId;
}
