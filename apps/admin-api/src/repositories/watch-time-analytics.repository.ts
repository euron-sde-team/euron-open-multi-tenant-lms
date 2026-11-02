/**
 * Watch-time analytics repository (tenant-admin backend, read-side).
 *
 * Reads from rollup tables wherever possible
 *   - tenant_watch_time_daily       (per day per lecture totals)
 *   - tenant_active_learners_daily  (per day distinct-learner counts)
 *   - lecture_dropoff_buckets       (10-bucket position retention curves)
 *
 * Falls back to lecture_watch_sessions only for "recent activity" tables
 * (recent lectures viewed by a member) where rollup granularity isn't enough.
 *
 * All queries are tenant-scoped. The learner-api's hourly rollup job
 * populates the rollup tables; this repo only reads them.
 */

import { sql } from "kysely";
import { db } from "../db/connection";
import { pLimit } from "../utils/concurrency";

const HOUR_MS = 60 * 60 * 1000;

function parseDateRange(startDate?: string, endDate?: string): { sd: string; ed: string } {
  // Defaults: lifetime (matches existing analytics convention).
  return {
    sd: startDate || "1970-01-01",
    ed: endDate || "2099-12-31",
  };
}

function bigIntToNumber(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return parseInt(v, 10) || 0;
  return Number(v ?? 0);
}

class WatchTimeAnalyticsRepository {
  /**
   * Per-course drilldown, per-lecture totals, drop-off buckets, top viewers.
   * Data is rollup-driven for the per-lecture totals + drop-off buckets;
   * top-viewers comes from lecture_watch_sessions (last 90 days hot window).
   */
  async getCourseWatchTime(
    tenantId: string,
    courseId: string,
    startDate?: string,
    endDate?: string,
    topViewersLimit = 10
  ) {
    const { sd, ed } = parseDateRange(startDate, endDate);

    // Perf: 3 independent queries fired in parallel (was sequential).
    //   - perLectureRows: rollup-backed per-lecture totals
    //   - topViewers:     raw sessions (no rollup by member), capped LIMIT
    //   - dailyWatchHours: rollup-backed daily series
    // Drop-off stays sequential because it depends on lectureIds. We start
    // it as soon as perLectureRows resolves (not waiting for the whole batch).
    const perLectureRowsPromise = db
      .selectFrom("tenant_watch_time_daily as twd")
      .innerJoin("lectures as l", (join) =>
        join.onRef("l.id", "=", "twd.lecture_id").on("l.tenant_id", "=", tenantId)
      )
      .select([
        "twd.lecture_id",
        "l.title as lecture_title",
        "l.duration as lecture_duration",
        sql<string>`coalesce(sum(twd.total_seconds), 0)::text`.as("total_seconds"),
        sql<number>`coalesce(sum(twd.sessions_count), 0)::int`.as("sessions_count"),
        sql<number>`coalesce(max(twd.distinct_members_count), 0)::int`.as("max_daily_members"),
        sql<number>`coalesce(avg(twd.avg_completion_pct), 0)::float`.as("avg_completion_pct"),
      ])
      .where("twd.tenant_id", "=", tenantId)
      .where("twd.course_id", "=", courseId)
      .where(sql<boolean>`twd.date >= ${sd}::date`)
      .where(sql<boolean>`twd.date < (${ed}::date + interval '1 day')`)
      .groupBy(["twd.lecture_id", "l.title", "l.duration"])
      .orderBy("total_seconds", "desc")
      .execute();

    const topViewersPromise = db
      .selectFrom("lecture_watch_sessions as s")
      .innerJoin("tenant_members as m", (join) =>
        join.onRef("m.id", "=", "s.tenant_member_id").on("m.tenant_id", "=", tenantId)
      )
      .select([
        "s.tenant_member_id as member_id",
        "m.name as member_name",
        "m.email as member_email",
        sql<string>`coalesce(sum(s.seconds_watched), 0)::text`.as("total_seconds"),
        sql<number>`count(distinct s.lecture_id)::int`.as("lectures_touched"),
      ])
      .where("s.tenant_id", "=", tenantId)
      .where("s.course_id", "=", courseId)
      .where(sql<boolean>`s.started_at >= ${sd}::date`)
      .where(sql<boolean>`s.started_at < (${ed}::date + interval '1 day')`)
      .groupBy(["s.tenant_member_id", "m.name", "m.email"])
      .orderBy(sql`sum(s.seconds_watched)`, "desc")
      .limit(topViewersLimit)
      .execute();

    const dailyWatchHoursPromise = db
      .selectFrom("tenant_watch_time_daily")
      .select([
        sql<string>`to_char(date(date), 'YYYY-MM-DD')`.as("date"),
        sql<string>`coalesce(sum(total_seconds), 0)::text`.as("total_seconds"),
      ])
      .where("tenant_id", "=", tenantId)
      .where("course_id", "=", courseId)
      .where(sql<boolean>`date >= ${sd}::date`)
      .where(sql<boolean>`date < (${ed}::date + interval '1 day')`)
      .groupBy(sql`date(date)`)
      .orderBy(sql`date(date)`)
      .execute();

    // Drop-off depends on perLectureRows for the lecture IDs, so we chain
    // it off that single promise rather than awaiting the full batch. The
    // outer Promise.all wall time is therefore max(perLecture+dropoff,
    // topViewers, dailyWatchHours).
    //
    // NOTE: drop-off is intentionally CUMULATIVE (lifetime, no date filter).
    // The lecture_dropoff_buckets table has no date dimension; buckets are
    // a rolling count across the full hot session window (~90 days). The
    // frontend labels this chart "All-time drop-off" so admins do not
    // misread it as date-filtered.
    const perLectureWithDropoffPromise = perLectureRowsPromise.then(
      async (perLectureRows) => {
        const lectureIds = perLectureRows.map((r) => r.lecture_id);
        const dropoffByLecture: Record<
          string,
          Array<{ bucket: number; sessions: number }>
        > = {};
        if (lectureIds.length === 0) {
          return { perLectureRows, dropoffByLecture };
        }
        const dropoffRows = await db
          .selectFrom("lecture_dropoff_buckets")
          .selectAll()
          .where("tenant_id", "=", tenantId)
          .where("lecture_id", "in", lectureIds)
          .execute();
        for (const r of dropoffRows) {
          const arr = (dropoffByLecture[r.lecture_id] ??= Array.from(
            { length: 10 },
            (_, i) => ({ bucket: i, sessions: 0 })
          ));
          arr[r.bucket_index] = {
            bucket: r.bucket_index,
            sessions: r.sessions_count,
          };
        }
        return { perLectureRows, dropoffByLecture };
      }
    );

    const [{ perLectureRows, dropoffByLecture }, topViewers, dailyWatchHours] =
      await Promise.all([
        perLectureWithDropoffPromise,
        topViewersPromise,
        dailyWatchHoursPromise,
      ]);

    return {
      perLecture: perLectureRows.map((r) => {
        const totalSecs = bigIntToNumber(r.total_seconds);
        return {
          lecture_id: r.lecture_id,
          title: r.lecture_title,
          duration_seconds: Number(r.lecture_duration ?? 0),
          total_seconds: totalSecs,
          total_hours: Math.round((totalSecs / 3600) * 100) / 100,
          sessions_count: r.sessions_count,
          max_daily_members: r.max_daily_members,
          avg_completion_pct: Math.round((r.avg_completion_pct || 0) * 1000) / 10, // 0–100 with 1 decimal
          dropoff: dropoffByLecture[r.lecture_id] ?? Array.from({ length: 10 }, (_, i) => ({ bucket: i, sessions: 0 })),
        };
      }),
      topViewers: topViewers.map((v) => {
        const total = bigIntToNumber(v.total_seconds);
        return {
          member_id: v.member_id,
          member_name: v.member_name,
          member_email: v.member_email,
          total_seconds: total,
          total_hours: Math.round((total / 3600) * 100) / 100,
          lectures_touched: v.lectures_touched,
        };
      }),
      dailyWatchHours: dailyWatchHours.map((d) => ({
        date: String(d.date).slice(0, 10),
        seconds: bigIntToNumber(d.total_seconds),
      })),
    };
  }

  /**
   * Per-user drilldown, course-by-course breakdown + recent lectures.
   * Course breakdown is rollup-driven; recent activity comes from sessions.
   */
  async getMemberWatchTime(
    tenantId: string,
    memberId: string,
    startDate?: string,
    endDate?: string,
    recentLimit = 10
  ) {
    const { sd, ed } = parseDateRange(startDate, endDate);

    // Course-by-course total, derive from sessions table directly to scope by
    // member (rollup is coarser per (course, lecture, day) but doesn't keep
    // per-member partition). 90-day hot window is fine for "what did this
    // user watch lately".
    const perCourse = await db
      .selectFrom("lecture_watch_sessions as s")
      .innerJoin("courses as c", (join) =>
        join.onRef("c.id", "=", "s.course_id").on("c.tenant_id", "=", tenantId)
      )
      .select([
        "s.course_id",
        "c.title as course_title",
        sql<string>`coalesce(sum(s.seconds_watched), 0)::text`.as("total_seconds"),
        sql<number>`count(distinct s.lecture_id)::int`.as("lectures_watched"),
        sql<number>`count(*)::int`.as("sessions_count"),
        sql<Date>`max(s.last_heartbeat_at)`.as("last_active_at"),
      ])
      .where("s.tenant_id", "=", tenantId)
      .where("s.tenant_member_id", "=", memberId)
      .where(sql<boolean>`s.started_at >= ${sd}::date`)
      .where(sql<boolean>`s.started_at < (${ed}::date + interval '1 day')`)
      .groupBy(["s.course_id", "c.title"])
      .orderBy(sql`sum(s.seconds_watched)`, "desc")
      .execute();

    // Recent sessions honor the same date range as perCourse so the response
    // is internally consistent. If the caller asked for "last 7 days", the
    // recent sessions list also respects that window.
    const recentSessions = await db
      .selectFrom("lecture_watch_sessions as s")
      .innerJoin("lectures as l", (join) =>
        join.onRef("l.id", "=", "s.lecture_id").on("l.tenant_id", "=", tenantId)
      )
      .innerJoin("courses as c", (join) =>
        join.onRef("c.id", "=", "s.course_id").on("c.tenant_id", "=", tenantId)
      )
      .select([
        "s.id",
        "s.lecture_id",
        "l.title as lecture_title",
        "s.course_id",
        "c.title as course_title",
        "s.started_at",
        "s.last_heartbeat_at",
        "s.end_position",
        sql<string>`coalesce(s.seconds_watched, 0)::text`.as("seconds_watched"),
      ])
      .where("s.tenant_id", "=", tenantId)
      .where("s.tenant_member_id", "=", memberId)
      .where(sql<boolean>`s.started_at >= ${sd}::date`)
      .where(sql<boolean>`s.started_at < (${ed}::date + interval '1 day')`)
      .orderBy("s.last_heartbeat_at", "desc")
      .limit(recentLimit)
      .execute();

    return {
      perCourse: perCourse.map((c) => {
        const total = bigIntToNumber(c.total_seconds);
        return {
          course_id: c.course_id,
          title: c.course_title,
          total_seconds: total,
          total_hours: Math.round((total / 3600) * 100) / 100,
          lectures_watched: c.lectures_watched,
          sessions_count: c.sessions_count,
          last_active_at: c.last_active_at instanceof Date ? c.last_active_at.toISOString() : String(c.last_active_at ?? ""),
        };
      }),
      recentSessions: recentSessions.map((s) => ({
        session_id: s.id,
        lecture_id: s.lecture_id,
        lecture_title: s.lecture_title,
        course_id: s.course_id,
        course_title: s.course_title,
        started_at: s.started_at instanceof Date ? s.started_at.toISOString() : String(s.started_at ?? ""),
        last_heartbeat_at: s.last_heartbeat_at instanceof Date ? s.last_heartbeat_at.toISOString() : String(s.last_heartbeat_at ?? ""),
        end_position: s.end_position,
        seconds_watched: bigIntToNumber(s.seconds_watched),
      })),
    };
  }

  /**
   * Tenant-wide video watch analytics overview. Aggregates the rollup tables to
   * give an at-a-glance view of platform engagement: total watched seconds,
   * unique learners, completion stats, daily trend, top courses by watch time,
   * top viewers, and the most-watched lectures.
   *
   * Date filter applies to the rollup `date` column (and started_at for the
   * top-viewers session scan), so admins can answer "how is video engagement
   * trending in this period".
   */
  async getOverview(
    tenantId: string,
    startDate?: string,
    endDate?: string,
    topN = 10
  ) {
    const { sd, ed } = parseDateRange(startDate, endDate);

    // One-shot scalar rollup. All four counters scan the same rollup table
    // with the same filters, so PG can use the same index path for each.
    const totalsRow = await sql<{
      total_seconds: string;
      sessions_count: number;
      lectures_touched: number;
      avg_completion_pct: number;
    }>`
      SELECT
        coalesce(sum(total_seconds), 0)::text       AS total_seconds,
        coalesce(sum(sessions_count), 0)::int       AS sessions_count,
        count(distinct lecture_id)::int             AS lectures_touched,
        coalesce(avg(avg_completion_pct), 0)::float AS avg_completion_pct
      FROM tenant_watch_time_daily
      WHERE tenant_id = ${tenantId}
        AND date >= ${sd}::date
        AND date < (${ed}::date + interval '1 day')
    `.execute(db);
    const totals = totalsRow.rows[0];
    const totalSeconds = bigIntToNumber(totals.total_seconds);

    // Distinct active learners over the window. tenant_active_learners_daily
    // stores only a per-day pre-aggregated count (distinct_members_count) and
    // doesn't expose member IDs, so we can't compute unique-across-window from
    // it. Fall back to lecture_watch_sessions (same source already used for
    // top-viewers); 90-day hot-window retention is fine for a usage KPI.
    const activeLearnersRow = await sql<{ active_learners: number }>`
      SELECT count(distinct tenant_member_id)::int AS active_learners
      FROM lecture_watch_sessions
      WHERE tenant_id = ${tenantId}
        AND started_at >= ${sd}::date
        AND started_at < (${ed}::date + interval '1 day')
    `.execute(db);
    const activeLearners = activeLearnersRow.rows[0]?.active_learners ?? 0;

    const reqLimit = pLimit(4);
    const [dailyRows, perCourseRows, topViewersRows, topLecturesRows] = await Promise.all([
      // Daily watch hours trend, single row per day across all courses.
      reqLimit(() => db
        .selectFrom("tenant_watch_time_daily")
        .select([
          sql<string>`to_char(date(date), 'YYYY-MM-DD')`.as("date"),
          sql<string>`coalesce(sum(total_seconds), 0)::text`.as("total_seconds"),
          sql<number>`coalesce(sum(sessions_count), 0)::int`.as("sessions"),
        ])
        .where("tenant_id", "=", tenantId)
        .where(sql<boolean>`date >= ${sd}::date`)
        .where(sql<boolean>`date < (${ed}::date + interval '1 day')`)
        .groupBy(sql`date(date)`)
        .orderBy(sql`date(date)`)
        .execute()),

      // Top courses by watch time. Joins lazy through the rollup so we don't
      // need session-level data. Includes title for display.
      reqLimit(() => db
        .selectFrom("tenant_watch_time_daily as twd")
        .innerJoin("courses as c", (join) =>
          join.onRef("c.id", "=", "twd.course_id").on("c.tenant_id", "=", tenantId)
        )
        .select([
          "twd.course_id",
          "c.title as course_title",
          sql<string>`coalesce(sum(twd.total_seconds), 0)::text`.as("total_seconds"),
          sql<number>`coalesce(sum(twd.sessions_count), 0)::int`.as("sessions_count"),
          sql<number>`count(distinct twd.lecture_id)::int`.as("lectures_touched"),
          sql<number>`coalesce(avg(twd.avg_completion_pct), 0)::float`.as("avg_completion_pct"),
        ])
        .where("twd.tenant_id", "=", tenantId)
        .where(sql<boolean>`twd.date >= ${sd}::date`)
        .where(sql<boolean>`twd.date < (${ed}::date + interval '1 day')`)
        .groupBy(["twd.course_id", "c.title"])
        .orderBy(sql`sum(twd.total_seconds)`, "desc")
        .limit(topN)
        .execute()),

      // Top viewers across all courses. Uses session table (rollup is not
      // member-keyed). 90-day hot window already enforced by table retention.
      reqLimit(() => db
        .selectFrom("lecture_watch_sessions as s")
        .innerJoin("tenant_members as m", (join) =>
          join.onRef("m.id", "=", "s.tenant_member_id").on("m.tenant_id", "=", tenantId)
        )
        .select([
          "s.tenant_member_id as member_id",
          "m.name as member_name",
          "m.email as member_email",
          sql<string>`coalesce(sum(s.seconds_watched), 0)::text`.as("total_seconds"),
          sql<number>`count(distinct s.course_id)::int`.as("courses_touched"),
          sql<number>`count(distinct s.lecture_id)::int`.as("lectures_touched"),
          sql<Date>`max(s.last_heartbeat_at)`.as("last_active_at"),
        ])
        .where("s.tenant_id", "=", tenantId)
        .where(sql<boolean>`s.started_at >= ${sd}::date`)
        .where(sql<boolean>`s.started_at < (${ed}::date + interval '1 day')`)
        .groupBy(["s.tenant_member_id", "m.name", "m.email"])
        .orderBy(sql`sum(s.seconds_watched)`, "desc")
        .limit(topN)
        .execute()),

      // Top lectures by watch time, useful for "which video is most watched".
      reqLimit(() => db
        .selectFrom("tenant_watch_time_daily as twd")
        .innerJoin("lectures as l", (join) =>
          join.onRef("l.id", "=", "twd.lecture_id").on("l.tenant_id", "=", tenantId)
        )
        .innerJoin("courses as c", (join) =>
          join.onRef("c.id", "=", "twd.course_id").on("c.tenant_id", "=", tenantId)
        )
        .select([
          "twd.lecture_id",
          "l.title as lecture_title",
          "l.duration as lecture_duration",
          "twd.course_id",
          "c.title as course_title",
          sql<string>`coalesce(sum(twd.total_seconds), 0)::text`.as("total_seconds"),
          sql<number>`coalesce(sum(twd.sessions_count), 0)::int`.as("sessions_count"),
          sql<number>`coalesce(max(twd.distinct_members_count), 0)::int`.as("max_daily_members"),
          sql<number>`coalesce(avg(twd.avg_completion_pct), 0)::float`.as("avg_completion_pct"),
        ])
        .where("twd.tenant_id", "=", tenantId)
        .where(sql<boolean>`twd.date >= ${sd}::date`)
        .where(sql<boolean>`twd.date < (${ed}::date + interval '1 day')`)
        .groupBy(["twd.lecture_id", "l.title", "l.duration", "twd.course_id", "c.title"])
        .orderBy(sql`sum(twd.total_seconds)`, "desc")
        .limit(topN)
        .execute()),
    ]);

    const avgSecondsPerLearner =
      activeLearners > 0 ? Math.round(totalSeconds / activeLearners) : 0;

    return {
      summary: {
        total_seconds: totalSeconds,
        total_hours: Math.round((totalSeconds / 3600) * 100) / 100,
        sessions_count: totals.sessions_count,
        lectures_touched: totals.lectures_touched,
        active_learners: activeLearners,
        avg_seconds_per_learner: avgSecondsPerLearner,
        avg_hours_per_learner: Math.round((avgSecondsPerLearner / 3600) * 100) / 100,
        // avg_completion_pct rolls up daily averages, so it's a coarse estimate
        //, fine for a "platform health" signal, not for a per-lecture KPI.
        avg_completion_pct: Math.round((totals.avg_completion_pct || 0) * 1000) / 10,
      },
      dailyWatchHours: dailyRows.map((d) => {
        const secs = bigIntToNumber(d.total_seconds);
        return {
          date: String(d.date).slice(0, 10),
          seconds: secs,
          hours: Math.round((secs / 3600) * 100) / 100,
          sessions: d.sessions,
        };
      }),
      topCourses: perCourseRows.map((r) => {
        const secs = bigIntToNumber(r.total_seconds);
        return {
          course_id: r.course_id,
          title: r.course_title,
          total_seconds: secs,
          total_hours: Math.round((secs / 3600) * 100) / 100,
          sessions_count: r.sessions_count,
          lectures_touched: r.lectures_touched,
          avg_completion_pct: Math.round((r.avg_completion_pct || 0) * 1000) / 10,
        };
      }),
      topViewers: topViewersRows.map((v) => {
        const secs = bigIntToNumber(v.total_seconds);
        return {
          member_id: v.member_id,
          member_name: v.member_name,
          member_email: v.member_email,
          total_seconds: secs,
          total_hours: Math.round((secs / 3600) * 100) / 100,
          courses_touched: v.courses_touched,
          lectures_touched: v.lectures_touched,
          last_active_at:
            v.last_active_at instanceof Date
              ? v.last_active_at.toISOString()
              : String(v.last_active_at ?? ""),
        };
      }),
      topLectures: topLecturesRows.map((r) => {
        const secs = bigIntToNumber(r.total_seconds);
        return {
          lecture_id: r.lecture_id,
          title: r.lecture_title,
          duration_seconds: Number(r.lecture_duration ?? 0),
          course_id: r.course_id,
          course_title: r.course_title,
          total_seconds: secs,
          total_hours: Math.round((secs / 3600) * 100) / 100,
          sessions_count: r.sessions_count,
          max_daily_members: r.max_daily_members,
          avg_completion_pct: Math.round((r.avg_completion_pct || 0) * 1000) / 10,
        };
      }),
      meta: {
        // hasAnyData: true if any rollup row exists for this tenant in the
        // selected window. Cheap because totalSeconds is already aggregated
        // above. We treat "any totals row with > 0 seconds OR any session
        // observed" as "has data" so that fresh tenants whose first rollup
        // tick hasn't fired yet still surface the explanatory banner.
        hasAnyData: totalSeconds > 0 || activeLearners > 0,
        lastRollupAt: null as string | null,
      },
    };
  }

  /**
   * Fetch the latest watermark from `watch_time_rollup_state` for the given
   * tenant. Returns null if no rollup has run yet (typical for tenants who
   * just shipped the feature).
   */
  async getRollupWatermark(tenantId: string): Promise<Date | null> {
    const row = await sql<{ last_rollup_at: Date | null }>`
      SELECT last_rollup_at
      FROM watch_time_rollup_state
      WHERE tenant_id = ${tenantId}
    `.execute(db);
    return row.rows[0]?.last_rollup_at ?? null;
  }
}

const watchTimeAnalyticsRepository = new WatchTimeAnalyticsRepository();
export default watchTimeAnalyticsRepository;
export { HOUR_MS };
