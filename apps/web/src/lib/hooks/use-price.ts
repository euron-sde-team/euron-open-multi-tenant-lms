"use client";

import {
  HIDDEN_PRICE,
  resolvePrice,
  type ResolvePriceInput,
  type ResolvedPriceResult,
} from "@open-mtlms/shared";
import { useCurrencyContext } from "@/components/providers/currency-provider";

/**
 * Resolve an item's display price under the buyer's currency context.
 * Returns null while the context is still loading (callers keep their
 * skeleton-while-null patterns). Once loaded, returns the shared
 * ResolvedPriceResult: ResolvedPrice, { unavailable: true } for PAID items
 * with no price in any enabled currency, or null for free items.
 *
 * Access-managed storefront: every item (including free ones, free
 * self-enroll is blocked too) resolves to the HIDDEN_PRICE sentinel.
 * Check isHiddenPrice() and render <AccessManagedCta /> instead of a price;
 * un-migrated consumers safely fall into their "unavailable" branch.
 */
export function usePrice(input: ResolvePriceInput): ResolvedPriceResult | null {
  const { resolvedCurrency, defaultCurrency, enabledCurrencies, accessManaged, isLoaded } =
    useCurrencyContext();
  if (!isLoaded) return null;
  if (accessManaged) return HIDDEN_PRICE;
  return resolvePrice(input, { resolvedCurrency, defaultCurrency, enabledCurrencies });
}
