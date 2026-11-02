import { sql } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";

export interface PersistedRate {
  quote_currency: string;
  rate: number;
  source: string;
  fetched_at: Date;
}

/**
 * Persisted FX rates. The database is the cache: every cluster worker reads the
 * same rate and it survives restarts, which an in-process cache cannot do. Rows
 * are appended rather than overwritten so a withdrawal statement can always be
 * re-derived from the rate that was actually in force when it was raised.
 */
class ExchangeRatesRepository {
  /** Newest rate per quote currency for one base. */
  async getLatestTable(baseCurrency: string): Promise<PersistedRate[]> {
    const rows = await db
      .selectFrom("platform_exchange_rates")
      .select(["quote_currency", "rate", "source", "fetched_at"])
      .distinctOn("quote_currency")
      .where("base_currency", "=", baseCurrency)
      .orderBy("quote_currency")
      .orderBy("fetched_at", "desc")
      .execute();

    return rows.map((r) => ({
      quote_currency: r.quote_currency,
      rate: parseFloat(String(r.rate)),
      source: r.source,
      fetched_at: new Date(r.fetched_at),
    }));
  }

  /**
   * Append one row per quote currency for a single fetch. All rows share the
   * same `fetched_at` so a table read is always internally consistent: a reader
   * can never mix half of today's rates with half of yesterday's.
   */
  async appendTable(
    baseCurrency: string,
    rates: Record<string, number>,
    source: string,
    fetchedAt: Date,
  ): Promise<number> {
    const values = Object.entries(rates)
      .filter(([code, rate]) => code && Number.isFinite(rate) && rate > 0)
      .map(([code, rate]) => ({
        id: ulid(),
        base_currency: baseCurrency,
        quote_currency: code.toUpperCase(),
        rate: String(rate),
        source,
        fetched_at: fetchedAt,
        created_at: fetchedAt,
      }));

    if (values.length === 0) return 0;

    await db.insertInto("platform_exchange_rates").values(values).execute();
    return values.length;
  }

  /**
   * Drop rate history older than `days`, keeping at least the newest row per
   * pair so a purge can never leave the table unable to answer a lookup.
   */
  async purgeOlderThan(days: number): Promise<number> {
    const result = await sql<{ count: string }>`
      with ranked as (
        select id, row_number() over (
                 partition by base_currency, quote_currency
                 order by fetched_at desc
               ) as rn
          from platform_exchange_rates
      )
      delete from platform_exchange_rates p
       using ranked r
       where p.id = r.id
         and r.rn > 1
         and p.fetched_at < now() - ${sql.lit(days)} * interval '1 day'
      returning p.id
    `.execute(db);
    return result.rows.length;
  }
}

export default new ExchangeRatesRepository();
