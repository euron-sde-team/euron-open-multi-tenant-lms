import { ulid } from "ulid";
import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB, books } from "../db/types";
import type { book_file_format, book_status, purchase_mode } from "../db/enums";
import { findBundlesForContent, type BundleRef } from "./content-bundles.repository";

export type BookRow = books;

export interface BooksListParams {
  page?: number;
  limit?: number;
  status?: string;
  purchaseMode?: string;
}

export type BookListRow = BookRow & {
  /** Bundles containing this book, drives the "Part of X" chip. */
  bundles: BundleRef[];
};

export interface BooksListResult {
  books: BookListRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateBookInput {
  tenant_id: string;
  title: string;
  slug: string;
  author?: string | null;
  description?: string | null;
  summary?: string | null;
  pages?: number | null;
  url?: string | null;
  page_images?: string[];
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  purchase_mode?: string;
  status?: string;
  language?: string[];
  thumbnail_url?: string | null;
  preview_url?: string | null;
  sort_order?: number;
  validity_days?: number | null;
  rating?: string | number | null;
  rating_total_count?: number | null;
  file_format?: string;
  /** Multi-currency price book; consumed by the service layer, not stored on books table */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

export interface UpdateBookInput {
  title?: string;
  slug?: string;
  author?: string | null;
  description?: string | null;
  summary?: string | null;
  pages?: number | null;
  url?: string | null;
  page_images?: string[];
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  purchase_mode?: string;
  status?: string;
  language?: string[];
  thumbnail_url?: string | null;
  preview_url?: string | null;
  sort_order?: number;
  validity_days?: number | null;
  rating?: string | number | null;
  rating_total_count?: number | null;
  file_format?: string;
  /** Author IDs for book_authors junction; not stored on books table */
  author_ids?: string[];
  /** Category IDs for book_categories junction; not stored on books table */
  category_ids?: string[];
  /** Multi-currency price book; consumed by the service layer, not stored on books table */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

class BooksRepository {
  async findByTenantId(
    tenantId: string,
    params: BooksListParams = {}
  ): Promise<BooksListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("books")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    let listQuery = db
      .selectFrom("books")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status as book_status);
      listQuery = listQuery.where("status", "=", params.status as book_status);
    }
    if (params.purchaseMode) {
      countQuery = countQuery.where("purchase_mode", "=", params.purchaseMode as purchase_mode);
      listQuery = listQuery.where("purchase_mode", "=", params.purchaseMode as purchase_mode);
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await listQuery
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // One batched lookup for the whole page, never a query per card.
    const bundleMap = await findBundlesForContent(tenantId, {
      bookIds: rows.map((r) => (r as { id: string }).id),
    });

    return {
      books: rows.map((r) => ({
        ...r,
        bundles: bundleMap.get((r as { id: string }).id) ?? [],
      })) as unknown as BookListRow[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, tenantId?: string): Promise<BookRow | null> {
    let query = db
      .selectFrom("books")
      .selectAll()
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query.executeTakeFirst();
    return row as unknown as BookRow | null;
  }

  async findByTenantAndSlug(
    tenantId: string,
    slug: string
  ): Promise<BookRow | null> {
    const row = await db
      .selectFrom("books")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row as unknown as BookRow | null;
  }

  async slugExistsForTenant(
    tenantId: string,
    slug: string,
    excludeId?: string
  ): Promise<boolean> {
    let query = db
      .selectFrom("books")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug);
    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }
    const result = await query.executeTakeFirst();
    return !!result;
  }

  async create(data: CreateBookInput, trx?: Transaction<DB>): Promise<BookRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("books")
      .values({
        id,
        tenant_id: data.tenant_id,
        title: data.title,
        slug: data.slug,
        author: data.author ?? null,
        description: data.description ?? null,
        summary: data.summary ?? null,
        pages: data.pages ?? null,
        url: data.url ?? null,
        page_images: data.page_images ?? [],
        price_inr: data.price_inr ?? null,
        price_usd: data.price_usd ?? null,
        discount_inr: data.discount_inr ?? null,
        discount_usd: data.discount_usd ?? null,
        purchase_mode: (data.purchase_mode as purchase_mode) ?? "PAID",
        status: (data.status as book_status) ?? "DRAFT",
        language: data.language ?? ["English"],
        thumbnail_url: data.thumbnail_url ?? null,
        preview_url: data.preview_url ?? null,
        sort_order: data.sort_order ?? 0,
        validity_days: data.validity_days === undefined ? 365 : data.validity_days,
        rating: data.rating != null ? String(data.rating) : null,
        rating_total_count: data.rating_total_count ?? null,
        file_format: (data.file_format as book_file_format) ?? "EPUB",
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as BookRow;
  }

  async update(id: string, data: UpdateBookInput, tenantId?: string, trx?: Transaction<DB>): Promise<BookRow | null> {
    const { author_ids: _authorIds, category_ids: _categoryIds, ...rest } = data;
    const now = new Date();
    const updateData: Record<string, unknown> = {
      updated_at: now,
    };
    if (rest.title !== undefined) updateData.title = rest.title;
    if (rest.slug !== undefined) updateData.slug = rest.slug;
    if (rest.author !== undefined) updateData.author = rest.author;
    if (rest.description !== undefined) updateData.description = rest.description;
    if (rest.summary !== undefined) updateData.summary = rest.summary;
    if (rest.pages !== undefined) updateData.pages = rest.pages;
    if (rest.url !== undefined) updateData.url = rest.url;
    if (rest.page_images !== undefined) updateData.page_images = rest.page_images;
    if (rest.price_inr !== undefined) updateData.price_inr = rest.price_inr;
    if (rest.price_usd !== undefined) updateData.price_usd = rest.price_usd;
    if (rest.discount_inr !== undefined) updateData.discount_inr = rest.discount_inr;
    if (rest.discount_usd !== undefined) updateData.discount_usd = rest.discount_usd;
    if (rest.purchase_mode !== undefined) updateData.purchase_mode = rest.purchase_mode;
    if (rest.status !== undefined) updateData.status = rest.status;
    if (rest.language !== undefined) updateData.language = rest.language;
    if (rest.validity_days !== undefined) updateData.validity_days = rest.validity_days;
    if (rest.thumbnail_url !== undefined) updateData.thumbnail_url = rest.thumbnail_url;
    if (rest.preview_url !== undefined) updateData.preview_url = rest.preview_url;
    if (rest.sort_order !== undefined) updateData.sort_order = rest.sort_order;
    if (rest.rating !== undefined) updateData.rating = rest.rating != null ? String(rest.rating) : null;
    if (rest.rating_total_count !== undefined) updateData.rating_total_count = rest.rating_total_count;
    if (rest.file_format !== undefined) updateData.file_format = rest.file_format as book_file_format;

    let query = (trx || db)
      .updateTable("books")
      .set(updateData as Record<string, unknown>)
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query
      .returningAll()
      .executeTakeFirst();
    return result as unknown as BookRow | null;
  }

  async delete(id: string, tenantId?: string, trx?: Transaction<DB>): Promise<boolean> {
    let query = (trx || db)
      .deleteFrom("books")
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }

  // --- Book Recommendations ---

  async findRecommendationsByBookId(
    tenantId: string,
    bookId: string
  ): Promise<
    Array<{
      id: string;
      bookId: string;
      title: string;
      slug: string;
      thumbnailUrl: string | null;
      sortOrder: number;
    }>
  > {
    const rows = await db
      .selectFrom("book_recommendations")
      .innerJoin("books", "books.id", "book_recommendations.recommended_book_id")
      .select([
        "book_recommendations.id as id",
        "book_recommendations.recommended_book_id as bookId",
        "books.title as title",
        "books.slug as slug",
        "books.thumbnail_url as thumbnailUrl",
        "book_recommendations.sort_order as sortOrder",
      ])
      .where("book_recommendations.tenant_id", "=", tenantId)
      .where("book_recommendations.book_id", "=", bookId)
      .orderBy("book_recommendations.sort_order", "asc")
      .execute();

    return rows.map((r) => ({
      id: String(r.id),
      bookId: String(r.bookId),
      title: String(r.title),
      slug: String(r.slug),
      thumbnailUrl: r.thumbnailUrl ?? null,
      sortOrder: Number(r.sortOrder),
    }));
  }

  async syncBookRecommendations(
    tenantId: string,
    bookId: string,
    recommendedBookIds: string[]
  ): Promise<
    Array<{
      id: string;
      bookId: string;
      title: string;
      slug: string;
      thumbnailUrl: string | null;
      sortOrder: number;
    }>
  > {
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("book_recommendations")
        .where("tenant_id", "=", tenantId)
        .where("book_id", "=", bookId)
        .execute();

      for (let i = 0; i < recommendedBookIds.length; i++) {
        await trx
          .insertInto("book_recommendations")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            book_id: bookId,
            recommended_book_id: recommendedBookIds[i],
            sort_order: i,
            created_at: now,
            updated_at: now,
          })
          .execute();
      }
    });

    return this.findRecommendationsByBookId(tenantId, bookId);
  }
}

const booksRepository = new BooksRepository();
export default booksRepository;
