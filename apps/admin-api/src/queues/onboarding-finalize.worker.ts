import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import {
  ONBOARDING_FINALIZE_QUEUE_NAME,
  type OnboardingFinalizeJobData,
} from "./onboarding-finalize.queue";
import tenantProvisioningService from "../services/tenant-provisioning.service";
import logger from "../utils/logger";

let worker: Worker<OnboardingFinalizeJobData> | null = null;

async function processJob(job: Job<OnboardingFinalizeJobData>): Promise<void> {
  logger.info(
    `[onboarding-finalize-worker] Starting job ${job.id} for tenant ${job.data.tenantId}`,
  );
  await tenantProvisioningService.finalizeAcademyProvisioning(job.data);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startOnboardingFinalizeWorker(): Worker {
  if (worker) return worker;

  worker = new Worker<OnboardingFinalizeJobData>(
    ONBOARDING_FINALIZE_QUEUE_NAME,
    processJob,
    {
      connection: redisConnection,
      prefix: QUEUE_PREFIX,
      concurrency: 4,
    },
  );

  worker.on("completed", (job) => {
    logger.info(`[onboarding-finalize-worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `[onboarding-finalize-worker] Job ${job?.id ?? "unknown"} failed: ${err.message}`,
    );
  });

  worker.on("error", (err) => {
    logger.error("[onboarding-finalize-worker] Worker error:", err);
  });

  logger.info("[onboarding-finalize-worker] Started");
  return worker;
}

export async function stopOnboardingFinalizeWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[onboarding-finalize-worker] Stopped");
}
