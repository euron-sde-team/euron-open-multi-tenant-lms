import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import type { CourseAIJobData } from "../types/course-ai.type";

export const COURSE_AI_QUEUE_NAME = "course-ai-generation";

export const courseAIQueue = new Queue<CourseAIJobData>(COURSE_AI_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1, // no job-level retries, section errors handled internally
    removeOnComplete: { age: 300 }, // 5 min TTL, thumbnails are large base64
    removeOnFail: { age: 1800 }, // 30 min for debugging
  },
});

/**
 * Submit a course AI generation job.
 *
 * Default jobId scheme, `course-ai-${tenantId}`, deduplicates the manual
 * "Generate all with AI" flow at one active job per tenant. If a job is
 * already active/waiting/delayed, returns the existing jobId; if
 * completed/failed, removes the old one and creates a new one.
 *
 * @param options.jobIdOverride
 *   Bypasses the default scheme so internal callers (currently the
 *   onboarding wizard's auto-apply flow in tenant-provisioning.service.ts)
 *   can occupy a separate ID namespace and run in parallel with manual
 *   admin-triggered jobs without colliding. The manual controller
 *   (`course-ai.controller.ts`) does NOT pass this, its behaviour is
 *   unchanged.
 */
export async function submitCourseAIJob(
  data: CourseAIJobData,
  options?: { jobIdOverride?: string }
): Promise<string> {
  const jobId = options?.jobIdOverride ?? `course-ai-${data.tenantId}`;

  // Check for existing job
  const existingJob = await courseAIQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();

    // If active/waiting/delayed, return existing job
    if (state === "active" || state === "waiting" || state === "delayed") {
      return jobId;
    }

    // If completed/failed, remove and create new
    await existingJob.remove();
  }

  await courseAIQueue.add("generate-course-content", data, { jobId });
  return jobId;
}
