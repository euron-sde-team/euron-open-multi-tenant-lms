import type { ConnectionOptions } from "bullmq";
import { createClient } from "redis";
import config from "../config";
import logger from "../utils/logger";

/** BullMQ (ioredis) connection for every queue and worker, from REDIS_URL or REDIS_*. */
export const bullmqConnection: ConnectionOptions = {
  host: config.REDIS_HOST,
  port: parseInt(config.REDIS_PORT, 10),
  db: config.REDIS_DB,
  ...(config.REDIS_USERNAME ? { username: config.REDIS_USERNAME } : {}),
  ...(config.REDIS_PASSWORD ? { password: config.REDIS_PASSWORD } : {}),
  ...(config.REDIS_TLS ? { tls: { servername: config.REDIS_HOST } } : {}),
  maxRetriesPerRequest: null,
};

type RedisClientType = ReturnType<typeof createClient>;

let redisClient: RedisClientType | null = null;

/**
 * Lazy singleton Redis client. Mirror of admin-api/src/lib/redis.ts.
 * The email engine duplicated across both backends shares this shape.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const client = createClient({
    socket: config.REDIS_TLS
      ? { host: config.REDIS_HOST, port: parseInt(config.REDIS_PORT, 10), tls: true, servername: config.REDIS_HOST }
      : { host: config.REDIS_HOST, port: parseInt(config.REDIS_PORT, 10) },
    database: config.REDIS_DB,
    ...(config.REDIS_USERNAME ? { username: config.REDIS_USERNAME } : {}),
    ...(config.REDIS_PASSWORD ? { password: config.REDIS_PASSWORD } : {}),
  });

  client.on("error", (err) => {
    logger.error("[redis] Client error:", err);
  });

  await client.connect();
  redisClient = client;
  logger.info("[redis] Connected");
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
    logger.info("[redis] Disconnected");
  }
}
