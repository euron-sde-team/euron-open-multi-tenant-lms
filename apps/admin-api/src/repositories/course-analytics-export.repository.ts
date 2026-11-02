import { sql } from "kysely";

import { db } from "../db/connection";

/**
 * Repository for the per-course analytics .xlsx export. Only the queries that
 * are unique to the export live here: daily engagement (90d) and top-learners
 * leaderboard. Everything else (per-quiz, per-assignment, per-lecture aggregates)
 * reuses the production analytics services that already back the live UI.
 *
 * Performance commitments:
 *   - daily engagement: 3 small grouped queries fired in parallel, each
 *     index-aligned (twd: tenant_id+course_id+date, quiz_attempts:
 *     tenant_id+course_id, assignment_submissions: tenant_id+course_id).
 *     Merged in JS so the SQL stays simple and cheap.
 *   - top learners: a single CTE-style query that pre-aggregates each member's
 *     watch / quiz / assignment activity then joins to enrollments. Hits the
 *     (tenant_id, tenant_member_id, course_id) index on member_lecture_progress
 *     and the (tenant_id, course_id) indexes on the attempt/submission tables.
 *     Result is capped at LIMIT 25 so the worst case is small even on large
 *     courses.
 */

export interface DailyEngagementRow {
  activity_date: Date;
  watch_seconds: number;
  quiz_attempts: number;
  assignment_submissions: number;
}

export interface CourseTopLearnerRow {
  tenant_member_id: string;
  member_name: string;
  member_email: string | null;
  enrollment_status: string;
  enrolled_at: Date;
  completed_at: Date | null;
  touched_lectures: string | number | null;
  completed_lectures: string | number | null;
  watched_seconds: string | number | null;
  total_watch_seconds: string | number | null;
  last_activity_at: Date | null;
  quiz_attempts: string | number | null;
  quiz_avg_score: string | number | null;
  assignment_submissions: string | number | null;
}

const toInt = (val: unknown): number => {
  if (val == null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number(val) || 0;
};

class CourseAnalyticsExportRepository {
  /**
   * Last `days` days of course engagement: watch hours, quiz attempts,
   * assignment submissions per day. Three grouped queries in parallel.
   */
  async getCourseDailyEngagement(
    tenantId: string,
    courseId: string,
    days: number
  ): Promise<DailyEngagementRow[]> {
    const safeDays = Math.max(1, Math.min(365, days));
    const cutoff = sql<Date>`NOW() - (${safeDays} || ' days')::interval`;

    const [watchRows, quizRows, assignmentRows] = await Promise.all([
      db
        .selectFrom("tenant_watch_time_daily as twd")
        .select([
          sql<Date>`twd.date`.as("activity_date"),
          sql<string>`COALESCE(SUM(twd.total_seconds), 0)`.as("watch_seconds"),
        ])
        .where("twd.tenant_id", "=", tenantId)
        .where("twd.course_id", "=", courseId)
        .where("twd.date", ">=", cutoff)
        .groupBy("twd.date")
        .execute(),
      db
        .selectFrom("quiz_attempts as qa")
        .select([
          sql<Date>`DATE(qa.created_at AT TIME ZONE 'UTC')`.as(
            "activity_date"
          ),
          sql<string>`COUNT(*)`.as("quiz_attempts"),
        ])
        .where("qa.tenant_id", "=", tenantId)
        .where("qa.course_id", "=", courseId)
        .where("qa.created_at", ">=", cutoff)
        .groupBy(sql`DATE(qa.created_at AT TIME ZONE 'UTC')`)
        .execute(),
      db
        .selectFrom("assignment_submissions as s")
        .select([
          sql<Date>`DATE(s.submitted_at AT TIME ZONE 'UTC')`.as(
            "activity_date"
          ),
          sql<string>`COUNT(*)`.as("assignment_submissions"),
        ])
        .where("s.tenant_id", "=", tenantId)
        .where("s.course_id", "=", courseId)
        .where("s.submitted_at", "is not", null)
        .where("s.submitted_at", ">=", cutoff)
        .groupBy(sql`DATE(s.submitted_at AT TIME ZONE 'UTC')`)
        .execute(),
    ]);

    const byDate = new Map<string, DailyEngagementRow>();
    const upsert = (
      date: Date,
      field: keyof Omit<DailyEngagementRow, "activity_date">,
      value: number
    ) => {
      const d = date instanceof Date ? date : new Date(date);
      const key = d.toISOString().slice(0, 10);
      let row = byDate.get(key);
      if (!row) {
        row = {
          activity_date: new Date(`${key}T00:00:00Z`),
          watch_seconds: 0,
          quiz_attempts: 0,
          assignment_submissions: 0,
        };
        byDate.set(key, row);
      }
      row[field] = value;
    };
    for (const r of watchRows) upsert(r.activity_date, "watch_seconds", toInt(r.watch_seconds));
    for (const r of quizRows) upsert(r.activity_date, "quiz_attempts", toInt(r.quiz_attempts));
    for (const r of assignmentRows)
      upsert(r.activity_date, "assignment_submissions", toInt(r.assignment_submissions));

    return Array.from(byDate.values()).sort(
      (a, b) => a.activity_date.getTime() - b.activity_date.getTime()
    );
  }

  /**
   * Top N learners in the course by total watched seconds, with quiz and
   * assignment activity joined in. Single query with three CTE aggregates
   * (member-level grouping) followed by joins to enrollments + tenant_members.
   */
  async getCourseTopLearners(
    tenantId: string,
    courseId: string,
    limit: number
  ): Promise<CourseTopLearnerRow[]> {
    const safeLimit = Math.max(1, Math.min(200, limit));

    const rows = await db
      .with("member_progress", (qb) =>
        qb
          .selectFrom("member_lecture_progress as mlp")
          .select([
            "mlp.tenant_member_id",
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
          .where("mlp.course_id", "=", courseId)
          .groupBy("mlp.tenant_member_id")
      )
      .with("member_quizzes", (qb) =>
        qb
          .selectFrom("quiz_attempts as qa")
          .select([
            "qa.tenant_member_id",
            sql<string>`COUNT(*)`.as("quiz_attempts"),
            sql<string>`COALESCE(ROUND(AVG(CASE WHEN qa.total_marks > 0 THEN qa.score::numeric / qa.total_marks * 100 ELSE NULL END)), 0)`.as(
              "quiz_avg_score"
            ),
          ])
          .where("qa.tenant_id", "=", tenantId)
          .where("qa.course_id", "=", courseId)
          .where("qa.status", "!=", "IN_PROGRESS")
          .groupBy("qa.tenant_member_id")
      )
      .with("member_assignments", (qb) =>
        qb
          .selectFrom("assignment_submissions as s")
          .select([
            "s.tenant_member_id",
            sql<string>`COUNT(*)`.as("assignment_submissions"),
          ])
          .where("s.tenant_id", "=", tenantId)
          .where("s.course_id", "=", courseId)
          .where("s.status", "!=", "PENDING")
          .groupBy("s.tenant_member_id")
      )
      .selectFrom("enrollments as e")
      .innerJoin("tenant_members as tm", (j) =>
        j
          .onRef("tm.id", "=", "e.tenant_member_id")
          .onRef("tm.tenant_id", "=", "e.tenant_id")
      )
      .leftJoin("member_progress as mp", "mp.tenant_member_id", "e.tenant_member_id")
      .leftJoin("member_quizzes as mq", "mq.tenant_member_id", "e.tenant_member_id")
      .leftJoin(
        "member_assignments as ma",
        "ma.tenant_member_id",
        "e.tenant_member_id"
      )
      .select([
        "e.tenant_member_id",
        "tm.name as member_name",
        "tm.email as member_email",
        sql<string>`e.status::text`.as("enrollment_status"),
        "e.enrolled_at",
        "e.completed_at",
        sql<string>`COALESCE(mp.touched_lectures, 0)`.as("touched_lectures"),
        sql<string>`COALESCE(mp.completed_lectures, 0)`.as(
          "completed_lectures"
        ),
        sql<string>`COALESCE(mp.watched_seconds, 0)`.as("watched_seconds"),
        sql<string>`COALESCE(mp.total_watch_seconds, 0)`.as(
          "total_watch_seconds"
        ),
        sql<Date | null>`mp.last_activity_at`.as("last_activity_at"),
        sql<string>`COALESCE(mq.quiz_attempts, 0)`.as("quiz_attempts"),
        sql<string>`COALESCE(mq.quiz_avg_score, 0)`.as("quiz_avg_score"),
        sql<string>`COALESCE(ma.assignment_submissions, 0)`.as(
          "assignment_submissions"
        ),
      ])
      .where("e.tenant_id", "=", tenantId)
      .where("e.course_id", "=", courseId)
      .where("e.status", "!=", "CANCELLED")
      .orderBy(sql`COALESCE(mp.watched_seconds, 0)`, "desc")
      .limit(safeLimit)
      .execute();

    return rows as unknown as CourseTopLearnerRow[];
  }
}

export default new CourseAnalyticsExportRepository();
