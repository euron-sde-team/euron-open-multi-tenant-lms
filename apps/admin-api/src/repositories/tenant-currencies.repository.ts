import type { Transaction } from "kysely";
import { ulid } from "ulid";

import { db } from "../db/connection";
import type { DB } from "../db/types";

export interface TenantCurrencyRow {
  id: string;
  tenant_id: string;
  currency: string;
  is_default: boolean;
  countries: string[];
  is_active: boolean;
  sort_order: number;
}

export interface TenantCurrencyInput {
  currency: string;
  is_default: boolean;
  countries: string[];
  sort_order: number;
}

function parseCountries(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

class TenantCurrenciesRepository {
  async listByTenant(tenantId: string, trx?: Transaction<DB>): Promise<TenantCurrencyRow[]> {
    const rows = await (trx || db)
      .selectFrom("tenant_currencies")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("is_active", "=", true)
      .orderBy("sort_order", "asc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      currency: r.currency,
      is_default: r.is_default,
      countries: parseCountries(r.countries),
      is_active: r.is_active,
      sort_order: r.sort_order,
    }));
  }

  /** Atomic replace of the tenant's full currency configuration. */
  async replaceAll(
    tenantId: string,
    rows: TenantCurrencyInput[],
    trx: Transaction<DB>,
  ): Promise<void> {
    await trx.deleteFrom("tenant_currencies").where("tenant_id", "=", tenantId).execute();
    if (rows.length === 0) return;
    const now = new Date();
    await trx
      .insertInto("tenant_currencies")
      .values(
        rows.map((r) => ({
          id: ulid(),
          tenant_id: tenantId,
          currency: r.currency,
          is_default: r.is_default,
          countries: JSON.stringify(r.countries),
          is_active: true,
          sort_order: r.sort_order,
          created_at: now,
          updated_at: now,
        })),
      )
      .execute();
  }
}

export default new TenantCurrenciesRepository();
