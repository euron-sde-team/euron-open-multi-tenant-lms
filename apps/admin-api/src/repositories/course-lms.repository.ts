import { sql, Transaction } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import type {
  course_sections,
  course_lessons,
  lectures,
  quizzes,
  quiz_questions,
  quiz_options,
  assignments,
  course_faqs,
  course_recommendations,
} from "../db/types";

type Trx = Transaction<DB>;

export type CourseSectionRow = course_sections;
export type CourseFaqRow = course_faqs;
export type CourseRecommendationRow = course_recommendations;
export type CourseLessonRow = course_lessons;
export type LectureRow = lectures;
export type QuizRow = quizzes;
export type QuizQuestionRow = quiz_questions;
export type QuizOptionRow = quiz_options;
export type AssignmentRow = assignments;

// --- Sections ---
export interface CreateSectionInput {
  tenant_id: string;
  course_id: string;
  title: string;
  sort_order?: number;
}

export interface UpdateSectionInput {
  title?: string;
  sort_order?: number;
}

export interface CurriculumOutlineRow {
  section_title: string;
  section_sort: number;
  lesson_title: string | null;
  lesson_type: string | null;
  lesson_sort: number | null;
  lecture_title: string | null;
  lecture_duration: string | null;
}

/**
 * Flat outline of a course's uploaded curriculum (sections → lessons →
 * lectures) used to ground AI landing-page generation in the real content.
 * Left joins so quiz/assignment lessons (no lecture row) are included.
 */
export async function findCurriculumOutline(
  tenantId: string,
  courseId: string
): Promise<CurriculumOutlineRow[]> {
  const rows = await db
    .selectFrom("course_sections as s")
    .leftJoin("course_lessons as ls", (j) =>
      j.onRef("ls.section_id", "=", "s.id").onRef("ls.tenant_id", "=", "s.tenant_id")
    )
    .leftJoin("lectures as l", (j) =>
      j.onRef("l.lesson_id", "=", "ls.id").onRef("l.tenant_id", "=", "ls.tenant_id")
    )
    .select([
      "s.title as section_title",
      "s.sort_order as section_sort",
      "ls.title as lesson_title",
      "ls.type as lesson_type",
      "ls.sort_order as lesson_sort",
      "l.title as lecture_title",
      "l.duration as lecture_duration",
    ])
    .where("s.tenant_id", "=", tenantId)
    .where("s.course_id", "=", courseId)
    .orderBy("s.sort_order", "asc")
    .orderBy("ls.sort_order", "asc")
    .execute();
  return rows as unknown as CurriculumOutlineRow[];
}

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

export async function findSectionById(
  sectionId: string,
  tenantId: string
): Promise<CourseSectionRow | null> {
  const row = await db
    .selectFrom("course_sections")
    .selectAll()
    .where("id", "=", sectionId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return row as unknown as CourseSectionRow | null;
}

export async function createSection(
  data: CreateSectionInput
): Promise<CourseSectionRow> {
  const id = ulid();
  const now = new Date();
  const row = await db
    .insertInto("course_sections")
    .values({
      id,
      tenant_id: data.tenant_id,
      course_id: data.course_id,
      title: data.title,
      sort_order: data.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as CourseSectionRow;
}

export async function updateSection(
  sectionId: string,
  tenantId: string,
  data: UpdateSectionInput
): Promise<CourseSectionRow | null> {
  const now = new Date();
  const updateData: Record<string, unknown> = { updated_at: now };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
  const row = await db
    .updateTable("course_sections")
    .set(updateData)
    .where("id", "=", sectionId)
    .where("tenant_id", "=", tenantId)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as CourseSectionRow | null;
}

export async function deleteSection(
  sectionId: string,
  tenantId: string
): Promise<boolean> {
  const result = await db
    .deleteFrom("course_sections")
    .where("id", "=", sectionId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return Number(result?.numDeletedRows ?? 0) > 0;
}

// --- Lessons ---
export interface CreateLessonInput {
  tenant_id: string;
  course_id: string;
  section_id: string;
  title: string;
  type: "LECTURE" | "QUIZ" | "ASSIGNMENT" | "PDF" | "LINK" | "TEXT" | "IMAGE";
  sort_order?: number;
  is_preview?: boolean;
}

export interface UpdateLessonInput {
  title?: string;
  type?: "LECTURE" | "QUIZ" | "ASSIGNMENT" | "PDF" | "LINK" | "TEXT" | "IMAGE";
  sort_order?: number;
  is_preview?: boolean;
}

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

export async function findLessonById(
  lessonId: string,
  tenantId: string
): Promise<CourseLessonRow | null> {
  const row = await db
    .selectFrom("course_lessons")
    .selectAll()
    .where("id", "=", lessonId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return row as unknown as CourseLessonRow | null;
}

export async function createLesson(
  data: CreateLessonInput
): Promise<CourseLessonRow> {
  const id = ulid();
  const now = new Date();
  const row = await db
    .insertInto("course_lessons")
    .values({
      id,
      tenant_id: data.tenant_id,
      course_id: data.course_id,
      section_id: data.section_id,
      title: data.title,
      type: data.type,
      sort_order: data.sort_order ?? 0,
      is_preview: data.is_preview ?? false,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as CourseLessonRow;
}

export async function updateLesson(
  lessonId: string,
  tenantId: string,
  data: UpdateLessonInput
): Promise<CourseLessonRow | null> {
  const now = new Date();
  const updateData: Record<string, unknown> = { updated_at: now };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
  if (data.is_preview !== undefined) updateData.is_preview = data.is_preview;
  const row = await db
    .updateTable("course_lessons")
    .set(updateData)
    .where("id", "=", lessonId)
    .where("tenant_id", "=", tenantId)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as CourseLessonRow | null;
}

export async function deleteLesson(
  lessonId: string,
  tenantId: string
): Promise<boolean> {
  const result = await db
    .deleteFrom("course_lessons")
    .where("id", "=", lessonId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return Number(result?.numDeletedRows ?? 0) > 0;
}

// --- Lectures ---
export interface CreateLectureInput {
  tenant_id: string;
  course_id: string;
  lesson_id: string;
  title: string;
  video_key?: string | null;
  video_provider?: "YOUTUBE" | "EVS" | "HLS" | "MP4" | null;
  duration?: string | null;
  resource_links?: string[];
  summary?: string | null;
}

// --- Asset reuse: ref-count helpers ---
// All queries below ride the composite index lectures(tenant_id, video_key)
// added March 2026 for asset reuse. Plan: Index Scan on
// lectures_tenant_id_video_key_idx: O(log N) seek to leaf, sequential read of
// matching rows. Selectivity is high because tenant_id is the leading column.

/**
 * How many lectures in this tenant reference the given video_key?
 * Used by the asset library to show how often a video is reused. Pass excludeLectureId when
 * called BEFORE the delete commits; omit when called AFTER.
 */
export async function countLecturesUsingVideoKey(
  tenantId: string,
  videoKey: string,
  excludeLectureId?: string
): Promise<number> {
  let qb = db
    .selectFrom("lectures")
    .select(({ fn }) => fn.count<number | string>("id").as("count"))
    .where("tenant_id", "=", tenantId)
    .where("video_key", "=", videoKey);
  if (excludeLectureId) {
    qb = qb.where("id", "!=", excludeLectureId);
  }
  const row = await qb.executeTakeFirst();
  const count = row?.count;
  return typeof count === "string" ? parseInt(count, 10) : Number(count ?? 0);
}

/**
 * Find a "surviving" lecture id that still references this video_key, excluding one.
 * Used to re-point tenant_video_storage.lecture_id when the canonical lecture
 * is being deleted but other lectures still reference the video.
 * ORDER BY id ASC = ULID lexicographic order = oldest first (stable).
 */
export async function findOtherLectureUsingVideoKey(
  tenantId: string,
  videoKey: string,
  excludeLectureId: string
): Promise<{ id: string } | null> {
  const row = await db
    .selectFrom("lectures")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("video_key", "=", videoKey)
    .where("id", "!=", excludeLectureId)
    .orderBy("id", "asc")
    .limit(1)
    .executeTakeFirst();
  return row ?? null;
}

/**
 * For a set of video keys, return how many lectures in this tenant reference each.
 * Single round-trip GROUP BY for asset-library tree rendering ("Used in N lessons").
 * Returns Map(videoKey -> count). Keys with 0 hits are omitted.
 */
export async function countLecturesByVideoKeys(
  tenantId: string,
  videoKeys: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (videoKeys.length === 0) return result;
  const rows = await db
    .selectFrom("lectures")
    .select(["video_key", ({ fn }) => fn.count<number | string>("id").as("count")])
    .where("tenant_id", "=", tenantId)
    .where("video_key", "in", videoKeys)
    .groupBy("video_key")
    .execute();
  for (const r of rows) {
    if (!r.video_key) continue;
    const c = typeof r.count === "string" ? parseInt(r.count, 10) : Number(r.count ?? 0);
    result.set(r.video_key, c);
  }
  return result;
}

/**
 * For an asset-library "where is this video used?" preview pane.
 * Returns lecture rows with course + lesson + section context so the UI can show
 * "Used in: Python Masterclass > Module 1 > Lesson 3".
 * Tightly capped (default 20), videos used in >20 places are statistical outliers.
 */
export interface VideoUsageRow {
  lecture_id: string;
  lecture_title: string;
  lesson_id: string;
  lesson_title: string;
  section_id: string;
  section_title: string;
  course_id: string;
  course_title: string;
  course_slug: string;
  course_status: string;
}

export async function findLecturesByVideoKey(
  tenantId: string,
  videoKey: string,
  limit = 20
): Promise<VideoUsageRow[]> {
  const rows = await db
    .selectFrom("lectures as l")
    .innerJoin("course_lessons as ls", (j) =>
      j.onRef("ls.id", "=", "l.lesson_id").onRef("ls.tenant_id", "=", "l.tenant_id")
    )
    .innerJoin("course_sections as s", (j) =>
      j.onRef("s.id", "=", "ls.section_id").onRef("s.tenant_id", "=", "ls.tenant_id")
    )
    .innerJoin("courses as c", (j) =>
      j.onRef("c.id", "=", "l.course_id").onRef("c.tenant_id", "=", "l.tenant_id")
    )
    .select([
      "l.id as lecture_id",
      "l.title as lecture_title",
      "ls.id as lesson_id",
      "ls.title as lesson_title",
      "s.id as section_id",
      "s.title as section_title",
      "c.id as course_id",
      "c.title as course_title",
      "c.slug as course_slug",
      "c.status as course_status",
    ])
    .where("l.tenant_id", "=", tenantId)
    .where("l.video_key", "=", videoKey)
    .orderBy("c.updated_at", "desc")
    .limit(limit)
    .execute();
  return rows as unknown as VideoUsageRow[];
}

// --- Asset library: tree-shaped queries ---

/**
 * Top-level course list for asset library tree.
 * Returns ONLY courses that have at least one lecture with a video.
 * Plan: Hash Aggregate over Index Scan lectures(tenant_id, course_id) ⨝
 * Index Scan courses(tenant_id, status). One round trip; the GROUP BY collapses
 * matching lectures into per-course counts.
 */
export interface AssetCourseRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  thumbnail_key: string | null;
  updated_at: Date;
  video_count: number;
}

export async function findCoursesWithVideos(
  tenantId: string,
  filters: {
    search?: string;
    status?: "DRAFT" | "PUBLISHED";
    limit?: number;
    offset?: number;
  } = {}
): Promise<AssetCourseRow[]> {
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;
  let qb = db
    .selectFrom("courses as c")
    .innerJoin("lectures as l", (j) =>
      j.onRef("l.course_id", "=", "c.id").onRef("l.tenant_id", "=", "c.tenant_id")
    )
    .select([
      "c.id",
      "c.title",
      "c.slug",
      "c.status",
      "c.thumbnail_key",
      "c.updated_at",
      ({ fn }) => fn.count<number | string>("l.id").as("video_count"),
    ])
    .where("c.tenant_id", "=", tenantId)
    .where("l.video_provider", "in", ["EVS", "HLS", "MP4", "YOUTUBE"])
    .where("l.video_key", "is not", null)
    .groupBy([
      "c.id",
      "c.title",
      "c.slug",
      "c.status",
      "c.thumbnail_key",
      "c.updated_at",
    ])
    .orderBy("c.updated_at", "desc")
    .limit(limit)
    .offset(offset);
  if (filters.status) qb = qb.where("c.status", "=", filters.status);
  if (filters.search && filters.search.trim()) {
    qb = qb.where("c.title", "ilike", `%${filters.search.trim()}%`);
  }
  const rows = await qb.execute();
  return rows.map((r) => ({
    ...r,
    video_count:
      typeof r.video_count === "string"
        ? parseInt(r.video_count, 10)
        : Number(r.video_count ?? 0),
  })) as AssetCourseRow[];
}

/**
 * Full tree (sections -> lessons -> lectures) for one course, FILTERED to only
 * branches that contain at least one lecture with a video.
 *
 * Strategy: single JOIN query, INNER-joined on lectures with the filter
 * predicate, so empty branches drop out naturally. Returned rows are
 * grouped by (section, lesson) in JS to build the tree.
 *
 * Plan: Index Scan course_sections(tenant_id, course_id, sort_order) ⨝
 * Nested Loop on course_lessons(tenant_id, section_id, sort_order) ⨝
 * Index Scan lectures(tenant_id, lesson_id). Filter on (video_provider,
 * video_key) is cheap because the inner scan is already narrowed.
 */
export interface AssetTreeFlatRow {
  section_id: string;
  section_title: string;
  section_sort: number;
  lesson_id: string;
  lesson_title: string;
  lesson_sort: number;
  lesson_is_preview: boolean;
  lecture_id: string;
  lecture_title: string;
  lecture_duration: string | null;
  lecture_processing_status: string;
  video_key: string;
  video_provider: "EVS" | "HLS" | "MP4" | "YOUTUBE";
}

export async function findCourseAssetTree(
  tenantId: string,
  courseId: string
): Promise<AssetTreeFlatRow[]> {
  const rows = await db
    .selectFrom("course_sections as s")
    .innerJoin("course_lessons as ls", (j) =>
      j.onRef("ls.section_id", "=", "s.id").onRef("ls.tenant_id", "=", "s.tenant_id")
    )
    .innerJoin("lectures as l", (j) =>
      j.onRef("l.lesson_id", "=", "ls.id").onRef("l.tenant_id", "=", "ls.tenant_id")
    )
    .select([
      "s.id as section_id",
      "s.title as section_title",
      "s.sort_order as section_sort",
      "ls.id as lesson_id",
      "ls.title as lesson_title",
      "ls.sort_order as lesson_sort",
      "ls.is_preview as lesson_is_preview",
      "l.id as lecture_id",
      "l.title as lecture_title",
      "l.duration as lecture_duration",
      "l.processing_status as lecture_processing_status",
      "l.video_key as video_key",
      "l.video_provider as video_provider",
    ])
    .where("s.tenant_id", "=", tenantId)
    .where("s.course_id", "=", courseId)
    .where("l.video_provider", "in", ["EVS", "HLS", "MP4", "YOUTUBE"])
    .where("l.video_key", "is not", null)
    .orderBy("s.sort_order", "asc")
    .orderBy("ls.sort_order", "asc")
    .execute();
  return rows as unknown as AssetTreeFlatRow[];
}

/**
 * Flat asset-search across courses/sections/lessons/lectures titles.
 * ILIKE pattern is unindexed; we keep cost predictable by:
 *  - hard LIMIT (default 30, max 100)
 *  - tenant_id filter as leading predicate (uses (tenant_id, lesson_id) index)
 *  - inner-joining lectures with video_key filter narrows row set early
 *
 * For tenants with >5k lectures, this stays well under 100ms in practice.
 * A pg_trgm GIN index can be added later if perf becomes an issue.
 */
export async function searchAssets(
  tenantId: string,
  query: string,
  limit = 30
): Promise<AssetTreeFlatRow[]> {
  const q = query.trim();
  if (!q) return [];
  const pattern = `%${q}%`;
  const cap = Math.min(limit, 100);
  const rows = await db
    .selectFrom("lectures as l")
    .innerJoin("course_lessons as ls", (j) =>
      j.onRef("ls.id", "=", "l.lesson_id").onRef("ls.tenant_id", "=", "l.tenant_id")
    )
    .innerJoin("course_sections as s", (j) =>
      j.onRef("s.id", "=", "ls.section_id").onRef("s.tenant_id", "=", "ls.tenant_id")
    )
    .innerJoin("courses as c", (j) =>
      j.onRef("c.id", "=", "l.course_id").onRef("c.tenant_id", "=", "l.tenant_id")
    )
    .select([
      "s.id as section_id",
      "s.title as section_title",
      "s.sort_order as section_sort",
      "ls.id as lesson_id",
      "ls.title as lesson_title",
      "ls.sort_order as lesson_sort",
      "ls.is_preview as lesson_is_preview",
      "l.id as lecture_id",
      "l.title as lecture_title",
      "l.duration as lecture_duration",
      "l.processing_status as lecture_processing_status",
      "l.video_key as video_key",
      "l.video_provider as video_provider",
    ])
    .where("l.tenant_id", "=", tenantId)
    .where("l.video_provider", "in", ["EVS", "HLS", "MP4", "YOUTUBE"])
    .where("l.video_key", "is not", null)
    .where((eb) =>
      eb.or([
        eb("l.title", "ilike", pattern),
        eb("ls.title", "ilike", pattern),
        eb("s.title", "ilike", pattern),
        eb("c.title", "ilike", pattern),
      ])
    )
    .orderBy("c.updated_at", "desc")
    .limit(cap)
    .execute();
  return rows as unknown as AssetTreeFlatRow[];
}

/* ──────────────────────────────────────────────────────────────────────────
 * Question Library
 *
 * Read-side queries that mirror the Asset Library, but for quiz questions:
 * browse every quiz question (with options + marks) across all of the tenant's
 * courses so an admin can copy questions into the quiz they are editing. There
 * is no write path here, imports reuse createQuizQuestion/createQuizOption.
 * ────────────────────────────────────────────────────────────────────────── */

export interface QuestionCourseRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  thumbnail_key: string | null;
  updated_at: Date;
  question_count: number;
}

/**
 * Page of courses that contain at least one quiz with at least one question.
 * Mirrors findCoursesWithVideos.
 */
export async function findCoursesWithQuestions(
  tenantId: string,
  filters: {
    search?: string;
    status?: "DRAFT" | "PUBLISHED";
    limit?: number;
    offset?: number;
  } = {}
): Promise<QuestionCourseRow[]> {
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;
  let qb = db
    .selectFrom("courses as c")
    .innerJoin("quizzes as q", (j) =>
      j.onRef("q.course_id", "=", "c.id").onRef("q.tenant_id", "=", "c.tenant_id")
    )
    .innerJoin("quiz_questions as qq", (j) =>
      j.onRef("qq.quiz_id", "=", "q.id").onRef("qq.tenant_id", "=", "q.tenant_id")
    )
    .select([
      "c.id",
      "c.title",
      "c.slug",
      "c.status",
      "c.thumbnail_key",
      "c.updated_at",
      ({ fn }) => fn.count<number | string>("qq.id").as("question_count"),
    ])
    .where("c.tenant_id", "=", tenantId)
    .groupBy([
      "c.id",
      "c.title",
      "c.slug",
      "c.status",
      "c.thumbnail_key",
      "c.updated_at",
    ])
    .orderBy("c.updated_at", "desc")
    .limit(limit)
    .offset(offset);
  if (filters.status) qb = qb.where("c.status", "=", filters.status);
  if (filters.search && filters.search.trim()) {
    qb = qb.where("c.title", "ilike", `%${filters.search.trim()}%`);
  }
  const rows = await qb.execute();
  return rows.map((r) => ({
    ...r,
    question_count:
      typeof r.question_count === "string"
        ? parseInt(r.question_count, 10)
        : Number(r.question_count ?? 0),
  })) as QuestionCourseRow[];
}

export interface QuestionTreeFlatRow {
  quiz_id: string;
  quiz_title: string;
  quiz_status: string;
  quiz_sort: number;
  question_id: string;
  question: string;
  marks: number;
  question_sort: number;
  option_count: number;
}

/**
 * Per-course tree of quizzes -> questions for the Question Library picker.
 * Returns flat rows (grouped into quizzes in the service). Includes an
 * option_count so the picker can show "4 options" without a second round-trip.
 */
export async function findCourseQuestionTree(
  tenantId: string,
  courseId: string
): Promise<QuestionTreeFlatRow[]> {
  const rows = await db
    .selectFrom("quizzes as q")
    .innerJoin("quiz_questions as qq", (j) =>
      j.onRef("qq.quiz_id", "=", "q.id").onRef("qq.tenant_id", "=", "q.tenant_id")
    )
    .leftJoin("quiz_options as qo", (j) =>
      j
        .onRef("qo.question_id", "=", "qq.id")
        .onRef("qo.tenant_id", "=", "qq.tenant_id")
    )
    .select([
      "q.id as quiz_id",
      "q.title as quiz_title",
      "q.status as quiz_status",
      "q.sort_order as quiz_sort",
      "qq.id as question_id",
      "qq.question as question",
      "qq.marks as marks",
      "qq.sort_order as question_sort",
      ({ fn }) => fn.count<number | string>("qo.id").as("option_count"),
    ])
    .where("q.tenant_id", "=", tenantId)
    .where("q.course_id", "=", courseId)
    .groupBy([
      "q.id",
      "q.title",
      "q.status",
      "q.sort_order",
      "qq.id",
      "qq.question",
      "qq.marks",
      "qq.sort_order",
    ])
    .orderBy("q.sort_order", "asc")
    .orderBy("qq.sort_order", "asc")
    .execute();
  return rows.map((r) => ({
    ...r,
    option_count:
      typeof r.option_count === "string"
        ? parseInt(r.option_count, 10)
        : Number(r.option_count ?? 0),
  })) as unknown as QuestionTreeFlatRow[];
}

export interface QuestionSearchRow {
  question_id: string;
  question: string;
  marks: number;
  question_sort: number;
  quiz_id: string;
  quiz_title: string;
  quiz_status: string;
  course_id: string;
  course_title: string;
  option_count: number;
}

/**
 * Cross-course question search by question text / quiz title / course title.
 * Mirrors searchAssets: hard LIMIT, tenant_id leading predicate, ILIKE.
 */
export async function searchQuestions(
  tenantId: string,
  query: string,
  limit = 30
): Promise<QuestionSearchRow[]> {
  const q = query.trim();
  if (!q) return [];
  const pattern = `%${q}%`;
  const cap = Math.min(limit, 100);
  const rows = await db
    .selectFrom("quiz_questions as qq")
    .innerJoin("quizzes as qz", (j) =>
      j.onRef("qz.id", "=", "qq.quiz_id").onRef("qz.tenant_id", "=", "qq.tenant_id")
    )
    .innerJoin("courses as c", (j) =>
      j.onRef("c.id", "=", "qz.course_id").onRef("c.tenant_id", "=", "qz.tenant_id")
    )
    .leftJoin("quiz_options as qo", (j) =>
      j
        .onRef("qo.question_id", "=", "qq.id")
        .onRef("qo.tenant_id", "=", "qq.tenant_id")
    )
    .select([
      "qq.id as question_id",
      "qq.question as question",
      "qq.marks as marks",
      "qq.sort_order as question_sort",
      "qz.id as quiz_id",
      "qz.title as quiz_title",
      "qz.status as quiz_status",
      "c.id as course_id",
      "c.title as course_title",
      ({ fn }) => fn.count<number | string>("qo.id").as("option_count"),
    ])
    .where("qq.tenant_id", "=", tenantId)
    .where((eb) =>
      eb.or([
        eb("qq.question", "ilike", pattern),
        eb("qz.title", "ilike", pattern),
        eb("c.title", "ilike", pattern),
      ])
    )
    .groupBy([
      "qq.id",
      "qq.question",
      "qq.marks",
      "qq.sort_order",
      "qz.id",
      "qz.title",
      "qz.status",
      "c.id",
      "c.title",
    ])
    .orderBy("c.updated_at", "desc")
    .limit(cap)
    .execute();
  return rows.map((r) => ({
    ...r,
    option_count:
      typeof r.option_count === "string"
        ? parseInt(r.option_count, 10)
        : Number(r.option_count ?? 0),
  })) as unknown as QuestionSearchRow[];
}

/**
 * Highest sort_order among a quiz's existing questions, or -1 if none.
 * Used to append imported questions after the current ones.
 */
export async function getMaxQuestionSortOrder(
  tenantId: string,
  quizId: string,
  trx?: Trx
): Promise<number> {
  const r = await (trx || db)
    .selectFrom("quiz_questions")
    .select(({ fn }) => fn.max<number | null>("sort_order").as("max_sort"))
    .where("tenant_id", "=", tenantId)
    .where("quiz_id", "=", quizId)
    .executeTakeFirst();
  const max = r?.max_sort;
  return max == null ? -1 : Number(max);
}

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
  return (row as LectureRow | undefined) ?? null;
}

export async function createLecture(
  data: CreateLectureInput
): Promise<LectureRow> {
  const id = ulid();
  const now = new Date();
  const row = await db
    .insertInto("lectures")
    .values({
      id,
      tenant_id: data.tenant_id,
      course_id: data.course_id,
      lesson_id: data.lesson_id,
      title: data.title,
      video_key: data.video_key ?? null,
      video_provider: data.video_provider ?? null,
      duration: data.duration ?? null,
      resource_links: data.resource_links ?? [],
      summary: data.summary ?? null,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as LectureRow;
}

export interface UpdateLectureInput {
  title?: string;
  video_key?: string | null;
  video_provider?: "YOUTUBE" | "EVS" | "HLS" | "MP4" | null;
  duration?: string | null;
  resource_links?: string[];
  summary?: string | null;
}

export async function updateLecture(
  lectureId: string,
  tenantId: string,
  data: UpdateLectureInput
): Promise<LectureRow | null> {
  const now = new Date();
  const updateData: Record<string, unknown> = { updated_at: now };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.video_key !== undefined) updateData.video_key = data.video_key;
  if (data.video_provider !== undefined) updateData.video_provider = data.video_provider;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.resource_links !== undefined) updateData.resource_links = data.resource_links;
  if (data.summary !== undefined) updateData.summary = data.summary;
  const row = await db
    .updateTable("lectures")
    .set(updateData)
    .where("id", "=", lectureId)
    .where("tenant_id", "=", tenantId)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as LectureRow | null;
}

// --- Quizzes ---
export interface CreateQuizInput {
  tenant_id: string;
  course_id: string;
  lesson_id: string; // required when creating from lesson (e.g. LMS editor)
  title: string;
}

export async function findQuizByLessonId(
  tenantId: string,
  lessonId: string
): Promise<QuizRow | null> {
  const row = await db
    .selectFrom("quizzes")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("lesson_id", "=", lessonId)
    .executeTakeFirst();
  return row as unknown as QuizRow | null;
}

export async function createQuiz(data: CreateQuizInput): Promise<QuizRow> {
  const id = ulid();
  const now = new Date();
  const row = await db
    .insertInto("quizzes")
    .values({
      id,
      tenant_id: data.tenant_id,
      course_id: data.course_id,
      section_id: null,
      lesson_id: data.lesson_id,
      source_lecture_id: null,
      title: data.title,
      instructions: null,
      scope: "LESSON",
      status: "DRAFT",
      max_score: 100,
      pass_percentage: 60,
      due_date: null,
      ai_generated: false,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as QuizRow;
}

// --- Quiz questions ---
export interface CreateQuizQuestionInput {
  tenant_id: string;
  quiz_id: string;
  question: string;
  question_type?: "MCQ" | "DRAG_DROP";
  marks?: number;
  sort_order?: number;
  /** test_questions.id this was imported from (null = manually authored). */
  source_question_id?: string | null;
}

export async function findQuestionById(
  tenantId: string,
  questionId: string
): Promise<QuizQuestionRow | null> {
  const row = await db
    .selectFrom("quiz_questions")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("id", "=", questionId)
    .executeTakeFirst();
  return row as unknown as QuizQuestionRow | null;
}

export async function countQuestionsByQuizId(
  tenantId: string,
  quizId: string
): Promise<number> {
  const r = await db
    .selectFrom("quiz_questions")
    .select(db.fn.count<number>("id").as("count"))
    .where("tenant_id", "=", tenantId)
    .where("quiz_id", "=", quizId)
    .executeTakeFirst();
  return Number(r?.count ?? 0);
}

export async function findQuestionsByQuizId(
  tenantId: string,
  quizId: string
): Promise<QuizQuestionRow[]> {
  const rows = await db
    .selectFrom("quiz_questions")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("quiz_id", "=", quizId)
    .orderBy("sort_order", "asc")
    .execute();
  return rows as unknown as QuizQuestionRow[];
}

export async function findOptionsByQuestionIds(
  tenantId: string,
  questionIds: string[]
): Promise<QuizOptionRow[]> {
  if (questionIds.length === 0) return [];
  const rows = await db
    .selectFrom("quiz_options")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("question_id", "in", questionIds)
    .orderBy("question_id", "asc")
    .orderBy("sort_order", "asc")
    .execute();
  return rows as unknown as QuizOptionRow[];
}

/** Distinct source_question_id values already imported into a quiz (for
 *  dedup on re-pull from a shared question bank). */
export async function findSourceQuestionIdsByQuiz(
  tenantId: string,
  quizId: string
): Promise<string[]> {
  const rows = await db
    .selectFrom("quiz_questions")
    .select("source_question_id")
    .where("tenant_id", "=", tenantId)
    .where("quiz_id", "=", quizId)
    .where("source_question_id", "is not", null)
    .execute();
  return rows
    .map((r) => r.source_question_id)
    .filter((v): v is string => !!v);
}

/** Persist which shared bank + filter a quiz last pulled from (for re-pull). */
export async function updateQuizBankSelection(
  tenantId: string,
  quizId: string,
  bankId: string,
  selection: unknown,
  trx?: Trx
): Promise<void> {
  await (trx || db)
    .updateTable("quizzes")
    .set({
      question_bank_id: bankId,
      bank_selection: selection != null ? JSON.stringify(selection) : null,
      updated_at: new Date(),
    })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", quizId)
    .execute();
}

export async function createQuizQuestion(
  data: CreateQuizQuestionInput,
  trx?: Trx
): Promise<QuizQuestionRow> {
  const id = ulid();
  const now = new Date();
  const row = await (trx || db)
    .insertInto("quiz_questions")
    .values({
      id,
      tenant_id: data.tenant_id,
      quiz_id: data.quiz_id,
      question: data.question,
      question_type: data.question_type ?? "MCQ",
      marks: data.marks ?? 1,
      sort_order: data.sort_order ?? 0,
      source_question_id: data.source_question_id ?? null,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as QuizQuestionRow;
}

// --- Quiz options ---
export interface CreateQuizOptionInput {
  tenant_id: string;
  question_id: string;
  option_text: string;
  is_correct?: boolean;
  // Multi-blank DRAG_DROP: which blank ("___") this option is the correct
  // answer for (0-indexed). null = distractor or single-blank/MCQ option.
  blank_index?: number | null;
  explanation?: string | null;
  sort_order?: number;
}

export async function createQuizOption(
  data: CreateQuizOptionInput,
  trx?: Trx
): Promise<QuizOptionRow> {
  const id = ulid();
  const now = new Date();
  const row = await (trx || db)
    .insertInto("quiz_options")
    .values({
      id,
      tenant_id: data.tenant_id,
      question_id: data.question_id,
      option_text: data.option_text,
      is_correct: data.is_correct ?? false,
      blank_index: data.blank_index ?? null,
      explanation: data.explanation ?? null,
      sort_order: data.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as QuizOptionRow;
}

/** Existing quiz question texts, used for duplicate detection on bank import. */
export async function findQuestionTextsByQuiz(
  tenantId: string,
  quizId: string
): Promise<string[]> {
  const rows = await db
    .selectFrom("quiz_questions")
    .select("question")
    .where("tenant_id", "=", tenantId)
    .where("quiz_id", "=", quizId)
    .execute();
  return rows.map((r) => r.question);
}

/**
 * Insert many quiz questions in a single multi-row INSERT. Ids are minted here
 * (ULID) and returned in input order so the caller can attach options to each
 * without a per-row round-trip. Avoids the N+1 insert loop on bulk import.
 */
export async function createQuizQuestionsBulk(
  inputs: CreateQuizQuestionInput[],
  trx?: Trx
): Promise<string[]> {
  if (inputs.length === 0) return [];
  const now = new Date();
  const rows = inputs.map((d) => ({
    id: ulid(),
    tenant_id: d.tenant_id,
    quiz_id: d.quiz_id,
    question: d.question,
    question_type: d.question_type ?? ("MCQ" as const),
    marks: d.marks ?? 1,
    sort_order: d.sort_order ?? 0,
    source_question_id: d.source_question_id ?? null,
    created_at: now,
    updated_at: now,
  }));
  await (trx || db).insertInto("quiz_questions").values(rows).execute();
  return rows.map((r) => r.id);
}

/** Insert many quiz options in a single multi-row INSERT. */
export async function createQuizOptionsBulk(
  inputs: CreateQuizOptionInput[],
  trx?: Trx
): Promise<number> {
  if (inputs.length === 0) return 0;
  const now = new Date();
  const rows = inputs.map((d) => ({
    id: ulid(),
    tenant_id: d.tenant_id,
    question_id: d.question_id,
    option_text: d.option_text,
    is_correct: d.is_correct ?? false,
    blank_index: d.blank_index ?? null,
    explanation: d.explanation ?? null,
    sort_order: d.sort_order ?? 0,
    created_at: now,
    updated_at: now,
  }));
  await (trx || db).insertInto("quiz_options").values(rows).execute();
  return rows.length;
}

export async function updateQuizQuestion(
  tenantId: string,
  questionId: string,
  data: {
    question?: string;
    question_type?: "MCQ" | "DRAG_DROP";
    marks?: number;
    sort_order?: number;
  }
): Promise<QuizQuestionRow | null> {
  const now = new Date();
  const updateable: Record<string, unknown> = { updated_at: now };
  if (data.question != null) updateable.question = data.question;
  if (data.question_type != null) updateable.question_type = data.question_type;
  if (data.marks != null) updateable.marks = data.marks;
  if (data.sort_order != null) updateable.sort_order = data.sort_order;
  const row = await db
    .updateTable("quiz_questions")
    .set(updateable)
    .where("tenant_id", "=", tenantId)
    .where("id", "=", questionId)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as QuizQuestionRow | null;
}

export async function deleteQuizQuestion(
  tenantId: string,
  questionId: string
): Promise<boolean> {
  const result = await db
    .deleteFrom("quiz_questions")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", questionId)
    .executeTakeFirst();
  return Number(result?.numDeletedRows ?? 0) > 0;
}

export async function updateQuizOption(
  tenantId: string,
  optionId: string,
  data: {
    option_text?: string;
    is_correct?: boolean;
    blank_index?: number | null;
    sort_order?: number;
  }
): Promise<QuizOptionRow | null> {
  const now = new Date();
  const updateable: Record<string, unknown> = { updated_at: now };
  if (data.option_text != null) updateable.option_text = data.option_text;
  if (data.is_correct != null) updateable.is_correct = data.is_correct;
  // Use `!== undefined` so passing null explicitly clears the mapping.
  if (data.blank_index !== undefined) updateable.blank_index = data.blank_index;
  if (data.sort_order != null) updateable.sort_order = data.sort_order;
  const row = await db
    .updateTable("quiz_options")
    .set(updateable)
    .where("tenant_id", "=", tenantId)
    .where("id", "=", optionId)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as QuizOptionRow | null;
}

export async function deleteQuizOption(
  tenantId: string,
  optionId: string
): Promise<boolean> {
  const result = await db
    .deleteFrom("quiz_options")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", optionId)
    .executeTakeFirst();
  return Number(result?.numDeletedRows ?? 0) > 0;
}

// --- Assignments ---
export interface CreateAssignmentInput {
  tenant_id: string;
  course_id: string;
  lesson_id: string;
  title: string;
  instructions?: string | null;
  resource_links?: string[];
}

export async function findAssignmentByLessonId(
  tenantId: string,
  lessonId: string
): Promise<AssignmentRow | null> {
  const row = await db
    .selectFrom("assignments")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("lesson_id", "=", lessonId)
    .executeTakeFirst();
  return row as unknown as AssignmentRow | null;
}

export async function createAssignment(
  data: CreateAssignmentInput
): Promise<AssignmentRow> {
  const id = ulid();
  const now = new Date();
  const row = await db
    .insertInto("assignments")
    .values({
      id,
      tenant_id: data.tenant_id,
      course_id: data.course_id,
      section_id: null,
      lesson_id: data.lesson_id,
      source_lecture_id: null,
      title: data.title,
      instructions: data.instructions ?? null,
      content_type: "TEXT",
      pdf_key: null,
      resource_links: data.resource_links ?? [],
      scope: "LESSON",
      status: "DRAFT",
      max_score: 100,
      due_date: null,
      ai_generated: false,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as AssignmentRow;
}

// --- Course FAQs ---
export interface CreateCourseFaqInput {
  tenant_id: string;
  course_id: string;
  question: string;
  answer: string;
  sort_order?: number;
}

export interface UpdateCourseFaqInput {
  question?: string;
  answer?: string;
  sort_order?: number;
}

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

export async function findFaqById(
  faqId: string,
  tenantId: string
): Promise<CourseFaqRow | null> {
  const row = await db
    .selectFrom("course_faqs")
    .selectAll()
    .where("id", "=", faqId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return row as unknown as CourseFaqRow | null;
}

export async function createCourseFaq(
  data: CreateCourseFaqInput
): Promise<CourseFaqRow> {
  const id = ulid();
  const now = new Date();
  const row = await db
    .insertInto("course_faqs")
    .values({
      id,
      tenant_id: data.tenant_id,
      course_id: data.course_id,
      question: data.question,
      answer: data.answer,
      sort_order: data.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as CourseFaqRow;
}

export async function updateCourseFaq(
  faqId: string,
  tenantId: string,
  data: UpdateCourseFaqInput
): Promise<CourseFaqRow | null> {
  const now = new Date();
  const updateData: Record<string, unknown> = { updated_at: now };
  if (data.question !== undefined) updateData.question = data.question;
  if (data.answer !== undefined) updateData.answer = data.answer;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
  const row = await db
    .updateTable("course_faqs")
    .set(updateData)
    .where("id", "=", faqId)
    .where("tenant_id", "=", tenantId)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as CourseFaqRow | null;
}

export async function deleteCourseFaq(
  faqId: string,
  tenantId: string
): Promise<boolean> {
  const result = await db
    .deleteFrom("course_faqs")
    .where("id", "=", faqId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return Number(result?.numDeletedRows ?? 0) > 0;
}

// --- Course Recommendations ---

export interface CreateCourseRecommendationInput {
  tenant_id: string;
  course_id: string;
  recommended_course_id: string;
  sort_order?: number;
}

export async function findRecommendationsByCourseId(
  tenantId: string,
  courseId: string
): Promise<CourseRecommendationRow[]> {
  const rows = await db
    .selectFrom("course_recommendations")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "asc")
    .execute();
  return rows as unknown as CourseRecommendationRow[];
}

export async function syncCourseRecommendations(
  tenantId: string,
  courseId: string,
  recommendedCourseIds: string[]
): Promise<CourseRecommendationRow[]> {
  const { ulid } = await import("ulid");
  const now = new Date();

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("course_recommendations")
      .where("tenant_id", "=", tenantId)
      .where("course_id", "=", courseId)
      .execute();

    for (let index = 0; index < recommendedCourseIds.length; index++) {
      await trx
        .insertInto("course_recommendations")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          course_id: courseId,
          recommended_course_id: recommendedCourseIds[index],
          sort_order: index,
          created_at: now,
          updated_at: now,
        })
        .execute();
    }
  });

  return findRecommendationsByCourseId(tenantId, courseId);
}

export async function updateLectureSummary(
  lectureId: string,
  tenantId: string,
  summary: string
): Promise<LectureRow | null> {
  const now = new Date();
  const row = await db
    .updateTable("lectures")
    .set({
      summary,
      updated_at: now,
    })
    .where("id", "=", lectureId)
    .where("tenant_id", "=", tenantId)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as LectureRow | null;
}

export async function findLectureById(
  lectureId: string,
  tenantId: string
): Promise<LectureRow | null> {
  const row = await db
    .selectFrom("lectures")
    .selectAll()
    .where("id", "=", lectureId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return row as unknown as LectureRow | null;
}

// --- Course Instructors ---

export interface CourseInstructorJoined {
  id: string;
  instructor_id: string;
  name: string;
  email: string | null;
  bio: string | null;
  expertise: string | null;
  profile_url: string | null;
  sort_order: number;
  linkedin_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
}

export async function findInstructorsByCourseId(
  tenantId: string,
  courseId: string
): Promise<CourseInstructorJoined[]> {
  const rows = await db
    .selectFrom("course_instructors")
    .innerJoin("instructors", "instructors.id", "course_instructors.instructor_id")
    .leftJoin("instructor_socials", "instructor_socials.instructor_id", "course_instructors.instructor_id")
    .select([
      "course_instructors.id",
      "course_instructors.instructor_id",
      "instructors.name",
      "instructors.email",
      "instructors.bio",
      "instructors.expertise",
      "instructors.profile_url",
      "course_instructors.sort_order",
      "instructor_socials.linkedin_url",
      "instructor_socials.twitter_url",
      "instructor_socials.github_url",
      "instructor_socials.youtube_url",
      "instructor_socials.website_url",
      "instructor_socials.facebook_url",
      "instructor_socials.instagram_url",
    ])
    .where("course_instructors.tenant_id", "=", tenantId)
    .where("course_instructors.course_id", "=", courseId)
    .orderBy("course_instructors.sort_order", "asc")
    .execute();
  return rows as unknown as CourseInstructorJoined[];
}

export async function syncCourseInstructors(
  tenantId: string,
  courseId: string,
  instructorIds: string[]
): Promise<CourseInstructorJoined[]> {
  const { ulid } = await import("ulid");
  const now = new Date();

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom("course_instructors")
      .where("tenant_id", "=", tenantId)
      .where("course_id", "=", courseId)
      .execute();

    for (let index = 0; index < instructorIds.length; index++) {
      await trx
        .insertInto("course_instructors")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          course_id: courseId,
          instructor_id: instructorIds[index],
          sort_order: index,
          created_at: now,
        })
        .execute();
    }
  });

  return findInstructorsByCourseId(tenantId, courseId);
}

// --- Bulk Reorder (curriculum drag-and-drop) ---
//
// Optimisations applied (matches plan section H):
//   H1: SELECT FOR UPDATE doubles as the exhaustiveness read; one round trip.
//   H2: Service skips the UPDATE if proposed order matches current order.
//   H3: Caller passes only diff (changed rows) so VALUES list stays minimal.
//   H4: VALUES + JOIN UPDATE, single statement, hash-join plan, scales past CASE WHEN limits.
//   H5: Cross-section move uses one UPDATE with 3 columns (id, section_id, sort_order).
//   H6: Row-level FOR UPDATE; readers (students, templates) are not blocked.
//   H7: Trx contains exactly one SELECT + one UPDATE; lock duration <10ms typical.
//
// Existing indexes cover all access paths (no new indexes needed):
//   course_sections: (tenant_id, course_id, sort_order)
//   course_lessons:  (tenant_id, section_id, sort_order)

export interface SectionSiblingRow {
  id: string;
  sort_order: number;
}

export interface LessonSiblingRow {
  id: string;
  section_id: string;
  sort_order: number;
}

/**
 * Lock + read every section of a course in a deterministic order (by id).
 * The same-id ORDER BY across all callers guarantees no deadlock between
 * concurrent drag operations; the second writer simply waits.
 */
export async function lockAndReadSectionSiblings(
  trx: Trx,
  tenantId: string,
  courseId: string
): Promise<SectionSiblingRow[]> {
  const rows = await trx
    .selectFrom("course_sections")
    .select(["id", "sort_order"])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .orderBy("id", "asc")
    .forUpdate()
    .execute();
  return rows as unknown as SectionSiblingRow[];
}

/**
 * Lock + read every lesson of a single section. Scoped by course_id too
 * for defense-in-depth (rejects lessons that don't belong to this course
 * even within the same tenant).
 */
export async function lockAndReadLessonSiblings(
  trx: Trx,
  tenantId: string,
  courseId: string,
  sectionId: string
): Promise<LessonSiblingRow[]> {
  const rows = await trx
    .selectFrom("course_lessons")
    .select(["id", "section_id", "sort_order"])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .where("section_id", "=", sectionId)
    .orderBy("id", "asc")
    .forUpdate()
    .execute();
  return rows as unknown as LessonSiblingRow[];
}

/**
 * Lock + read every lesson in any of the given sections (used for the
 * cross-section move endpoint). Deterministic lock order by (section_id, id)
 * so two simultaneous cross-section moves involving overlapping sections
 * cannot deadlock.
 */
export async function lockAndReadLessonSiblingsInSections(
  trx: Trx,
  tenantId: string,
  courseId: string,
  sectionIds: ReadonlyArray<string>
): Promise<LessonSiblingRow[]> {
  if (sectionIds.length === 0) return [];
  const rows = await trx
    .selectFrom("course_lessons")
    .select(["id", "section_id", "sort_order"])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .where("section_id", "in", [...sectionIds])
    .orderBy("section_id", "asc")
    .orderBy("id", "asc")
    .forUpdate()
    .execute();
  return rows as unknown as LessonSiblingRow[];
}

/**
 * One-statement bulk update of section sort_order using VALUES + JOIN.
 * Only rows whose position actually changed are included in `changes`.
 * Returns the number of rows touched (for logging / sanity checks).
 */
export async function bulkUpdateSectionSortOrder(
  trx: Trx,
  tenantId: string,
  courseId: string,
  changes: ReadonlyArray<{ id: string; sort_order: number }>
): Promise<number> {
  if (changes.length === 0) return 0;

  const valueRows = changes.map(
    (c) => sql`(${c.id}::text, ${c.sort_order}::int)`
  );

  const result = await sql`
    UPDATE course_sections AS s
    SET sort_order = v.new_order,
        updated_at = NOW()
    FROM (VALUES ${sql.join(valueRows, sql`, `)}) AS v(id, new_order)
    WHERE s.id = v.id
      AND s.tenant_id = ${tenantId}
      AND s.course_id = ${courseId}
  `.execute(trx);

  return Number(result.numAffectedRows ?? 0);
}

/**
 * One-statement bulk update of lesson sort_order. Tenant scoping handles
 * isolation; the caller has already locked the relevant rows.
 */
export async function bulkUpdateLessonSortOrder(
  trx: Trx,
  tenantId: string,
  changes: ReadonlyArray<{ id: string; sort_order: number }>
): Promise<number> {
  if (changes.length === 0) return 0;

  const valueRows = changes.map(
    (c) => sql`(${c.id}::text, ${c.sort_order}::int)`
  );

  const result = await sql`
    UPDATE course_lessons AS l
    SET sort_order = v.new_order,
        updated_at = NOW()
    FROM (VALUES ${sql.join(valueRows, sql`, `)}) AS v(id, new_order)
    WHERE l.id = v.id
      AND l.tenant_id = ${tenantId}
  `.execute(trx);

  return Number(result.numAffectedRows ?? 0);
}

/**
 * One-statement bulk update for cross-section lesson move. The moved lesson
 * gets a new section_id AND new sort_order; resequenced source/target lessons
 * keep their section_id but get new sort_order. All three writes share one
 * statement so the move is atomic even under crash or rollback.
 */
export async function bulkUpdateLessonSectionAndOrder(
  trx: Trx,
  tenantId: string,
  changes: ReadonlyArray<{
    id: string;
    section_id: string;
    sort_order: number;
  }>
): Promise<number> {
  if (changes.length === 0) return 0;

  const valueRows = changes.map(
    (c) =>
      sql`(${c.id}::text, ${c.section_id}::text, ${c.sort_order}::int)`
  );

  const result = await sql`
    UPDATE course_lessons AS l
    SET section_id = v.section_id,
        sort_order = v.sort_order,
        updated_at = NOW()
    FROM (VALUES ${sql.join(valueRows, sql`, `)}) AS v(id, section_id, sort_order)
    WHERE l.id = v.id
      AND l.tenant_id = ${tenantId}
  `.execute(trx);

  return Number(result.numAffectedRows ?? 0);
}

// Re-export for single default if needed; we use named exports
const courseLmsRepository = {
  findSectionsByCourseId,
  findSectionById,
  createSection,
  updateSection,
  deleteSection,
  findLessonsBySectionId,
  findLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  findLectureByLessonId,
  findLectureById,
  createLecture,
  updateLecture,
  countLecturesUsingVideoKey,
  findOtherLectureUsingVideoKey,
  countLecturesByVideoKeys,
  findLecturesByVideoKey,
  findCoursesWithVideos,
  findCourseAssetTree,
  searchAssets,
  findQuizByLessonId,
  createQuiz,
  countQuestionsByQuizId,
  findQuestionsByQuizId,
  createQuizQuestion,
  createQuizOption,
  findAssignmentByLessonId,
  createAssignment,
  findFaqsByCourseId,
  findFaqById,
  createCourseFaq,
  updateCourseFaq,
  deleteCourseFaq,
  findRecommendationsByCourseId,
  syncCourseRecommendations,
  updateLectureSummary,
  findInstructorsByCourseId,
  syncCourseInstructors,
  lockAndReadSectionSiblings,
  lockAndReadLessonSiblings,
  lockAndReadLessonSiblingsInSections,
  bulkUpdateSectionSortOrder,
  bulkUpdateLessonSortOrder,
  bulkUpdateLessonSectionAndOrder,
};
export default courseLmsRepository;
