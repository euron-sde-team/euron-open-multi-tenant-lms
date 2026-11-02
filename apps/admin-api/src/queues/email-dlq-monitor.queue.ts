import { Queue } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";

export const EMAIL_DLQ_MONITOR_QUEUE_NAME = "email-dlq-monitor";

export const emailDlqMonitorQueue = new Queue(EMAIL_DLQ_MONITOR_QUEUE_NAME, {
  connection: redisConnection,
  prefix: QUEUE_PREFIX,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export interface CheckDlqDepthJob {
  triggeredBy: "schedule";
}

/**
 * Register the repeatable DLQ depth check. Every 5 minutes the worker calls
 * SQS GetQueueAttributes on SES_EVENTS_DLQ_URL; non-zero depth fires an OPS
 * alert (SEV2 by default, SEV1 if >100).
 *
 * Idempotent: BullMQ deduplicates repeatables by scheduler key, so booting
 * this in every cluster worker is safe.
 */
export async function registerEmailDlqMonitorJob(): Promise<void> {
  await emailDlqMonitorQueue.upsertJobScheduler(
    "email-dlq-monitor-scheduler",
    { every: 5 * 60 * 1000 },
    {
      name: "check-dlq-depth",
      data: { triggeredBy: "schedule" } satisfies CheckDlqDepthJob,
    },
  );
}
