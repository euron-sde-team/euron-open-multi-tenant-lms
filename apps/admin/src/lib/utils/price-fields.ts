/**
 * Adapters between the multi-currency price book (ContentPrice[]) and the
 * legacy INR/USD column pairs every content form still sends alongside it.
 */

import type { ContentPrice } from "@open-mtlms/shared";

export interface LegacyPriceFields {
  inr: number | null;
  usd: number | null;
  discountInr: number | null;
  discountUsd: number | null;
}

/**
 * Extract the legacy INR/USD fields from a price book.
 * Missing entries (or non-positive amounts) become null so callers can keep
 * the existing "null/0 when absent" save conventions.
 */
export function pricesToLegacy(prices: ContentPrice[]): LegacyPriceFields {
  const find = (code: string) =>
    prices.find((p) => p.currency?.toUpperCase() === code);
  const inr = find("INR");
  const usd = find("USD");
  const amountOrNull = (p: ContentPrice | undefined) =>
    p && Number.isFinite(p.amount) && p.amount > 0 ? p.amount : null;
  const discountOrNull = (p: ContentPrice | undefined) =>
    p && p.discount != null && Number.isFinite(p.discount) && p.discount > 0
      ? p.discount
      : null;
  return {
    inr: amountOrNull(inr),
    usd: amountOrNull(usd),
    discountInr: discountOrNull(inr),
    discountUsd: discountOrNull(usd),
  };
}

type NumericLike = number | string | null | undefined;

function toNumber(value: NumericLike): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build a price book from legacy INR/USD fields, for records that predate
 * the `prices` array. Only currencies with a positive amount are included.
 *
 * `discount_type` is deliberately NOT set. The legacy columns carry no type, so
 * the correct reading depends on the entity, and both layers already agree on
 * that fallback: MultiCurrencyPriceEditor derives it from its `discountMode`
 * prop, and the backend's `resolveDiscountType` uses the same entity-type rule
 * for a payload without the field. Inventing a value here would override both.
 */
export function legacyToPrices(
  inr: NumericLike,
  usd: NumericLike,
  discountInr?: NumericLike,
  discountUsd?: NumericLike
): ContentPrice[] {
  const prices: ContentPrice[] = [];
  const inrAmount = toNumber(inr);
  const usdAmount = toNumber(usd);
  if (inrAmount > 0) {
    const d = toNumber(discountInr);
    prices.push({ currency: "INR", amount: inrAmount, discount: d > 0 ? d : null });
  }
  if (usdAmount > 0) {
    const d = toNumber(discountUsd);
    prices.push({ currency: "USD", amount: usdAmount, discount: d > 0 ? d : null });
  }
  return prices;
}

/** One currency row of a tenant's currency settings, as the editors receive it. */
interface CurrencySettingLike {
  currency: string;
  is_default: boolean;
}

/**
 * Structural shape of `TemplatePriceParts`, course-, book- and
 * webinar-templates each export their own identical copy, so this helper
 * returns the shape rather than importing any one of them.
 */
export interface EditorPreviewPriceParts {
  currency: string;
  symbol: string;
  amount: number;
  original: number;
  hasDiscount: boolean;
  discountType?: "PERCENTAGE" | "FLAT";
  additionalPrices?: Array<{ currency: string; label: string }>;
}

/**
 * Build the admin editor's preview price parts from a price book: primary =
 * tenant default currency, every other configured price on the muted "Also
 * priced" line. Buyers get a single geo-resolved price instead; this never
 * affects the storefront. Returns null when no price book exists yet, so
 * templates fall back to the legacy INR/USD math.
 *
 * The discount is read according to each row's `discount_type`, matching
 * `resolvePrice` in @open-mtlms/shared and the server's price resolver, a FLAT row
 * subtracts, a PERCENTAGE row scales. This was three hand-copied percent-only
 * inline blocks (course/book/webinar editors); they silently rendered a ₹100
 * flat discount on a ₹400 item as 100% off (₹0). Keep it in one place.
 */
export function buildEditorPreviewPriceParts(
  prices: ContentPrice[] | undefined,
  currencies: CurrencySettingLike[] | undefined,
  formatters: {
    getCurrencySymbol: (code: string) => string;
    formatMoney: (amount: number, currency: string) => string;
  },
  /** Fallback for rows with no stored type: "amount" (flat) for hub products. */
  discountMode: "percent" | "amount" = "percent"
): EditorPreviewPriceParts | null {
  const enabled = new Set((currencies ?? []).map((c) => c.currency.toUpperCase()));
  const book = (prices ?? []).filter(
    (p) => p.amount > 0 && (enabled.size === 0 || enabled.has(p.currency?.toUpperCase()))
  );
  if (book.length === 0) return null;

  const isFlat = (p: ContentPrice) => {
    if (p.discount_type === "FLAT") return true;
    if (p.discount_type === "PERCENTAGE") return false;
    return discountMode === "amount";
  };
  const effectiveAmount = (p: ContentPrice) => {
    const discount = p.discount ?? 0;
    if (discount <= 0) return p.amount;
    return isFlat(p)
      ? Math.max(0, p.amount - discount)
      : Math.max(0, p.amount * (1 - Math.min(100, discount) / 100));
  };

  const defaultCode = currencies?.find((c) => c.is_default)?.currency?.toUpperCase();
  const primary = book.find((p) => p.currency?.toUpperCase() === defaultCode) ?? book[0];
  const primaryFinal = effectiveAmount(primary);

  return {
    currency: primary.currency,
    symbol: formatters.getCurrencySymbol(primary.currency),
    amount: primaryFinal,
    original: primary.amount,
    hasDiscount: primaryFinal < primary.amount,
    discountType: isFlat(primary) ? "FLAT" : "PERCENTAGE",
    additionalPrices: book
      .filter((p) => p !== primary)
      .map((p) => ({
        currency: p.currency,
        label: formatters.formatMoney(effectiveAmount(p), p.currency),
      })),
  };
}
