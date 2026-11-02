import { useState, useEffect } from "react";

const INDIAN_TIMEZONES = ["Asia/Calcutta", "Asia/Kolkata"];

function getCurrencyFromTimezone(): "INR" | "USD" {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return INDIAN_TIMEZONES.includes(tz) ? "INR" : "USD";
  } catch {
    return "INR";
  }
}

/**
 * Returns "INR" for Indian timezones, "USD" for everything else.
 * Uses "INR" for initial render (SSR + hydration) to avoid hydration mismatch,
 * then switches to timezone-based value after mount.
 */
export function useCurrency(): "INR" | "USD" {
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");

  useEffect(() => {
    setCurrency(getCurrencyFromTimezone());
  }, []);

  return currency;
}
