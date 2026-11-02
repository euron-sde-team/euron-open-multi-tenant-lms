import { NextFunction, Request, Response } from "express";
import config from "../config";
import { TooManyRequestsError } from "../errors/too-many-request.error";

/**
 * Fixed-window brute-force guard for operator login: one counter per client
 * IP and one per email address. Counters live in process memory, so behind
 * several tasks (or cluster workers) the effective limit is the configured
 * value times the number of processes.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function hit(key: string, limit: number, windowMs: number, now: number): number | null {
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count > limit ? bucket.resetAt : null;
}

export const loginRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const now = Date.now();
  const windowMs = config.AUTH_RATE_LIMIT_WINDOW_MS;
  const rawEmail = (req.body as { email?: unknown } | undefined)?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  const blockedUntil = [
    hit(`ip:${req.ip ?? "unknown"}`, config.AUTH_RATE_LIMIT_PER_IP, windowMs, now),
    email ? hit(`email:${email}`, config.AUTH_RATE_LIMIT_PER_EMAIL, windowMs, now) : null,
  ].reduce<number | null>((a, b) => (a === null ? b : b === null ? a : Math.max(a, b)), null);

  if (blockedUntil !== null) {
    res.setHeader("Retry-After", Math.ceil((blockedUntil - now) / 1000).toString());
    throw new TooManyRequestsError();
  }
  next();
};
