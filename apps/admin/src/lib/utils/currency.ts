/**
 * Display-side currency helpers for the multi-currency revenue UI.
 *
 * Most backend endpoints return revenue as a `RevenueBreakdown`:
 *   { inr, usd, combined_inr, conversion_rate }
 *
 * The backend is the source of truth for the conversion rate (set by
 * USD_TO_INR_RATE env var, default 90). `FALLBACK_USD_TO_INR_RATE` here is
 * only used when a client-side helper must compute combined locally and
 * no server value is available.
 */

export const FALLBACK_USD_TO_INR_RATE = 90;

export interface RevenueBreakdown {
  inr: number;
  usd: number;
  combined_inr: number;
  conversion_rate: number;
}

export function isRevenueBreakdown(value: unknown): value is RevenueBreakdown {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.inr === "number" &&
    typeof v.usd === "number" &&
    typeof v.combined_inr === "number" &&
    typeof v.conversion_rate === "number"
  );
}

/** Format an INR amount using Indian locale (no decimals for large values). */
export function formatInr(amount: number): string {
  if (!Number.isFinite(amount)) return "₹0";
  const rounded = Math.abs(amount) >= 100 ? Math.round(amount) : amount;
  return `₹${rounded.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

/** Format a USD amount using US locale. */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "$0";
  return `$${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
}

/** Format an arbitrary currency + amount pair (fallback: `<code> <amount>`). */
export function formatAmountWithCurrency(amount: number, currency: string): string {
  if (currency === "INR") return formatInr(amount);
  if (currency === "USD") return formatUsd(amount);
  return `${currency} ${amount.toLocaleString()}`;
}

/** Combine split INR + USD into a single INR-normalized value. */
export function combinedInInr(
  inr: number,
  usd: number,
  rate = FALLBACK_USD_TO_INR_RATE,
): number {
  return (Number.isFinite(inr) ? inr : 0) + (Number.isFinite(usd) ? usd : 0) * rate;
}

/**
 * Build a RevenueBreakdown from raw INR/USD values (useful when a legacy
 * endpoint hasn't been updated yet). Always prefer the server's shape if
 * it provides one.
 */
export function makeBreakdown(
  inr: number,
  usd: number,
  rate = FALLBACK_USD_TO_INR_RATE,
): RevenueBreakdown {
  return {
    inr: Number.isFinite(inr) ? inr : 0,
    usd: Number.isFinite(usd) ? usd : 0,
    combined_inr: combinedInInr(inr, usd, rate),
    conversion_rate: rate,
  };
}

export const COMBINED_REVENUE_SUBNOTE = (rate: number) =>
  `Expected revenue after converting USD at 1 USD = ₹${rate}. For exact amounts, check your payment gateway.`;
