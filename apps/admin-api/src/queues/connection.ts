import { type ConnectionOptions } from "bullmq";
import config from "../config";

export const redisConnection: ConnectionOptions = {
  host: config.REDIS_HOST,
  port: parseInt(config.REDIS_PORT, 10),
  db: config.REDIS_DB,
  ...(config.REDIS_USERNAME ? { username: config.REDIS_USERNAME } : {}),
  ...(config.REDIS_PASSWORD ? { password: config.REDIS_PASSWORD } : {}),
  ...(config.REDIS_TLS ? { tls: { servername: config.REDIS_HOST } } : {}),
  maxRetriesPerRequest: null, // required by BullMQ
};

/** BullMQ key prefix (BULLMQ_PREFIX); keeps test runs and other installs apart. */
export const QUEUE_PREFIX = config.BULLMQ_PREFIX;
