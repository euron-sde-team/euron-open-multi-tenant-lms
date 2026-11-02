import { sql } from "kysely";
import { db } from "../db/connection";

function pint(val: unknown): number {
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return Number(val ?? 0);
}

function pfloat(val: unknown): number {
  if (typeof val === "string") return parseFloat(val) || 0;
  return Number(val ?? 0);
}

class MemberAnalyticsRepository {
  async getAggregatedAnalytics(tenantId: string, memberId: string) {
    const [
      enrollmentStats,
      lectureStats,
      courseProgress,
      completedCoursesAgg,
      weeklyActivity,
      timeByCourse,
      quizAgg,
      quizScores,
      assignmentStats,
      certCount,
      reviewStats,
      bookmarkStats,
      recentSessions,
      activeSessionCount,
      loginFrequency,
      paymentStats,
      streakDays,
      dailyActivity,
    ] = await Promise.all([
      // 1. Enrollment summary
      db.selectFrom("enrollments")
        .select([
          sql<string>`count(*)`.as("total"),
          sql<string>`count(*) filter (where status = 'COMPLETED')`.as("completed"),
          sql<string>`count(*) filter (where status = 'ACTIVE')`.as("active"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .executeTakeFirst(),

      // 2. Lecture progress summary
      db.selectFrom("member_lecture_progress")
        .select([
          sql<string>`coalesce(sum(watched_duration), 0)`.as("total_seconds"),
          sql<string>`count(*)`.as("total_touched"),
          sql<string>`count(*) filter (where completed = true)`.as("completed"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .executeTakeFirst(),

      // 3. Per-course progress (top 20)
      db.selectFrom("enrollments as e")
        .innerJoin("courses as c", "c.id", "e.course_id")
        .select([
          "c.id as course_id",
          "c.title as course_title",
          sql<string>`e.status`.as("status"),
          "e.enrolled_at",
          sql<string>`(select count(*) from member_lecture_progress mlp where mlp.course_id = c.id and mlp.tenant_id = ${tenantId} and mlp.tenant_member_id = ${memberId})`.as("touched_lectures"),
          sql<string>`(select count(*) from member_lecture_progress mlp where mlp.course_id = c.id and mlp.tenant_id = ${tenantId} and mlp.tenant_member_id = ${memberId} and mlp.completed = true)`.as("completed_lectures"),
          sql<string>`(select count(*) from lectures l inner join course_lessons cl on cl.id = l.lesson_id inner join course_sections cs on cs.id = cl.section_id where cs.course_id = c.id and cs.tenant_id = ${tenantId})`.as("total_lectures"),
        ])
        .where("e.tenant_id", "=", tenantId)
        .where("e.tenant_member_id", "=", memberId)
        .where("e.status", "!=", "CANCELLED")
        .orderBy("e.enrolled_at", "desc")
        .limit(20)
        .execute(),

      // 3b. Completed courses across ALL enrollments (unbounded, same
      // completion semantics as the per-course list above)
      db.selectFrom("enrollments as e")
        .innerJoin("courses as c", "c.id", "e.course_id")
        .select([sql<string>`count(*)`.as("completed")])
        .where("e.tenant_id", "=", tenantId)
        .where("e.tenant_member_id", "=", memberId)
        .where("e.status", "!=", "CANCELLED")
        .where("c.tenant_id", "=", tenantId)
        .where(
          sql<boolean>`(select count(*) from lectures l inner join course_lessons cl on cl.id = l.lesson_id inner join course_sections cs on cs.id = cl.section_id where cs.course_id = c.id and cs.tenant_id = ${tenantId}) > 0`
        )
        .where(
          sql<boolean>`(select count(*) from member_lecture_progress mlp where mlp.course_id = c.id and mlp.tenant_id = ${tenantId} and mlp.tenant_member_id = ${memberId} and mlp.completed = true) >= (select count(*) from lectures l inner join course_lessons cl on cl.id = l.lesson_id inner join course_sections cs on cs.id = cl.section_id where cs.course_id = c.id and cs.tenant_id = ${tenantId})`
        )
        .executeTakeFirst(),

      // 4. Weekly activity (last 12 weeks)
      db.selectFrom("member_lecture_progress")
        .select([
          sql<string>`date_trunc('week', last_watched_at)`.as("week"),
          sql<string>`coalesce(sum(watched_duration), 0)`.as("total_seconds"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("last_watched_at", ">=", sql<Date>`now() - interval '12 weeks'`)
        .groupBy(sql`date_trunc('week', last_watched_at)`)
        .orderBy(sql`date_trunc('week', last_watched_at)`, "asc")
        .execute(),

      // 5. Time by course (top 10)
      db.selectFrom("member_lecture_progress as mlp")
        .innerJoin("courses as c", "c.id", "mlp.course_id")
        .select([
          "c.title as course_title",
          sql<string>`coalesce(sum(mlp.watched_duration), 0)`.as("total_seconds"),
        ])
        .where("mlp.tenant_id", "=", tenantId)
        .where("mlp.tenant_member_id", "=", memberId)
        .groupBy(["c.id", "c.title"])
        .orderBy(sql`coalesce(sum(mlp.watched_duration), 0)`, "desc")
        .limit(10)
        .execute(),

      // 6. Quiz aggregates
      db.selectFrom("quiz_attempts")
        .select([
          sql<string>`count(*)`.as("total_attempts"),
          sql<string>`coalesce(avg(case when total_marks > 0 then (score::float / total_marks * 100) end), 0)`.as("avg_score_pct"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("status", "!=", "IN_PROGRESS")
        .executeTakeFirst(),

      // 7. Quiz scores over time (last 50)
      db.selectFrom("quiz_attempts")
        .select(["id", "quiz_id", "score", "total_marks", "completed_at"])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("status", "!=", "IN_PROGRESS")
        .where("completed_at", "is not", null)
        .orderBy("completed_at", "asc")
        .limit(50)
        .execute(),

      // 8. Assignment stats
      db.selectFrom("member_assignment_progress")
        .select([
          sql<string>`count(*)`.as("total"),
          sql<string>`count(*) filter (where completed = true)`.as("completed"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .executeTakeFirst(),

      // 9. Certificates count
      db.selectFrom("certificates")
        .select([sql<string>`count(*)`.as("total")])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("status", "=", "ISSUED")
        .executeTakeFirst(),

      // 13. Reviews
      db.selectFrom("course_reviews")
        .select([
          sql<string>`count(*)`.as("count"),
          sql<string>`coalesce(avg(rating), 0)`.as("avg_rating"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .executeTakeFirst(),

      // 14. Bookmarks by type
      db.selectFrom("member_bookmarks")
        .select(["bookmark_type", sql<string>`count(*)`.as("count")])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .groupBy("bookmark_type")
        .execute(),

      // 22. Recent sessions (last 10)
      db.selectFrom("tenant_member_sessions")
        .select(["id", "device_info", "is_active", "created_at", "last_seen_at"])
        .where("tenant_id", "=", tenantId)
        .where("member_id", "=", memberId)
        .orderBy("created_at", "desc")
        .limit(10)
        .execute(),

      // 23. Active sessions count
      db.selectFrom("tenant_member_sessions")
        .select([sql<string>`count(*)`.as("active")])
        .where("tenant_id", "=", tenantId)
        .where("member_id", "=", memberId)
        .where("is_active", "=", true)
        .executeTakeFirst(),

      // 24. Login frequency (last 30 days)
      db.selectFrom("tenant_member_sessions")
        .select([
          sql<string>`date_trunc('day', created_at)`.as("day"),
          sql<string>`count(*)`.as("count"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("member_id", "=", memberId)
        .where("created_at", ">=", sql<Date>`now() - interval '30 days'`)
        .groupBy(sql`date_trunc('day', created_at)`)
        .orderBy(sql`date_trunc('day', created_at)`, "asc")
        .execute(),

      // 25. Payment stats
      db.selectFrom("payment_orders")
        .select([
          "order_type",
          "currency",
          sql<string>`count(*)`.as("count"),
          sql<string>`coalesce(sum(cast(total_amount as numeric)), 0)`.as("amount"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("status", "=", "PAID")
        .groupBy(["order_type", "currency"])
        .execute(),

      // 28. Streak days (distinct activity dates, last 90 days)
      db.selectFrom("member_lecture_progress")
        .select([sql<string>`distinct date(last_watched_at)`.as("d")])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("last_watched_at", ">=", sql<Date>`now() - interval '90 days'`)
        .orderBy(sql`date(last_watched_at)`, "desc")
        .execute(),

      // 29. Daily activity heatmap (last 365 days, for GitHub-style grid)
      db.selectFrom("member_lecture_progress")
        .select([
          sql<string>`date(last_watched_at)`.as("day"),
          sql<string>`coalesce(sum(watched_duration), 0)`.as("seconds"),
          sql<string>`count(*)`.as("actions"),
        ])
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("last_watched_at", ">=", sql<Date>`now() - interval '365 days'`)
        .groupBy(sql`date(last_watched_at)`)
        .orderBy(sql`date(last_watched_at)`, "asc")
        .execute(),
    ]);

    // Compute bookmark breakdown
    const bookmarks = { courses: 0, books: 0, bundles: 0 };
    for (const b of bookmarkStats) {
      const count = pint(b.count);
      if (b.bookmark_type === "COURSE") bookmarks.courses = count;
      else if (b.bookmark_type === "BOOK") bookmarks.books = count;
      else if (b.bookmark_type === "BUNDLE") bookmarks.bundles = count;
    }

    // Compute current streak from the set of distinct active UTC dates. A single
    // grace day is allowed only at the START (so a streak counts even if the
    // learner hasn't been active *today* yet, it ends yesterday), it must
    // never bridge a real gap, which the previous per-step grace wrongly did.
    const activeDateSet = new Set(
      streakDays.map((row) => new Date(String(row.d)).toISOString().slice(0, 10))
    );
    let currentStreak = 0;
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    if (!activeDateSet.has(cursor.toISOString().slice(0, 10))) {
      // Not active today, start the walk from yesterday (grace day).
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    while (activeDateSet.has(cursor.toISOString().slice(0, 10))) {
      currentStreak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    const totalLearningSeconds = pint(lectureStats?.total_seconds);
    const totalEnrolled = pint(enrollmentStats?.total);
    // enrollments.status is never flipped to COMPLETED anywhere in the app,
    // so the stored "completed" filter is always 0. Derive completion from
    // actual lecture progress instead: a course counts as completed once all
    // of its lectures are done, the same rule certificate eligibility uses.
    // Counted across ALL enrollments, not the 20-row recent-courses widget.
    const totalCompleted = pint(completedCoursesAgg?.completed);

    return {
      overview: {
        totalCoursesEnrolled: totalEnrolled,
        coursesCompleted: totalCompleted,
        completionRate: totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0,
        totalLearningHours: Math.round((totalLearningSeconds / 3600) * 10) / 10,
        certificatesEarned: pint(certCount?.total),
        totalQuizAttempts: pint(quizAgg?.total_attempts),
        averageQuizScore: Math.round(pfloat(quizAgg?.avg_score_pct)),
        currentStreak,
      },

      learningProgress: {
        courseProgress: courseProgress.map((c) => {
          const total = pint(c.total_lectures);
          const completed = pint(c.completed_lectures);
          return {
            courseId: c.course_id,
            courseTitle: c.course_title ?? "Untitled Course",
            status: c.status,
            enrolledAt: c.enrolled_at?.toISOString() ?? "",
            totalLectures: total,
            completedLectures: completed,
            progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
          };
        }),
        weeklyActivity: weeklyActivity.map((w) => ({
          week: new Date(w.week as string).toISOString(),
          hours: Math.round((pint(w.total_seconds) / 3600) * 10) / 10,
        })),
        timeByCourse: timeByCourse.map((t) => ({
          courseTitle: t.course_title ?? "Untitled",
          hours: Math.round((pint(t.total_seconds) / 3600) * 10) / 10,
        })),
      },

      assessments: {
        quizScores: quizScores.map((q) => ({
          quizId: q.quiz_id,
          score: q.score,
          totalMarks: q.total_marks,
          percent: q.total_marks > 0 ? Math.round((q.score / q.total_marks) * 100) : 0,
          completedAt: q.completed_at?.toISOString() ?? "",
        })),
        assignmentStats: {
          total: pint(assignmentStats?.total),
          completed: pint(assignmentStats?.completed),
          pending: pint(assignmentStats?.total) - pint(assignmentStats?.completed),
        },
      },

      contentEngagement: {
        reviews: {
          count: pint(reviewStats?.count),
          averageRating: Math.round(pfloat(reviewStats?.avg_rating) * 10) / 10,
        },
        bookmarks,
      },

      sessions: {
        recentSessions: recentSessions.map((s) => ({
          id: s.id,
          deviceInfo: s.device_info,
          isActive: s.is_active,
          createdAt: s.created_at.toISOString(),
          lastSeenAt: s.last_seen_at.toISOString(),
        })),
        activeSessions: pint(activeSessionCount?.active),
        loginFrequency: loginFrequency.map((l) => ({
          day: new Date(l.day as string).toISOString(),
          count: pint(l.count),
        })),
      },

      financial: {
        totalSpent: paymentStats.reduce((sum, p) => sum + pfloat(p.amount), 0),
        currency: paymentStats[0]?.currency ?? "INR",
        purchaseBreakdown: paymentStats.map((p) => ({
          orderType: p.order_type,
          count: pint(p.count),
          amount: pfloat(p.amount),
        })),
      },

      // Normalise the grouped date to a "YYYY-MM-DD" key so the frontend
      // heatmap (which generates the same key shape) actually matches, a raw
      // Date stringifies to "Fri Jun 12 2026 …", which never matched, leaving
      // the activity grid (and "active today") permanently empty.
      dailyActivity: dailyActivity.map((d) => ({
        day: new Date(String(d.day)).toISOString().slice(0, 10),
        minutes: Math.round(pint(d.seconds) / 60),
        actions: pint(d.actions),
      })),
    };
  }
}

export default new MemberAnalyticsRepository();
