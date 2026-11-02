import config from "../config";
import { sql } from "kysely";
import { db } from "../db/connection";
import { batch_status, enrollment_status } from "../db/enums";

function resolveThumbnailUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:")) return v;
  const base = config.THUMBNAILS_BASE_URL;
  if (!base) return v;
  const key = v.startsWith("/") ? v.slice(1) : v;
  return `${base}/${key}`;
}

export interface PublishedBatchItem {
  id: string;
  itemType: "COURSE" | "BOOK";
  courseId: string | null;
  bookId: string | null;
  sortOrder: number;
  courseTitle: string | null;
  courseSlug: string | null;
  courseSubtitle: string | null;
  courseThumbnailKey: string | null;
  courseMode: string | null;
  courseType: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
  bookPages: number | null;
  bookThumbnailUrl: string | null;
}

export interface PublishedBatchListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  webThumbnailUrl: string | null;
  mobileThumbnailUrl: string | null;
  startDate: string;
  endDate: string | null;
  enrollmentOpenDate: string | null;
  enrollmentCloseDate: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  itemCount: number;
  totalEnrollments: number;
  sortOrder: number;
  createdAt: string;
}

export interface PublishedBatchDetail extends PublishedBatchListItem {
  previewUrl: string | null;
  durationDays: number | null;
  validityDays: number | null;
  learningOutcomes: string[];
  updatedAt: string;
  items: PublishedBatchItem[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "start_date" | "title" | "sort_order";
  sortOrder?: "asc" | "desc";
}

export interface PublishedBatchesResult {
  batches: PublishedBatchListItem[];
  pagination: PaginationMeta;
}

class BatchesRepository {
  /**
   * Public list of PUBLISHED batches for a tenant.
   */
  async listPublishedByTenant(
    tenantId: string,
    options?: PaginationOptions
  ): Promise<PublishedBatchesResult> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
    const offset = (page - 1) * limit;
    const sortBy = options?.sortBy ?? "start_date";
    const sortOrder = options?.sortOrder ?? "asc";

    const countResult = await db
      .selectFrom("batches")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("status", "=", batch_status.PUBLISHED)
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await db
      .selectFrom("batches")
      .leftJoin("batch_items", "batch_items.batch_id", "batches.id")
      .select((eb) => [
        "batches.id",
        "batches.title",
        "batches.slug",
        "batches.subtitle",
        "batches.description",
        "batches.thumbnail_url",
        "batches.cover_image_url",
        "batches.web_thumbnail_key",
        "batches.mobile_thumbnail_key",
        "batches.start_date",
        "batches.end_date",
        "batches.enrollment_open_date",
        "batches.enrollment_close_date",
        "batches.price_inr",
        "batches.price_usd",
        "batches.discount_inr",
        "batches.discount_usd",
        "batches.purchase_mode",
        "batches.total_enrollments",
        "batches.sort_order",
        "batches.created_at",
        eb.fn.count<number>("batch_items.id").as("item_count"),
      ])
      .where("batches.tenant_id", "=", tenantId)
      .where("batches.status", "=", batch_status.PUBLISHED)
      .groupBy("batches.id")
      .orderBy(`batches.${sortBy}` as never, sortOrder)
      .orderBy("batches.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const batches: PublishedBatchListItem[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      subtitle: r.subtitle,
      description: r.description,
      thumbnailUrl: resolveThumbnailUrl(r.thumbnail_url) ?? r.thumbnail_url,
      coverImageUrl: resolveThumbnailUrl(r.cover_image_url) ?? r.cover_image_url,
      webThumbnailUrl:
        resolveThumbnailUrl(r.web_thumbnail_key) ?? r.web_thumbnail_key,
      mobileThumbnailUrl:
        resolveThumbnailUrl(r.mobile_thumbnail_key) ?? r.mobile_thumbnail_key,
      startDate: r.start_date instanceof Date ? r.start_date.toISOString() : String(r.start_date),
      endDate: r.end_date ? (r.end_date instanceof Date ? r.end_date.toISOString() : String(r.end_date)) : null,
      enrollmentOpenDate: r.enrollment_open_date
        ? r.enrollment_open_date instanceof Date
          ? r.enrollment_open_date.toISOString()
          : String(r.enrollment_open_date)
        : null,
      enrollmentCloseDate: r.enrollment_close_date
        ? r.enrollment_close_date instanceof Date
          ? r.enrollment_close_date.toISOString()
          : String(r.enrollment_close_date)
        : null,
      priceInr: r.price_inr,
      priceUsd: r.price_usd,
      discountInr: r.discount_inr,
      discountUsd: r.discount_usd,
      purchaseMode: String(r.purchase_mode ?? "PAID"),
      itemCount: Number(r.item_count ?? 0),
      totalEnrollments: Number(r.total_enrollments ?? 0),
      sortOrder: Number(r.sort_order ?? 0),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      batches,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Public detail of a PUBLISHED batch by slug.
   */
  async findPublishedBySlug(
    tenantId: string,
    slug: string
  ): Promise<PublishedBatchDetail | null> {
    const normalizedSlug = slug.startsWith("batches/")
      ? slug.replace(/^batches\/?/, "")
      : slug;
    if (!normalizedSlug) return null;

    const batch = await db
      .selectFrom("batches")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("status", "=", batch_status.PUBLISHED)
      .where("slug", "=", normalizedSlug)
      .executeTakeFirst();
    if (!batch) return null;

    const items = await db
      .selectFrom("batch_items")
      .leftJoin("courses", "batch_items.course_id", "courses.id")
      .leftJoin("books", "batch_items.book_id", "books.id")
      .select([
        "batch_items.id as id",
        "batch_items.item_type as item_type",
        "batch_items.course_id as course_id",
        "batch_items.book_id as book_id",
        "batch_items.sort_order as sort_order",
        "courses.title as course_title",
        "courses.slug as course_slug",
        "courses.subtitle as course_subtitle",
        "courses.thumbnail_key as course_thumbnail_key",
        "courses.mode as course_mode",
        "courses.course_type as course_type",
        "books.title as book_title",
        "books.slug as book_slug",
        "books.author as book_author",
        "books.pages as book_pages",
        "books.thumbnail_url as book_thumbnail_url",
      ])
      .where("batch_items.batch_id", "=", batch.id)
      .orderBy("batch_items.sort_order", "asc")
      .execute();

    const mappedItems: PublishedBatchItem[] = items.map((r) => ({
      id: r.id,
      itemType: String(r.item_type) as "COURSE" | "BOOK",
      courseId: r.course_id,
      bookId: r.book_id,
      sortOrder: Number(r.sort_order ?? 0),
      courseTitle: r.course_title,
      courseSlug: r.course_slug,
      courseSubtitle: r.course_subtitle,
      courseThumbnailKey:
        resolveThumbnailUrl(r.course_thumbnail_key) ?? r.course_thumbnail_key ?? null,
      courseMode: r.course_mode ? String(r.course_mode) : null,
      courseType: r.course_type ? String(r.course_type) : null,
      bookTitle: r.book_title,
      bookSlug: r.book_slug,
      bookAuthor: r.book_author,
      bookPages: r.book_pages === null ? null : Number(r.book_pages),
      bookThumbnailUrl:
        resolveThumbnailUrl(r.book_thumbnail_url) ?? r.book_thumbnail_url ?? null,
    }));

    return {
      id: batch.id,
      title: batch.title,
      slug: batch.slug,
      subtitle: batch.subtitle,
      description: batch.description,
      thumbnailUrl: resolveThumbnailUrl(batch.thumbnail_url) ?? batch.thumbnail_url,
      coverImageUrl: resolveThumbnailUrl(batch.cover_image_url) ?? batch.cover_image_url,
      webThumbnailUrl:
        resolveThumbnailUrl(batch.web_thumbnail_key) ?? batch.web_thumbnail_key,
      mobileThumbnailUrl:
        resolveThumbnailUrl(batch.mobile_thumbnail_key) ?? batch.mobile_thumbnail_key,
      learningOutcomes: Array.isArray(batch.learning_outcomes)
        ? (batch.learning_outcomes as string[])
        : [],
      previewUrl: batch.preview_url,
      startDate:
        batch.start_date instanceof Date
          ? batch.start_date.toISOString()
          : String(batch.start_date),
      endDate: batch.end_date
        ? batch.end_date instanceof Date
          ? batch.end_date.toISOString()
          : String(batch.end_date)
        : null,
      enrollmentOpenDate: batch.enrollment_open_date
        ? batch.enrollment_open_date instanceof Date
          ? batch.enrollment_open_date.toISOString()
          : String(batch.enrollment_open_date)
        : null,
      enrollmentCloseDate: batch.enrollment_close_date
        ? batch.enrollment_close_date instanceof Date
          ? batch.enrollment_close_date.toISOString()
          : String(batch.enrollment_close_date)
        : null,
      durationDays:
        batch.duration_days === null ? null : Number(batch.duration_days),
      validityDays:
        batch.validity_days === null ? null : Number(batch.validity_days),
      priceInr: batch.price_inr,
      priceUsd: batch.price_usd,
      discountInr: batch.discount_inr,
      discountUsd: batch.discount_usd,
      purchaseMode: String(batch.purchase_mode ?? "PAID"),
      itemCount: mappedItems.length,
      totalEnrollments: Number(batch.total_enrollments ?? 0),
      sortOrder: Number(batch.sort_order ?? 0),
      createdAt:
        batch.created_at instanceof Date
          ? batch.created_at.toISOString()
          : String(batch.created_at),
      updatedAt:
        batch.updated_at instanceof Date
          ? batch.updated_at.toISOString()
          : String(batch.updated_at),
      items: mappedItems,
    };
  }

  async findById(tenantId: string, batchId: string) {
    return db
      .selectFrom("batches")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", batchId)
      .executeTakeFirst();
  }

  /**
   * Active enrollment for member in this batch (used to gate dashboard / calendar / content tabs).
   */
  async findActiveEnrollment(tenantId: string, batchId: string, memberId: string) {
    return db
      .selectFrom("batch_enrollments")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .where("tenant_member_id", "=", memberId)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .executeTakeFirst();
  }

  async listMyBatches(tenantId: string, memberId: string) {
    const rows = await db
      .selectFrom("batch_enrollments")
      .innerJoin("batches", "batches.id", "batch_enrollments.batch_id")
      .select([
        "batches.id as id",
        "batches.title as title",
        "batches.slug as slug",
        "batches.subtitle as subtitle",
        "batches.thumbnail_url as thumbnail_url",
        "batches.cover_image_url as cover_image_url",
        "batches.start_date as start_date",
        "batches.end_date as end_date",
        "batches.status as status",
        "batch_enrollments.joined_at as joined_at",
        "batch_enrollments.valid_till as valid_till",
        "batch_enrollments.status as enrollment_status",
      ])
      .where("batch_enrollments.tenant_id", "=", tenantId)
      .where("batch_enrollments.tenant_member_id", "=", memberId)
      .where("batch_enrollments.status", "=", enrollment_status.ACTIVE)
      .orderBy("batches.start_date", "asc")
      .execute();

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      subtitle: r.subtitle,
      thumbnailUrl: resolveThumbnailUrl(r.thumbnail_url) ?? r.thumbnail_url,
      coverImageUrl: resolveThumbnailUrl(r.cover_image_url) ?? r.cover_image_url,
      startDate:
        r.start_date instanceof Date ? r.start_date.toISOString() : String(r.start_date),
      endDate: r.end_date
        ? r.end_date instanceof Date
          ? r.end_date.toISOString()
          : String(r.end_date)
        : null,
      status: String(r.status),
      enrollmentStatus: String(r.enrollment_status),
      joinedAt:
        r.joined_at instanceof Date ? r.joined_at.toISOString() : String(r.joined_at),
      validTill: r.valid_till
        ? r.valid_till instanceof Date
          ? r.valid_till.toISOString()
          : String(r.valid_till)
        : null,
    }));
  }
}

const batchesRepository = new BatchesRepository();
export default batchesRepository;
