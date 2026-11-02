import { ulid } from "ulid";
import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import type { test_taxonomy_kind } from "../db/enums";

export interface TaxonomyNodeRow {
  id: string;
  tenant_id: string;
  kind: string;
  parent_id: string | null;
  name: string;
  order_index: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaxonomyNodeInput {
  tenant_id: string;
  kind: string;
  parent_id?: string | null;
  name: string;
  order_index?: number;
}

export interface UpdateTaxonomyNodeInput {
  name?: string;
  parent_id?: string | null;
  order_index?: number;
}

class TestTaxonomyRepository {
  async findByTenant(
    tenantId: string,
    filter: { kind?: string; parent_id?: string | null } = {}
  ): Promise<TaxonomyNodeRow[]> {
    let q = db
      .selectFrom("test_taxonomy_nodes")
      .selectAll()
      .where("tenant_id", "=", tenantId);
    if (filter.kind) q = q.where("kind", "=", filter.kind as test_taxonomy_kind);
    if (filter.parent_id !== undefined) {
      q =
        filter.parent_id === null
          ? q.where("parent_id", "is", null)
          : q.where("parent_id", "=", filter.parent_id);
    }
    const rows = await q
      .orderBy("order_index", "asc")
      .orderBy("name", "asc")
      .execute();
    return rows as unknown as TaxonomyNodeRow[];
  }

  async findById(id: string, tenantId: string): Promise<TaxonomyNodeRow | null> {
    const row = await db
      .selectFrom("test_taxonomy_nodes")
      .selectAll()
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return (row as unknown as TaxonomyNodeRow) ?? null;
  }

  async create(
    data: CreateTaxonomyNodeInput,
    trx?: Transaction<DB>
  ): Promise<TaxonomyNodeRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_taxonomy_nodes")
      .values({
        id,
        tenant_id: data.tenant_id,
        kind: data.kind as test_taxonomy_kind,
        parent_id: data.parent_id ?? null,
        name: data.name,
        order_index: data.order_index ?? 0,
        created_at: now,
        updated_at: now,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TaxonomyNodeRow;
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateTaxonomyNodeInput,
    trx?: Transaction<DB>
  ): Promise<TaxonomyNodeRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.parent_id !== undefined) updateData.parent_id = data.parent_id;
    if (data.order_index !== undefined) updateData.order_index = data.order_index;
    const row = await (trx || db)
      .updateTable("test_taxonomy_nodes")
      .set(updateData)
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TaxonomyNodeRow) ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("test_taxonomy_nodes")
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }
}

export default new TestTaxonomyRepository();
