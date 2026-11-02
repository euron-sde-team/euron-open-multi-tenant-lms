import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const QUEUE_NAME = "usage-reconciliation";

export const usageReconciliationQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

export interface UsageReconciliationJob {
  triggeredBy: "schedule" | "manual";
  tenantId?: string;
}

/**
 * Queue a reconciliation job for a single tenant (manual trigger).
 */
export async function queueReconcileTenant(tenantId: string): Promise<void> {
  await usageReconciliationQueue.add("reconcile-tenant", {
    triggeredBy: "manual",
    tenantId,
  } satisfies UsageReconciliationJob);
}

/**
 * Register the repeatable job to reconcile all tenants every 30 minutes.
 * Safe to call from every worker: BullMQ deduplicates repeatables by key.
 */
export async function registerUsageReconciliationJob(): Promise<void> {
  await usageReconciliationQueue.upsertJobScheduler(
    "usage-reconciliation-scheduler",
    { every: 30 * 60 * 1000 },
    {
      name: "reconcile-all-tenants",
      data: { triggeredBy: "schedule" } satisfies UsageReconciliationJob,
    }
  );
}
