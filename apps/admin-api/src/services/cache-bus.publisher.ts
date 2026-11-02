import { getRedisClient } from "../lib/redis";
import config from "../config";
import logger from "../utils/logger";

/**
 * Publish a cache-bust signal over shared Redis pub/sub. learner-api
 * subscribes on every worker process; one publish here triggers in-memory
 * cache invalidation on ALL of those workers.
 *
 * Channel naming: `<CACHE_BUS_PREFIX>cache-bust:<topic>` (prefix `lms:` by
 * default; must match learner-api).
 */

/**
 * Tenant-config channel: busts learner-api's in-memory tenant resolution
 * cache (TenantInfo) so storefront/certificate toggles propagate within seconds
 * instead of the 60s TTL.
 */
const CHANNEL_TENANT_CONFIG = `${config.CACHE_BUS_PREFIX}cache-bust:tenant-config`;

/**
 * Fire-and-forget publish that tells learner-api to drop its cached
 * TenantInfo for this tenant. Used after storefront (access-managed) and
 * certificate-tab toggles so the change is visible to learners within seconds.
 * Failures are logged but never thrown, the 60s TTL guarantees eventual
 * consistency even if Redis is briefly unreachable.
 */
export async function publishTenantConfigInvalidation(
  tenantId: string
): Promise<void> {
  try {
    const client = await getRedisClient();
    const payload = JSON.stringify({ tenant_id: tenantId, ts: Date.now() });
    await client.publish(CHANNEL_TENANT_CONFIG, payload);
    logger.info(
      `[cache-bus] Published ${CHANNEL_TENANT_CONFIG} for tenant ${tenantId}`
    );
  } catch (err) {
    logger.warn(
      `[cache-bus] Publish failed for tenant ${tenantId}: ${(err as Error).message}`
    );
  }
}
