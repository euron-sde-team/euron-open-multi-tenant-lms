import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const EMAIL_REPUTATION_SWEEP_QUEUE_NAME = "email-reputation-sweep";

export const emailReputationSweepQueue = new Queue(
  EMAIL_REPUTATION_SWEEP_QUEUE_NAME,
  {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  },
);

export interface SweepReputationJob {
  triggeredBy: "schedule";
}

/**
 * Recurring sweep: every 10 minutes iterate WARNING + THROTTLED tenants and
 * call evaluateTenant(AUTO_RECOVERY). The enforcer applies the 48h cooldown
 * + below-threshold check internally.
 *
 * Idempotent across cluster workers via BullMQ scheduler dedup.
 */
export async function registerEmailReputationSweepJob(): Promise<void> {
  await emailReputationSweepQueue.upsertJobScheduler(
    "email-reputation-sweep-scheduler",
    { every: 10 * 60 * 1000 },
    {
      name: "sweep-reputation",
      data: { triggeredBy: "schedule" } satisfies SweepReputationJob,
    },
  );
}
