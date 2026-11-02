/**
 * Multi-currency revenue helpers for the tenant admin dashboard.
 *
 * Payments in `payment_orders` are stored with their original currency
 * (INR or USD). Revenue totals must be reported per-currency so admins
 * see the actual takings, plus an optional "combined" number normalized
 * to INR using a fixed display rate. The combined value is advisory.
 * payouts and accounting should rely on the payment gateway, not this.
 */

import config from "../config";

const parsed = parseFloat(String(config.USD_TO_INR_RATE));
export const USD_TO_INR_RATE: number =
  Number.isFinite(parsed) && parsed > 0 ? parsed : 90;

/** Convert a single amount in `currency` to INR using the fixed rate. */
export function normalizeToInr(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) return 0;
  if (currency === "INR") return amount;
  if (currency === "USD") return amount * USD_TO_INR_RATE;
  // Unknown currencies are treated as already-INR to avoid silent inflation.
  return amount;
}

/** Combine separate INR and USD totals into a single INR-normalized number. */
export function combinedInInr(inr: number, usd: number): number {
  const a = Number.isFinite(inr) ? inr : 0;
  const b = Number.isFinite(usd) ? usd : 0;
  return a + b * USD_TO_INR_RATE;
}

/**
 * Standard shape every revenue-returning endpoint should use. Frontends
 * can render INR / USD / Combined consistently without per-endpoint knowledge.
 */
export interface RevenueBreakdown {
  inr: number;
  usd: number;
  /** inr + usd * USD_TO_INR_RATE, display only, not for accounting. */
  combined_inr: number;
  /** Echoed so the UI can show the rate in use and update when it changes. */
  conversion_rate: number;
}

export function makeRevenueBreakdown(inr: number, usd: number): RevenueBreakdown {
  const i = Number.isFinite(inr) ? inr : 0;
  const u = Number.isFinite(usd) ? usd : 0;
  return {
    inr: i,
    usd: u,
    combined_inr: combinedInInr(i, u),
    conversion_rate: USD_TO_INR_RATE,
  };
}
