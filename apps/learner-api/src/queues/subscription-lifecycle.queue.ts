import { Queue } from "bullmq";
import config from "../config";
import { bullmqConnection } from "../lib/redis";

const redisConnection = bullmqConnection;

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};

export const subscriptionLifecycleQueue = new Queue("subscription-lifecycle", {
  connection: redisConnection,
  prefix: config.BULLMQ_PREFIX,
  defaultJobOptions,
});

export type SubscriptionLifecycleJobType =
  | "grace-period-check"
  | "dunning-email"
  | "renewal-reminder"
  | "verify-pending-subscriptions"
  | "grace-period-warning";

export interface SubscriptionLifecycleJob {
  type: SubscriptionLifecycleJobType;
}
