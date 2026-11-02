/**
 * XSS Sanitization Middleware
 *
 * Uses express-xss-sanitizer - a production-grade, battle-tested package
 * that sanitizes user inputs to prevent XSS attacks.
 *
 * Features:
 * - Express 5 compatible
 * - Actively maintained
 * - Sanitizes req.body, req.query, req.headers, and req.params
 * - Based on DOMPurify (industry-standard XSS sanitizer)
 *
 * Note: For additional input validation, use express-validator in your route handlers.
 * SQL injection protection is handled at the database layer via parameterized queries
 * (Kysely/Prisma provide this by default).
 */

import type { NextFunction, Request, Response } from "express";
import { xss } from "express-xss-sanitizer";

/**
 * The sanitizer strips tags and HTML-encodes text, so a saved URL such as
 * "https://cdn.example.com/v.m3u8?a=1&b=2" would be stored with "&amp;" and
 * break. A bare "&" cannot open markup, so turning "&amp;" back into "&" is
 * safe and makes every value round-trip; "<" and ">" stay encoded.
 */
function restoreAmpersands(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/&amp;/g, "&");
  if (Array.isArray(value)) return value.map(restoreAmpersands);
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) (value as Record<string, unknown>)[k] = restoreAmpersands(v);
  }
  return value;
}

const withAmpersands =
  (inner: ReturnType<typeof xss>) => (req: Request, res: Response, next: NextFunction) =>
    inner(req, res, (err?: unknown) => {
      if (err) return next(err);
      if (req.body) req.body = restoreAmpersands(req.body);
      next();
    });

/**
 * XSS sanitization middleware
 * Sanitizes all user inputs (body, query, params, headers) to prevent XSS attacks
 *
 * Configuration options:
 * - allowedKeys: Array of keys to skip sanitization (optional)
 * - allowedAttributes: Object mapping tags to allowed attributes (optional)
 *
 * @example
 * ```typescript
 * // Basic usage
 * app.use(xss());
 *
 * // With options
 * app.use(xss({
 *   allowedKeys: ['description'], // Allow HTML in description field
 *   allowedAttributes: {
 *     input: ['value']
 *   }
 * }));
 * ```
 */
export const sanitizeInput = withAmpersands(xss());
