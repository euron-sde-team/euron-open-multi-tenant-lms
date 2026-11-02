"use client";

import { useState, useEffect } from "react";

const INDIAN_TIMEZONES = ["Asia/Calcutta", "Asia/Kolkata"];

function getCurrencyFromTimezone(): "INR" | "USD" {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return INDIAN_TIMEZONES.includes(tz) ? "INR" : "USD";
  } catch {
    return "USD";
  }
}

/**
 * Returns "INR" for Indian timezones, "USD" for everything else.
 * Returns null on initial render (SSR), callers should show a loading
 * state until the value resolves (one frame after mount).
 */
export function usePreferredCurrency(): "INR" | "USD" | null {
  const [currency, setCurrency] = useState<"INR" | "USD" | null>(null);

  useEffect(() => {
    setCurrency(getCurrencyFromTimezone());
  }, []);

  return currency;
}
