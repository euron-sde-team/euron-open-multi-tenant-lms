/**
 * One query for a whole curriculum.
 *
 * WHY THIS EXISTS BESIDE course-lms.repository.ts
 * -----------------------------------------------
 * Reading a course's curriculum through the existing repository is a walk:
 * sections, then lessons per section, then a lecture / quiz / assignment per
 * lesson, then resources per lesson. `getCourseFullTree` already does that walk
 * and issues one query per lesson, which is fine for an editor that loads once
 * and expensive for an assistant that reads before every write.
 *
 * More importantly it is the wrong SHAPE for a model: it returns whole rows,
 * including video keys, HLS keys and summaries nobody reasoning about structure
 * needs, and it costs tokens on every single run.
 *
 * So this is two flat queries, the tree, and the lesson attachments, that the
 * service folds into a lean outline. Nothing here loops a query.
 */
import { db } from "../db/connection";

export interface CurriculumRow {
  section_id: string;
  section_title: string;
  section_sort: number;
  lesson_id: string | null;
  lesson_title: string | null;
  lesson_type: string | null;
  lesson_sort: number | null;
  lesson_is_preview: boolean | null;
  lecture_id: string | null;
  lecture_duration: string | null;
  lecture_video_key: string | null;
  lecture_video_provider: string | null;
  quiz_id: string | null;
  quiz_title: string | null;
  quiz_status: string | null;
  assignment_id: string | null;
  assignment_title: string | null;
  assignment_status: string | null;
}

export interface LessonResourceBrief {
  id: string;
  lesson_id: string;
  type: string;
  title: string;
}

/**
 * Every module and lesson of one course, with whatever is attached to each
 * lesson, in display order. Left joins throughout so an empty module and a
 * lesson with nothing on it both still appear, an empty module is exactly the
 * thing an admin needs to be told about.
 */
export async function findCurriculumRows(
  tenantId: string,
  courseId: string
): Promise<CurriculumRow[]> {
  const rows = await db
    .selectFrom("course_sections as s")
    .leftJoin("course_lessons as ls", (j) =>
      j
        .onRef("ls.section_id", "=", "s.id")
        .onRef("ls.tenant_id", "=", "s.tenant_id")
    )
    .leftJoin("lectures as l", (j) =>
      j.onRef("l.lesson_id", "=", "ls.id").onRef("l.tenant_id", "=", "ls.tenant_id")
    )
    .leftJoin("quizzes as q", (j) =>
      j.onRef("q.lesson_id", "=", "ls.id").onRef("q.tenant_id", "=", "ls.tenant_id")
    )
    .leftJoin("assignments as a", (j) =>
      j.onRef("a.lesson_id", "=", "ls.id").onRef("a.tenant_id", "=", "ls.tenant_id")
    )
    .select([
      "s.id as section_id",
      "s.title as section_title",
      "s.sort_order as section_sort",
      "ls.id as lesson_id",
      "ls.title as lesson_title",
      "ls.type as lesson_type",
      "ls.sort_order as lesson_sort",
      "ls.is_preview as lesson_is_preview",
      "l.id as lecture_id",
      "l.duration as lecture_duration",
      "l.video_key as lecture_video_key",
      "l.video_provider as lecture_video_provider",
      "q.id as quiz_id",
      "q.title as quiz_title",
      "q.status as quiz_status",
      "a.id as assignment_id",
      "a.title as assignment_title",
      "a.status as assignment_status",
    ])
    .where("s.tenant_id", "=", tenantId)
    .where("s.course_id", "=", courseId)
    .orderBy("s.sort_order", "asc")
    .orderBy("s.created_at", "asc")
    .orderBy("ls.sort_order", "asc")
    .orderBy("ls.created_at", "asc")
    .execute();

  return rows as unknown as CurriculumRow[];
}

/** Every attachment on every lesson of one course, in one query. */
export async function findCourseLessonResources(
  tenantId: string,
  courseId: string
): Promise<LessonResourceBrief[]> {
  const rows = await db
    .selectFrom("lesson_resources")
    .select(["id", "lesson_id", "type", "title"])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "asc")
    .execute();

  return rows as unknown as LessonResourceBrief[];
}

export default { findCurriculumRows, findCourseLessonResources };
