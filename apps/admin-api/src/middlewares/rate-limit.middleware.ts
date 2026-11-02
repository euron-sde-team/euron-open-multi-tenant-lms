import type { Request, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import config from "../config";

/**
 * Brute-force guards for the public staff auth routes (login, signup,
 * password reset, OTP). Each route gets its own counters: one per client IP
 * and, when the body carries an email, one per address, so a single attacker
 * cannot spray many accounts and many IPs cannot hammer one account.
 *
 * Counters live in process memory. Behind several tasks (or cluster workers)
 * the effective limit is the configured value times the number of processes.
 */
const tooMany = (what: string) => ({
  success: false,
  error: { message: `Too many ${what} attempts. Try again later.` },
  message: `Too many ${what} attempts`,
  statusCode: 429,
});

const emailOf = (req: Request): string => {
  const raw = (req.body as { email?: unknown } | undefined)?.email;
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
};

export function authRateLimit(
  what: string,
  { perIp = config.AUTH_RATE_LIMIT_PER_IP, perEmail = config.AUTH_RATE_LIMIT_PER_EMAIL } = {}
): RequestHandler[] {
  const common = {
    windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
    message: tooMany(what),
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
  } as const;
  return [
    rateLimit({ ...common, limit: perIp }),
    rateLimit({
      ...common,
      limit: perEmail,
      skip: (req) => !emailOf(req),
      keyGenerator: (req) => `email:${emailOf(req)}`,
    }),
  ];
}
