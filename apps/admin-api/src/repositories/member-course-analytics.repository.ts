import { sql } from "kysely";

import { db } from "../db/connection";

export interface CourseAnalyticsSummaryRow {
  course_id: string;
  course_title: string;
  course_slug: string;
  course_mode: string;
  enrollment_id: string;
  enrollment_status: string;
  enrollment_source: string;
  enrolled_at: Date;
  completed_at: Date | null;
  total_lectures: string | number | null;
  total_duration_seconds: string | number | null;
  touched_lectures: string | number | null;
  completed_lectures: string | number | null;
  watched_seconds: string | number | null;
  total_watch_seconds: string | number | null;
  last_activity_at: Date | null;
}

export interface CourseLectureProgressRow {
  section_id: string;
  section_title: string;
  section_sort: number;
  lesson_id: string;
  lesson_title: string;
  lesson_sort: number;
  lecture_id: string;
  lecture_title: string;
  video_provider: string | null;
  duration_seconds: string | number | null;
  watched_seconds: string | number | null;
  total_watch_seconds: string | number | null;
  last_position_seconds: string | number | null;
  completed: boolean;
  last_watched_at: Date | null;
}

export interface ExportLectureRow extends CourseLectureProgressRow {
  course_id: string;
  course_title: string;
}

export interface MemberDailyActivityRow {
  activity_date: Date;
  sessions_count: string | number | null;
  courses_touched: string | number | null;
  lectures_touched: string | number | null;
  total_seconds: string | number | null;
}

export interface SectionAnalyticsRow {
  course_id: string;
  course_title: string;
  section_id: string;
  section_title: string;
  section_sort: number;
  total_lectures: string | number | null;
  total_duration_seconds: string | number | null;
  touched_lectures: string | number | null;
  completed_lectures: string | number | null;
  watched_seconds: string | number | null;
  last_activity_at: Date | null;
}

/**
 * One row per PUBLISHED quiz in the member's enrolled courses, with the
 * member's attempt aggregates (LEFT joined, quizzes never attempted still
 * appear, with zero attempts). `best_*` reflect the highest-scoring attempt;
 * `last_status` / `last_attempt_at` reflect the most recent attempt.
 */
export interface MemberQuizAnalyticsRow {
  quiz_id: string;
  quiz_title: string;
  course_id: string;
  course_title: string;
  max_score: string | number | null;
  pass_percentage: string | number | null;
  attempt_count: string | number | null;
  best_score: string | number | null;
  best_total_marks: string | number | null;
  best_percentage: string | number | null;
  last_status: string | null;
  last_attempt_at: Date | null;
  passed: boolean;
}

/**
 * One row per PUBLISHED assignment in the member's enrolled courses, with the
 * member's latest submission + evaluation (LEFT joined, never-submitted
 * assignments still appear). On-time is computed vs `due_date` when both the
 * submission time and a due date exist.
 */
export interface MemberAssignmentAnalyticsRow {
  assignment_id: string;
  assignment_title: string;
  course_id: string;
  course_title: string;
  max_score: string | number | null;
  due_date: Date | null;
  submission_status: string | null;
  submitted_at: Date | null;
  score: string | number | null;
  eval_max_score: string | number | null;
  feedback: string | null;
  evaluated_at: Date | null;
}

/**
 * Parses `lectures.duration` (free-form String?) into integer seconds.
 * Tolerated formats:
 *   "300"          -> 300        (raw seconds)
 *   "5:00"         -> 300        (MM:SS)
 *   "1:23:45"      -> 5025       (HH:MM:SS)
 *   NULL / ""      -> 0
 *   anything else  -> 0
 * Using split_part keeps it safe even if a row has extra colons or junk; the
 * regex guard means we never attempt a cast on non-matching values.
 */
const DURATION_SECONDS_EXPR = sql<string>`
  CASE
    WHEN l.duration ~ '^[0-9]+$' THEN l.duration::int
    WHEN l.duration ~ '^[0-9]+:[0-5]?[0-9]$' THEN
      (split_part(l.duration, ':', 1)::int * 60)
      + split_part(l.duration, ':', 2)::int
    WHEN l.duration ~ '^[0-9]+:[0-5]?[0-9]:[0-5]?[0-9]$' THEN
      (split_part(l.duration, ':', 1)::int * 3600)
      + (split_part(l.duration, ':', 2)::int * 60)
      + split_part(l.duration, ':', 3)::int
    ELSE 0
  END
`;

class MemberCourseAnalyticsRepository {
  /**
   * One-shot per-course summary for a single member.
   * Two CTEs (lecture totals, member progress) + outer join to enrollments.
   * Hits indexes: enrollments(tenant_id, tenant_member_id), lectures(tenant_id, course_id),
   * member_lecture_progress(tenant_id, tenant_member_id, course_id).
   */
  async getCourseSummary(
    tenantId: string,
    memberId: string
  ): Promise<CourseAnalyticsSummaryRow[]> {
    const rows = await db
      .with("course_lecture_totals", (qb) =>
        qb
          .selectFrom("lectures as l")
          .innerJoin("enrollments as e", (join) =>
            join
              .onRef("e.course_id", "=", "l.course_id")
              .onRef("e.tenant_id", "=", "l.tenant_id")
          )
          .select([
            "l.course_id",
            sql<string>`COUNT(l.id)`.as("total_lectures"),
            sql<string>`COALESCE(SUM(${DURATION_SECONDS_EXPR}), 0)`.as(
              "total_duration_seconds"
            ),
          ])
          .where("l.tenant_id", "=", tenantId)
          .where("e.tenant_member_id", "=", memberId)
          .where("e.status", "!=", "CANCELLED")
          .groupBy("l.course_id")
      )
      .with("member_progress", (qb) =>
        qb
          .selectFrom("member_lecture_progress as mlp")
          .select([
            "mlp.course_id",
            sql<string>`COUNT(*)`.as("touched_lectures"),
            sql<string>`COUNT(*) FILTER (WHERE mlp.completed = true)`.as(
              "completed_lectures"
            ),
            sql<string>`COALESCE(SUM(mlp.watched_duration), 0)`.as(
              "watched_seconds"
            ),
            sql<string>`COALESCE(SUM(mlp.total_watch_seconds), 0)`.as(
              "total_watch_seconds"
            ),
            sql<Date | null>`MAX(mlp.last_watched_at)`.as("last_activity_at"),
          ])
          .where("mlp.tenant_id", "=", tenantId)
          .where("mlp.tenant_member_id", "=", memberId)
          .groupBy("mlp.course_id")
      )
      .selectFrom("enrollments as e")
      .innerJoin("courses as c", (join) =>
        join.onRef("c.id", "=", "e.course_id").onRef("c.tenant_id", "=", "e.tenant_id")
      )
      .leftJoin("course_lecture_totals as clt", "clt.course_id", "c.id")
      .leftJoin("member_progress as mp", "mp.course_id", "c.id")
      .select([
        "c.id as course_id",
        "c.title as course_title",
        "c.slug as course_slug",
        sql<string>`c.mode::text`.as("course_mode"),
        "e.id as enrollment_id",
        sql<string>`e.status::text`.as("enrollment_status"),
        sql<string>`e.source::text`.as("enrollment_source"),
        "e.enrolled_at",
        "e.completed_at",
        sql<string>`COALESCE(clt.total_lectures, 0)`.as("total_lectures"),
        sql<string>`COALESCE(clt.total_duration_seconds, 0)`.as(
          "total_duration_seconds"
        ),
        sql<string>`COALESCE(mp.touched_lectures, 0)`.as("touched_lectures"),
        sql<string>`COALESCE(mp.completed_lectures, 0)`.as("completed_lectures"),
        sql<string>`COALESCE(mp.watched_seconds, 0)`.as("watched_seconds"),
        sql<string>`COALESCE(mp.total_watch_seconds, 0)`.as("total_watch_seconds"),
        sql<Date | null>`mp.last_activity_at`.as("last_activity_at"),
      ])
      .where("e.tenant_id", "=", tenantId)
      .where("e.tenant_member_id", "=", memberId)
      .where("e.status", "!=", "CANCELLED")
      .orderBy(sql`mp.last_activity_at DESC NULLS LAST`)
      .orderBy("e.enrolled_at", "desc")
      .execute();

    return rows as unknown as CourseAnalyticsSummaryRow[];
  }

  /**
   * Per-lecture breakdown for one course + member.
   * Single query: course_sections -> course_lessons -> lectures
   * LEFT JOIN member_lecture_progress (scoped to this member).
   */
  async getCourseLectureBreakdown(
    tenantId: string,
    memberId: string,
    courseId: string
  ): Promise<CourseLectureProgressRow[]> {
    const rows = await db
      .selectFrom("course_sections as cs")
      .innerJoin("course_lessons as cl", (join) =>
        join.onRef("cl.section_id", "=", "cs.id").onRef("cl.tenant_id", "=", "cs.tenant_id")
      )
      .innerJoin("lectures as l", (join) =>
        join.onRef("l.lesson_id", "=", "cl.id").onRef("l.tenant_id", "=", "cl.tenant_id")
      )
      .leftJoin("member_lecture_progress as mlp", (join) =>
        join
          .onRef("mlp.lecture_id", "=", "l.id")
          .onRef("mlp.tenant_id", "=", "l.tenant_id")
          .on("mlp.tenant_member_id", "=", memberId)
      )
      .select([
        "cs.id as section_id",
        "cs.title as section_title",
        "cs.sort_order as section_sort",
        "cl.id as lesson_id",
        "cl.title as lesson_title",
        "cl.sort_order as lesson_sort",
        "l.id as lecture_id",
        "l.title as lecture_title",
        sql<string | null>`l.video_provider::text`.as("video_provider"),
        DURATION_SECONDS_EXPR.as("duration_seconds"),
        sql<string>`COALESCE(mlp.watched_duration, 0)`.as("watched_seconds"),
        sql<string>`COALESCE(mlp.total_watch_seconds, 0)`.as("total_watch_seconds"),
        sql<string>`COALESCE(mlp.last_position_seconds, 0)`.as(
          "last_position_seconds"
        ),
        sql<boolean>`COALESCE(mlp.completed, false)`.as("completed"),
        sql<Date | null>`mlp.last_watched_at`.as("last_watched_at"),
      ])
      .where("cs.tenant_id", "=", tenantId)
      .where("cs.course_id", "=", courseId)
      .orderBy("cs.sort_order", "asc")
      .orderBy("cl.sort_order", "asc")
      .orderBy("l.created_at", "asc")
      .execute();

    return rows as unknown as CourseLectureProgressRow[];
  }

  /**
   * Flat per-lecture rows across ALL enrolled courses for one member.
   * Used by the multi-sheet Excel export: one round-trip, no N+1.
   */
  async getAllLecturesForExport(
    tenantId: string,
    memberId: string
  ): Promise<ExportLectureRow[]> {
    const rows = await db
      .selectFrom("enrollments as e")
      .innerJoin("courses as c", (join) =>
        join.onRef("c.id", "=", "e.course_id").onRef("c.tenant_id", "=", "e.tenant_id")
      )
      .innerJoin("course_sections as cs", (join) =>
        join.onRef("cs.course_id", "=", "c.id").onRef("cs.tenant_id", "=", "c.tenant_id")
      )
      .innerJoin("course_lessons as cl", (join) =>
        join.onRef("cl.section_id", "=", "cs.id").onRef("cl.tenant_id", "=", "cs.tenant_id")
      )
      .innerJoin("lectures as l", (join) =>
        join.onRef("l.lesson_id", "=", "cl.id").onRef("l.tenant_id", "=", "cl.tenant_id")
      )
      .leftJoin("member_lecture_progress as mlp", (join) =>
        join
          .onRef("mlp.lecture_id", "=", "l.id")
          .onRef("mlp.tenant_id", "=", "l.tenant_id")
          .on("mlp.tenant_member_id", "=", memberId)
      )
      .select([
        "c.id as course_id",
        "c.title as course_title",
        "cs.id as section_id",
        "cs.title as section_title",
        "cs.sort_order as section_sort",
        "cl.id as lesson_id",
        "cl.title as lesson_title",
        "cl.sort_order as lesson_sort",
        "l.id as lecture_id",
        "l.title as lecture_title",
        sql<string | null>`l.video_provider::text`.as("video_provider"),
        DURATION_SECONDS_EXPR.as("duration_seconds"),
        sql<string>`COALESCE(mlp.watched_duration, 0)`.as("watched_seconds"),
        sql<string>`COALESCE(mlp.total_watch_seconds, 0)`.as("total_watch_seconds"),
        sql<string>`COALESCE(mlp.last_position_seconds, 0)`.as(
          "last_position_seconds"
        ),
        sql<boolean>`COALESCE(mlp.completed, false)`.as("completed"),
        sql<Date | null>`mlp.last_watched_at`.as("last_watched_at"),
      ])
      .where("e.tenant_id", "=", tenantId)
      .where("e.tenant_member_id", "=", memberId)
      .where("e.status", "!=", "CANCELLED")
      .orderBy("c.title", "asc")
      .orderBy("cs.sort_order", "asc")
      .orderBy("cl.sort_order", "asc")
      .orderBy("l.created_at", "asc")
      .execute();

    return rows as unknown as ExportLectureRow[];
  }

  /**
   * Daily activity for the last N days from lecture_watch_sessions.
   * Uses the (tenant_id, tenant_member_id, started_at) index. Returns at most
   * `days` rows (Postgres only includes dates the learner actually watched on).
   */
  async getMemberDailyActivity(
    tenantId: string,
    memberId: string,
    days: number
  ): Promise<MemberDailyActivityRow[]> {
    const safeDays = Math.max(1, Math.min(365, days));
    const rows = await db
      .selectFrom("lecture_watch_sessions as s")
      .select([
        sql<Date>`DATE(s.started_at AT TIME ZONE 'UTC')`.as("activity_date"),
        sql<string>`COUNT(*)`.as("sessions_count"),
        sql<string>`COUNT(DISTINCT s.course_id)`.as("courses_touched"),
        sql<string>`COUNT(DISTINCT s.lecture_id)`.as("lectures_touched"),
        sql<string>`COALESCE(SUM(s.seconds_watched), 0)`.as("total_seconds"),
      ])
      .where("s.tenant_id", "=", tenantId)
      .where("s.tenant_member_id", "=", memberId)
      .where(
        "s.started_at",
        ">=",
        sql<Date>`NOW() - (${safeDays} || ' days')::interval`
      )
      .groupBy(sql`DATE(s.started_at AT TIME ZONE 'UTC')`)
      .orderBy(sql`DATE(s.started_at AT TIME ZONE 'UTC')`, "asc")
      .execute();
    return rows as unknown as MemberDailyActivityRow[];
  }

  /**
   * Per-section breakdown for every course this member is enrolled in.
   * Two CTEs (lecture totals by section, member progress by section) joined
   * to the course list. Single round-trip, no N+1.
   */
  async getMemberSectionAnalytics(
    tenantId: string,
    memberId: string
  ): Promise<SectionAnalyticsRow[]> {
    const rows = await db
      .with("enrolled_courses", (qb) =>
        qb
          .selectFrom("enrollments as e")
          .select("e.course_id")
          .where("e.tenant_id", "=", tenantId)
          .where("e.tenant_member_id", "=", memberId)
          .where("e.status", "!=", "CANCELLED")
      )
      .with("section_lectures", (qb) =>
        qb
          .selectFrom("course_sections as cs")
          .innerJoin("course_lessons as cl", (j) =>
            j.onRef("cl.section_id", "=", "cs.id").onRef("cl.tenant_id", "=", "cs.tenant_id")
          )
          .innerJoin("lectures as l", (j) =>
            j.onRef("l.lesson_id", "=", "cl.id").onRef("l.tenant_id", "=", "cl.tenant_id")
          )
          .select([
            "cs.id as section_id",
            "cs.title as section_title",
            "cs.course_id",
            "cs.sort_order as section_sort",
            sql<string>`COUNT(l.id)`.as("total_lectures"),
            sql<string>`COALESCE(SUM(${DURATION_SECONDS_EXPR}), 0)`.as(
              "total_duration_seconds"
            ),
          ])
          .where("cs.tenant_id", "=", tenantId)
          .where("cs.course_id", "in", (q) =>
            q.selectFrom("enrolled_courses").select("course_id")
          )
          .groupBy([
            "cs.id",
            "cs.title",
            "cs.course_id",
            "cs.sort_order",
          ])
      )
      .with("section_progress", (qb) =>
        qb
          .selectFrom("member_lecture_progress as mlp")
          .innerJoin("lectures as l", (j) =>
            j.onRef("l.id", "=", "mlp.lecture_id").onRef("l.tenant_id", "=", "mlp.tenant_id")
          )
          .innerJoin("course_lessons as cl", (j) =>
            j.onRef("cl.id", "=", "l.lesson_id").onRef("cl.tenant_id", "=", "l.tenant_id")
          )
          .select([
            "cl.section_id",
            sql<string>`COUNT(*)`.as("touched_lectures"),
            sql<string>`COUNT(*) FILTER (WHERE mlp.completed = true)`.as(
              "completed_lectures"
            ),
            sql<string>`COALESCE(SUM(mlp.watched_duration), 0)`.as(
              "watched_seconds"
            ),
            sql<Date | null>`MAX(mlp.last_watched_at)`.as("last_activity_at"),
          ])
          .where("mlp.tenant_id", "=", tenantId)
          .where("mlp.tenant_member_id", "=", memberId)
          .groupBy("cl.section_id")
      )
      .selectFrom("section_lectures as sl")
      .innerJoin("courses as c", "c.id", "sl.course_id")
      .leftJoin("section_progress as sp", "sp.section_id", "sl.section_id")
      .where("c.tenant_id", "=", tenantId)
      .select([
        "c.id as course_id",
        "c.title as course_title",
        "sl.section_id",
        "sl.section_title",
        "sl.section_sort",
        "sl.total_lectures",
        "sl.total_duration_seconds",
        sql<string>`COALESCE(sp.touched_lectures, 0)`.as("touched_lectures"),
        sql<string>`COALESCE(sp.completed_lectures, 0)`.as("completed_lectures"),
        sql<string>`COALESCE(sp.watched_seconds, 0)`.as("watched_seconds"),
        sql<Date | null>`sp.last_activity_at`.as("last_activity_at"),
      ])
      .orderBy("c.title", "asc")
      .orderBy("sl.section_sort", "asc")
      .execute();
    return rows as unknown as SectionAnalyticsRow[];
  }

  /**
   * Per-quiz analytics for one member across all enrolled (non-cancelled)
   * courses. A `member_attempts` CTE aggregates this member's attempts per
   * quiz (best score, count, last status/date); the outer query LEFT joins it
   * onto every PUBLISHED quiz in the enrolled courses so untouched quizzes
   * still surface. Single round-trip, no N+1.
   */
  async getMemberQuizAnalytics(
    tenantId: string,
    memberId: string
  ): Promise<MemberQuizAnalyticsRow[]> {
    const rows = await db
      .with("enrolled_courses", (qb) =>
        qb
          .selectFrom("enrollments as e")
          .select("e.course_id")
          .where("e.tenant_id", "=", tenantId)
          .where("e.tenant_member_id", "=", memberId)
          .where("e.status", "!=", "CANCELLED")
      )
      .with("member_attempts", (qb) =>
        qb
          .selectFrom("quiz_attempts as qa")
          .select([
            "qa.quiz_id",
            sql<string>`COUNT(*)`.as("attempt_count"),
            sql<string>`MAX(qa.score)`.as("best_score"),
            // total_marks paired with the best score (highest score wins; ties
            // resolved arbitrarily, marks are typically constant per quiz).
            sql<string>`(array_agg(qa.total_marks ORDER BY qa.score DESC, qa.completed_at DESC NULLS LAST))[1]`.as(
              "best_total_marks"
            ),
            sql<string>`MAX(CASE WHEN qa.total_marks > 0 THEN ROUND(qa.score::numeric / qa.total_marks * 100) ELSE 0 END)`.as(
              "best_percentage"
            ),
            sql<boolean>`bool_or(qa.status = 'PASSED')`.as("passed"),
            sql<string | null>`(array_agg(qa.status::text ORDER BY qa.started_at DESC))[1]`.as(
              "last_status"
            ),
            sql<Date | null>`MAX(qa.started_at)`.as("last_attempt_at"),
          ])
          .where("qa.tenant_id", "=", tenantId)
          .where("qa.tenant_member_id", "=", memberId)
          .groupBy("qa.quiz_id")
      )
      .selectFrom("quizzes as q")
      .innerJoin("courses as c", (join) =>
        join.onRef("c.id", "=", "q.course_id").onRef("c.tenant_id", "=", "q.tenant_id")
      )
      .leftJoin("member_attempts as ma", "ma.quiz_id", "q.id")
      .select([
        "q.id as quiz_id",
        "q.title as quiz_title",
        "q.course_id",
        "c.title as course_title",
        "q.max_score",
        "q.pass_percentage",
        sql<string>`COALESCE(ma.attempt_count, 0)`.as("attempt_count"),
        sql<string>`COALESCE(ma.best_score, 0)`.as("best_score"),
        sql<string>`COALESCE(ma.best_total_marks, 0)`.as("best_total_marks"),
        sql<string>`COALESCE(ma.best_percentage, 0)`.as("best_percentage"),
        sql<string | null>`ma.last_status`.as("last_status"),
        sql<Date | null>`ma.last_attempt_at`.as("last_attempt_at"),
        sql<boolean>`COALESCE(ma.passed, false)`.as("passed"),
      ])
      .where("q.tenant_id", "=", tenantId)
      .where("q.status", "=", "PUBLISHED")
      .where("q.course_id", "in", (qb) =>
        qb.selectFrom("enrolled_courses").select("course_id")
      )
      .orderBy("c.title", "asc")
      .orderBy("q.sort_order", "asc")
      .orderBy("q.created_at", "asc")
      .execute();

    return rows as unknown as MemberQuizAnalyticsRow[];
  }

  /**
   * Per-assignment analytics for one member across all enrolled (non-cancelled)
   * courses. LEFT joins the member's latest submission (by submitted_at, then
   * created_at) and its evaluation onto every PUBLISHED assignment in the
   * enrolled courses. DISTINCT ON keeps one row per assignment. Single
   * round-trip, no N+1.
   */
  async getMemberAssignmentAnalytics(
    tenantId: string,
    memberId: string
  ): Promise<MemberAssignmentAnalyticsRow[]> {
    const rows = await db
      .with("enrolled_courses", (qb) =>
        qb
          .selectFrom("enrollments as e")
          .select("e.course_id")
          .where("e.tenant_id", "=", tenantId)
          .where("e.tenant_member_id", "=", memberId)
          .where("e.status", "!=", "CANCELLED")
      )
      // Latest submission per assignment for this member. DISTINCT ON collapses
      // resubmissions to the most recent one.
      .with("latest_submission", (qb) =>
        qb
          .selectFrom("assignment_submissions as s")
          .select([
            "s.id as submission_id",
            "s.assignment_id",
            sql<string>`s.status::text`.as("submission_status"),
            "s.submitted_at",
          ])
          .distinctOn("s.assignment_id")
          .where("s.tenant_id", "=", tenantId)
          .where("s.tenant_member_id", "=", memberId)
          .orderBy("s.assignment_id")
          .orderBy(sql`s.submitted_at DESC NULLS LAST`)
          .orderBy("s.created_at", "desc")
      )
      .selectFrom("assignments as a")
      .innerJoin("courses as c", (join) =>
        join.onRef("c.id", "=", "a.course_id").onRef("c.tenant_id", "=", "a.tenant_id")
      )
      .leftJoin("latest_submission as ls", "ls.assignment_id", "a.id")
      .leftJoin("assignment_evaluations as ev", (join) =>
        join
          .onRef("ev.submission_id", "=", "ls.submission_id")
          .on("ev.tenant_id", "=", tenantId)
      )
      .select([
        "a.id as assignment_id",
        "a.title as assignment_title",
        "a.course_id",
        "c.title as course_title",
        "a.max_score",
        "a.due_date",
        sql<string | null>`ls.submission_status`.as("submission_status"),
        sql<Date | null>`ls.submitted_at`.as("submitted_at"),
        sql<string | null>`ev.score`.as("score"),
        sql<string | null>`ev.max_score`.as("eval_max_score"),
        sql<string | null>`ev.feedback`.as("feedback"),
        sql<Date | null>`ev.evaluated_at`.as("evaluated_at"),
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.status", "=", "PUBLISHED")
      .where("a.course_id", "in", (qb) =>
        qb.selectFrom("enrolled_courses").select("course_id")
      )
      .orderBy("c.title", "asc")
      .orderBy("a.sort_order", "asc")
      .orderBy("a.created_at", "asc")
      .execute();

    return rows as unknown as MemberAssignmentAnalyticsRow[];
  }
}

export default new MemberCourseAnalyticsRepository();
