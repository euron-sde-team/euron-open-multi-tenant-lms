/**
 * Resolve a test series' display price.
 *
 * Thin wrapper over the shared resolvePrice() so test series participate in
 * multi-currency resolution (buyer currency > tenant default) while keeping
 * the original return shape consumed by the catalog and detail pages.
 *
 * Returns null when the series is FREE or has no usable price in any enabled
 * currency. Otherwise returns the effective (after-discount) price plus the
 * original price if a discount applies, plus the currency symbol and a
 * symbol-less number formatter.
 */

import {
  discountLabel,
  getPlatformCurrency,
  isResolvedPrice,
  resolvePrice,
  type ResolvePriceContext,
} from "@open-mtlms/shared";

export interface TestSeriesPriceParts {
  currency: string;
  symbol: string;
  effective: number;
  original: number;
  hasDiscount: boolean;
  /** Saving labelled as entered: "₹100 off" (FLAT) or "10% off". */
  savingLabel: string | null;
  format: (n: number) => string;
}

export function resolveTestSeriesPrice(
  input: {
    pricingType: string;
    priceInr: string | null;
    priceUsd: string | null;
    discountInr: string | null;
    discountUsd: string | null;
    prices?: Record<string, { amount: number | string; discount?: number | string | null }> | null;
  },
  ctx: ResolvePriceContext,
): TestSeriesPriceParts | null {
  if (input.pricingType !== "PAID") return null;

  const result = resolvePrice(
    {
      prices: input.prices ?? null,
      legacyInr: input.priceInr,
      legacyUsd: input.priceUsd,
      legacyDiscountInr: input.discountInr,
      legacyDiscountUsd: input.discountUsd,
      purchaseMode: "PAID",
    },
    ctx,
  );
  if (!isResolvedPrice(result) || result.original <= 0) return null;

  const def = getPlatformCurrency(result.currency);
  const format = (n: number) => {
    try {
      return new Intl.NumberFormat(def?.locale ?? "en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: def?.decimals ?? 2,
      }).format(n);
    } catch {
      return n.toLocaleString();
    }
  };

  return {
    currency: result.currency,
    symbol: result.symbol,
    effective: result.amount,
    original: result.original,
    hasDiscount: result.hasDiscount,
    // "₹100 off" for a flat discount, "10% off" for a percentage.
    savingLabel: discountLabel(result),
    format,
  };
}
