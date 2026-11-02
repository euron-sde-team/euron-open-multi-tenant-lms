import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import type { PlanPageResult } from "../services/page-ai.service";

export interface PagePlanJobData {
  tenantId: string;
  prompt: string;
  businessContext?: string;
  availableSections: { type: string; label: string; description: string }[];
}

export interface PagePlanJobProgress {
  status: "processing" | "completed" | "failed";
  result?: PlanPageResult;
  error?: string;
}

export const PAGE_PLAN_AI_QUEUE_NAME = "page-plan-ai-generation";

export const pagePlanAIQueue = new Queue<PagePlanJobData>(PAGE_PLAN_AI_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 300 }, // 5 min TTL
    removeOnFail: { age: 1800 }, // 30 min for debugging
  },
});

/**
 * Submit a page-plan job. One active job per tenant.
 * If a job is already active/waiting, returns the existing jobId.
 *
 * The plan step does grounded web research + a large structured generation, so
 * it is too slow to run synchronously inside the request (it trips the gateway
 * 504). Running it as a job and polling for status removes the long-held request.
 */
export async function submitPagePlanJob(data: PagePlanJobData): Promise<string> {
  const jobId = `page-plan-${data.tenantId}`;

  const existingJob = await pagePlanAIQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    if (state === "active" || state === "waiting" || state === "delayed") {
      return jobId;
    }

    await existingJob.remove();
  }

  await pagePlanAIQueue.add("plan-page", data, { jobId });
  return jobId;
}
