import { ulid } from "ulid";
import { sql } from "kysely";
import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB, courses } from "../db/types";
import type { course_status, course_mode, course_difficulty, purchase_mode, course_type } from "../db/enums";
import { findBundlesForContent, type BundleRef } from "./content-bundles.repository";

export type CourseRow = courses;

export interface CoursesListParams {
  page?: number;
  limit?: number;
  status?: string;
  mode?: string;
  course_type?: string;
  /** Case-insensitive substring match on the title. */
  search?: string;
}

/**
 * List rows carry the id of the course's landing page (the tenant_pages row
 * whose slug is "courses/<course.slug>"), resolved via a correlated subquery
 * on the unique (tenant_id, slug) index; null when that page row is missing.
 * The admin UI keys its editor/LMS links on this page id, so it must come
 * from here rather than from a separately fetched (and server-capped) pages
 * list.
 */
export type CourseListRow = CourseRow & {
  page_id: string | null;
  /** Bundles containing this course, drives the "Part of X" chip. */
  bundles: BundleRef[];
};

export interface CoursesListResult {
  courses: CourseListRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCourseInput {
  tenant_id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  purchase_mode?: string;
  status?: string;
  mode?: string;
  difficulty?: string;
  course_type?: string;
  language?: string[];
  thumbnail_key?: string | null;
  secondary_thumbnail_key?: string | null;
  preview_key?: string | null;
  duration?: string | null;
  learning_outcomes?: string[];
  prerequisites?: string[];
  class_timing?: string | null;
  start_date?: string | null;
  sort_order?: number;
  validity_days?: number | null;
  /** Multi-currency price book; consumed by the service layer, not stored on courses */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

export interface UpdateCourseInput {
  title?: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  purchase_mode?: string;
  status?: string;
  mode?: string;
  difficulty?: string;
  course_type?: string;
  language?: string[];
  thumbnail_key?: string | null;
  secondary_thumbnail_key?: string | null;
  preview_key?: string | null;
  duration?: string | null;
  learning_outcomes?: string[];
  prerequisites?: string[];
  class_timing?: string | null;
  start_date?: string | null;
  sort_order?: number;
  validity_days?: number | null;
  lms_template_id?: string | null;
  lms_settings?: unknown;
  /** Category IDs for course_categories junction; not stored on courses table */
  category_ids?: string[];
  /** Multi-currency price book; consumed by the service layer, not stored on courses */
  prices?: Array<{ currency: string; amount: number | string; discount?: number | string | null }>;
}

class CoursesRepository {
  async findByTenantId(
    tenantId: string,
    params: CoursesListParams = {}
  ): Promise<CoursesListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("courses")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    // Correlated subquery (not a join) so the unqualified where/orderBy
    // column refs in this builder stay unambiguous; resolves via the unique
    // tenant_pages (tenant_id, slug) index.
    let listQuery = db
      .selectFrom("courses")
      .selectAll()
      .select((eb) =>
        eb
          .selectFrom("tenant_pages")
          .select("tenant_pages.id")
          .whereRef("tenant_pages.tenant_id", "=", "courses.tenant_id")
          .where(
            sql<boolean>`${sql.ref("tenant_pages.slug")} = 'courses/' || ${sql.ref("courses.slug")}`
          )
          .limit(1)
          .as("page_id")
      )
      .where("tenant_id", "=", tenantId);

    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status as course_status);
      listQuery = listQuery.where("status", "=", params.status as course_status);
    }
    if (params.mode) {
      countQuery = countQuery.where("mode", "=", params.mode as course_mode);
      listQuery = listQuery.where("mode", "=", params.mode as course_mode);
    }
    if (params.course_type) {
      countQuery = countQuery.where("course_type", "=", params.course_type as course_type);
      listQuery = listQuery.where("course_type", "=", params.course_type as course_type);
    }
    // Title search. The agent's `course.search` capability has always SENT this
    // parameter and the route has always ignored it, so "how is the Python
    // course doing?" searched, got an unfiltered page of unrelated courses back,
    // and correctly concluded the course did not exist. Every name-based agent
    // request into courses was affected.
    if (params.search?.trim()) {
      const needle = `%${params.search.trim()}%`;
      countQuery = countQuery.where("title", "ilike", needle);
      listQuery = listQuery.where("title", "ilike", needle);
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await listQuery
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // One batched lookup for the whole page, merged by id below, never a
    // query per card.
    const bundleMap = await findBundlesForContent(tenantId, {
      courseIds: rows.map((r) => (r as { id: string }).id),
    });

    return {
      courses: rows.map((r) => ({
        ...r,
        bundles: bundleMap.get((r as { id: string }).id) ?? [],
      })) as unknown as CourseListRow[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, tenantId?: string): Promise<CourseRow | null> {
    let query = db
      .selectFrom("courses")
      .selectAll()
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const row = await query.executeTakeFirst();
    return row as unknown as CourseRow | null;
  }

  async findByTenantAndSlug(
    tenantId: string,
    slug: string
  ): Promise<CourseRow | null> {
    const row = await db
      .selectFrom("courses")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row as unknown as CourseRow | null;
  }

  async slugExistsForTenant(
    tenantId: string,
    slug: string,
    excludeId?: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    let query = (trx || db)
      .selectFrom("courses")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug);
    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }
    const result = await query.executeTakeFirst();
    return !!result;
  }

  async create(data: CreateCourseInput, trx?: Transaction<DB>): Promise<CourseRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("courses")
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
        purchase_mode: (data.purchase_mode as purchase_mode) ?? "PAID",
        status: (data.status as course_status) ?? "DRAFT",
        mode: (data.mode as course_mode) ?? "SELF_PACED",
        difficulty: (data.difficulty as course_difficulty) ?? "NONE",
        course_type: (data.course_type as course_type) ?? "NORMAL",
        language: data.language ?? ["English"],
        thumbnail_key: data.thumbnail_key ?? null,
        secondary_thumbnail_key: data.secondary_thumbnail_key ?? null,
        preview_key: data.preview_key ?? null,
        duration: data.duration ?? null,
        learning_outcomes: data.learning_outcomes ?? [],
        prerequisites: data.prerequisites ?? [],
        class_timing: data.class_timing ?? null,
        start_date: data.start_date ?? null,
        sort_order: data.sort_order ?? 0,
        validity_days: data.validity_days === undefined ? 365 : data.validity_days,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as CourseRow;
  }

  async update(id: string, data: UpdateCourseInput, trx?: Transaction<DB>, tenantId?: string): Promise<CourseRow | null> {
    const { category_ids: _categoryIds, ...rest } = data;
    const now = new Date();
    const updateData: Record<string, unknown> = {
      updated_at: now,
    };
    if (rest.title !== undefined) updateData.title = rest.title;
    if (rest.slug !== undefined) updateData.slug = rest.slug;
    if (rest.subtitle !== undefined) updateData.subtitle = rest.subtitle;
    if (rest.description !== undefined) updateData.description = rest.description;
    if (rest.price_inr !== undefined) updateData.price_inr = rest.price_inr;
    if (rest.price_usd !== undefined) updateData.price_usd = rest.price_usd;
    if (rest.discount_inr !== undefined) updateData.discount_inr = rest.discount_inr;
    if (rest.discount_usd !== undefined) updateData.discount_usd = rest.discount_usd;
    if (rest.purchase_mode !== undefined) updateData.purchase_mode = rest.purchase_mode;
    if (rest.status !== undefined) updateData.status = rest.status;
    if (rest.mode !== undefined) updateData.mode = rest.mode;
    if (rest.difficulty !== undefined) updateData.difficulty = rest.difficulty;
    if (rest.course_type !== undefined) updateData.course_type = rest.course_type;
    if (rest.language !== undefined) updateData.language = rest.language;
    if (rest.thumbnail_key !== undefined) updateData.thumbnail_key = rest.thumbnail_key;
    if (rest.secondary_thumbnail_key !== undefined) updateData.secondary_thumbnail_key = rest.secondary_thumbnail_key;
    if (rest.preview_key !== undefined) updateData.preview_key = rest.preview_key;
    if (rest.duration !== undefined) updateData.duration = rest.duration;
    if (rest.learning_outcomes !== undefined) updateData.learning_outcomes = rest.learning_outcomes;
    if (rest.prerequisites !== undefined) updateData.prerequisites = rest.prerequisites;
    if (rest.class_timing !== undefined) updateData.class_timing = rest.class_timing;
    if (rest.validity_days !== undefined) updateData.validity_days = rest.validity_days;
    if (rest.start_date !== undefined) updateData.start_date = rest.start_date;
    if (rest.sort_order !== undefined) updateData.sort_order = rest.sort_order;
    if (rest.lms_template_id !== undefined) updateData.lms_template_id = rest.lms_template_id;
    if (rest.lms_settings !== undefined) {
      updateData.lms_settings =
        typeof rest.lms_settings === "string"
          ? rest.lms_settings
          : JSON.stringify(rest.lms_settings ?? {});
    }

    let query = (trx || db)
      .updateTable("courses")
      .set(updateData as Record<string, unknown>)
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query
      .returningAll()
      .executeTakeFirst();
    return result as unknown as CourseRow | null;
  }

  async delete(id: string, trx?: Transaction<DB>, tenantId?: string): Promise<boolean> {
    let query = (trx || db)
      .deleteFrom("courses")
      .where("id", "=", id);

    if (tenantId) {
      query = query.where("tenant_id", "=", tenantId);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.numDeletedRows ?? 0) > 0;
  }
}

const coursesRepository = new CoursesRepository();
export default coursesRepository;
