/**
 * In-memory cached exchange rates (base USD) from exchangerate-api.com free v4 tier
 * (no API key needed). Cache TTL: 6 hours. When the API is unreachable the last good
 * table (or a small fixed fallback table) keeps serving, so lookups only throw for
 * currencies absent from both.
 */

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const API_URL = "https://api.exchangerate-api.com/v4/latest/USD";

/** Last-resort static rates (base USD) used until the API responds once. */
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  INR: 85,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  MAD: 10,
  SGD: 1.34,
  JPY: 149.5,
  AUD: 1.53,
  CAD: 1.36,
};

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number; // 0 = fallback table, never fetched
  source: string;
}

let cached: CachedRates = { rates: FALLBACK_RATES, fetchedAt: 0, source: "fallback-fixed" };
let fetchPromise: Promise<CachedRates> | null = null;

async function fetchRates(): Promise<CachedRates> {
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number> };
      if (data?.rates && typeof data.rates.INR === "number" && data.rates.INR > 0) {
        cached = { rates: data.rates, fetchedAt: Date.now(), source: "exchangerate-api.com" };
      }
    }
  } catch {
    // Keep serving the previous cache/fallback rates.
  }
  return cached;
}

async function getRates(): Promise<CachedRates> {
  if (cached.fetchedAt > 0 && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached;
  }

  // Deduplicate concurrent fetches
  if (!fetchPromise) {
    fetchPromise = fetchRates().finally(() => {
      fetchPromise = null;
    });
  }

  return fetchPromise;
}

export interface ExchangeRateResult {
  rate: number;
  source: string;
  fetchedAt: Date;
}

/**
 * Cross rate between two currencies via the USD-based table. Throws when either
 * code is unknown to both the API and the fallback table; callers treating FX as
 * best-effort (order snapshots) must wrap in try/catch.
 */
export async function getRate(from: string, to: string): Promise<ExchangeRateResult> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  if (fromUpper === toUpper) {
    return { rate: 1, source: "identity", fetchedAt: new Date() };
  }

  const { rates, fetchedAt, source } = await getRates();
  const fromRate = rates[fromUpper];
  const toRate = rates[toUpper];
  if (!fromRate || !toRate) {
    throw new Error(`Exchange rate not available for ${fromUpper} to ${toUpper}`);
  }

  return {
    rate: Math.round((toRate / fromRate) * 1_000_000) / 1_000_000,
    source,
    fetchedAt: new Date(fetchedAt || Date.now()),
  };
}

/** Legacy wrapper kept for existing callers (AI wallet billing, withdrawal checks). */
export async function getUsdToInrRate(): Promise<number> {
  try {
    return (await getRate("USD", "INR")).rate;
  } catch {
    return FALLBACK_RATES.INR;
  }
}
