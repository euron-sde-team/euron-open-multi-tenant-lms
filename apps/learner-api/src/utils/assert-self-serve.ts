import { db } from "../db/connection";
import { ForbiddenError } from "../errors/forbidden.error";

/**
 * Access-managed storefront enforcement.
 *
 * When a tenant enables access-managed mode, the storefront shows no pricing
 * and every self-serve acquisition path (paid checkout, cart, free enroll,
 * webinar registration, hub free claim) is blocked server-side; access is
 * assigned only by tenant admins. The UI hiding prices is cosmetic, these
 * helpers are the hard boundary.
 *
 * Webhook fulfillment and verify-payment fulfillment are deliberately NOT
 * gated: admin grants and legacy in-flight orders must still fulfill.
 */

export const SELF_SERVE_BLOCKED_MESSAGE =
  "This store does not support self-checkout. Please contact support for access.";

const CACHE_TTL_MS = 60 * 1000;
const flagCache = new Map<string, { value: boolean; expiresAt: number }>();

async function readFlag(tenantId: string): Promise<boolean> {
  try {
    const row = await db
      .selectFrom("tenants")
      .select(["access_managed_enabled"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    return row?.access_managed_enabled === true;
  } catch (err) {
    // 42703 = undefined_column: the access-managed migration has not run yet,
    // so no tenant can possibly have the flag on, fail open ONLY for this
    // exact case (deploy-order safety). Anything else stays fail-closed.
    if ((err as { code?: string }).code === "42703") return false;
    throw err;
  }
}

/**
 * Cached flag lookup (60s TTL, same cadence as the tenant resolver and
 * currency-config caches). Use for read paths that run on every catalog
 * request (price scrubbing); NOT for the acquisition guard.
 */
export async function isAccessManaged(tenantId: string): Promise<boolean> {
  const hit = flagCache.get(tenantId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await readFlag(tenantId);
  flagCache.set(tenantId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Hard guard for user-initiated acquisition entry points. Reads the flag
 * straight from the DB (no cache): purchases are rare enough that one extra
 * query is free, and the security boundary must flip the moment the admin
 * toggles the setting.
 */
export async function assertSelfServeAllowed(tenantId: string): Promise<void> {
  if (await readFlag(tenantId)) {
    throw new ForbiddenError(SELF_SERVE_BLOCKED_MESSAGE);
  }
}

/**
 * Legacy price columns ride on many catalog/detail/search/template responses
 * under both snake_case (raw rows) and camelCase (DTO) names. Rather than
 * chasing every serializer, the response edge (sendSuccessResponse) calls this
 * for access-managed tenants: it walks the payload and nulls known price keys
 * (and empties per-currency `prices` maps) so amounts never reach the browser.
 */
const NULLED_PRICE_KEYS = new Set([
  // Raw rows + DTO casings
  "price_inr",
  "price_usd",
  "discount_inr",
  "discount_usd",
  "priceInr",
  "priceUsd",
  "discountInr",
  "discountUsd",
  // template.service page-config casings (course/book/webinar sections)
  "priceINR",
  "priceUSD",
  "discountINR",
  "discountUSD",
  "webPriceINR",
  "webPriceUSD",
  "mobilePriceINR",
  "mobilePriceUSD",
  "webDiscount",
  "mobileDiscount",
]);
const EMPTIED_PRICE_MAP_KEYS = new Set(["prices", "price_map"]);
const MAX_SCRUB_DEPTH = 12;

export function scrubPriceFields<T>(value: T, depth = 0): T {
  if (depth > MAX_SCRUB_DEPTH || value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) {
    for (const item of value) scrubPriceFields(item, depth + 1);
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (NULLED_PRICE_KEYS.has(key)) {
      record[key] = null;
    } else if (EMPTIED_PRICE_MAP_KEYS.has(key) && record[key] && typeof record[key] === "object") {
      // Preserve the container shape: per-currency maps become {}, the
      // template-service ContentPrice arrays become [].
      record[key] = Array.isArray(record[key]) ? [] : {};
    } else {
      scrubPriceFields(record[key], depth + 1);
    }
  }
  return value;
}
