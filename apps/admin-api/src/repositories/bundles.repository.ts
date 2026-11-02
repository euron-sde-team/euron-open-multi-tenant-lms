import { ulid } from "ulid";
import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB, bundles, bundle_items } from "../db/types";
import type { bundle_status, bundle_item_type, purchase_mode } from "../db/enums";

export type BundleRow = bundles;
export type BundleItemRow = bundle_items;

export interface BundlesListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface BundlesListResult {
  bundles: BundleRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateBundleInput {
  tenant_id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  thumbnail_url?: string | null;
  preview_url?: string | null;
  status?: string;
  purchase_mode?: string;
  validity_days?: number | null;
  sort_order?: number;
  /** Multi-currency price book; consumed by the service layer, not stored on bundles table */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

export interface UpdateBundleInput {
  title?: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  thumbnail_url?: string | null;
  preview_url?: string | null;
  status?: string;
  purchase_mode?: string;
  validity_days?: number | null;
  sort_order?: number;
  /** Multi-currency price book; consumed by the service layer, not stored on bundles table */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

export interface CreateBundleItemInput {
  tenant_id: string;
  bundle_id: string;
  item_type: string;
  course_id?: string | null;
  book_id?: string | null;
  test_series_id?: string | null;
  sort_order?: number;
}

export interface BundleItemWithDetails extends BundleItemRow {
  course_title?: string | null;
  course_slug?: string | null;
  course_thumbnail_key?: string | null;
  book_title?: string | null;
  book_slug?: string | null;
  book_thumbnail_url?: string | null;
  test_series_title?: string | null;
  test_series_slug?: string | null;
  test_series_cover_image_key?: string | null;
}

class BundlesRepository {
  // ─────────────────────────────────────────────────────────────
  // Bundle CRUD
  // ─────────────────────────────────────────────────────────────

  async findByTenantId(
    tenantId: string,
    params: BundlesListParams = {}
  ): Promise<BundlesListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("bundles")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    let listQuery = db
      .selectFrom("bundles")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status as bundle_status);
      listQuery = listQuery.where("status", "=", params.status as bundle_status);
    }

    if (params.search) {
      const search = `%${params.search}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([eb("title", "ilike", search), eb("slug", "ilike", search)])
      );
      listQuery = listQuery.where((eb) =>
        eb.or([eb("title", "ilike", search), eb("slug", "ilike", search)])
      );
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await listQuery
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      bundles: rows as unknown as BundleRow[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, tenantId?: string): Promise<BundleRow | null> {
    let query = db
      .selectFrom("bundles")
      .selectAll()
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query.executeTakeFirst();
    return row as unknown as BundleRow | null;
  }

  async findByTenantAndSlug(
    tenantId: string,
    slug: string
  ): Promise<BundleRow | null> {
    const row = await db
      .selectFrom("bundles")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row as unknown as BundleRow | null;
  }

  async slugExistsForTenant(
    tenantId: string,
    slug: string,
    excludeId?: string
  ): Promise<boolean> {
    let query = db
      .selectFrom("bundles")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug);
    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }
    const result = await query.executeTakeFirst();
    return !!result;
  }

  async create(data: CreateBundleInput, trx?: Transaction<DB>): Promise<BundleRow> {
    const id = ulid();
    const now = new Date();
    // Default validity_days to 365 (1 year) if not specified
    const DEFAULT_VALIDITY_DAYS = 365;
    const row = await (trx || db)
      .insertInto("bundles")
      .values({
        id,
        tenant_id: data.tenant_id,
        title: data.title,
        slug: data.slug,
        subtitle: data.subtitle ?? null,
        description: data.description ?? null,
        price_inr: data.price_inr ?? null,
        price_usd: data.price_usd ?? null,
        discount_inr: data.discount_inr ?? null,
        discount_usd: data.discount_usd ?? null,
        thumbnail_url: data.thumbnail_url ?? null,
        preview_url: data.preview_url ?? null,
        status: (data.status as bundle_status) ?? "DRAFT",
        purchase_mode: (data.purchase_mode as purchase_mode) ?? "PAID",
        validity_days: data.validity_days === undefined ? DEFAULT_VALIDITY_DAYS : data.validity_days,
        sort_order: data.sort_order ?? 0,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as BundleRow;
  }

  async update(id: string, data: UpdateBundleInput, tenantId?: string, trx?: Transaction<DB>): Promise<BundleRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = {
      updated_at: now,
    };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price_inr !== undefined) updateData.price_inr = data.price_inr;
    if (data.price_usd !== undefined) updateData.price_usd = data.price_usd;
    if (data.discount_inr !== undefined) updateData.discount_inr = data.discount_inr;
    if (data.discount_usd !== undefined) updateData.discount_usd = data.discount_usd;
    if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url;
    if (data.preview_url !== undefined) updateData.preview_url = data.preview_url;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.purchase_mode !== undefined) updateData.purchase_mode = data.purchase_mode;
    if (data.validity_days !== undefined) updateData.validity_days = data.validity_days;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

    let query = (trx || db)
      .updateTable("bundles")
      .set(updateData as Record<string, unknown>)
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query
      .returningAll()
      .executeTakeFirst();
    return result as unknown as BundleRow | null;
  }

  async delete(id: string, tenantId?: string, trx?: Transaction<DB>): Promise<boolean> {
    let query = (trx || db)
      .deleteFrom("bundles")
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Bundle Items
  // ─────────────────────────────────────────────────────────────

  async findItemsByBundleId(bundleId: string): Promise<BundleItemRow[]> {
    const rows = await db
      .selectFrom("bundle_items")
      .selectAll()
      .where("bundle_id", "=", bundleId)
      .orderBy("sort_order", "asc")
      .execute();
    return rows as unknown as BundleItemRow[];
  }

  /**
   * Get bundle items with course/book details for display
   */
  async findItemsWithDetailsByBundleId(
    bundleId: string
  ): Promise<BundleItemWithDetails[]> {
    const rows = await db
      .selectFrom("bundle_items")
      .leftJoin("courses", "bundle_items.course_id", "courses.id")
      .leftJoin("books", "bundle_items.book_id", "books.id")
      .leftJoin("test_series", "bundle_items.test_series_id", "test_series.id")
      .select([
        "bundle_items.id",
        "bundle_items.tenant_id",
        "bundle_items.bundle_id",
        "bundle_items.item_type",
        "bundle_items.course_id",
        "bundle_items.book_id",
        "bundle_items.test_series_id",
        "bundle_items.sort_order",
        "bundle_items.created_at",
        "courses.title as course_title",
        "courses.slug as course_slug",
        "courses.thumbnail_key as course_thumbnail_key",
        "books.title as book_title",
        "books.slug as book_slug",
        "books.thumbnail_url as book_thumbnail_url",
        "test_series.title as test_series_title",
        "test_series.slug as test_series_slug",
        "test_series.cover_image_key as test_series_cover_image_key",
      ])
      .where("bundle_items.bundle_id", "=", bundleId)
      .orderBy("bundle_items.sort_order", "asc")
      .execute();
    return rows as unknown as BundleItemWithDetails[];
  }

  async createItem(data: CreateBundleItemInput): Promise<BundleItemRow> {
    const id = ulid();
    const now = new Date();
    const row = await db
      .insertInto("bundle_items")
      .values({
        id,
        tenant_id: data.tenant_id,
        bundle_id: data.bundle_id,
        item_type: data.item_type as bundle_item_type,
        course_id: data.course_id ?? null,
        book_id: data.book_id ?? null,
        test_series_id: data.test_series_id ?? null,
        sort_order: data.sort_order ?? 0,
        created_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as BundleItemRow;
  }

  async deleteItem(itemId: string, tenantId?: string): Promise<boolean> {
    let query = db
      .deleteFrom("bundle_items")
      .where("id", "=", itemId);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }

  async findItemById(itemId: string, tenantId?: string): Promise<BundleItemRow | null> {
    let query = db
      .selectFrom("bundle_items")
      .selectAll()
      .where("id", "=", itemId);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query.executeTakeFirst();
    return row as unknown as BundleItemRow | null;
  }

  /**
   * Check if a course, book, or test series is already in the bundle
   */
  async itemExistsInBundle(
    bundleId: string,
    itemType: string,
    courseId: string | null,
    bookId: string | null,
    testSeriesId: string | null = null
  ): Promise<boolean> {
    let query = db
      .selectFrom("bundle_items")
      .select("id")
      .where("bundle_id", "=", bundleId)
      .where("item_type", "=", itemType as bundle_item_type);

    if (itemType === "COURSE" && courseId) {
      query = query.where("course_id", "=", courseId);
    } else if (itemType === "BOOK" && bookId) {
      query = query.where("book_id", "=", bookId);
    } else if (itemType === "TEST_SERIES" && testSeriesId) {
      query = query.where("test_series_id", "=", testSeriesId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  /**
   * Reorder bundle items by updating their sort_order
   */
  async reorderItems(
    bundleId: string,
    itemIds: string[]
  ): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      await db
        .updateTable("bundle_items")
        .set({ sort_order: i })
        .where("id", "=", itemIds[i])
        .where("bundle_id", "=", bundleId)
        .execute();
    }
  }

  /**
   * Get the count of items in a bundle
   */
  async getItemCount(bundleId: string): Promise<number> {
    const result = await db
      .selectFrom("bundle_items")
      .select(db.fn.count<number>("id").as("count"))
      .where("bundle_id", "=", bundleId)
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  /**
   * Get max sort_order for items in a bundle (for adding new items)
   */
  async getMaxItemSortOrder(bundleId: string): Promise<number> {
    const result = await db
      .selectFrom("bundle_items")
      .select(db.fn.max<number>("sort_order").as("max_order"))
      .where("bundle_id", "=", bundleId)
      .executeTakeFirst();
    return Number(result?.max_order ?? -1);
  }
}

const bundlesRepository = new BundlesRepository();
export default bundlesRepository;
