/**
 * Public (read-only) repository for courses and LMS data.
 * Used by the user-facing server to serve published course content without authentication.
 */

import { sql } from "kysely";
import config from "../config";
import { db } from "../db/connection";
import bundlesRepository from "./bundles.repository";
import type {
  courses,
  course_sections,
  course_lessons,
  lectures,
  course_faqs,
  course_reviews,
} from "../db/types";

export type CourseRow = courses;
export type CourseSectionRow = course_sections;
export type CourseLessonRow = course_lessons;
export type LectureRow = lectures;
export type CourseFaqRow = course_faqs;
export type CourseReviewRow = course_reviews;

export interface LessonResourceRow {
  id: string;
  lesson_id: string;
  type: string;
  title: string;
  url: string | null;
  content: string | null;
  downloadable: boolean;
  sort_order: number;
}

/** Find a published course by slug within a tenant. */
export async function findPublishedCourseBySlug(
  tenantId: string,
  slug: string,
  options?: { allowArchived?: boolean }
): Promise<CourseRow | undefined> {
  const statusFilter = options?.allowArchived
    ? ["PUBLISHED", "ARCHIVED"] as const
    : ["PUBLISHED"] as const;
  const row = await db
    .selectFrom("courses")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("slug", "=", slug)
    .where("status", "in", statusFilter)
    .executeTakeFirst();
  return row as unknown as CourseRow | undefined;
}

/** Find sections for a course, ordered. */
export async function findSectionsByCourseId(
  tenantId: string,
  courseId: string
): Promise<CourseSectionRow[]> {
  const rows = await db
    .selectFrom("course_sections")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "asc")
    .execute();
  return rows as unknown as CourseSectionRow[];
}

/** Find lessons for a section, ordered. */
export async function findLessonsBySectionId(
  tenantId: string,
  sectionId: string
): Promise<CourseLessonRow[]> {
  const rows = await db
    .selectFrom("course_lessons")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("section_id", "=", sectionId)
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "asc")
    .execute();
  return rows as unknown as CourseLessonRow[];
}

/** Find the lecture for a lesson. */
export async function findLectureByLessonId(
  tenantId: string,
  lessonId: string
): Promise<LectureRow | null> {
  const row = await db
    .selectFrom("lectures")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("lesson_id", "=", lessonId)
    .executeTakeFirst();
  return (row as unknown as LectureRow) ?? null;
}

/** Find all lesson resources for a course in one query, ordered. */
export async function findLessonResourcesByCourseId(
  tenantId: string,
  courseId: string
): Promise<LessonResourceRow[]> {
  const rows = await db
    .selectFrom("lesson_resources")
    .select([
      "id",
      "lesson_id",
      "type",
      "title",
      "url",
      "content",
      "downloadable",
      "sort_order",
    ])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "asc")
    .execute();
  return rows;
}

/** Find FAQs for a course, ordered. */
export async function findFaqsByCourseId(
  tenantId: string,
  courseId: string
): Promise<CourseFaqRow[]> {
  const rows = await db
    .selectFrom("course_faqs")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "asc")
    .execute();
  return rows as unknown as CourseFaqRow[];
}

/** Get total lecture count per course. Returns Map<courseId, totalCount>. */
export async function getLectureCountsByCourseIds(
  tenantId: string,
  courseIds: string[]
): Promise<Map<string, number>> {
  if (courseIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("lectures")
    .select(["course_id", db.fn.count("id").as("count")])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "in", courseIds)
    .groupBy("course_id")
    .execute();

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.course_id, Number(r.count));
  }
  return map;
}

/** Get assignment lesson count per course (course_lessons where type=ASSIGNMENT). Returns Map<courseId, count>. */
export async function getAssignmentLessonCountsByCourseIds(
  tenantId: string,
  courseIds: string[]
): Promise<Map<string, number>> {
  if (courseIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("course_lessons")
    .select(["course_id", db.fn.count("id").as("count")])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "in", courseIds)
    .where("type", "=", "ASSIGNMENT")
    .groupBy("course_id")
    .execute();

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.course_id, Number(r.count));
  }
  return map;
}

/** Get quiz lesson count per course (course_lessons where type=QUIZ). Returns Map<courseId, count>. */
export async function getQuizLessonCountsByCourseIds(
  tenantId: string,
  courseIds: string[]
): Promise<Map<string, number>> {
  if (courseIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("course_lessons")
    .select(["course_id", db.fn.count("id").as("count")])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "in", courseIds)
    .where("type", "=", "QUIZ")
    .groupBy("course_id")
    .execute();

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.course_id, Number(r.count));
  }
  return map;
}

/** Find course by id (for validation). */
export async function findCourseById(
  tenantId: string,
  courseId: string
): Promise<CourseRow | undefined> {
  const row = await db
    .selectFrom("courses")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("id", "=", courseId)
    .executeTakeFirst();
  return row as unknown as CourseRow | undefined;
}

// --- Course reviews ---

export async function findReviewsByCourseId(
  tenantId: string,
  courseId: string,
  options?: { showHidden?: boolean }
): Promise<(CourseReviewRow & { member_name: string | null; member_avatar_url: string | null })[]> {
  let q = db
    .selectFrom("course_reviews")
    .leftJoin("tenant_members", "tenant_members.id", "course_reviews.tenant_member_id")
    .selectAll("course_reviews")
    .select(["tenant_members.name as member_name", "tenant_members.avatar_url as member_avatar_url"])
    .where("course_reviews.tenant_id", "=", tenantId)
    .where("course_reviews.course_id", "=", courseId);
  if (!options?.showHidden) {
    q = q.where("course_reviews.is_visible", "=", true);
  }
  q = q.orderBy("course_reviews.created_at", "desc");
  const rows = await q.execute();
  return rows as unknown as (CourseReviewRow & { member_name: string | null; member_avatar_url: string | null })[];
}

export async function createReview(data: {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  rating: number;
  review_text: string | null;
  created_at: Date;
  updated_at: Date;
}): Promise<CourseReviewRow> {
  await db
    .insertInto("course_reviews")
    .values({
      id: data.id,
      tenant_id: data.tenant_id,
      tenant_member_id: data.tenant_member_id,
      course_id: data.course_id,
      rating: data.rating,
      review_text: data.review_text,
      created_at: data.created_at,
      updated_at: data.updated_at,
    })
    .execute();
  return (await db
    .selectFrom("course_reviews")
    .selectAll()
    .where("id", "=", data.id)
    .executeTakeFirst()) as unknown as CourseReviewRow;
}

export async function findReviewByTenantMemberAndCourse(
  tenantId: string,
  tenantMemberId: string,
  courseId: string
): Promise<CourseReviewRow | null> {
  const row = await db
    .selectFrom("course_reviews")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", tenantMemberId)
    .where("course_id", "=", courseId)
    .executeTakeFirst();
  return (row as unknown as CourseReviewRow) ?? null;
}

// --- Course listing with pagination ---

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "title" | "sort_order";
  sortOrder?: "asc" | "desc";
  mode?: "SELF_PACED";
  courseType?: "NORMAL" | "PROJECT";
  categorySlug?: string;
  /** When true, only return courses the member has bookmarked. Requires memberId. */
  bookmarkedOnly?: boolean;
  /** When true, only return courses the member is enrolled in. Requires memberId. */
  enrolledOnly?: boolean;
  /** Filter by purchase mode (FREE or PAID). */
  purchaseMode?: "FREE" | "PAID";
  /** When true, include ARCHIVED courses alongside PUBLISHED. */
  allowArchived?: boolean;
  memberId?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PublishedCourseListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  secondaryThumbnailUrl: string | null;
  duration: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  mode: string;
  courseType: string;
  difficulty: string;
  language: string[];
  status: string;
  instructor: { id: string; name: string; avatar: string | null } | null;
  /**
   * PUBLISHED bundles that include this course, so the card can show
   * "Part of <Bundle>". Empty when it belongs to none.
   */
  bundles: Array<{ id: string; title: string; slug: string }>;
  /** Progress percentage (0-100). Only present when enrolledOnly and member has access. */
  progress_percent?: number;
  completed_lectures?: number;
  total_lectures?: number;
}

export interface PublishedCoursesResult {
  courses: PublishedCourseListItem[];
  pagination: PaginationMeta;
}

/**
 * Find published courses for a tenant with pagination.
 * Returns course list items with first instructor info.
 */
export async function findPublishedCourses(
  tenantId: string,
  options: PaginationOptions = {}
): Promise<PublishedCoursesResult> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(50, Math.max(1, options.limit || 8));
  const sortBy = options.sortBy || "sort_order";
  const sortOrder = options.sortOrder || "asc";
  const offset = (page - 1) * limit;
  const mode = options.mode;
  const courseType = options.courseType;
  const categorySlug = options.categorySlug;
  const bookmarkedOnly = options.bookmarkedOnly && options.memberId;
  const enrolledOnly = options.enrolledOnly && options.memberId;
  const purchaseMode = options.purchaseMode;

  // Resolve category ID if filtering by category slug
  let categoryId: string | undefined;
  if (categorySlug) {
    const cat = await db
      .selectFrom("categories")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", categorySlug)
      .where("is_active", "=", true)
      .executeTakeFirst();
    categoryId = cat?.id;
  }

  // Get total count.
  // "My learning" / enrolled lists must keep showing a course the learner has
  // access to even after the admin unpublishes it (unpublish drops the course
  // to DRAFT). Access is already gated by the ACTIVE + still-valid enrollment
  // below, and validity dates handle expiry, so don't hide enrolled courses by
  // publish status. Catalog / browse lists stay PUBLISHED-only.
  const statusFilter = enrolledOnly
    ? (["PUBLISHED", "ARCHIVED", "DRAFT"] as const)
    : options.allowArchived
      ? (["PUBLISHED", "ARCHIVED"] as const)
      : (["PUBLISHED"] as const);
  let countQuery = db
    .selectFrom("courses")
    .select(db.fn.countAll().as("count"))
    .where("courses.tenant_id", "=", tenantId)
    .where("courses.status", "in", statusFilter);

  if (categoryId) {
    countQuery = countQuery
      .innerJoin("course_categories", "course_categories.course_id", "courses.id")
      .where("course_categories.tenant_id", "=", tenantId)
      .where("course_categories.category_id", "=", categoryId);
  }

  // Apply mode filter if provided
  if (mode) {
    countQuery = countQuery.where("courses.mode", "=", mode);
  }

  // Apply course_type filter if provided
  if (courseType) {
    countQuery = countQuery.where("courses.course_type", "=", courseType);
  }

  if (purchaseMode) {
    countQuery = countQuery.where("courses.purchase_mode", "=", purchaseMode);
  }

  let enrolledCourseIds: string[] | undefined;
  if (enrolledOnly) {
    const enrolled = await db
      .selectFrom("enrollments")
      .select("course_id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", options.memberId!)
      .where("status", "=", "ACTIVE")
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .execute();
    enrolledCourseIds = enrolled.map((e) => e.course_id);
    if (enrolledCourseIds.length === 0) {
      return {
        courses: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      };
    }
    countQuery = countQuery.where("courses.id", "in", enrolledCourseIds);
  }

  if (bookmarkedOnly) {
    countQuery = countQuery
      .innerJoin(
        "member_bookmarks",
        "member_bookmarks.course_id",
        "courses.id"
      )
      .where("member_bookmarks.tenant_id", "=", tenantId)
      .where("member_bookmarks.tenant_member_id", "=", options.memberId!)
      .where("member_bookmarks.bookmark_type", "=", "COURSE");
  }

  const countResult = await countQuery.executeTakeFirst();

  const total = Number(countResult?.count || 0);
  const totalPages = Math.ceil(total / limit);

  // Get courses
  let coursesQuery = db
    .selectFrom("courses")
    .select([
      "courses.id",
      "courses.title",
      "courses.slug",
      "courses.subtitle",
      "courses.description",
      "courses.thumbnail_key",
      "courses.secondary_thumbnail_key",
      "courses.duration",
      "courses.price_inr",
      "courses.price_usd",
      "courses.discount_inr",
      "courses.discount_usd",
      "courses.purchase_mode",
      "courses.mode",
      "courses.course_type",
      "courses.difficulty",
      "courses.language",
      "courses.status",
    ])
    .where("courses.tenant_id", "=", tenantId)
    .where("courses.status", "in", statusFilter);

  if (categoryId) {
    coursesQuery = coursesQuery
      .innerJoin("course_categories", "course_categories.course_id", "courses.id")
      .where("course_categories.tenant_id", "=", tenantId)
      .where("course_categories.category_id", "=", categoryId);
  }

  // Apply mode filter if provided
  if (mode) {
    coursesQuery = coursesQuery.where("courses.mode", "=", mode);
  }

  // Apply course_type filter if provided
  if (courseType) {
    coursesQuery = coursesQuery.where("courses.course_type", "=", courseType);
  }

  if (purchaseMode) {
    coursesQuery = coursesQuery.where("courses.purchase_mode", "=", purchaseMode);
  }

  if (enrolledOnly && enrolledCourseIds && enrolledCourseIds.length > 0) {
    coursesQuery = coursesQuery.where("courses.id", "in", enrolledCourseIds);
  }

  if (bookmarkedOnly) {
    coursesQuery = coursesQuery
      .innerJoin("member_bookmarks", "member_bookmarks.course_id", "courses.id")
      .where("member_bookmarks.tenant_id", "=", tenantId)
      .where("member_bookmarks.tenant_member_id", "=", options.memberId!)
      .where("member_bookmarks.bookmark_type", "=", "COURSE");
  }

  coursesQuery = coursesQuery
    .orderBy(`courses.${sortBy}`, sortOrder)
    .offset(offset)
    .limit(limit);

  const coursesRaw = await coursesQuery.execute();

  // Get instructors for these courses
  const courseIds = coursesRaw.map((c) => c.id);

  const instructorMap: Map<string, { id: string; name: string; avatar: string | null }> = new Map();

  if (courseIds.length > 0) {
    const instructors = await db
      .selectFrom("course_instructors")
      .innerJoin("instructors", "instructors.id", "course_instructors.instructor_id")
      .select([
        "course_instructors.course_id",
        "instructors.id as instructor_id",
        "instructors.name",
        "instructors.profile_url",
      ])
      .where("course_instructors.tenant_id", "=", tenantId)
      .where("course_instructors.course_id", "in", courseIds)
      .orderBy("course_instructors.sort_order", "asc")
      .execute();

    // Map first instructor to each course
    for (const inst of instructors) {
      if (!instructorMap.has(inst.course_id)) {
        instructorMap.set(inst.course_id, {
          id: inst.instructor_id,
          name: inst.name,
          avatar: inst.profile_url,
        });
      }
    }
  }

  // Which bundles contain these courses: ONE query for the whole page, merged
  // by id below. Same shape as instructorMap above; deliberately not a lookup
  // inside the .map(), which would be a round trip per card.
  const bundleMap = await bundlesRepository.findBundlesForContent(tenantId, {
    courseIds,
  });

  const thumbnailBase = config.THUMBNAILS_BASE_URL ?? null;
  // A stored key becomes a URL under the thumbnails base; a full URL (an
  // external image or CDN link) is used as is.
  const resolveKey = (raw: string | null | undefined): string | null => {
    const k = raw?.trim();
    if (!k) return null;
    if (/^(https?:|data:)/i.test(k) || !thumbnailBase) return k;
    return `${thumbnailBase}/${k.startsWith("/") ? k.slice(1) : k}`;
  };
  const courses: PublishedCourseListItem[] = coursesRaw.map((course) => {
    const thumbnailUrl = resolveKey(course.thumbnail_key);
    const secondaryThumbnailUrl = resolveKey(course.secondary_thumbnail_key);
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      subtitle: course.subtitle,
      description: course.description,
      thumbnailUrl,
      secondaryThumbnailUrl,
      duration: course.duration,
    priceInr: course.price_inr,
    priceUsd: course.price_usd,
    discountInr: course.discount_inr,
    discountUsd: course.discount_usd,
    purchaseMode: course.purchase_mode,
    mode: course.mode,
    courseType: course.course_type,
    difficulty: course.difficulty,
    language: course.language || [],
    status: course.status,
    instructor: instructorMap.get(course.id) || null,
    bundles: bundleMap.get(course.id) ?? [],
    };
  });

  return {
    courses,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

// --- Enrollment Check ---

export async function checkEnrollment(
  tenantId: string,
  memberId: string,
  courseId: string
): Promise<boolean> {
  const enrollment = await db
    .selectFrom("enrollments")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("course_id", "=", courseId)
    .where("status", "=", "ACTIVE")
    .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
    .executeTakeFirst();
  return !!enrollment;
}

export async function findLectureById(
  tenantId: string,
  lectureId: string
): Promise<LectureRow | null> {
  const row = await db
    .selectFrom("lectures")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("id", "=", lectureId)
    .executeTakeFirst();
  return (row as unknown as LectureRow) ?? null;
}

/**
 * Lecture lookup for the playback gate. Returns the lecture only when it
 * belongs to the given course, so a video id can never be minted through a
 * course the member is not enrolled in. The video id comes from this row,
 * never from the client.
 */
export async function findLectureForPlayback(
  tenantId: string,
  courseId: string,
  lectureId: string
): Promise<{ id: string; video_key: string | null; video_provider: string | null } | null> {
  const row = await db
    .selectFrom("lectures")
    .select(["id", "video_key", "video_provider"])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .where("id", "=", lectureId)
    .executeTakeFirst();
  return row ?? null;
}

/**
 * Free-sample lessons for a published course, by course slug.
 *
 * An admin ticks "free preview" on a lesson in the LMS curriculum editor, which
 * is also where the video is attached, so `course_lessons.is_preview` is the
 * flag they expect to matter. The course landing page renders from a snapshot of
 * its own that never learns about that flag, so a ticked preview could publish
 * no play control at all. Reading the flag here lets the public page honour what
 * was actually ticked.
 *
 * Keyed by lesson id, because that is what a syllabus row carries and titles get
 * renamed. PUBLISHED courses only, and only lessons that really hold a video:
 * an anonymous visitor may play whatever this returns.
 */
export async function findPreviewLessonsByCourseSlug(
  tenantId: string,
  courseSlug: string
): Promise<
  Array<{
    lessonId: string;
    title: string;
    videoKey: string;
    videoProvider: string | null;
    duration: string | null;
  }>
> {
  const rows = await db
    .selectFrom("course_lessons")
    .innerJoin("courses", "courses.id", "course_lessons.course_id")
    .innerJoin("lectures", "lectures.lesson_id", "course_lessons.id")
    .select([
      "course_lessons.id as lesson_id",
      "course_lessons.title as lesson_title",
      "lectures.title as lecture_title",
      "lectures.video_key as video_key",
      "lectures.video_provider as video_provider",
      "lectures.duration as duration",
    ])
    .where("course_lessons.tenant_id", "=", tenantId)
    .where("courses.tenant_id", "=", tenantId)
    .where("courses.slug", "=", courseSlug)
    .where("courses.status", "=", "PUBLISHED")
    .where("course_lessons.is_preview", "=", true)
    .where("lectures.video_key", "is not", null)
    .orderBy("course_lessons.sort_order", "asc")
    .execute();

  const out: Array<{
    lessonId: string;
    title: string;
    videoKey: string;
    videoProvider: string | null;
    duration: string | null;
  }> = [];
  for (const r of rows) {
    const videoKey = r.video_key;
    if (typeof videoKey !== "string" || videoKey.length === 0) continue;
    out.push({
      lessonId: r.lesson_id,
      title: r.lecture_title || r.lesson_title || "Preview",
      videoKey,
      videoProvider: r.video_provider ?? null,
      duration: r.duration ?? null,
    });
  }
  return out;
}

/**
 * Provider of a lecture in a published course that holds this exact video key.
 * Used by previews published from the landing page, which carry only the key.
 */
export async function findVideoProviderInCourse(
  tenantId: string,
  courseSlug: string,
  videoKey: string
): Promise<string | null> {
  const row = await db
    .selectFrom("lectures")
    .innerJoin("courses", "courses.id", "lectures.course_id")
    .select("lectures.video_provider")
    .where("lectures.tenant_id", "=", tenantId)
    .where("courses.tenant_id", "=", tenantId)
    .where("courses.slug", "=", courseSlug)
    .where("lectures.video_key", "=", videoKey)
    .executeTakeFirst();
  return row?.video_provider ?? null;
}
