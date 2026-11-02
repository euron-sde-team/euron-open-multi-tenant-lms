import type { Transaction } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";
import type { DB, batches, batch_items, batch_enrollments } from "../db/types";
import type { batch_status, batch_item_type, purchase_mode } from "../db/enums";

export type BatchRow = batches;
export type BatchItemRow = batch_items;
export type BatchEnrollmentRow = batch_enrollments;

export interface BatchesListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface BatchesListResult {
  batches: BatchRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateBatchInput {
  tenant_id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  cover_image_url?: string | null;
  preview_url?: string | null;
  web_thumbnail_key?: string | null;
  mobile_thumbnail_key?: string | null;
  learning_outcomes?: string[];
  start_date: Date;
  end_date?: Date | null;
  enrollment_open_date?: Date | null;
  enrollment_close_date?: Date | null;
  duration_days?: number | null;
  validity_days?: number | null;
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  status?: string;
  purchase_mode?: string;
  sort_order?: number;
  /** Multi-currency price book; consumed by the service layer, not stored on batches table */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

export interface UpdateBatchInput {
  title?: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  cover_image_url?: string | null;
  preview_url?: string | null;
  web_thumbnail_key?: string | null;
  mobile_thumbnail_key?: string | null;
  learning_outcomes?: string[];
  start_date?: Date;
  end_date?: Date | null;
  enrollment_open_date?: Date | null;
  enrollment_close_date?: Date | null;
  duration_days?: number | null;
  validity_days?: number | null;
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  status?: string;
  purchase_mode?: string;
  sort_order?: number;
  /** Multi-currency price book; consumed by the service layer, not stored on batches table */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

export interface CreateBatchItemInput {
  tenant_id: string;
  batch_id: string;
  item_type: string;
  course_id?: string | null;
  book_id?: string | null;
  sort_order?: number;
}

export interface BatchItemWithDetails extends BatchItemRow {
  course_title?: string | null;
  course_slug?: string | null;
  course_thumbnail_key?: string | null;
  course_mode?: string | null;
  course_type?: string | null;
  book_title?: string | null;
  book_slug?: string | null;
  book_thumbnail_url?: string | null;
}

class BatchesRepository {
  // ─────────────────────────────────────────────────────────────
  // Batch CRUD
  // ─────────────────────────────────────────────────────────────

  async findByTenantId(
    tenantId: string,
    params: BatchesListParams = {}
  ): Promise<BatchesListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("batches")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    let listQuery = db
      .selectFrom("batches")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status as batch_status);
      listQuery = listQuery.where("status", "=", params.status as batch_status);
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
      .orderBy("start_date", "desc")
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      batches: rows as unknown as BatchRow[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, tenantId?: string): Promise<BatchRow | null> {
    let query = db.selectFrom("batches").selectAll().where("id", "=", id);
    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }
    const row = await query.executeTakeFirst();
    return row as unknown as BatchRow | null;
  }

  async findByTenantAndSlug(
    tenantId: string,
    slug: string
  ): Promise<BatchRow | null> {
    const row = await db
      .selectFrom("batches")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row as unknown as BatchRow | null;
  }

  async slugExistsForTenant(
    tenantId: string,
    slug: string,
    excludeId?: string
  ): Promise<boolean> {
    let query = db
      .selectFrom("batches")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug);
    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }
    const result = await query.executeTakeFirst();
    return !!result;
  }

  async create(data: CreateBatchInput, trx?: Transaction<DB>): Promise<BatchRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("batches")
      .values({
        id,
        tenant_id: data.tenant_id,
        title: data.title,
        slug: data.slug,
        subtitle: data.subtitle ?? null,
        description: data.description ?? null,
        thumbnail_url: data.thumbnail_url ?? null,
        cover_image_url: data.cover_image_url ?? null,
        preview_url: data.preview_url ?? null,
        web_thumbnail_key: data.web_thumbnail_key ?? null,
        mobile_thumbnail_key: data.mobile_thumbnail_key ?? null,
        learning_outcomes: data.learning_outcomes ?? [],
        start_date: data.start_date,
        end_date: data.end_date ?? null,
        enrollment_open_date: data.enrollment_open_date ?? null,
        enrollment_close_date: data.enrollment_close_date ?? null,
        duration_days: data.duration_days ?? null,
        validity_days: data.validity_days ?? null,
        price_inr: data.price_inr ?? null,
        price_usd: data.price_usd ?? null,
        discount_inr: data.discount_inr ?? null,
        discount_usd: data.discount_usd ?? null,
        status: (data.status as batch_status) ?? "DRAFT",
        purchase_mode: (data.purchase_mode as purchase_mode) ?? "PAID",
        sort_order: data.sort_order ?? 0,
        total_enrollments: 0,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as BatchRow;
  }

  async update(
    id: string,
    data: UpdateBatchInput,
    tenantId?: string,
    trx?: Transaction<DB>
  ): Promise<BatchRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url;
    if (data.cover_image_url !== undefined) updateData.cover_image_url = data.cover_image_url;
    if (data.preview_url !== undefined) updateData.preview_url = data.preview_url;
    if (data.web_thumbnail_key !== undefined) updateData.web_thumbnail_key = data.web_thumbnail_key;
    if (data.mobile_thumbnail_key !== undefined) updateData.mobile_thumbnail_key = data.mobile_thumbnail_key;
    if (data.learning_outcomes !== undefined) updateData.learning_outcomes = data.learning_outcomes;
    if (data.start_date !== undefined) updateData.start_date = data.start_date;
    if (data.end_date !== undefined) updateData.end_date = data.end_date;
    if (data.enrollment_open_date !== undefined) updateData.enrollment_open_date = data.enrollment_open_date;
    if (data.enrollment_close_date !== undefined) updateData.enrollment_close_date = data.enrollment_close_date;
    if (data.duration_days !== undefined) updateData.duration_days = data.duration_days;
    if (data.validity_days !== undefined) updateData.validity_days = data.validity_days;
    if (data.price_inr !== undefined) updateData.price_inr = data.price_inr;
    if (data.price_usd !== undefined) updateData.price_usd = data.price_usd;
    if (data.discount_inr !== undefined) updateData.discount_inr = data.discount_inr;
    if (data.discount_usd !== undefined) updateData.discount_usd = data.discount_usd;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.purchase_mode !== undefined) updateData.purchase_mode = data.purchase_mode;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

    let query = (trx || db)
      .updateTable("batches")
      .set(updateData as Record<string, unknown>)
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.returningAll().executeTakeFirst();
    return result as unknown as BatchRow | null;
  }

  async delete(
    id: string,
    tenantId?: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    let query = (trx || db).deleteFrom("batches").where("id", "=", id);
    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }
    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }

  async incrementEnrollmentCount(
    batchId: string,
    delta: number,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("batches")
      .set({
        total_enrollments: (eb) => eb("total_enrollments", "+", delta),
        updated_at: new Date(),
      })
      .where("id", "=", batchId)
      .execute();
  }

  // ─────────────────────────────────────────────────────────────
  // Batch Items
  // ─────────────────────────────────────────────────────────────

  async findItemsByBatchId(batchId: string): Promise<BatchItemRow[]> {
    const rows = await db
      .selectFrom("batch_items")
      .selectAll()
      .where("batch_id", "=", batchId)
      .orderBy("sort_order", "asc")
      .execute();
    return rows as unknown as BatchItemRow[];
  }

  async findItemsWithDetailsByBatchId(
    batchId: string
  ): Promise<BatchItemWithDetails[]> {
    const rows = await db
      .selectFrom("batch_items")
      .leftJoin("courses", "batch_items.course_id", "courses.id")
      .leftJoin("books", "batch_items.book_id", "books.id")
      .select([
        "batch_items.id",
        "batch_items.tenant_id",
        "batch_items.batch_id",
        "batch_items.item_type",
        "batch_items.course_id",
        "batch_items.book_id",
        "batch_items.sort_order",
        "batch_items.created_at",
        "courses.title as course_title",
        "courses.slug as course_slug",
        "courses.thumbnail_key as course_thumbnail_key",
        "courses.mode as course_mode",
        "courses.course_type as course_type",
        "books.title as book_title",
        "books.slug as book_slug",
        "books.thumbnail_url as book_thumbnail_url",
      ])
      .where("batch_items.batch_id", "=", batchId)
      .orderBy("batch_items.sort_order", "asc")
      .execute();
    return rows as unknown as BatchItemWithDetails[];
  }

  async createItem(
    data: CreateBatchItemInput,
    trx?: Transaction<DB>
  ): Promise<BatchItemRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("batch_items")
      .values({
        id,
        tenant_id: data.tenant_id,
        batch_id: data.batch_id,
        item_type: data.item_type as batch_item_type,
        course_id: data.course_id ?? null,
        book_id: data.book_id ?? null,
        sort_order: data.sort_order ?? 0,
        created_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as BatchItemRow;
  }

  async deleteItem(itemId: string, tenantId?: string): Promise<boolean> {
    let query = db.deleteFrom("batch_items").where("id", "=", itemId);
    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }
    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }

  async findItemById(itemId: string, tenantId?: string): Promise<BatchItemRow | null> {
    let query = db.selectFrom("batch_items").selectAll().where("id", "=", itemId);
    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }
    const row = await query.executeTakeFirst();
    return row as unknown as BatchItemRow | null;
  }

  async itemExistsInBatch(
    batchId: string,
    itemType: string,
    courseId: string | null,
    bookId: string | null
  ): Promise<boolean> {
    let query = db
      .selectFrom("batch_items")
      .select("id")
      .where("batch_id", "=", batchId)
      .where("item_type", "=", itemType as batch_item_type);

    if (itemType === "COURSE" && courseId) {
      query = query.where("course_id", "=", courseId);
    } else if (itemType === "BOOK" && bookId) {
      query = query.where("book_id", "=", bookId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }

  async reorderItems(batchId: string, itemIds: string[]): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      await db
        .updateTable("batch_items")
        .set({ sort_order: i })
        .where("id", "=", itemIds[i])
        .where("batch_id", "=", batchId)
        .execute();
    }
  }

  async getItemCount(batchId: string): Promise<number> {
    const result = await db
      .selectFrom("batch_items")
      .select(db.fn.count<number>("id").as("count"))
      .where("batch_id", "=", batchId)
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async getMaxItemSortOrder(batchId: string): Promise<number> {
    const result = await db
      .selectFrom("batch_items")
      .select(db.fn.max<number>("sort_order").as("max_order"))
      .where("batch_id", "=", batchId)
      .executeTakeFirst();
    return Number(result?.max_order ?? -1);
  }

  // ─────────────────────────────────────────────────────────────
  // Batch Enrollments
  // ─────────────────────────────────────────────────────────────

  async getEnrollmentCount(batchId: string): Promise<number> {
    const result = await db
      .selectFrom("batch_enrollments")
      .select(db.fn.count<number>("id").as("count"))
      .where("batch_id", "=", batchId)
      .where("status", "=", "ACTIVE")
      .executeTakeFirst();
    return Number(result?.count ?? 0);
  }

  async listEnrollments(
    batchId: string,
    tenantId: string,
    page = 1,
    limit = 20
  ): Promise<{ enrollments: BatchEnrollmentRow[]; total: number }> {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (Math.max(1, page) - 1) * safeLimit;

    const countResult = await db
      .selectFrom("batch_enrollments")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .executeTakeFirst();

    const enrollments = await db
      .selectFrom("batch_enrollments")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .orderBy("joined_at", "desc")
      .limit(safeLimit)
      .offset(offset)
      .execute();

    return {
      enrollments: enrollments as unknown as BatchEnrollmentRow[],
      total: Number(countResult?.count ?? 0),
    };
  }
}

const batchesRepository = new BatchesRepository();
export default batchesRepository;
