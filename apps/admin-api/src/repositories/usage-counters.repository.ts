/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExpressionBuilder, Transaction, sql } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";
import { DB } from "../db/types";
import type { tenant_usage_counters } from "../db/types";

export type UsageCounterRow = tenant_usage_counters;

/**
 * window_start of every LIFETIME counter. A fixed date rather than NULL so the
 * unique key (tenant, product, scope, window_type, window_start) holds: Postgres
 * treats NULLs as distinct, so NULL let concurrent first consumes insert
 * duplicate LIFETIME rows.
 */
export const LIFETIME_WINDOW_START = new Date(Date.UTC(1970, 0, 1));

/**
 * Compute window_start for a given window type.
 * LIFETIME → LIFETIME_WINDOW_START, MONTHLY → first of current month UTC, YEARLY → first of current year UTC.
 */
export function computeWindowStart(windowType: string): Date {
  const now = new Date();
  switch (windowType) {
    case "MONTHLY":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    case "YEARLY":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    case "LIFETIME":
    default:
      return LIFETIME_WINDOW_START;
  }
}

/**
 * Matches the counter row for a window. LIFETIME also matches rows written
 * before the sentinel existed (window_start NULL).
 */
const windowStartIs =
  (windowStart: Date) => (eb: ExpressionBuilder<DB, "tenant_usage_counters">) =>
    windowStart.getTime() === LIFETIME_WINDOW_START.getTime()
      ? eb.or([eb("window_start", "=", windowStart), eb("window_start", "is", null)])
      : eb("window_start", "=", windowStart);

class UsageCountersRepository {
  /**
   * Find a counter by tenant and product code (LIFETIME, TENANT scope by default).
   */
  async findByTenantAndProduct(
    tenantId: string,
    productCode: string,
    trx?: Transaction<DB>
  ): Promise<UsageCounterRow | null> {
    const executor = trx || db;
    const row = await executor
      .selectFrom("tenant_usage_counters")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("product_code", "=", productCode)
      .where("scope_type", "=", "TENANT")
      .where("scope_id", "=", "__TENANT__")
      .where("window_type", "=", "LIFETIME")
      .orderBy("created_at", "asc")
      .executeTakeFirst();
    return (row as unknown as UsageCounterRow) ?? null;
  }

  /**
   * Find all counters for a tenant (LIFETIME + current-window MONTHLY).
   */
  async findAllByTenant(
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<UsageCounterRow[]> {
    const executor = trx || db;
    const monthlyWindowStart = computeWindowStart("MONTHLY");
    const rows = await executor
      .selectFrom("tenant_usage_counters")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("scope_type", "=", "TENANT")
      .where((eb) =>
        eb.or([
          eb("window_type", "=", "LIFETIME"),
          eb.and([
            eb("window_type", "=", "MONTHLY"),
            eb("window_start", "=", monthlyWindowStart),
          ]),
        ])
      )
      .orderBy("created_at", "asc")
      .execute();

    // Deduplicate by product_code (keeping the oldest due to orderBy)
    const seen = new Set<string>();
    const deduplicated: UsageCounterRow[] = [];
    for (const row of rows) {
      if (!seen.has(row.product_code)) {
        seen.add(row.product_code);
        deduplicated.push(row as unknown as UsageCounterRow);
      }
    }
    return deduplicated;
  }

  /**
   * Find a counter by tenant, product, scope, and window (scope-aware).
   * For windowed counters, matches on window_start for the current period.
   */
  async findScoped(
    tenantId: string,
    productCode: string,
    scopeType: string,
    scopeId: string,
    windowType: string,
    trx?: Transaction<DB>
  ): Promise<UsageCounterRow | null> {
    const executor = trx || db;
    const windowStart = computeWindowStart(windowType);

    let query = executor
      .selectFrom("tenant_usage_counters")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("product_code", "=", productCode)
      .where("scope_type", "=", scopeType)
      .where("scope_id", "=", scopeId)
      .where("window_type", "=", windowType);

    query = query.where(windowStartIs(windowStart));

    const row = await query.orderBy("created_at", "asc").executeTakeFirst();
    return (row as unknown as UsageCounterRow) ?? null;
  }

  /**
   * Ensure a counter exists (race-safe upsert).
   */
  async ensureCounter(
    tenantId: string,
    productCode: string,
    scopeType: string = "TENANT",
    scopeId: string = "__TENANT__",
    windowType: string = "LIFETIME",
    trx?: Transaction<DB>
  ): Promise<UsageCounterRow> {
    const executor = trx || db;
    const now = new Date();
    const windowStart = computeWindowStart(windowType);

    // 1. Try to find existing counter first (match on window_start for windowed counters)
    let findQuery = executor
      .selectFrom("tenant_usage_counters")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("product_code", "=", productCode)
      .where("scope_type", "=", scopeType)
      .where("scope_id", "=", scopeId)
      .where("window_type", "=", windowType);

    findQuery = findQuery.where(windowStartIs(windowStart));

    let row = await findQuery.orderBy("created_at", "asc").executeTakeFirst();

    if (row) {
      return row as unknown as UsageCounterRow;
    }

    // 2. If not found, try to insert
    try {
      row = await executor
        .insertInto("tenant_usage_counters")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          product_code: productCode,
          scope_type: scopeType,
          scope_id: scopeId,
          window_type: windowType,
          window_start: windowStart,
          current_value: 0,
          last_reconciled_at: null,
          reconciled_value: null,
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirst();

      if (row) {
        return row as unknown as UsageCounterRow;
      }
    } catch (error: any) {
      // Ignore unique constraint violations (23505 in Postgres)
      if (error.code !== "23505") {
        throw error;
      }
    }

    // 3. If insert failed due to race condition, read again
    let retryQuery = executor
      .selectFrom("tenant_usage_counters")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("product_code", "=", productCode)
      .where("scope_type", "=", scopeType)
      .where("scope_id", "=", scopeId)
      .where("window_type", "=", windowType);

    retryQuery = retryQuery.where(windowStartIs(windowStart));

    row = await retryQuery.orderBy("created_at", "asc").executeTakeFirstOrThrow();

    return row as unknown as UsageCounterRow;
  }

  /**
   * Increment current_value atomically. Returns updated row.
   */
  async increment(
    id: string,
    amount: number,
    trx?: Transaction<DB>
  ): Promise<UsageCounterRow> {
    const executor = trx || db;
    const row = await executor
      .updateTable("tenant_usage_counters")
      .set({
        current_value: sql<number>`current_value + ${amount}`,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as UsageCounterRow;
  }

  /**
   * Decrement current_value atomically (floor at 0). Returns updated row.
   */
  async decrement(
    id: string,
    amount: number,
    trx?: Transaction<DB>
  ): Promise<UsageCounterRow> {
    const executor = trx || db;
    const row = await executor
      .updateTable("tenant_usage_counters")
      .set({
        current_value: sql<number>`GREATEST(0, current_value - ${amount})`,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as UsageCounterRow;
  }

  /**
   * Set counter to an exact value (for reconciliation).
   */
  async setValue(
    id: string,
    newValue: number,
    trx?: Transaction<DB>
  ): Promise<UsageCounterRow> {
    const executor = trx || db;
    const row = await executor
      .updateTable("tenant_usage_counters")
      .set({
        current_value: newValue,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as UsageCounterRow;
  }

  /**
   * Mark counter as reconciled with the given value.
   */
  async markReconciled(
    id: string,
    value: number,
    trx?: Transaction<DB>
  ): Promise<void> {
    const executor = trx || db;
    await executor
      .updateTable("tenant_usage_counters")
      .set({
        last_reconciled_at: new Date(),
        reconciled_value: value,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }
}

const usageCountersRepository = new UsageCountersRepository();
export default usageCountersRepository;
