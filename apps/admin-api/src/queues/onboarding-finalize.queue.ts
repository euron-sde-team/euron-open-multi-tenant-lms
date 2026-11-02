import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import type { QuizAnswers } from "../lib/creator-intent/types";

export const ONBOARDING_FINALIZE_QUEUE_NAME = "onboarding-finalize";

/**
 * Payload for the deferred "finalize academy" step. The synchronous
 * provisioning request (POST /tenant/organization) creates the usable tenant
 * shell (tenant + membership + FREE plan/entitlements + subdomain + the
 * the AI model-picked template/theme) and returns immediately. Everything that is
 * NOT needed by the frontend to start rendering, the sample course, its
 * publish and the course-ai content job, is
 * enqueued here and runs in the background worker.
 *
 * Keeping the request light is what stops the whole flow from crossing the
 * dev-proxy timeout when the DB is remote (see finalizeAcademyProvisioning in
 * tenant-provisioning.service.ts). In prod it simply makes signup faster.
 */
export interface OnboardingFinalizeJobData {
  tenantId: string;
  orgName: string;
  quiz_answers: QuizAnswers;
}

export const onboardingFinalizeQueue = new Queue<OnboardingFinalizeJobData>(
  ONBOARDING_FINALIZE_QUEUE_NAME,
  {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    defaultJobOptions: {
      // attempts: 1, the finalize steps are individually best-effort and
      // guarded for idempotency inside the handler. No job-level retry keeps
      // the sample-course creation from ever running twice.
      attempts: 1,
      removeOnComplete: { age: 300 }, // 5 min
      removeOnFail: { age: 1800 }, // 30 min for debugging
    },
  },
);

/**
 * Enqueue the deferred finalize step for a freshly-provisioned tenant.
 *
 * jobId is namespaced per-tenant so a duplicate enqueue (e.g. a retried
 * request) never fans out into two finalize runs, the second call finds the
 * in-flight/queued job and returns its id.
 */
export async function submitOnboardingFinalizeJob(
  data: OnboardingFinalizeJobData,
): Promise<string> {
  const jobId = `onboarding-finalize-${data.tenantId}`;

  const existingJob = await onboardingFinalizeQueue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === "active" || state === "waiting" || state === "delayed") {
      return jobId;
    }
    await existingJob.remove();
  }

  await onboardingFinalizeQueue.add("finalize-academy", data, { jobId });
  return jobId;
}
