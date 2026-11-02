import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import exchangeRatesRepository from "../repositories/exchange-rates.repository";
import logger from "../utils/logger";

interface ExchangeRateResult {
  rate: number;
  source: string;
  fetchedAt: Date;
}

interface RateTable {
  rates: Record<string, number>;
  base: string;
  fetchedAt: Date;
  source: string;
}

/**
 * FX rates, cached in the DATABASE rather than in process memory.
 *
 * This mirrors what the original platform has always done (a scheduled fetch of the
 * keyless exchangerate-api.com endpoint, persisted to a table, readers taking
 * the newest row). The database being the cache is what makes it correct here:
 * every cluster worker sees the same rate, it survives restarts, and the history
 * lets a withdrawal statement be re-derived from the rate that was in force when
 * it was raised.
 *
 * The keyless provider is the default precisely so no API key is required.
 * OPEN_EXCHANGE_RATES_API_KEY remains supported and takes precedence when set.
 */

/** Base of the persisted table. The provider quotes everything against USD. */
const BASE = "USD";

/** In-process memo, purely to stop a burst of calls hitting the DB per lookup. */
const MEMO_TTL_MS = 5 * 60 * 1000;

/** Persisted rates older than this are refreshed inline on the next lookup. */
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

/** Keyless. This is the endpoint the original platform has used in production. */
const KEYLESS_URL = `https://api.exchangerate-api.com/v4/latest/${BASE}`;

/**
 * Last-resort table, used only when the provider is unreachable AND nothing has
 * ever been persisted. Deliberately labelled so it can never be mistaken for a
 * real quote on an accountant-facing screen.
 */
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5, JPY: 149.5,
  CAD: 1.36, AUD: 1.53, CHF: 0.88, CNY: 7.24, SGD: 1.34,
};
const FALLBACK_SOURCE = "fallback-fixed";

let memo: RateTable | null = null;

class ExchangeRateService {
  /**
   * Rate to convert one unit of `from` into `to`.
   * Signature is unchanged; only where the numbers come from has changed.
   */
  async getRate(from: string, to: string): Promise<ExchangeRateResult> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    if (fromUpper === toUpper) {
      return { rate: 1, source: "identity", fetchedAt: new Date() };
    }

    const table = await this.getTable();
    const fromRate = fromUpper === table.base ? 1 : table.rates[fromUpper];
    const toRate = toUpper === table.base ? 1 : table.rates[toUpper];

    if (!fromRate || !toRate) {
      throw new BadRequestError(
        `Exchange rate not available for ${fromUpper} to ${toUpper}. Please use a supported currency.`,
      );
    }

    return {
      rate: Math.round((toRate / fromRate) * 1_000_000) / 1_000_000,
      source: table.source,
      fetchedAt: table.fetchedAt,
    };
  }

  /**
   * Fetch from the provider and append to the rate history. Called by the
   * scheduled refresh, and inline when the persisted table is stale or absent.
   * Returns null when the provider could not be reached.
   */
  async refresh(): Promise<RateTable | null> {
    const fetched = await this.fetchFromProvider();
    if (!fetched) return null;

    try {
      const written = await exchangeRatesRepository.appendTable(
        BASE,
        fetched.rates,
        fetched.source,
        fetched.fetchedAt,
      );
      logger.info(
        `[exchange-rate] refreshed ${written} ${BASE} rates from ${fetched.source}`,
      );
    } catch (err) {
      // A persistence failure must not make the freshly fetched rates unusable.
      logger.error("[exchange-rate] failed to persist rates", err);
    }

    memo = fetched;
    return fetched;
  }

  /** Resolve a usable rate table: memo, then persisted, then live, then fallback. */
  private async getTable(): Promise<RateTable> {
    if (memo && Date.now() - memo.fetchedAt.getTime() < MEMO_TTL_MS) {
      return memo;
    }

    let persisted: RateTable | null = null;
    try {
      const rows = await exchangeRatesRepository.getLatestTable(BASE);
      if (rows.length > 0) {
        const newest = rows.reduce(
          (max, r) => (r.fetched_at > max ? r.fetched_at : max),
          rows[0].fetched_at,
        );
        persisted = {
          base: BASE,
          rates: Object.fromEntries(rows.map((r) => [r.quote_currency, r.rate])),
          fetchedAt: newest,
          source: rows[0].source,
        };
      }
    } catch (err) {
      logger.error("[exchange-rate] failed to read persisted rates", err);
    }

    if (
      persisted !== null &&
      Date.now() - persisted.fetchedAt.getTime() < STALE_AFTER_MS
    ) {
      memo = persisted;
      return persisted;
    }

    // Stale or missing: try to refresh inline, but never fail the caller over it.
    const refreshed = await this.refresh();
    if (refreshed) return refreshed;

    if (persisted) {
      logger.warn(
        "[exchange-rate] provider unreachable, serving stale persisted rates",
      );
      memo = persisted;
      return persisted;
    }

    logger.warn("[exchange-rate] no persisted rates and provider unreachable");
    return {
      base: BASE,
      rates: FALLBACK_RATES,
      fetchedAt: new Date(),
      source: FALLBACK_SOURCE,
    };
  }

  private async fetchFromProvider(): Promise<RateTable | null> {
    const key = config.OPEN_EXCHANGE_RATES_API_KEY;
    const url = key
      ? `https://openexchangerates.org/api/latest.json?app_id=${key}`
      : KEYLESS_URL;
    const source = key ? "openexchangerates.org" : "exchangerate-api.com";

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Exchange rate API returned ${response.status}`);
      }
      const data = (await response.json()) as {
        base?: string;
        rates?: Record<string, number>;
      };
      const rates = data.rates ?? {};
      if (Object.keys(rates).length === 0) {
        throw new Error("Exchange rate API returned no rates");
      }
      // Both providers quote against USD; guard in case that ever changes.
      if (data.base && data.base.toUpperCase() !== BASE) {
        throw new Error(`Unexpected base currency ${data.base} (expected ${BASE})`);
      }
      return { base: BASE, rates, fetchedAt: new Date(), source };
    } catch (err) {
      logger.error(`[exchange-rate] fetch from ${source} failed`, err);
      return null;
    }
  }
}

const exchangeRateService = new ExchangeRateService();
export default exchangeRateService;
