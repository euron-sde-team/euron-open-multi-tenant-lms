import { ulid } from "ulid";
import type { Transaction } from "kysely";
import { db } from "../db/connection";
import { findBundlesForContent, type BundleRef } from "./content-bundles.repository";
import type { DB, test_series, test_series_tests } from "../db/types";
import type {
  test_status,
  test_series_pricing_type,
  test_series_visibility,
  test_series_access_mode,
} from "../db/enums";

export type TestSeriesRow = test_series;
export type TestSeriesTestRow = test_series_tests;

export interface TestSeriesListParams {
  page?: number;
  limit?: number;
  status?: string;
  visibility?: string;
  pricing_type?: string;
  search?: string;
}

export type TestSeriesListRow = TestSeriesRow & {
  /** Bundles containing this series, drives the "Part of X" chip. */
  bundles: BundleRef[];
};

export interface TestSeriesListResult {
  series: TestSeriesListRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTestSeriesInput {
  tenant_id: string;
  title: string;
  slug: string;
  description?: string | null;
  cover_image_key?: string | null;
  category?: string | null;
  pricing_type?: string;
  price_inr?: number | string | null;
  price_usd?: number | string | null;
  discount_inr?: number | string | null;
  discount_usd?: number | string | null;
  currency?: string | null;
  validity_days?: number | null;
  end_date?: Date | null;
  visibility?: string;
  access_mode?: string;
  status?: string;
  created_by?: string | null;
  /** Multi-currency price book; consumed by the service layer, not stored on test_series table */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

export interface UpdateTestSeriesInput {
  title?: string;
  slug?: string;
  description?: string | null;
  cover_image_key?: string | null;
  category?: string | null;
  pricing_type?: string;
  price_inr?: number | string | null;
  price_usd?: number | string | null;
  discount_inr?: number | string | null;
  discount_usd?: number | string | null;
  currency?: string | null;
  validity_days?: number | null;
  end_date?: Date | null;
  visibility?: string;
  access_mode?: string;
  status?: string;
  /** Multi-currency price book; consumed by the service layer, not stored on test_series table */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

class TestSeriesRepository {
  async findByTenantId(
    tenantId: string,
    params: TestSeriesListParams = {}
  ): Promise<TestSeriesListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("test_series")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    let listQuery = db
      .selectFrom("test_series")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status as test_status);
      listQuery = listQuery.where("status", "=", params.status as test_status);
    }
    if (params.visibility) {
      countQuery = countQuery.where("visibility", "=", params.visibility as test_series_visibility);
      listQuery = listQuery.where("visibility", "=", params.visibility as test_series_visibility);
    }
    if (params.pricing_type) {
      countQuery = countQuery.where(
        "pricing_type",
        "=",
        params.pricing_type as test_series_pricing_type
      );
      listQuery = listQuery.where(
        "pricing_type",
        "=",
        params.pricing_type as test_series_pricing_type
      );
    }
    if (params.search) {
      const term = `%${params.search}%`;
      countQuery = countQuery.where("title", "ilike", term);
      listQuery = listQuery.where("title", "ilike", term);
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await listQuery
      // Match the sibling catalogs: the admin's arrangement first, newest as
      // the tiebreak. Previously created_at only, so a dragged order never
      // showed on this page.
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const bundleMap = await findBundlesForContent(tenantId, {
      testSeriesIds: rows.map((r) => (r as { id: string }).id),
    });

    return {
      series: rows.map((r) => ({
        ...r,
        bundles: bundleMap.get((r as { id: string }).id) ?? [],
      })) as unknown as TestSeriesListRow[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, tenantId?: string): Promise<TestSeriesRow | null> {
    let query = db.selectFrom("test_series").selectAll().where("id", "=", id);
    if (tenantId) query = query.where("tenant_id", "=", tenantId);
    const row = await query.executeTakeFirst();
    return (row as unknown as TestSeriesRow) ?? null;
  }

  async findByTenantAndSlug(
    tenantId: string,
    slug: string
  ): Promise<TestSeriesRow | null> {
    const row = await db
      .selectFrom("test_series")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .executeTakeFirst();
    return (row as unknown as TestSeriesRow) ?? null;
  }

  async slugExistsForTenant(
    tenantId: string,
    slug: string,
    excludeId?: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    let query = (trx || db)
      .selectFrom("test_series")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug);
    if (excludeId) query = query.where("id", "!=", excludeId);
    const result = await query.executeTakeFirst();
    return !!result;
  }

  async create(
    data: CreateTestSeriesInput,
    trx?: Transaction<DB>
  ): Promise<TestSeriesRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_series")
      .values({
        id,
        tenant_id: data.tenant_id,
        title: data.title,
        slug: data.slug,
        description: data.description ?? null,
        cover_image_key: data.cover_image_key ?? null,
        category: data.category ?? null,
        pricing_type: (data.pricing_type ?? "FREE") as test_series_pricing_type,
        price_inr: (data.price_inr ?? null) as unknown as string | null,
        price_usd: (data.price_usd ?? null) as unknown as string | null,
        discount_inr: (data.discount_inr ?? null) as unknown as string | null,
        discount_usd: (data.discount_usd ?? null) as unknown as string | null,
        currency: data.currency ?? "INR",
        validity_days: data.validity_days ?? null,
        end_date: data.end_date ?? null,
        visibility: (data.visibility ?? "PUBLIC") as test_series_visibility,
        access_mode: (data.access_mode ?? "OPEN") as test_series_access_mode,
        status: (data.status ?? "DRAFT") as test_status,
        created_by: data.created_by ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestSeriesRow;
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateTestSeriesInput,
    trx?: Transaction<DB>
  ): Promise<TestSeriesRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.cover_image_key !== undefined) updateData.cover_image_key = data.cover_image_key;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.pricing_type !== undefined)
      updateData.pricing_type = data.pricing_type as test_series_pricing_type;
    if (data.price_inr !== undefined) updateData.price_inr = data.price_inr;
    if (data.price_usd !== undefined) updateData.price_usd = data.price_usd;
    if (data.discount_inr !== undefined) updateData.discount_inr = data.discount_inr;
    if (data.discount_usd !== undefined) updateData.discount_usd = data.discount_usd;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.validity_days !== undefined) updateData.validity_days = data.validity_days;
    if (data.end_date !== undefined) updateData.end_date = data.end_date;
    if (data.visibility !== undefined)
      updateData.visibility = data.visibility as test_series_visibility;
    if (data.access_mode !== undefined)
      updateData.access_mode = data.access_mode as test_series_access_mode;
    if (data.status !== undefined) updateData.status = data.status as test_status;

    const row = await (trx || db)
      .updateTable("test_series")
      .set(updateData)
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestSeriesRow) ?? null;
  }

  async delete(id: string, tenantId: string, trx?: Transaction<DB>): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("test_series")
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  async countPublishedByTenant(tenantId: string): Promise<number> {
    const row = await db
      .selectFrom("test_series")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PUBLISHED" as test_status)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  // ---------- Series-Tests linking ----------
  async findTestsBySeries(
    seriesId: string,
    tenantId: string
  ): Promise<TestSeriesTestRow[]> {
    const rows = await db
      .selectFrom("test_series_tests")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_series_id", "=", seriesId)
      .orderBy("order_index", "asc")
      .execute();
    return rows as unknown as TestSeriesTestRow[];
  }

  async addTestToSeries(
    data: {
      tenant_id: string;
      test_series_id: string;
      test_id: string;
      order_index?: number;
      is_free_preview?: boolean;
    },
    trx?: Transaction<DB>
  ): Promise<TestSeriesTestRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_series_tests")
      .values({
        id,
        tenant_id: data.tenant_id,
        test_series_id: data.test_series_id,
        test_id: data.test_id,
        order_index: data.order_index ?? 0,
        is_free_preview: data.is_free_preview ?? false,
        created_at: now,
      })
      .onConflict((oc) =>
        oc.columns(["test_series_id", "test_id"]).doUpdateSet({
          order_index: data.order_index ?? 0,
          is_free_preview: data.is_free_preview ?? false,
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestSeriesTestRow;
  }

  async removeTestFromSeries(
    seriesId: string,
    testId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("test_series_tests")
      .where("tenant_id", "=", tenantId)
      .where("test_series_id", "=", seriesId)
      .where("test_id", "=", testId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  async reorderTestsInSeries(
    seriesId: string,
    tenantId: string,
    orderedTestIds: string[],
    trx?: Transaction<DB>
  ): Promise<void> {
    const conn = trx || db;
    for (let i = 0; i < orderedTestIds.length; i++) {
      await conn
        .updateTable("test_series_tests")
        .set({ order_index: i })
        .where("tenant_id", "=", tenantId)
        .where("test_series_id", "=", seriesId)
        .where("test_id", "=", orderedTestIds[i])
        .execute();
    }
  }

  async countFreePreviews(seriesId: string, tenantId: string): Promise<number> {
    const row = await db
      .selectFrom("test_series_tests")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("test_series_id", "=", seriesId)
      .where("is_free_preview", "=", true)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }
}

export default new TestSeriesRepository();
