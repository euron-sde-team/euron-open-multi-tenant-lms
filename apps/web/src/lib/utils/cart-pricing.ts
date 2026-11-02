/**
 * Cart/checkout price resolution shared by the cart page and the checkout
 * page. Resolves each cart item via the shared resolvePrice() and computes the
 * effective checkout currency: if ANY purchasable item only resolves via the
 * tenant default currency (isFallback), the WHOLE order is charged in the
 * default currency so all line items share one currency.
 */

import {
  isResolvedPrice,
  resolvePrice,
  type ResolvePriceContext,
  type ResolvedPriceResult,
} from "@open-mtlms/shared";
import type { CartItemResponse } from "@/lib/api/cart";

export function resolveCartItemPrice(
  item: CartItemResponse,
  ctx: ResolvePriceContext,
): ResolvedPriceResult {
  return resolvePrice(
    {
      prices:
        (item as {
          prices?: Record<string, { amount: number | string; discount?: number | string | null }> | null;
        }).prices ?? null,
      legacyInr: item.price_inr,
      legacyUsd: item.price_usd,
      legacyDiscountInr: item.discount_inr,
      legacyDiscountUsd: item.discount_usd,
      purchaseMode: item.purchase_mode,
    },
    ctx,
  );
}

/**
 * Effective checkout currency, mirroring the server cart rule: the FIRST
 * currency (buyer currency > tenant default > remaining enabled currencies in
 * the tenant's configured order) in which EVERY purchasable item has a price.
 * Free items are compatible with any currency. When no single currency covers
 * the whole cart, the buyer currency is kept and the server rejects checkout
 * with an item-naming error (the page already marks unpriceable items).
 */
export function computeEffectiveCurrency(
  purchasableItems: CartItemResponse[],
  ctx: ResolvePriceContext,
): { effectiveCurrency: string; forcedToDefault: boolean } {
  const candidates = [
    ...new Set([
      ctx.resolvedCurrency.toUpperCase(),
      ctx.defaultCurrency.toUpperCase(),
      ...ctx.enabledCurrencies.map((c) => c.toUpperCase()),
    ]),
  ];

  const coversAll = (candidate: string) =>
    purchasableItems.every((item) => {
      const result = resolveCartItemPrice(item, { ...ctx, resolvedCurrency: candidate });
      if (result === null) return true; // free item: any currency works
      return isResolvedPrice(result) && result.currency === candidate;
    });

  for (const candidate of candidates) {
    if (coversAll(candidate)) {
      return {
        effectiveCurrency: candidate,
        forcedToDefault: candidate !== ctx.resolvedCurrency.toUpperCase(),
      };
    }
  }
  return { effectiveCurrency: ctx.resolvedCurrency, forcedToDefault: false };
}

/**
 * Per-item coupon discount in the effective currency. Backend exposes legacy
 * INR/USD fields; a per-currency map is read defensively when present.
 */
export function cartItemCouponDiscount(item: CartItemResponse, currency: string): number {
  if (!item.coupon_valid) return 0;
  const code = currency.toUpperCase();
  const extra = item as { coupon_discounts?: Record<string, number> | null };
  const fromMap = extra.coupon_discounts?.[code] ?? extra.coupon_discounts?.[currency];
  if (typeof fromMap === "number") return fromMap;
  if (code === "USD") return item.coupon_discount_usd;
  if (code === "INR") return item.coupon_discount_inr;
  return 0;
}
