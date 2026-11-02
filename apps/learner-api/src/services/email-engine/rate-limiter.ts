/**
 * Rate limiter, per-tenant + account-wide token buckets in Redis.
 *
 * Implementation: 1-second fixed-window counter, evaluated for BOTH buckets
 * inside a single Lua script so the pair is consumed atomically.
 *
 * Two buckets are consumed per send (BOTH must allow):
 *   1. Per-tenant TPS, capacity = ceil(tenant_tps * categoryMultiplier)
 *      where tenant_tps = tenants.email_tps_override ?? EMAIL_DEFAULT_TENANT_TPS
 *   2. Account-wide TPS, capacity = EMAIL_ACCOUNT_TPS (no multiplier)
 *
 * Why Lua rather than two sequential INCRs: the previous implementation
 * consumed the tenant token, THEN checked the account bucket, and returned
 * false without giving the tenant token back when the account bucket was
 * exhausted. Every account-level denial therefore burned per-tenant capacity
 * that nobody used. Rolling that back with a bare DECR from the client is not
 * safe either, if the 1s key expired between the INCR and the DECR, the DECR
 * RECREATES the key at -1 with NO TTL, and because the "arm the expiry" branch
 * only fires when INCR returns exactly 1, that key would then never expire and
 * the tenant's counter would climb monotonically until it was permanently
 * blocked. Doing both bucket checks (and the rollback) inside one script makes
 * the expiry race impossible: KEYS[1] is guaranteed to exist because this same
 * script INCR'd it microseconds earlier.
 *
 * Approximate but cheap. A fixed window can admit up to ~2x capacity across a
 * window edge; EMAIL_ACCOUNT_TPS is sized below the real SES rate with that in
 * mind, and the AWS SDK retries any throttle that still slips through.
 */

import { db } from "../../db/connection";
import config from "../../config";
import { getRedisClient } from "../../lib/redis";
import logger from "../../utils/logger";

const ACCOUNT_KEY = "email-rate:account";
const WINDOW_SECONDS = 1;

function tenantKey(tenantId: string): string {
  return `email-rate:${tenantId}`;
}

/**
 * KEYS[1] tenant bucket, KEYS[2] account bucket.
 * ARGV[1] tenant capacity, ARGV[2] account capacity, ARGV[3] window seconds.
 * Returns 1 when BOTH buckets admitted the send, 0 otherwise.
 */
const CONSUME_SCRIPT = `
local tenantCap  = tonumber(ARGV[1])
local accountCap = tonumber(ARGV[2])
local window     = tonumber(ARGV[3])

local t = redis.call('INCR', KEYS[1])
-- Arm the window whenever the key has no TTL, not only on the first INCR.
-- A key can exist WITHOUT a TTL: the pre-Lua implementation ran INCR and
-- EXPIRE as two separate round-trips, so a worker killed between them (any
-- deploy) leaked a permanent key. Such a key never returns 1 from INCR
-- again, so an == 1 guard alone would never arm expiry and the bucket would
-- deny forever once past capacity. PTTL < 0 detects and heals that state.
if t == 1 or redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], window)
end
if t > tenantCap then return 0 end

local a = redis.call('INCR', KEYS[2])
if a == 1 or redis.call('PTTL', KEYS[2]) < 0 then
  redis.call('EXPIRE', KEYS[2], window)
end
if a > accountCap then
  -- Hand the tenant token back. Safe: KEYS[1] cannot have expired between
  -- the INCR above and this DECR, because the whole script is one command.
  redis.call('DECR', KEYS[1])
  return 0
end

return 1
`;

async function loadTenantTps(tenantId: string): Promise<number> {
  const row = await db
    .selectFrom("tenants")
    .select(["email_tps_override"])
    .where("id", "=", tenantId)
    .executeTakeFirst();
  const override = row?.email_tps_override;
  if (override !== null && override !== undefined) {
    const parsed =
      typeof override === "string" ? parseFloat(override) : Number(override);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return config.EMAIL_DEFAULT_TENANT_TPS;
}

/**
 * Attempt to consume one token from BOTH the per-tenant and account buckets.
 * Returns true only if both allow.
 *
 * A false return is back-pressure, NOT a failure: callers map it to
 * EmailError("RATE_LIMITED", retryable=true) and the campaign worker defers
 * the recipient (leaving it PENDING) rather than terminalising it.
 *
 * Redis being unreachable also returns false, deliberately fail-CLOSED to
 * back-pressure rather than fail-open. Failing open would let a campaign
 * blast straight past the SES account quota; failing closed just defers the
 * send, and the deferral path re-queues it, so nothing is lost.
 */
export async function consumeRateLimit(
  tenantId: string,
  categoryMultiplier: number,
): Promise<boolean> {
  const accountCap = config.EMAIL_ACCOUNT_TPS;
  if (!Number.isFinite(accountCap) || accountCap <= 0) {
    logger.error(
      `[email-rate] EMAIL_ACCOUNT_TPS is ${accountCap}; refusing all sends. Check config.`,
    );
    return false;
  }

  try {
    const tenantTps = await loadTenantTps(tenantId);
    const tenantCap = Math.max(1, Math.ceil(tenantTps * categoryMultiplier));
    const client = await getRedisClient();
    const allowed = await client.eval(CONSUME_SCRIPT, {
      keys: [tenantKey(tenantId), ACCOUNT_KEY],
      arguments: [String(tenantCap), String(accountCap), String(WINDOW_SECONDS)],
    });
    return Number(allowed) === 1;
  } catch (err) {
    logger.warn(
      `[email-rate] Bucket check failed for tenant=${tenantId}; deferring send: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return false;
  }
}
