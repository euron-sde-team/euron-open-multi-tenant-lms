import { db } from "../db/connection";
import { sql } from "kysely";
import { NotFoundError } from "../errors/not-found.error";
import * as quizzesRepo from "../repositories/quizzes.repository";

export interface OverviewQuizAnalytics {
  total_quizzes: number;
  published_count: number;
  draft_count: number;
  total_attempts: number;
  passed_count: number;
  failed_count: number;
  courses: Array<{
    course_id: string;
    course_title: string;
    total_quizzes: number;
    published_count: number;
    draft_count: number;
    total_attempts: number;
    passed_count: number;
    failed_count: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface CourseQuizAnalytics {
  total_quizzes: number;
  published_count: number;
  draft_count: number;
  enrolled_count: number;
  quizzes: Array<{
    quiz_id: string;
    title: string;
    scope: string;
    status: string;
    max_score: number;
    pass_percentage: number;
    attempt_count: number;
    attempt_rate: number;
    passed_count: number;
    failed_count: number;
    average_score: number | null;
    pass_rate: number | null;
  }>;
}

export interface SingleQuizAnalytics {
  quiz_id: string;
  title: string;
  scope: string;
  max_score: number;
  pass_percentage: number;
  total_attempts: number;
  passed_count: number;
  failed_count: number;
  average_score: number | null;
  median_score: number | null;
  pass_rate: number | null;
  score_distribution: Array<{ range: string; count: number }>;
  student_results?: Array<{
    tenant_member_id: string;
    member_name: string;
    member_email: string | null;
    attempted: boolean;
    attempt_status: string | null;
    score: number | null;
    score_percentage: number | null;
    passed: boolean;
  }>;
  student_results_total?: number;
  student_results_page?: number;
  student_results_limit?: number;
}

const SCORE_BUCKETS = [
  { label: "0-20%", min: 0, max: 20 },
  { label: "21-40%", min: 21, max: 40 },
  { label: "41-60%", min: 41, max: 60 },
  { label: "61-80%", min: 61, max: 80 },
  { label: "81-100%", min: 81, max: 100 },
];

export async function getOverviewQuizAnalytics(
  tenantId: string,
  options?: { search?: string; page?: number; limit?: number }
): Promise<OverviewQuizAnalytics> {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = (page - 1) * limit;

  const statusCounts = await db
    .selectFrom("quizzes")
    .select(["status", db.fn.countAll().as("count")])
    .where("tenant_id", "=", tenantId)
    .groupBy("status")
    .execute();

  const publishedCount = statusCounts.find((r) => r.status === "PUBLISHED")
    ? Number(statusCounts.find((r) => r.status === "PUBLISHED")!.count)
    : 0;
  const draftCount = statusCounts.find((r) => r.status === "DRAFT")
    ? Number(statusCounts.find((r) => r.status === "DRAFT")!.count)
    : 0;
  const totalQuizzes = statusCounts.reduce((s, r) => s + Number(r.count ?? 0), 0);

  const attemptStats = await db
    .selectFrom("quiz_attempts")
    .select([
      sql<number>`count(id)::int`.as("total_attempts"),
      sql<number>`count(case when status = 'PASSED' then 1 end)::int`.as("passed_count"),
      sql<number>`count(case when status = 'FAILED' then 1 end)::int`.as("failed_count"),
    ])
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  const totalAttempts = Number(attemptStats?.total_attempts ?? 0);
  const passedCount = Number(attemptStats?.passed_count ?? 0);
  const failedCount = Number(attemptStats?.failed_count ?? 0);

  let courseQuery = db
    .selectFrom("quizzes as q")
    .innerJoin("courses as c", (join) =>
      join.onRef("c.id", "=", "q.course_id").on("c.tenant_id", "=", tenantId)
    )
    .leftJoin("quiz_attempts as qa", (join) =>
      join
        .onRef("qa.quiz_id", "=", "q.id")
        .on("qa.tenant_id", "=", tenantId)
    )
    .select([
      "c.id as course_id",
      "c.title as course_title",
      sql<number>`count(distinct q.id)::int`.as("total_quizzes"),
      sql<number>`count(distinct case when q.status = 'PUBLISHED' then q.id end)::int`.as("published_count"),
      sql<number>`count(distinct case when q.status = 'DRAFT' then q.id end)::int`.as("draft_count"),
      sql<number>`count(qa.id)::int`.as("total_attempts"),
      sql<number>`count(case when qa.status = 'PASSED' then 1 end)::int`.as("passed_count"),
      sql<number>`count(case when qa.status = 'FAILED' then 1 end)::int`.as("failed_count"),
    ])
    .where("q.tenant_id", "=", tenantId)
    .groupBy(["c.id", "c.title"]);

  if (options?.search?.trim()) {
    const term = `%${options.search.trim().toLowerCase()}%`;
    courseQuery = courseQuery.where(
      sql<boolean>`lower(c.title) like ${term}`
    );
  }

  let countQuery = db
    .selectFrom("quizzes as q")
    .innerJoin("courses as c", (join) =>
      join.onRef("c.id", "=", "q.course_id").on("c.tenant_id", "=", tenantId)
    )
    .where("q.tenant_id", "=", tenantId);
  if (options?.search?.trim()) {
    const term = `%${options.search.trim().toLowerCase()}%`;
    countQuery = countQuery.where(sql<boolean>`lower(c.title) like ${term}`);
  }
  const totalResult = await countQuery
    .select(sql<number>`count(distinct c.id)::int`.as("total"))
    .executeTakeFirst();
  const total = Number(totalResult?.total ?? 0);

  const courseRows = await courseQuery
    .orderBy("c.title", "asc")
    .limit(limit)
    .offset(offset)
    .execute();

  const courses = courseRows.map((r) => ({
    course_id: r.course_id,
    course_title: r.course_title,
    total_quizzes: Number(r.total_quizzes ?? 0),
    published_count: Number(r.published_count ?? 0),
    draft_count: Number(r.draft_count ?? 0),
    total_attempts: Number(r.total_attempts ?? 0),
    passed_count: Number(r.passed_count ?? 0),
    failed_count: Number(r.failed_count ?? 0),
  }));

  return {
    total_quizzes: totalQuizzes,
    published_count: publishedCount,
    draft_count: draftCount,
    total_attempts: totalAttempts,
    passed_count: passedCount,
    failed_count: failedCount,
    courses,
    total,
    page,
    limit,
  };
}

export async function getCourseQuizAnalytics(
  tenantId: string,
  courseId: string
): Promise<CourseQuizAnalytics> {
  // Perf: 3 round trips in parallel (was 4 sequential) and the previously
  // separate "status counts" query is gone, derived from quizRows in JS.
  // All three queries are scoped by (tenant_id, course_id) and hit existing
  // indexes; the course existence check is a PK lookup.
  const [course, enrolledCountResult, quizRows] = await Promise.all([
    db
      .selectFrom("courses")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", courseId)
      .executeTakeFirst(),
    db
      .selectFrom("enrollments")
      .select(db.fn.countAll().as("count"))
      .where("tenant_id", "=", tenantId)
      .where("course_id", "=", courseId)
      .where("status", "=", "ACTIVE")
      .executeTakeFirst(),
    db
      .selectFrom("quizzes")
      .leftJoin("quiz_attempts as qa", (join) =>
        join
          .onRef("qa.quiz_id", "=", "quizzes.id")
          .on("qa.tenant_id", "=", tenantId)
      )
      .select([
        "quizzes.id as quiz_id",
        "quizzes.title",
        "quizzes.scope",
        "quizzes.status",
        "quizzes.max_score",
        "quizzes.pass_percentage",
        sql<number>`count(qa.id)::int`.as("attempt_count"),
        sql<number>`count(case when qa.status = 'PASSED' then 1 end)::int`.as("passed_count"),
        sql<number>`count(case when qa.status = 'FAILED' then 1 end)::int`.as("failed_count"),
        sql<string>`avg(case when qa.total_marks > 0 then qa.score::float / qa.total_marks * 100 else null end)`.as("avg_pct"),
        sql<string>`(count(case when qa.status = 'PASSED' then 1 end)::float / nullif(count(qa.id), 0) * 100)`.as("pass_rate_pct"),
      ])
      .where("quizzes.tenant_id", "=", tenantId)
      .where("quizzes.course_id", "=", courseId)
      .groupBy([
        "quizzes.id",
        "quizzes.title",
        "quizzes.scope",
        "quizzes.status",
        "quizzes.max_score",
        "quizzes.pass_percentage",
        "quizzes.sort_order",
        "quizzes.created_at",
      ])
      .orderBy("quizzes.sort_order", "asc")
      .orderBy("quizzes.created_at", "asc")
      .execute(),
  ]);

  if (!course) {
    throw new NotFoundError("Course not found");
  }
  const enrolledCount = Number(enrolledCountResult?.count ?? 0);

  // Status counts derived from quizRows (no extra round trip). The outer
  // query already returns one row per quiz with its status, so we tally here.
  let publishedCount = 0;
  let draftCount = 0;
  for (const r of quizRows) {
    if (r.status === "PUBLISHED") publishedCount += 1;
    else if (r.status === "DRAFT") draftCount += 1;
  }

  const quizzes = quizRows.map((r) => {
    const attemptCount = Number(r.attempt_count ?? 0);
    const passedCount = Number(r.passed_count ?? 0);
    const failedCount = Number(r.failed_count ?? 0);
    const attemptRate =
      enrolledCount > 0 ? Math.round((attemptCount / enrolledCount) * 100) : 0;
    const avgScore = r.avg_pct != null ? parseFloat(String(r.avg_pct)) : null;
    const passRate =
      r.pass_rate_pct != null ? parseFloat(String(r.pass_rate_pct)) : null;

    return {
      quiz_id: r.quiz_id,
      title: r.title,
      scope: String(r.scope),
      status: String(r.status),
      max_score: Number(r.max_score),
      pass_percentage: Number(r.pass_percentage),
      attempt_count: attemptCount,
      attempt_rate: attemptRate,
      passed_count: passedCount,
      failed_count: failedCount,
      average_score: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
      pass_rate: passRate != null ? Math.round(passRate * 100) / 100 : null,
    };
  });

  return {
    total_quizzes: quizRows.length,
    published_count: publishedCount,
    draft_count: draftCount,
    enrolled_count: enrolledCount,
    quizzes,
  };
}

export async function getSingleQuizAnalytics(
  tenantId: string,
  quizId: string,
  options?: {
    include_student_results?: boolean;
    student_page?: number;
    student_limit?: number;
    student_search?: string;
  }
): Promise<SingleQuizAnalytics> {
  const quiz = await quizzesRepo.findById(tenantId, quizId);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }

  const maxScore = Number(quiz.max_score);
  const passPercentage = Number(quiz.pass_percentage);

  const attemptRows = await db
    .selectFrom("quiz_attempts")
    .select([
      "score",
      "total_marks",
      "status",
      sql<number>`(case when total_marks > 0 then score::float / total_marks * 100 else 0 end)::int`.as("score_pct"),
    ])
    .where("tenant_id", "=", tenantId)
    .where("quiz_id", "=", quizId)
    .execute();

  const totalAttempts = attemptRows.length;
  const passedCount = attemptRows.filter((r) => r.status === "PASSED").length;
  const failedCount = attemptRows.filter((r) => r.status === "FAILED").length;

  const scores = attemptRows.map((r) => r.score_pct ?? 0).filter((s) => !isNaN(s));
  const averageScore =
    scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;
  const medianScore =
    scores.length > 0
      ? (() => {
          const sorted = [...scores].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
        })()
      : null;

  const passCount = scores.filter((s) => s >= passPercentage).length;
  const passRate =
    scores.length > 0
      ? Math.round((passCount / scores.length) * 10000) / 100
      : null;

  const scoreDistribution = SCORE_BUCKETS.map((bucket) => ({
    range: bucket.label,
    count: scores.filter(
      (s) => s >= bucket.min && s <= bucket.max
    ).length,
  }));

  let studentResults: SingleQuizAnalytics["student_results"] | undefined;
  let studentResultsTotal: number | undefined;
  let studentResultsPage: number | undefined;
  let studentResultsLimit: number | undefined;

  if (options?.include_student_results) {
    const studentPage = Math.max(1, options.student_page ?? 1);
    const studentLimit = Math.min(50, Math.max(1, options.student_limit ?? 20));
    const studentSearch = options.student_search?.trim().toLowerCase();
    const offset = (studentPage - 1) * studentLimit;

    let baseQuery = db
      .selectFrom("enrollments")
      .innerJoin("tenant_members", (join) =>
        join
          .onRef("tenant_members.id", "=", "enrollments.tenant_member_id")
          .on("tenant_members.tenant_id", "=", tenantId)
      )
      .select([
        "enrollments.tenant_member_id",
        "tenant_members.name as member_name",
        "tenant_members.email as member_email",
      ])
      .where("enrollments.tenant_id", "=", tenantId)
      .where("enrollments.course_id", "=", quiz.course_id)
      .where("enrollments.status", "=", "ACTIVE")
      .groupBy(["enrollments.tenant_member_id", "tenant_members.name", "tenant_members.email"]);

    if (studentSearch) {
      const searchTerm = `%${studentSearch}%`;
      baseQuery = baseQuery.where(
        sql<boolean>`(
          lower(tenant_members.name) like ${searchTerm}
          or lower(coalesce(tenant_members.email, '')) like ${searchTerm}
        )`
      );
    }

    let countQuery = db
      .selectFrom("enrollments")
      .innerJoin("tenant_members", (join) =>
        join
          .onRef("tenant_members.id", "=", "enrollments.tenant_member_id")
          .on("tenant_members.tenant_id", "=", tenantId)
      )
      .where("enrollments.tenant_id", "=", tenantId)
      .where("enrollments.course_id", "=", quiz.course_id)
      .where("enrollments.status", "=", "ACTIVE");
    if (studentSearch) {
      const searchTerm = `%${studentSearch}%`;
      countQuery = countQuery.where(
        sql<boolean>`(
          lower(tenant_members.name) like ${searchTerm}
          or lower(coalesce(tenant_members.email, '')) like ${searchTerm}
        )`
      );
    }
    const countResult = await countQuery
      .select(sql<number>`count(distinct enrollments.tenant_member_id)::int`.as("count"))
      .executeTakeFirst();
    studentResultsTotal = Number(countResult?.count ?? 0);

    const enrolledMembers = await baseQuery
      .orderBy("tenant_members.name", "asc")
      .limit(studentLimit)
      .offset(offset)
      .execute();

    const attemptMap = await db
      .selectFrom("quiz_attempts")
      .select([
        "tenant_member_id",
        "status as attempt_status",
        "score",
        "total_marks",
      ])
      .where("tenant_id", "=", tenantId)
      .where("quiz_id", "=", quizId)
      .execute();

    const attemptByMember = new Map(
      attemptMap.map((a) => [
        a.tenant_member_id,
        {
          attempted: true,
          attempt_status: a.attempt_status,
          score: a.score,
          total_marks: a.total_marks,
          passed: a.attempt_status === "PASSED",
        },
      ])
    );

    studentResults = enrolledMembers.map((m) => {
      const att = attemptByMember.get(m.tenant_member_id);
      const score = att?.score != null ? Number(att.score) : null;
      const total = att?.total_marks != null ? Number(att.total_marks) : maxScore;
      const scorePct =
        score != null && total != null && total > 0
          ? Math.round((score / total) * 100)
          : null;

      return {
        tenant_member_id: m.tenant_member_id,
        member_name: m.member_name,
        member_email: m.member_email,
        attempted: !!att,
        attempt_status: att?.attempt_status ?? null,
        score,
        score_percentage: scorePct,
        passed: att?.passed ?? false,
      };
    });
    studentResultsPage = studentPage;
    studentResultsLimit = studentLimit;
  }

  const result: SingleQuizAnalytics = {
    quiz_id: quizId,
    title: quiz.title,
    scope: String(quiz.scope),
    max_score: maxScore,
    pass_percentage: passPercentage,
    total_attempts: totalAttempts,
    passed_count: passedCount,
    failed_count: failedCount,
    average_score:
      averageScore != null ? Math.round(averageScore * 100) / 100 : null,
    median_score:
      medianScore != null ? Math.round(medianScore * 100) / 100 : null,
    pass_rate: passRate,
    score_distribution: scoreDistribution,
    student_results: studentResults,
  };
  if (studentResultsTotal !== undefined) result.student_results_total = studentResultsTotal;
  if (studentResultsPage !== undefined) result.student_results_page = studentResultsPage;
  if (studentResultsLimit !== undefined) result.student_results_limit = studentResultsLimit;
  return result;
}
