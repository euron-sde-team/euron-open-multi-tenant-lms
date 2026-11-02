import type { CurrencyContext } from "@open-mtlms/shared";
import { apiGet, apiPut } from "./api-client";

/**
 * Fetch the buyer's resolved currency context from the learner-api.
 * Sends the browser timezone as a geo hint (member preference and IP-based
 * geo take precedence server-side).
 */
export const getCurrencyContext = async (): Promise<CurrencyContext> => {
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = undefined;
  }
  return apiGet<CurrencyContext>("/currency-context", tz ? { params: { tz } } : undefined);
};

/** Persist the logged-in member's currency preference; returns the refreshed context. */
export const updateCurrencyPreference = async (currency: string): Promise<CurrencyContext> =>
  apiPut<CurrencyContext>("/currency-context/preference", { currency });
