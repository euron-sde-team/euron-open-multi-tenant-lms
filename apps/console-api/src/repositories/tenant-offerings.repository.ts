import { sql } from "kysely";
import { db } from "../db/connection";
import {
  CountBreakdown,
  OfferingBatchListItem,
  OfferingBookDetail,
  OfferingBookListItem,
  OfferingBundleListItem,
  OfferingCourseDetail,
  OfferingCourseListItem,
  OfferingItemRef,
  OfferingTestSeriesListItem,
  OfferingsBooksQueryParams,
  OfferingsCoursesQueryParams,
  TenantOfferingsSummary,
} from "../types/tenant-offerings.type";
import { PaginationParams } from "../types/tenant.type";

/** Parse a possibly-string numeric column to a number. */
const num = (v: unknown): number =>
  typeof v === "string" ? parseFloat(v) || 0 : Number(v ?? 0);

/** Parse a nullable decimal column to number | null. */
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : num(v);

/** Roll grouped { key, count } rows into a CountBreakdown map + total. */
const toBreakdown = (
  rows: { key: unknown; count: unknown }[]
): { total: number; map: CountBreakdown } => {
  const map: CountBreakdown = {};
  let total = 0;
  for (const r of rows) {
    const c = num(r.count);
    map[String(r.key)] = c;
    total += c;
  }
  return { total, map };
};

class TenantOfferingsRepository {
  // ============================================
  // SUMMARY
  // ============================================

  async getSummary(tenantId: string): Promise<TenantOfferingsSummary> {
    const groupCount = (table: "courses" | "books" | "bundles" | "batches" | "test_series", col: string) =>
      db
        .selectFrom(table)
        .select([sql.ref(col).as("key"), db.fn.countAll().as("count")])
        .where("tenant_id", "=", tenantId)
        .groupBy(sql.ref(col))
        .execute();

    const accessCount = (
      table:
        | "enrollments"
        | "book_access"
        | "batch_enrollments"
        | "test_series_enrollments"
    ) =>
      db
        .selectFrom(table)
        .select(db.fn.countAll().as("count"))
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst();

    const [
      coursesByStatus,
      coursesByType,
      coursesByMode,
      booksByStatus,
      bundlesByStatus,
      batchesByStatus,
      testSeriesByStatus,
      enrollmentsCount,
      bookAccessCount,
      batchEnrollmentsCount,
      testSeriesEnrollmentsCount,
    ] = await Promise.all([
      groupCount("courses", "status"),
      groupCount("courses", "course_type"),
      groupCount("courses", "mode"),
      groupCount("books", "status"),
      groupCount("bundles", "status"),
      groupCount("batches", "status"),
      groupCount("test_series", "status"),
      accessCount("enrollments"),
      accessCount("book_access"),
      accessCount("batch_enrollments"),
      accessCount("test_series_enrollments"),
    ]);

    const courseStatus = toBreakdown(coursesByStatus);
    return {
      courses: {
        total: courseStatus.total,
        by_status: courseStatus.map,
        by_type: toBreakdown(coursesByType).map,
        by_mode: toBreakdown(coursesByMode).map,
      },
      books: {
        total: toBreakdown(booksByStatus).total,
        by_status: toBreakdown(booksByStatus).map,
      },
      bundles: {
        total: toBreakdown(bundlesByStatus).total,
        by_status: toBreakdown(bundlesByStatus).map,
      },
      batches: {
        total: toBreakdown(batchesByStatus).total,
        by_status: toBreakdown(batchesByStatus).map,
      },
      test_series: {
        total: toBreakdown(testSeriesByStatus).total,
        by_status: toBreakdown(testSeriesByStatus).map,
      },
      access_grants: {
        enrollments: num(enrollmentsCount?.count),
        book_access: num(bookAccessCount?.count),
        batch_enrollments: num(batchEnrollmentsCount?.count),
        test_series_enrollments: num(testSeriesEnrollmentsCount?.count),
      },
    };
  }

  // ============================================
  // COURSES
  // ============================================

  async listCourses(
    tenantId: string,
    params: OfferingsCoursesQueryParams
  ): Promise<{ items: OfferingCourseListItem[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("courses")
      .select([
        "id",
        "title",
        "slug",
        "status",
        "course_type",
        "mode",
        "purchase_mode",
        "price_inr",
        "price_usd",
        "validity_days",
        "created_at",
      ])
      .where("tenant_id", "=", tenantId);
    let countQuery = db
      .selectFrom("courses")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId);

    if (params.status) {
      query = query.where("status", "=", params.status as never);
      countQuery = countQuery.where("status", "=", params.status as never);
    }
    if (params.course_type) {
      query = query.where("course_type", "=", params.course_type as never);
      countQuery = countQuery.where("course_type", "=", params.course_type as never);
    }
    if (params.mode) {
      query = query.where("mode", "=", params.mode as never);
      countQuery = countQuery.where("mode", "=", params.mode as never);
    }
    if (params.search) {
      const pattern = `%${params.search}%`;
      query = query.where("title", "ilike", pattern);
      countQuery = countQuery.where("title", "ilike", pattern);
    }

    const [rows, countResult] = await Promise.all([
      query
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    const courseIds = rows.map((r) => r.id);
    let sectionMap = new Map<string, number>();
    let lessonMap = new Map<string, number>();
    let lectureMap = new Map<string, number>();
    let enrollmentMap = new Map<string, number>();

    if (courseIds.length > 0) {
      const [sections, lessons, lectures, enrollments] =
        await Promise.all([
          db
            .selectFrom("course_sections")
            .select(["course_id", db.fn.countAll().as("count")])
            .where("tenant_id", "=", tenantId)
            .where("course_id", "in", courseIds)
            .groupBy("course_id")
            .execute(),
          db
            .selectFrom("course_lessons")
            .select(["course_id", db.fn.countAll().as("count")])
            .where("tenant_id", "=", tenantId)
            .where("course_id", "in", courseIds)
            .groupBy("course_id")
            .execute(),
          db
            .selectFrom("lectures")
            .select(["course_id", db.fn.countAll().as("count")])
            .where("tenant_id", "=", tenantId)
            .where("course_id", "in", courseIds)
            .groupBy("course_id")
            .execute(),
          db
            .selectFrom("enrollments")
            .select(["course_id", db.fn.countAll().as("count")])
            .where("tenant_id", "=", tenantId)
            .where("course_id", "in", courseIds)
            .groupBy("course_id")
            .execute(),
        ]);

      sectionMap = new Map(sections.map((s) => [s.course_id, num(s.count)]));
      lessonMap = new Map(lessons.map((l) => [l.course_id, num(l.count)]));
      lectureMap = new Map(lectures.map((l) => [l.course_id, num(l.count)]));
      enrollmentMap = new Map(
        enrollments.map((e) => [e.course_id, num(e.count)])
      );
    }

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        status: r.status as string,
        course_type: r.course_type as string,
        mode: r.mode as string,
        purchase_mode: r.purchase_mode as string,
        price_inr: numOrNull(r.price_inr),
        price_usd: numOrNull(r.price_usd),
        validity_days: num(r.validity_days),
        created_at: r.created_at as Date,
        section_count: sectionMap.get(r.id) ?? 0,
        lesson_count: lessonMap.get(r.id) ?? 0,
        lecture_count: lectureMap.get(r.id) ?? 0,
        enrollment_count: enrollmentMap.get(r.id) ?? 0,
      })),
      total: num(countResult?.count),
    };
  }

  async getCourseDetail(
    tenantId: string,
    courseId: string
  ): Promise<OfferingCourseDetail | null> {
    const course = await db
      .selectFrom("courses")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", courseId)
      .executeTakeFirst();
    if (!course) return null;

    const [sections, lessons, lectures, enrollmentCount] =
      await Promise.all([
        db
          .selectFrom("course_sections")
          .select(["id", "title"])
          .where("tenant_id", "=", tenantId)
          .where("course_id", "=", courseId)
          .orderBy("sort_order", "asc")
          .execute(),
        db
          .selectFrom("course_lessons")
          .select(["id", "section_id", "title", "type"])
          .where("tenant_id", "=", tenantId)
          .where("course_id", "=", courseId)
          .orderBy("sort_order", "asc")
          .execute(),
        db
          .selectFrom("lectures")
          .select([
            "id",
            "lesson_id",
            "title",
            "duration",
            "processing_status",
            "video_provider",
          ])
          .where("tenant_id", "=", tenantId)
          .where("course_id", "=", courseId)
          .orderBy("created_at", "asc")
          .execute(),
        db
          .selectFrom("enrollments")
          .select(db.fn.countAll().as("count"))
          .where("tenant_id", "=", tenantId)
          .where("course_id", "=", courseId)
          .executeTakeFirst(),
      ]);

    const lecturesByLesson = new Map<string, OfferingCourseDetail["sections"][number]["lessons"][number]["lectures"]>();
    for (const lec of lectures) {
      const list = lecturesByLesson.get(lec.lesson_id) ?? [];
      list.push({
        id: lec.id,
        title: lec.title,
        duration: lec.duration,
        processing_status: lec.processing_status as string,
        video_provider: (lec.video_provider as string | null) ?? null,
      });
      lecturesByLesson.set(lec.lesson_id, list);
    }

    const lessonsBySection = new Map<string, OfferingCourseDetail["sections"][number]["lessons"]>();
    for (const lesson of lessons) {
      const list = lessonsBySection.get(lesson.section_id) ?? [];
      list.push({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type as string,
        lectures: lecturesByLesson.get(lesson.id) ?? [],
      });
      lessonsBySection.set(lesson.section_id, list);
    }

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      subtitle: course.subtitle,
      description: course.description,
      status: course.status as string,
      course_type: course.course_type as string,
      mode: course.mode as string,
      purchase_mode: course.purchase_mode as string,
      difficulty: course.difficulty as string,
      language: (course.language as string[]) ?? [],
      duration: course.duration,
      learning_outcomes: (course.learning_outcomes as string[]) ?? [],
      prerequisites: (course.prerequisites as string[]) ?? [],
      price_inr: numOrNull(course.price_inr),
      price_usd: numOrNull(course.price_usd),
      validity_days: num(course.validity_days),
      enrollment_count: num(enrollmentCount?.count),
      total_lectures: lectures.length,
      sections: sections.map((s) => ({
        id: s.id,
        title: s.title,
        lessons: lessonsBySection.get(s.id) ?? [],
      })),
    };
  }

  // ============================================
  // BOOKS
  // ============================================

  async listBooks(
    tenantId: string,
    params: OfferingsBooksQueryParams
  ): Promise<{ items: OfferingBookListItem[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("books")
      .select([
        "id",
        "title",
        "slug",
        "author",
        "status",
        "purchase_mode",
        "file_format",
        "pages",
        "price_inr",
        "price_usd",
        "validity_days",
        "sample_enabled",
        "sample_pages",
        "created_at",
      ])
      .where("tenant_id", "=", tenantId);
    let countQuery = db
      .selectFrom("books")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId);

    if (params.status) {
      query = query.where("status", "=", params.status as never);
      countQuery = countQuery.where("status", "=", params.status as never);
    }
    if (params.file_format) {
      query = query.where("file_format", "=", params.file_format as never);
      countQuery = countQuery.where("file_format", "=", params.file_format as never);
    }
    if (params.search) {
      const pattern = `%${params.search}%`;
      query = query.where("title", "ilike", pattern);
      countQuery = countQuery.where("title", "ilike", pattern);
    }

    const [rows, countResult] = await Promise.all([
      query.orderBy("created_at", "desc").limit(limit).offset(offset).execute(),
      countQuery.executeTakeFirst(),
    ]);

    const bookIds = rows.map((r) => r.id);
    let accessMap = new Map<string, number>();
    if (bookIds.length > 0) {
      const access = await db
        .selectFrom("book_access")
        .select(["book_id", db.fn.countAll().as("count")])
        .where("tenant_id", "=", tenantId)
        .where("book_id", "in", bookIds)
        .groupBy("book_id")
        .execute();
      accessMap = new Map(access.map((a) => [a.book_id, num(a.count)]));
    }

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        author: r.author,
        status: r.status as string,
        purchase_mode: r.purchase_mode as string,
        file_format: r.file_format as string,
        pages: r.pages,
        price_inr: numOrNull(r.price_inr),
        price_usd: numOrNull(r.price_usd),
        validity_days: num(r.validity_days),
        sample_enabled: !!r.sample_enabled,
        sample_pages: r.sample_pages,
        created_at: r.created_at as Date,
        book_access_count: accessMap.get(r.id) ?? 0,
      })),
      total: num(countResult?.count),
    };
  }

  async getBookDetail(
    tenantId: string,
    bookId: string
  ): Promise<OfferingBookDetail | null> {
    const book = await db
      .selectFrom("books")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", bookId)
      .executeTakeFirst();
    if (!book) return null;

    const [accessCount, conversions] = await Promise.all([
      db
        .selectFrom("book_access")
        .select(db.fn.countAll().as("count"))
        .where("tenant_id", "=", tenantId)
        .where("book_id", "=", bookId)
        .executeTakeFirst(),
      db
        .selectFrom("book_conversions")
        .select([
          "id",
          "source_type",
          "source_filename",
          "source_size_bytes",
          "output_key",
          "output_size_bytes",
          "status",
          "created_at",
          "completed_at",
        ])
        .where("tenant_id", "=", tenantId)
        .where("book_id", "=", bookId)
        .orderBy("created_at", "desc")
        .execute(),
    ]);

    return {
      id: book.id,
      title: book.title,
      slug: book.slug,
      author: book.author,
      status: book.status as string,
      purchase_mode: book.purchase_mode as string,
      file_format: book.file_format as string,
      pages: book.pages,
      price_inr: numOrNull(book.price_inr),
      price_usd: numOrNull(book.price_usd),
      validity_days: num(book.validity_days),
      sample_enabled: !!book.sample_enabled,
      sample_pages: book.sample_pages,
      created_at: book.created_at as Date,
      book_access_count: num(accessCount?.count),
      description: book.description,
      summary: book.summary,
      url: book.url,
      page_images_count: ((book.page_images as string[]) ?? []).length,
      conversions: conversions.map((c) => ({
        id: c.id,
        source_type: c.source_type as string,
        source_filename: c.source_filename,
        source_size_bytes: num(c.source_size_bytes),
        output_key: c.output_key,
        output_size_bytes: numOrNull(c.output_size_bytes),
        status: c.status as string,
        created_at: c.created_at as Date,
        completed_at: c.completed_at as Date | null,
      })),
    };
  }

  // ============================================
  // BUNDLES / BATCHES / TEST SERIES
  // ============================================

  /** Resolve { course_id, book_id } refs to titles/slugs in two batched lookups. */
  private async resolveItemTitles(
    tenantId: string,
    courseIds: string[],
    bookIds: string[]
  ): Promise<{
    courses: Map<string, { title: string; slug: string }>;
    books: Map<string, { title: string; slug: string }>;
  }> {
    const [courses, books] = await Promise.all([
      courseIds.length
        ? db
            .selectFrom("courses")
            .select(["id", "title", "slug"])
            .where("tenant_id", "=", tenantId)
            .where("id", "in", courseIds)
            .execute()
        : Promise.resolve([]),
      bookIds.length
        ? db
            .selectFrom("books")
            .select(["id", "title", "slug"])
            .where("tenant_id", "=", tenantId)
            .where("id", "in", bookIds)
            .execute()
        : Promise.resolve([]),
    ]);
    return {
      courses: new Map(courses.map((c) => [c.id, { title: c.title, slug: c.slug }])),
      books: new Map(books.map((b) => [b.id, { title: b.title, slug: b.slug }])),
    };
  }

  async listBundles(
    tenantId: string,
    params: PaginationParams
  ): Promise<{ items: OfferingBundleListItem[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db
        .selectFrom("bundles")
        .select([
          "id",
          "title",
          "slug",
          "status",
          "purchase_mode",
          "price_inr",
          "price_usd",
          "validity_days",
          "created_at",
        ])
        .where("tenant_id", "=", tenantId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      db
        .selectFrom("bundles")
        .select(db.fn.countAll().as("count"))
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst(),
    ]);

    const bundleIds = rows.map((r) => r.id);
    const itemsByBundle = new Map<string, OfferingItemRef[]>();
    if (bundleIds.length > 0) {
      const items = await db
        .selectFrom("bundle_items")
        .select(["bundle_id", "item_type", "course_id", "book_id"])
        .where("tenant_id", "=", tenantId)
        .where("bundle_id", "in", bundleIds)
        .orderBy("sort_order", "asc")
        .execute();
      const courseIds = items.flatMap((i) => (i.course_id ? [i.course_id] : []));
      const bookIds = items.flatMap((i) => (i.book_id ? [i.book_id] : []));
      const resolved = await this.resolveItemTitles(tenantId, courseIds, bookIds);
      for (const it of items) {
        const ref = it.course_id
          ? resolved.courses.get(it.course_id)
          : it.book_id
            ? resolved.books.get(it.book_id)
            : undefined;
        const list = itemsByBundle.get(it.bundle_id) ?? [];
        list.push({
          item_type: it.item_type as string,
          id: it.course_id ?? it.book_id ?? null,
          title: ref?.title ?? null,
          slug: ref?.slug ?? null,
        });
        itemsByBundle.set(it.bundle_id, list);
      }
    }

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        status: r.status as string,
        purchase_mode: r.purchase_mode as string,
        price_inr: numOrNull(r.price_inr),
        price_usd: numOrNull(r.price_usd),
        validity_days: num(r.validity_days),
        created_at: r.created_at as Date,
        items: itemsByBundle.get(r.id) ?? [],
      })),
      total: num(countResult?.count),
    };
  }

  async listBatches(
    tenantId: string,
    params: PaginationParams
  ): Promise<{ items: OfferingBatchListItem[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db
        .selectFrom("batches")
        .select([
          "id",
          "title",
          "slug",
          "status",
          "purchase_mode",
          "price_inr",
          "price_usd",
          "start_date",
          "end_date",
          "enrollment_open_date",
          "enrollment_close_date",
          "duration_days",
          "validity_days",
          "total_enrollments",
          "created_at",
        ])
        .where("tenant_id", "=", tenantId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      db
        .selectFrom("batches")
        .select(db.fn.countAll().as("count"))
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst(),
    ]);

    const batchIds = rows.map((r) => r.id);
    const itemsByBatch = new Map<string, OfferingItemRef[]>();
    if (batchIds.length > 0) {
      const items = await db
        .selectFrom("batch_items")
        .select(["batch_id", "item_type", "course_id", "book_id"])
        .where("tenant_id", "=", tenantId)
        .where("batch_id", "in", batchIds)
        .orderBy("sort_order", "asc")
        .execute();
      const courseIds = items.flatMap((i) => (i.course_id ? [i.course_id] : []));
      const bookIds = items.flatMap((i) => (i.book_id ? [i.book_id] : []));
      const resolved = await this.resolveItemTitles(tenantId, courseIds, bookIds);
      for (const it of items) {
        const ref = it.course_id
          ? resolved.courses.get(it.course_id)
          : it.book_id
            ? resolved.books.get(it.book_id)
            : undefined;
        const list = itemsByBatch.get(it.batch_id) ?? [];
        list.push({
          item_type: it.item_type as string,
          id: it.course_id ?? it.book_id ?? null,
          title: ref?.title ?? null,
          slug: ref?.slug ?? null,
        });
        itemsByBatch.set(it.batch_id, list);
      }
    }

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        status: r.status as string,
        purchase_mode: r.purchase_mode as string,
        price_inr: numOrNull(r.price_inr),
        price_usd: numOrNull(r.price_usd),
        start_date: r.start_date as Date,
        end_date: r.end_date as Date | null,
        enrollment_open_date: r.enrollment_open_date as Date | null,
        enrollment_close_date: r.enrollment_close_date as Date | null,
        duration_days: r.duration_days,
        validity_days: r.validity_days,
        total_enrollments: num(r.total_enrollments),
        created_at: r.created_at as Date,
        items: itemsByBatch.get(r.id) ?? [],
      })),
      total: num(countResult?.count),
    };
  }

  async listTestSeries(
    tenantId: string,
    params: PaginationParams
  ): Promise<{ items: OfferingTestSeriesListItem[]; total: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      db
        .selectFrom("test_series")
        .select([
          "id",
          "title",
          "slug",
          "status",
          "pricing_type",
          "price_inr",
          "price_usd",
          "validity_days",
          "visibility",
          "access_mode",
          "created_at",
        ])
        .where("tenant_id", "=", tenantId)
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      db
        .selectFrom("test_series")
        .select(db.fn.countAll().as("count"))
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst(),
    ]);

    const seriesIds = rows.map((r) => r.id);
    let testMap = new Map<string, number>();
    let enrollmentMap = new Map<string, number>();
    if (seriesIds.length > 0) {
      const [tests, enrollments] = await Promise.all([
        db
          .selectFrom("test_series_tests")
          .select(["test_series_id", db.fn.countAll().as("count")])
          .where("tenant_id", "=", tenantId)
          .where("test_series_id", "in", seriesIds)
          .groupBy("test_series_id")
          .execute(),
        db
          .selectFrom("test_series_enrollments")
          .select(["test_series_id", db.fn.countAll().as("count")])
          .where("tenant_id", "=", tenantId)
          .where("test_series_id", "in", seriesIds)
          .groupBy("test_series_id")
          .execute(),
      ]);
      testMap = new Map(tests.map((t) => [t.test_series_id, num(t.count)]));
      enrollmentMap = new Map(
        enrollments.map((e) => [e.test_series_id, num(e.count)])
      );
    }

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        status: r.status as string,
        pricing_type: r.pricing_type as string,
        price_inr: numOrNull(r.price_inr),
        price_usd: numOrNull(r.price_usd),
        validity_days: r.validity_days,
        visibility: r.visibility as string,
        access_mode: r.access_mode as string,
        created_at: r.created_at as Date,
        test_count: testMap.get(r.id) ?? 0,
        enrollment_count: enrollmentMap.get(r.id) ?? 0,
      })),
      total: num(countResult?.count),
    };
  }
}

export default new TenantOfferingsRepository();
