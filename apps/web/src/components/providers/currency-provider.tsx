"use client";

/**
 * CurrencyProvider resolves the buyer's display currency once per session via
 * GET /currency-context (geo > tenant country rules > tenant default) and
 * exposes it to the whole app. There is deliberately NO buyer-facing currency
 * picker: the tenant's configuration decides what each region sees, and items
 * priced only in other enabled currencies fall through the shared resolvePrice
 * chain (buyer currency > default > first priced enabled currency). For
 * INR/USD-only tenants (the virtual default) this behaves exactly like the
 * old timezone heuristic: IN -> INR, elsewhere -> USD.
 */

import { useQuery } from "@tanstack/react-query";
import React, { createContext, useContext, useMemo } from "react";
import type { CurrencyContext as CurrencyContextResponse } from "@open-mtlms/shared";
import { getCurrencyContext } from "@/lib/api/currency-context";

export interface CurrencyProviderValue {
  /** Buyer's display currency (server-resolved: geo > tenant rules > default). */
  resolvedCurrency: string;
  /** Tenant default currency (price fallback target). */
  defaultCurrency: string;
  /** Enabled currency codes for the tenant. */
  enabledCurrencies: string[];
  /** Full enabled-currency rows (code, symbol, decimals, is_default). */
  enabledCurrencyDetails: CurrencyContextResponse["enabled_currencies"];
  /** ISO-3166 alpha-2 country, when resolvable. */
  country: string | null;
  /**
   * Access-managed storefront: no pricing shown, no self-serve purchase;
   * not-owned items render Contact Support instead of a buy CTA.
   */
  accessManaged: boolean;
  /** Tenant support email (mailto target); only set when accessManaged. */
  supportEmail: string | null;
  /**
   * Whether learners can access certificates (Certificates profile tab).
   * Defaults to true, only an explicit tenant opt-out disables it.
   */
  certificatesEnabled: boolean;
  /**
   * When true, the job portal shows only organisation-posted jobs and hides
   * external job search. Defaults to false, only an explicit tenant opt-in.
   */
  /**
   * When true, learners only see enrolled courses, the public catalog / explore
   * surfaces are hidden. Defaults to false, only an explicit tenant opt-in.
   */
  enrolledCoursesOnly: boolean;
  /** True once the currency context query has settled. */
  isLoaded: boolean;
}

const FALLBACK_VALUE: CurrencyProviderValue = {
  resolvedCurrency: "USD",
  defaultCurrency: "USD",
  enabledCurrencies: [],
  enabledCurrencyDetails: [],
  country: null,
  accessManaged: false,
  supportEmail: null,
  certificatesEnabled: true,
  enrolledCoursesOnly: false,
  isLoaded: false,
};

const CurrencyReactContext = createContext<CurrencyProviderValue>(FALLBACK_VALUE);

const INDIAN_TIMEZONES = ["Asia/Calcutta", "Asia/Kolkata"];

/** Legacy timezone heuristic, used only when the context API is unreachable. */
function timezoneFallbackCurrency(): "INR" | "USD" {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return INDIAN_TIMEZONES.includes(tz) ? "INR" : "USD";
  } catch {
    return "USD";
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Short staleTime + refetch-on-focus so admin changes (currency, access-managed,
  // certificate tab) propagate to open storefront tabs within ~15s or on the next
  // focus. The learner-api's tenant cache is busted instantly via Redis pub/sub on
  // toggle, so the bound here is just how soon the client re-asks.
  const { data, isError } = useQuery({
    queryKey: ["currency-context"],
    queryFn: getCurrencyContext,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const value = useMemo<CurrencyProviderValue>(() => {
    if (data) {
      return {
        resolvedCurrency: data.currency.toUpperCase(),
        defaultCurrency: data.default_currency.toUpperCase(),
        enabledCurrencies: data.enabled_currencies.map((c) => c.code.toUpperCase()),
        enabledCurrencyDetails: data.enabled_currencies,
        country: data.country,
        accessManaged: data.access_managed === true,
        supportEmail: data.support_email ?? null,
        // Default ON: only an explicit `false` disables certificates.
        certificatesEnabled: data.certificate_tab_enabled !== false,
        // Default OFF: only an explicit `true` restricts to org-posted jobs.
        // Default OFF: only an explicit `true` restricts to enrolled courses.
        enrolledCoursesOnly: data.enrolled_courses_only_enabled === true,
        isLoaded: true,
      };
    }
    if (isError) {
      // API unreachable: preserve the legacy INR/USD timezone behavior so
      // prices still render instead of skeleton-ing forever. (Display-only
      // fail-open: the backend still 403s all purchases when access-managed.)
      const fallback = timezoneFallbackCurrency();
      return {
        resolvedCurrency: fallback,
        defaultCurrency: fallback,
        enabledCurrencies: ["INR", "USD"],
        enabledCurrencyDetails: [],
        country: null,
        accessManaged: false,
        supportEmail: null,
        certificatesEnabled: true,
        enrolledCoursesOnly: false,
        isLoaded: true,
      };
    }
    return FALLBACK_VALUE;
  }, [data, isError]);

  return <CurrencyReactContext.Provider value={value}>{children}</CurrencyReactContext.Provider>;
}

/** Full currency context (resolved/default/enabled currencies). */
export function useCurrencyContext(): CurrencyProviderValue {
  return useContext(CurrencyReactContext);
}
