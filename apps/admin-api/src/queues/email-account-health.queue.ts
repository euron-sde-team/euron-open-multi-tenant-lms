import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const EMAIL_ACCOUNT_HEALTH_QUEUE_NAME = "email-account-health";

export const emailAccountHealthQueue = new Queue(
  EMAIL_ACCOUNT_HEALTH_QUEUE_NAME,
  {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 200 },
    },
  },
);

export interface AccountHealthJob {
  triggeredBy: "schedule";
}

/**
 * Register the recurring 5-minute account health check. The check is fast
 * (one SES call + two CloudWatch calls + maybe a Redis sweep over tenant
 * keys); 5 min cadence gives us a tight reaction window without hammering
 * AWS APIs.
 */
export async function registerEmailAccountHealthJob(): Promise<void> {
  await emailAccountHealthQueue.upsertJobScheduler(
    "email-account-health-scheduler",
    { every: 5 * 60 * 1000 },
    {
      name: "run-emergency-brake",
      data: { triggeredBy: "schedule" } satisfies AccountHealthJob,
    },
  );
}
