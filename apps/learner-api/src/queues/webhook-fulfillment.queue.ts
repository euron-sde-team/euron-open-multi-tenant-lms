import { Queue } from "bullmq";
import config from "../config";
import { bullmqConnection } from "../lib/redis";

const redisConnection = bullmqConnection;

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 10_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};

const webhookFulfillmentQueue = new Queue("webhook-fulfillment", {
  connection: redisConnection,
  prefix: config.BULLMQ_PREFIX,
  defaultJobOptions,
});

export interface WebhookFulfillmentJob {
  tenantId: string;
  orderId: string;
  eventId: string;
  paymentId: string;
  eventType: string;
  orderType: string;
  source: "WEBHOOK" | "VERIFICATION_FALLBACK";
}

export async function queueWebhookFulfillment(data: WebhookFulfillmentJob) {
  await webhookFulfillmentQueue.add("fulfill", data, {
    jobId: `webhook-fulfill-${data.orderId}-${data.eventId}`,
  });
}
