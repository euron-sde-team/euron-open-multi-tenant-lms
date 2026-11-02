/**
 * Fixed-window rate limiter, shared across cluster workers and API tasks through
 * Redis when it is reachable, and per-process in memory when it is not.
 *
 * Each `RateLimiter` keys its counts by an arbitrary string (typically a
 * tenant-scoped IP address or a normalized identifier). Windows reset when they
 * elapse. A Redis error never blocks a request: the limiter falls back to its
 * in-process buckets for that call.
 */

import config from "../config";
import { TooManyRequestsError } from "../errors/too-many-request.error";
import { getRedisClient } from "../lib/redis";
import logger from "./logger";

interface Bucket {
  count: number;
  windowStart: number;
}

export interface RateLimiterOptions {
  /** Max events per window before TooManyRequests. */
  max: number;
  /** Window duration in ms. */
  windowMs: number;
  /** Name of the limiter; part of the Redis key, so keep it unique and stable. */
  label: string;
}

// After a Redis failure, stay on in-process counts for a while rather than
// opening a new connection attempt on every request.
const REDIS_RETRY_AFTER_MS = 30_000;
const REDIS_CONNECT_TIMEOUT_MS = 1_000;
let redisDownUntil = 0;

async function sharedClient() {
  if (Date.now() < redisDownUntil) throw new Error("redis marked unavailable");
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      getRedisClient(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("redis connect timeout")), REDIS_CONNECT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly max: number;
  private readonly windowMs: number;
  private readonly label: string;

  constructor(opts: RateLimiterOptions) {
    this.max = opts.max;
    this.windowMs = opts.windowMs;
    this.label = opts.label;
  }

  /** In-process check. Throws TooManyRequestsError when the bucket overflows. */
  check(key: string): void {
    if (!key) return;
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart > this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return;
    }
    if (bucket.count >= this.max) {
      throw new TooManyRequestsError();
    }
    bucket.count += 1;
  }

  /** Shared check (Redis), falling back to `check` when Redis is unavailable. */
  async consume(key: string): Promise<void> {
    if (!key) return;
    let count: number;
    try {
      const client = await sharedClient();
      const redisKey = `${config.CACHE_BUS_PREFIX}rl:${this.label}:${key}`;
      count = await client.incr(redisKey);
      if (count === 1) await client.pExpire(redisKey, this.windowMs);
    } catch (err) {
      redisDownUntil = Date.now() + REDIS_RETRY_AFTER_MS;
      logger.warn(`[rate-limit] Redis unavailable for ${this.label}, using in-process counts: ${String(err)}`);
      this.check(key);
      return;
    }
    if (count > this.max) throw new TooManyRequestsError();
  }
}
