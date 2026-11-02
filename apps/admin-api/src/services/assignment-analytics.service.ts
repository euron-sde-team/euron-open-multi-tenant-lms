import { db } from "../db/connection";
import { sql } from "kysely";
import { NotFoundError } from "../errors/not-found.error";
import * as assignmentsRepo from "../repositories/assignments.repository";

export interface OverviewAssignmentAnalytics {
  total_assignments: number;
  published_count: number;
  draft_count: number;
  total_submissions: number;
  evaluated_count: number;
  pending_evaluation_count: number;
  courses: Array<{
    course_id: string;
    course_title: string;
    total_assignments: number;
    published_count: number;
    draft_count: number;
    total_submissions: number;
    evaluated_count: number;
    pending_evaluation: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface CourseAssignmentAnalytics {
  total_assignments: number;
  published_count: number;
  draft_count: number;
  enrolled_count: number;
  assignments: Array<{
    assignment_id: string;
    title: string;
    scope: string;
    status: string;
    max_score: number;
    submission_count: number;
    submission_rate: number;
    evaluated_count: number;
    average_score: number | null;
    pass_rate: number | null;
    pending_evaluation: number;
  }>;
}

export interface SingleAssignmentAnalytics {
  assignment_id: string;
  title: string;
  scope: string;
  max_score: number;
  total_submissions: number;
  evaluated_count: number;
  average_score: number | null;
  median_score: number | null;
  pass_rate: number | null;
  score_distribution: Array<{ range: string; count: number }>;
  student_results?: Array<{
    tenant_member_id: string;
    member_name: string;
    member_email: string | null;
    submitted: boolean;
    submission_status: string | null;
    score: number | null;
    score_percentage: number | null;
    evaluated: boolean;
  }>;
}

export async function getOverviewAssignmentAnalytics(
  tenantId: string,
  options?: { search?: string; page?: number; limit?: number }
): Promise<OverviewAssignmentAnalytics> {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = (page - 1) * limit;
  const statusCounts = await db
    .selectFrom("assignments")
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
  const totalAssignments = statusCounts.reduce((s, r) => s + Number(r.count ?? 0), 0);

  const submissionStats = await db
    .selectFrom("assignment_submissions as sub")
    .leftJoin("assignment_evaluations as ev", (join) =>
      join
        .onRef("ev.submission_id", "=", "sub.id")
        .on("ev.tenant_id", "=", tenantId)
    )
    .select([
      sql<number>`count(sub.id)::int`.as("total_submissions"),
      sql<number>`count(case when ev.id is not null then 1 end)::int`.as("evaluated_count"),
      sql<number>`count(case when sub.id is not null and ev.id is null then 1 end)::int`.as("pending_count"),
    ])
    .where("sub.tenant_id", "=", tenantId)
    .executeTakeFirst();

  const totalSubmissions = Number(submissionStats?.total_submissions ?? 0);
  const evaluatedCount = Number(submissionStats?.evaluated_count ?? 0);
  const pendingEvaluationCount = Number(submissionStats?.pending_count ?? 0);

  let courseQuery = db
    .selectFrom("assignments as a")
    .innerJoin("courses as c", (join) =>
      join.onRef("c.id", "=", "a.course_id").on("c.tenant_id", "=", tenantId)
    )
    .leftJoin("assignment_submissions as sub", (join) =>
      join
        .onRef("sub.assignment_id", "=", "a.id")
        .on("sub.tenant_id", "=", tenantId)
    )
    .leftJoin("assignment_evaluations as ev", (join) =>
      join
        .onRef("ev.submission_id", "=", "sub.id")
        .on("ev.tenant_id", "=", tenantId)
    )
    .select([
      "c.id as course_id",
      "c.title as course_title",
      sql<number>`count(distinct a.id)::int`.as("total_assignments"),
      sql<number>`count(distinct case when a.status = 'PUBLISHED' then a.id end)::int`.as("published_count"),
      sql<number>`count(distinct case when a.status = 'DRAFT' then a.id end)::int`.as("draft_count"),
      sql<number>`count(sub.id)::int`.as("total_submissions"),
      sql<number>`count(case when ev.id is not null then 1 end)::int`.as("evaluated_count"),
      sql<number>`count(case when sub.id is not null and ev.id is null then 1 end)::int`.as("pending_count"),
    ])
    .where("a.tenant_id", "=", tenantId)
    .groupBy(["c.id", "c.title"]);

  if (options?.search?.trim()) {
    const term = `%${options.search.trim().toLowerCase()}%`;
    courseQuery = courseQuery.where(
      sql<boolean>`lower(c.title) like ${term}`
    );
  }

  let countQuery = db
    .selectFrom("assignments as a")
    .innerJoin("courses as c", (join) =>
      join.onRef("c.id", "=", "a.course_id").on("c.tenant_id", "=", tenantId)
    )
    .where("a.tenant_id", "=", tenantId);
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
    total_assignments: Number(r.total_assignments ?? 0),
    published_count: Number(r.published_count ?? 0),
    draft_count: Number(r.draft_count ?? 0),
    total_submissions: Number(r.total_submissions ?? 0),
    evaluated_count: Number(r.evaluated_count ?? 0),
    pending_evaluation: Number(r.pending_count ?? 0),
  }));

  return {
    total_assignments: totalAssignments,
    published_count: publishedCount,
    draft_count: draftCount,
    total_submissions: totalSubmissions,
    evaluated_count: evaluatedCount,
    pending_evaluation_count: pendingEvaluationCount,
    courses,
    total,
    page,
    limit,
  };
}

const SCORE_BUCKETS = [
  { label: "0-20%", min: 0, max: 20 },
  { label: "21-40%", min: 21, max: 40 },
  { label: "41-60%", min: 41, max: 60 },
  { label: "61-80%", min: 61, max: 80 },
  { label: "81-100%", min: 81, max: 100 },
];

export async function getCourseAssignmentAnalytics(
  tenantId: string,
  courseId: string
): Promise<CourseAssignmentAnalytics> {
  // Perf: 3 round trips in parallel (was 4 sequential). Status counts query
  // is gone, derived from assignmentRows in JS. All queries scoped by
  // (tenant_id, course_id) and index-aligned.
  const [course, enrolledCountResult, assignmentRows] = await Promise.all([
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
      .selectFrom("assignments")
      .leftJoin("assignment_submissions as sub", (join) =>
        join
          .onRef("sub.assignment_id", "=", "assignments.id")
          .on("sub.tenant_id", "=", tenantId)
      )
      .leftJoin("assignment_evaluations as ev", (join) =>
        join
          .onRef("ev.submission_id", "=", "sub.id")
          .on("ev.tenant_id", "=", tenantId)
      )
      .select([
        "assignments.id as assignment_id",
        "assignments.title",
        "assignments.scope",
        "assignments.status",
        "assignments.max_score",
        sql<number>`count(sub.id)::int`.as("submission_count"),
        sql<number>`count(case when ev.id is not null then 1 end)::int`.as("evaluated_count"),
        sql<number>`count(case when sub.id is not null and ev.id is null then 1 end)::int`.as("pending_count"),
        sql<string>`avg(case when ev.id is not null then ev.score::float / nullif(ev.max_score, 0) * 100 else null end)`.as("avg_pct"),
        sql<string>`(count(case when ev.id is not null and ev.score::float / nullif(ev.max_score, 0) * 100 >= 60 then 1 end)::float / nullif(count(case when ev.id is not null then 1 end), 0) * 100)`.as("pass_rate_pct"),
      ])
      .where("assignments.tenant_id", "=", tenantId)
      .where("assignments.course_id", "=", courseId)
      .groupBy(["assignments.id", "assignments.title", "assignments.scope", "assignments.status", "assignments.max_score", "assignments.sort_order", "assignments.created_at"])
      .orderBy("assignments.sort_order", "asc")
      .orderBy("assignments.created_at", "asc")
      .execute(),
  ]);

  if (!course) {
    throw new NotFoundError("Course not found");
  }
  const enrolledCount = Number(enrolledCountResult?.count ?? 0);

  // Status counts derived from assignmentRows (no extra round trip).
  let publishedCount = 0;
  let draftCount = 0;
  for (const r of assignmentRows) {
    if (r.status === "PUBLISHED") publishedCount += 1;
    else if (r.status === "DRAFT") draftCount += 1;
  }

  const assignments = assignmentRows.map((r) => {
    const subCount = Number(r.submission_count ?? 0);
    const evalCount = Number(r.evaluated_count ?? 0);
    const pendingCount = Number(r.pending_count ?? 0);
    const submissionRate =
      enrolledCount > 0 ? Math.round((subCount / enrolledCount) * 100) : 0;
    const avgScore = r.avg_pct != null ? parseFloat(String(r.avg_pct)) : null;
    const passRate =
      r.pass_rate_pct != null ? parseFloat(String(r.pass_rate_pct)) : null;

    return {
      assignment_id: r.assignment_id,
      title: r.title,
      scope: String(r.scope),
      status: String(r.status),
      max_score: Number(r.max_score),
      submission_count: subCount,
      submission_rate: submissionRate,
      evaluated_count: evalCount,
      average_score: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
      pass_rate: passRate != null ? Math.round(passRate * 100) / 100 : null,
      pending_evaluation: pendingCount,
    };
  });

  return {
    total_assignments: assignmentRows.length,
    published_count: publishedCount,
    draft_count: draftCount,
    enrolled_count: enrolledCount,
    assignments,
  };
}

export async function getSingleAssignmentAnalytics(
  tenantId: string,
  assignmentId: string,
  options?: { include_student_results?: boolean }
): Promise<SingleAssignmentAnalytics> {
  const assignment = await assignmentsRepo.findById(tenantId, assignmentId);
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }

  const maxScore = Number(assignment.max_score);

  const evalRows = await db
    .selectFrom("assignment_submissions as sub")
    .innerJoin("assignment_evaluations as ev", "ev.submission_id", "sub.id")
    .select([
      "ev.score",
      "ev.max_score",
      sql<number>`(ev.score::float / nullif(ev.max_score, 0) * 100)::int`.as("score_pct"),
    ])
    .where("sub.tenant_id", "=", tenantId)
    .where("sub.assignment_id", "=", assignmentId)
    .execute();

  const totalSubmissions = await db
    .selectFrom("assignment_submissions")
    .select(db.fn.countAll().as("count"))
    .where("tenant_id", "=", tenantId)
    .where("assignment_id", "=", assignmentId)
    .executeTakeFirst();

  const subCount = Number(totalSubmissions?.count ?? 0);
  const evalCount = evalRows.length;

  const scores = evalRows.map((r) => r.score_pct ?? 0).filter((s) => !isNaN(s));
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

  const passCount = scores.filter((s) => s >= 60).length;
  const passRate =
    scores.length > 0 ? Math.round((passCount / scores.length) * 10000) / 100 : null;

  const scoreDistribution = SCORE_BUCKETS.map((bucket) => ({
    range: bucket.label,
    count: scores.filter(
      (s) => s >= bucket.min && s <= bucket.max
    ).length,
  }));

  let studentResults: SingleAssignmentAnalytics["student_results"] | undefined;
  if (options?.include_student_results) {
    const enrolledMembers = await db
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
      .where("enrollments.course_id", "=", assignment.course_id)
      .where("enrollments.status", "=", "ACTIVE")
      .distinct()
      .execute();

    const submissionMap = await db
      .selectFrom("assignment_submissions")
      .leftJoin("assignment_evaluations", (join) =>
        join
          .onRef("assignment_evaluations.submission_id", "=", "assignment_submissions.id")
          .on("assignment_evaluations.tenant_id", "=", tenantId)
      )
      .select([
        "assignment_submissions.tenant_member_id",
        "assignment_submissions.status as submission_status",
        "assignment_evaluations.score",
        "assignment_evaluations.max_score as eval_max_score",
      ])
      .where("assignment_submissions.tenant_id", "=", tenantId)
      .where("assignment_submissions.assignment_id", "=", assignmentId)
      .execute();

    const subByMember = new Map(
      submissionMap.map((s) => [
        s.tenant_member_id,
        {
          submitted: true,
          submission_status: s.submission_status,
          score: s.score,
          max_score: s.eval_max_score,
        },
      ])
    );

    studentResults = enrolledMembers.map((m) => {
      const sub = subByMember.get(m.tenant_member_id);
      const score = sub?.score != null ? Number(sub.score) : null;
      const max = sub?.max_score != null ? Number(sub.max_score) : maxScore;
      const scorePct =
        score != null && max != null && max > 0
          ? Math.round((score / max) * 100)
          : null;

      return {
        tenant_member_id: m.tenant_member_id,
        member_name: m.member_name,
        member_email: m.member_email,
        submitted: !!sub,
        submission_status: sub?.submission_status ?? null,
        score,
        score_percentage: scorePct,
        evaluated: sub != null && score != null,
      };
    });
  }

  return {
    assignment_id: assignmentId,
    title: assignment.title,
    scope: String(assignment.scope),
    max_score: maxScore,
    total_submissions: subCount,
    evaluated_count: evalCount,
    average_score:
      averageScore != null ? Math.round(averageScore * 100) / 100 : null,
    median_score:
      medianScore != null ? Math.round(medianScore * 100) / 100 : null,
    pass_rate: passRate,
    score_distribution: scoreDistribution,
    student_results: studentResults,
  };
}
