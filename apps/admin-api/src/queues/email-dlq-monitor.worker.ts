import { Worker, type Job } from "bullmq";
import { SQSClient, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import config from "../config";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { EMAIL_DLQ_MONITOR_QUEUE_NAME } from "./email-dlq-monitor.queue";
import { notifyOps } from "../services/email-engine/ops-alert";
import logger from "../utils/logger";

let worker: Worker | null = null;

function buildSqsClient(): SQSClient {
  return new SQSClient({
    region: config.AWS_SES_REGION,
    credentials: {
      accessKeyId: config.AWS_SES_ACCESS_KEY,
      secretAccessKey: config.AWS_SES_SECRET_KEY,
    },
  });
}

async function checkDlqDepth(): Promise<void> {
  if (!config.SES_EVENTS_DLQ_URL) {
    logger.warn(
      "[email-dlq-monitor] SES_EVENTS_DLQ_URL is not configured; check skipped.",
    );
    return;
  }
  const sqs = buildSqsClient();
  const result = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: config.SES_EVENTS_DLQ_URL,
      AttributeNames: ["ApproximateNumberOfMessages"],
    }),
  );
  const depthStr = result.Attributes?.ApproximateNumberOfMessages ?? "0";
  const depth = Number.parseInt(depthStr, 10);
  if (!Number.isFinite(depth) || depth <= 0) return;

  await notifyOps({
    severity: depth > 100 ? "SEV1" : "SEV2",
    source: "email-engine.dlq",
    message: `SES events DLQ has ${depth} message${depth === 1 ? "" : "s"}; investigate via AWS console and redrive after fixing root cause.`,
    context: {
      dlqUrl: config.SES_EVENTS_DLQ_URL,
      mainQueueUrl: config.SES_EVENTS_QUEUE_URL,
      approximateDepth: depth,
    },
  });
}

async function processJob(job: Job): Promise<void> {
  switch (job.name) {
    case "check-dlq-depth":
      await checkDlqDepth();
      break;
    default:
      logger.warn(`[email-dlq-monitor-worker] Unknown job name: ${job.name}`);
  }
}

export function startEmailDlqMonitorWorker(): void {
  worker = new Worker(EMAIL_DLQ_MONITOR_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    logger.debug(`[email-dlq-monitor-worker] Job ${job.name} completed`);
  });
  worker.on("failed", (job, err) => {
    logger.error(`[email-dlq-monitor-worker] Job ${job?.name} failed:`, err);
  });

  logger.info("[email-dlq-monitor-worker] Worker started");
}

export async function stopEmailDlqMonitorWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[email-dlq-monitor-worker] Worker stopped");
  }
}
