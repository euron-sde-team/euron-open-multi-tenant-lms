import { getRedisClient } from "../lib/redis";
import logger from "../utils/logger";
import config from "../config";
import { invalidateTenantConfig } from "../middlewares/tenant-resolver.middleware";

/**
 * Cross-backend cache invalidation over shared Redis pub/sub.
 *
 * Why Redis pub/sub and not HTTP?
 *   1. Multi-worker fanout: learner-api runs in Node cluster mode (one
 *      worker per CPU). Each worker holds its own in-memory cache. Pub/sub
 *      broadcasts to every subscribed worker; an HTTP call would only hit
 *      one worker and leave the rest stale for up to 60s.
 *   2. No shared secret / no reachability dependency between backends.
 *   3. The DB is already shared, the truth is in Postgres. This is purely
 *      an "invalidate sooner than 60s" hint, exactly what fire-and-forget
 *      pub/sub is for.
 *
 * Channel naming convention (must be unique across the platform's Redis):
 *   - Root prefix:  config.CACHE_BUS_PREFIX (default `lms:`)
 *   - Family:       `cache-bust:`          (vs `cache:`, `lock:`, etc.)
 *   - Topic:        `tenant-config`        (specific concern)
 *   Full channel:   `lms:cache-bust:tenant-config`
 *
 * BullMQ uses `bull:<queue>:*` keys; this namespace won't collide. The
 * publishers (admin-api, console-api) must use the same prefix.
 */
const CHANNEL_TENANT_CONFIG = `${config.CACHE_BUS_PREFIX}cache-bust:tenant-config`;

type SubscriberClient = Awaited<ReturnType<typeof getRedisClient>>;
let subscriberClient: SubscriberClient | null = null;

interface CacheBustPayload {
  tenant_id?: string;
}

export async function startCacheBusSubscriber(): Promise<void> {
  if (subscriberClient) return;

  const main = await getRedisClient();
  // node-redis v4+ requires a dedicated connection for subscribe mode. The
  // `duplicate()` reuses the connection options without copying state.
  const sub = main.duplicate();
  sub.on("error", (err) => {
    logger.error(`[cache-bus] Subscriber error: ${(err as Error).message}`);
  });
  await sub.connect();

  await sub.subscribe(CHANNEL_TENANT_CONFIG, (message: string) => {
    try {
      const payload = JSON.parse(message) as CacheBustPayload;
      if (payload?.tenant_id) {
        invalidateTenantConfig(payload.tenant_id);
      } else {
        logger.warn(`[cache-bus] Missing tenant_id on ${CHANNEL_TENANT_CONFIG}`);
      }
    } catch (err) {
      logger.warn(
        `[cache-bus] Invalid payload on ${CHANNEL_TENANT_CONFIG}: ${(err as Error).message}`
      );
    }
  });

  subscriberClient = sub;
  logger.info(`[cache-bus] Subscribed to ${CHANNEL_TENANT_CONFIG}`);
}

export async function stopCacheBusSubscriber(): Promise<void> {
  if (!subscriberClient) return;
  try {
    await subscriberClient.unsubscribe();
    await subscriberClient.quit();
    logger.info("[cache-bus] Subscriber stopped");
  } catch (err) {
    logger.warn(
      `[cache-bus] Error during subscriber shutdown: ${(err as Error).message}`
    );
  } finally {
    subscriberClient = null;
  }
}
