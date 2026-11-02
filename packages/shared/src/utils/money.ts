/**
 * Money formatting and price resolution shared by apps/web, apps/admin, and the
 * course/book template packages.
 *
 * resolvePrice() is the frontend twin of the learner-api resolveContentPrice():
 * it merges the multi-currency price book with the legacy INR/USD fields into a
 * per-currency view, then resolves buyer currency > tenant default currency.
 * Legacy fields participate ONLY while their currency is enabled for the tenant,
 * so a tenant that disabled INR/USD never leaks those prices to buyers.
 */

import { getPlatformCurrency } from "../constants/currencies";
import type { ContentPrice } from "../types/currency";

/** Format a major-unit amount with the currency's locale, symbol, and decimals. */
export function formatMoney(
  amount: number,
  code: string,
  opts?: { alwaysShowDecimals?: boolean },
): string {
  const def = getPlatformCurrency(code);
  const decimals = def?.decimals ?? 2;
  const isWhole = Number.isInteger(amount);
  const minFractionDigits = opts?.alwaysShowDecimals ? decimals : isWhole ? 0 : decimals;
  try {
    return new Intl.NumberFormat(def?.locale ?? "en-US", {
      style: "currency",
      currency: code.toUpperCase(),
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    const symbol = def?.symbol ?? code.toUpperCase();
    return `${symbol}${amount.toLocaleString()}`;
  }
}

/**
 * Round an FX-converted suggestion to a psychologically priced value.
 * Examples: 23.41 USD -> 23.99, 1860 INR -> 1899, 3540 JPY -> 3499.
 * Display-only helper for the admin FX-suggest button; never applied at runtime.
 */
export function roundPsychological(amount: number, code: string): number {
  const def = getPlatformCurrency(code);
  const decimals = def?.decimals ?? 2;
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  if (decimals === 0) {
    if (amount >= 100) return Math.ceil(amount / 100) * 100 - 1;
    return Math.max(1, Math.round(amount));
  }

  if (amount >= 100) {
    return Math.ceil(amount / 100) * 100 - 1;
  }

  const step = Math.pow(10, -decimals);
  const charm = Math.ceil(amount) - step;
  return Number(Math.max(step, charm).toFixed(decimals));
}

export interface ResolvedPrice {
  currency: string;
  symbol: string;
  /** Effective price after discount. */
  amount: number;
  original: number;
  hasDiscount: boolean;
  /** True when resolved from the tenant default currency, not the buyer's currency. */
  isFallback: boolean;
  /**
   * How the admin expressed this discount. Storefronts use it to label the
   * saving the same way it was entered, "₹100 off" for FLAT, "10% off" for
   * PERCENTAGE, via `discountLabel()`.
   */
  discountType: DiscountType;
  /** Absolute amount saved (`original - amount`); 0 when there is no discount. */
  saved: number;
  format: (n?: number) => string;
}

export interface UnavailablePrice {
  unavailable: true;
}

/**
 * Access-managed storefront: the tenant hides all pricing and disables
 * self-serve purchase. Structurally extends UnavailablePrice on purpose.
 * consumers that have not been taught isHiddenPrice degrade to their
 * existing "not available for purchase" state (no price, no buy button)
 * instead of accidentally rendering the item as free.
 */
export interface HiddenPrice {
  hidden: true;
  unavailable: true;
}

export const HIDDEN_PRICE: HiddenPrice = { hidden: true, unavailable: true };

/** null = free; UnavailablePrice = PAID item with no price in any enabled currency. */
export type ResolvedPriceResult = ResolvedPrice | UnavailablePrice | HiddenPrice | null;

export function isUnavailablePrice(result: ResolvedPriceResult): result is UnavailablePrice {
  return result !== null && "unavailable" in result;
}

export function isHiddenPrice(result: ResolvedPriceResult): result is HiddenPrice {
  return result !== null && "hidden" in result;
}

export function isResolvedPrice(result: ResolvedPriceResult): result is ResolvedPrice {
  return result !== null && !("unavailable" in result);
}

type NumericLike = number | string | null | undefined;

/** How a discount value is read. Mirrors the DB enum `content_discount_type`. */
export type DiscountType = "PERCENTAGE" | "FLAT";

interface PriceMapEntry {
  amount?: NumericLike;
  price?: NumericLike;
  discount?: NumericLike;
  discount_percent?: NumericLike;
  /**
   * Set on price-book rows served by the learner-api. Absent on legacy-derived
   * entries and on older cached responses, where `discountMode` decides.
   */
  discount_type?: DiscountType | null;
}

export interface ResolvePriceInput {
  /** Multi-currency price book: API map keyed by currency, or admin ContentPrice array. */
  prices?: Record<string, PriceMapEntry> | ContentPrice[] | null;
  legacyInr?: NumericLike;
  legacyUsd?: NumericLike;
  legacyDiscountInr?: NumericLike;
  legacyDiscountUsd?: NumericLike;
  /** "FREE" short-circuits to null regardless of price data. */
  purchaseMode?: string | null;
  /** Discount semantics: percent (default) or flat amount (hub products). */
  discountMode?: "percent" | "amount";
}

export interface ResolvePriceContext {
  resolvedCurrency: string;
  defaultCurrency: string;
  /** Enabled currency codes; legacy INR/USD fields only count when listed here. */
  enabledCurrencies: string[];
}

function toNumber(value: NumericLike): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

/** A merged price entry. `discountType` is undefined for legacy-derived rows. */
interface EffectiveEntry {
  amount: number;
  discount: number;
  discountType?: DiscountType;
}

function normalizePrices(prices: ResolvePriceInput["prices"]): Map<string, EffectiveEntry> {
  const map = new Map<string, EffectiveEntry>();
  if (!prices) return map;
  const entries: Array<[string, PriceMapEntry]> = Array.isArray(prices)
    ? prices.map((p) => [
        p.currency,
        { amount: p.amount, discount: p.discount, discount_type: p.discount_type },
      ])
    : Object.entries(prices);
  for (const [code, entry] of entries) {
    if (!code) continue;
    const amount = toNumber(entry.amount ?? entry.price);
    // A non-positive amount means the admin left this currency blank, it is
    // NOT a price of zero. Treating it as one made a USD buyer resolve to "$0"
    // on an INR-only item instead of falling back to the priced currency.
    if (amount === null || amount <= 0) continue;
    const discount = toNumber(entry.discount ?? entry.discount_percent) ?? 0;
    const discountType =
      entry.discount_type === "FLAT" || entry.discount_type === "PERCENTAGE"
        ? entry.discount_type
        : undefined;
    map.set(code.toUpperCase(), { amount, discount, discountType });
  }
  return map;
}

function applyDiscount(
  amount: number,
  discount: number,
  mode: "percent" | "amount",
): number {
  if (discount <= 0) return amount;
  if (mode === "amount") return Math.max(0, amount - discount);
  const pct = Math.min(100, discount);
  return Math.max(0, amount * (1 - pct / 100));
}

/**
 * Which reading applies to the entry that was actually picked.
 *
 * A price-book row carries its own `discountType`, the admin chose it per item,
 * so it always wins. A legacy-derived entry has none, and falls back to the
 * caller's `discountMode` (hub call sites pass "amount", which is what their
 * legacy columns really contain). Mirrors `legacyDiscountTypeFor` on the server.
 */
function readingFor(
  entry: EffectiveEntry,
  fallback: "percent" | "amount",
): "percent" | "amount" {
  if (entry.discountType === "FLAT") return "amount";
  if (entry.discountType === "PERCENTAGE") return "percent";
  return fallback;
}

/**
 * Resolve the display price for an item under the buyer's currency context.
 * Order: effective[resolvedCurrency] > effective[defaultCurrency] (isFallback),
 * where effective merges price-book rows with enabled legacy INR/USD fields.
 */
export function resolvePrice(
  input: ResolvePriceInput,
  ctx: ResolvePriceContext,
): ResolvedPriceResult {
  if (input.purchaseMode === "FREE") return null;

  const enabled = new Set(ctx.enabledCurrencies.map((c) => c.toUpperCase()));
  const effective = normalizePrices(input.prices);

  const addLegacy = (code: "INR" | "USD", amount: NumericLike, discount: NumericLike) => {
    if (effective.has(code) || !enabled.has(code)) return;
    const parsed = toNumber(amount);
    // Same rule as the price book: blank/zero is "no price in this currency".
    // The legacy fields are especially prone to it, form defaults leave a 0
    // (or a template placeholder) behind when the admin prices only one currency.
    if (parsed === null || parsed <= 0) return;
    // No discountType: legacy columns carry no type, so `discountMode` decides.
    effective.set(code, { amount: parsed, discount: toNumber(discount) ?? 0 });
  };
  addLegacy("INR", input.legacyInr, input.legacyDiscountInr);
  addLegacy("USD", input.legacyUsd, input.legacyDiscountUsd);

  // Chain: buyer currency > tenant default > first enabled currency (in the
  // tenant's configured order) that has a price. Mirrors the server resolver:
  // an item priced in ANY enabled currency always displays and sells.
  const resolvedCode = ctx.resolvedCurrency.toUpperCase();
  const defaultCode = ctx.defaultCurrency.toUpperCase();
  let pick: { code: string; entry: EffectiveEntry; isFallback: boolean } | null = null;
  if (effective.has(resolvedCode)) {
    pick = { code: resolvedCode, entry: effective.get(resolvedCode)!, isFallback: false };
  } else if (effective.has(defaultCode)) {
    pick = { code: defaultCode, entry: effective.get(defaultCode)!, isFallback: true };
  } else {
    for (const code of ctx.enabledCurrencies) {
      const upper = code.toUpperCase();
      const entry = effective.get(upper);
      if (entry) {
        pick = { code: upper, entry, isFallback: true };
        break;
      }
    }
  }

  if (!pick) {
    return input.purchaseMode === "PAID" ? { unavailable: true } : null;
  }

  const mode = readingFor(pick.entry, input.discountMode ?? "percent");
  const original = pick.entry.amount;
  const amount = applyDiscount(original, pick.entry.discount, mode);
  const discountType: DiscountType = mode === "amount" ? "FLAT" : "PERCENTAGE";
  const def = getPlatformCurrency(pick.code);

  return {
    currency: pick.code,
    symbol: def?.symbol ?? pick.code,
    amount,
    original,
    hasDiscount: amount < original,
    isFallback: pick.isFallback,
    discountType,
    saved: Math.max(0, original - amount),
    format: (n?: number) => formatMoney(n ?? amount, pick.code),
  };
}

/**
 * The saving, labelled the way the admin entered it.
 *
 * FLAT shows the money off ("₹100 off"); PERCENTAGE shows the percentage
 * ("10% off"). A flat discount deliberately never renders as a percentage: the
 * derived figure changes every time the price is edited, so it reads as noise
 * and invites "why is my ₹100 off showing as 8%?".
 *
 * Returns null when there is nothing to advertise, so callers can render the
 * badge conditionally without repeating the guard.
 */
export function discountLabel(price: ResolvedPrice): string | null {
  if (!price.hasDiscount || price.original <= 0 || price.saved <= 0) return null;
  if (price.discountType === "FLAT") {
    return `${formatMoney(price.saved, price.currency)} off`;
  }
  const percent = Math.round((price.saved / price.original) * 100);
  return percent > 0 ? `${percent}% off` : null;
}
