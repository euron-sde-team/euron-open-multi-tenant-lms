import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { db } from "../db/connection";
import type { content_discount_type, price_entity_type } from "../db/enums";
import type { DB } from "../db/types";

export interface ContentPriceRow {
  currency: string;
  amount: string;
  discount: string;
  discount_type: content_discount_type;
}

export interface ContentPriceInput {
  currency: string;
  amount: number;
  discount: number;
  /**
   * How `discount` is read. All rows for one entity carry the same value.
   * content-prices.service enforces that; the column lives here because the
   * price resolver reads it off whichever row it picks.
   */
  discount_type: content_discount_type;
}

export interface CoverageTargetResult {
  entity_type: price_entity_type;
  missing_count: number;
  sample: Array<{ id: string; title: string }>;
}

/**
 * Content tables that carry pricing. paid column/value are trusted constants
 * (interpolated via sql.raw); never feed user input into this list.
 */
const COVERAGE_TARGETS: Array<{
  entityType: price_entity_type;
  table: string;
  paidColumn: string;
  paidValue: string;
}> = [
  { entityType: "COURSE", table: "courses", paidColumn: "purchase_mode", paidValue: "PAID" },
  { entityType: "BOOK", table: "books", paidColumn: "purchase_mode", paidValue: "PAID" },
  { entityType: "BUNDLE", table: "bundles", paidColumn: "purchase_mode", paidValue: "PAID" },
  { entityType: "BATCH", table: "batches", paidColumn: "purchase_mode", paidValue: "PAID" },
  { entityType: "TEST_SERIES", table: "test_series", paidColumn: "pricing_type", paidValue: "PAID" },
];

class ContentPricesRepository {
  async listByEntity(
    tenantId: string,
    entityType: price_entity_type,
    entityId: string,
    trx?: Transaction<DB>,
  ): Promise<ContentPriceRow[]> {
    const rows = await (trx || db)
      .selectFrom("content_prices")
      .select(["currency", "amount", "discount", "discount_type"])
      .where("tenant_id", "=", tenantId)
      .where("entity_type", "=", entityType)
      .where("entity_id", "=", entityId)
      .orderBy("currency", "asc")
      .execute();
    return rows.map((r) => ({
      currency: r.currency,
      amount: String(r.amount),
      discount: String(r.discount),
      discount_type: r.discount_type,
    }));
  }

  /** Bulk fetch for list screens; returns a map keyed by entity_id. */
  async listByEntities(
    tenantId: string,
    entityType: price_entity_type,
    entityIds: string[],
  ): Promise<Map<string, ContentPriceRow[]>> {
    const map = new Map<string, ContentPriceRow[]>();
    if (entityIds.length === 0) return map;
    const rows = await db
      .selectFrom("content_prices")
      .select(["entity_id", "currency", "amount", "discount", "discount_type"])
      .where("tenant_id", "=", tenantId)
      .where("entity_type", "=", entityType)
      .where("entity_id", "in", entityIds)
      .execute();
    for (const r of rows) {
      const list = map.get(r.entity_id) ?? [];
      list.push({
        currency: r.currency,
        amount: String(r.amount),
        discount: String(r.discount),
        discount_type: r.discount_type,
      });
      map.set(r.entity_id, list);
    }
    return map;
  }

  /** Delete-missing + upsert so the rows exactly mirror the provided list. */
  async syncForEntity(
    tenantId: string,
    entityType: price_entity_type,
    entityId: string,
    rows: ContentPriceInput[],
    trx: Transaction<DB>,
  ): Promise<void> {
    const codes = rows.map((r) => r.currency);
    let deleteQuery = trx
      .deleteFrom("content_prices")
      .where("tenant_id", "=", tenantId)
      .where("entity_type", "=", entityType)
      .where("entity_id", "=", entityId);
    if (codes.length > 0) {
      deleteQuery = deleteQuery.where("currency", "not in", codes);
    }
    await deleteQuery.execute();

    if (rows.length === 0) return;
    const now = new Date();
    await trx
      .insertInto("content_prices")
      .values(
        rows.map((r) => ({
          id: ulid(),
          tenant_id: tenantId,
          entity_type: entityType,
          entity_id: entityId,
          currency: r.currency,
          amount: r.amount.toFixed(2),
          discount: r.discount.toFixed(2),
          discount_type: r.discount_type,
          created_at: now,
          updated_at: now,
        })),
      )
      .onConflict((oc) =>
        oc.columns(["tenant_id", "entity_type", "entity_id", "currency"]).doUpdateSet({
          amount: (eb) => eb.ref("excluded.amount"),
          discount: (eb) => eb.ref("excluded.discount"),
          discount_type: (eb) => eb.ref("excluded.discount_type"),
          updated_at: now,
        }),
      )
      .execute();
  }

  /**
   * Partial upsert for legacy-only writers: upserts the given rows and removes
   * only the listed currencies, leaving rows in other currencies untouched
   * (unlike syncForEntity, which mirrors the full list).
   */
  async upsertPartial(
    tenantId: string,
    entityType: price_entity_type,
    entityId: string,
    upserts: ContentPriceInput[],
    removeCurrencies: string[],
    trx: Transaction<DB>,
  ): Promise<void> {
    if (removeCurrencies.length > 0) {
      await trx
        .deleteFrom("content_prices")
        .where("tenant_id", "=", tenantId)
        .where("entity_type", "=", entityType)
        .where("entity_id", "=", entityId)
        .where("currency", "in", removeCurrencies)
        .execute();
    }
    if (upserts.length === 0) return;
    const now = new Date();
    await trx
      .insertInto("content_prices")
      .values(
        upserts.map((r) => ({
          id: ulid(),
          tenant_id: tenantId,
          entity_type: entityType,
          entity_id: entityId,
          currency: r.currency,
          amount: r.amount.toFixed(2),
          discount: r.discount.toFixed(2),
          discount_type: r.discount_type,
          created_at: now,
          updated_at: now,
        })),
      )
      .onConflict((oc) =>
        oc.columns(["tenant_id", "entity_type", "entity_id", "currency"]).doUpdateSet({
          amount: (eb) => eb.ref("excluded.amount"),
          discount: (eb) => eb.ref("excluded.discount"),
          discount_type: (eb) => eb.ref("excluded.discount_type"),
          updated_at: now,
        }),
      )
      .execute();
  }

  async deleteByEntity(
    tenantId: string,
    entityType: price_entity_type,
    entityId: string,
    trx?: Transaction<DB>,
  ): Promise<void> {
    await (trx || db)
      .deleteFrom("content_prices")
      .where("tenant_id", "=", tenantId)
      .where("entity_type", "=", entityType)
      .where("entity_id", "=", entityId)
      .execute();
  }

  /** Used when a tenant disables currencies in settings. */
  async deleteByCurrencies(
    tenantId: string,
    currencies: string[],
    trx?: Transaction<DB>,
  ): Promise<number> {
    if (currencies.length === 0) return 0;
    const result = await (trx || db)
      .deleteFrom("content_prices")
      .where("tenant_id", "=", tenantId)
      .where("currency", "in", currencies)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }

  /** Dry-run impact counts for the settings confirmation dialog. */
  async countByCurrencies(
    tenantId: string,
    currencies: string[],
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    if (currencies.length === 0) return counts;
    const rows = await db
      .selectFrom("content_prices")
      .select(["currency", (eb) => eb.fn.countAll<string>().as("total")])
      .where("tenant_id", "=", tenantId)
      .where("currency", "in", currencies)
      .groupBy("currency")
      .execute();
    for (const code of currencies) counts[code] = 0;
    for (const r of rows) counts[r.currency] = Number(r.total);
    return counts;
  }

  /**
   * Pricing-coverage report: per entity type, PAID items with NO price in the
   * given currency. Legacy price_inr/price_usd columns count as priced for
   * INR/USD (the merged-view rule), so coverage only flags items that would
   * become "not available for purchase" under this default currency.
   */
  async coverageForCurrency(
    tenantId: string,
    currency: string,
  ): Promise<CoverageTargetResult[]> {
    const results: CoverageTargetResult[] = [];
    for (const target of COVERAGE_TARGETS) {
      const legacyColumn =
        currency === "INR" ? "price_inr" : currency === "USD" ? "price_usd" : null;
      const legacyFilter = legacyColumn ? sql.raw(`AND t.${legacyColumn} IS NULL`) : sql.raw("");
      const paidFilter = sql.raw(`t.${target.paidColumn} = '${target.paidValue}'`);

      const query = sql<{ id: string; title: string; total: string }>`
        SELECT t.id, t.title, COUNT(*) OVER() AS total
        FROM ${sql.raw(target.table)} t
        WHERE t.tenant_id = ${tenantId}
          AND ${paidFilter}
          AND NOT EXISTS (
            SELECT 1 FROM content_prices cp
            WHERE cp.tenant_id = ${tenantId}
              AND cp.entity_type = ${target.entityType}::price_entity_type
              AND cp.entity_id = t.id
              AND cp.currency = ${currency}
          )
          ${legacyFilter}
        ORDER BY t.created_at DESC
        LIMIT 5
      `;
      const { rows } = await query.execute(db);
      results.push({
        entity_type: target.entityType,
        missing_count: rows.length > 0 ? Number(rows[0].total) : 0,
        sample: rows.map((r) => ({ id: r.id, title: r.title })),
      });
    }
    return results;
  }
}

export default new ContentPricesRepository();
