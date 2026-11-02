"use client";

import { useCurrencyContext } from "@/components/providers/currency-provider";

export { useCurrencyContext };

/**
 * Returns the buyer's resolved display currency code ("INR", "USD", "AED", ...).
 * Returns null until the currency context loads, callers should show a
 * loading state until the value resolves (same contract as the old
 * timezone-based hook). For INR/USD-only tenants the resolved value matches
 * the legacy behavior: India -> INR, everywhere else -> USD.
 */
export function useCurrency(): string | null {
  const { resolvedCurrency, isLoaded } = useCurrencyContext();
  return isLoaded ? resolvedCurrency : null;
}
