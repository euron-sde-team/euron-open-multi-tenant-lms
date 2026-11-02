import { ulid } from "ulid";
import { db } from "../db/connection";

export interface SubmissionListItem {
  id: string;
  tenant_member_id: string;
  member_name: string;
  member_email: string | null;
  member_avatar_url: string | null;
  status: string;
  submitted_at: string | null;
  content_type: string;
  score: number | null;
  max_score: number | null;
  feedback: string | null;
  evaluated_at: string | null;
  assignment_title: string;
  assignment_max_score: number;
}

/** Valid submission status values (from schema enum) - API source of truth */
export const SUBMISSION_STATUS_OPTIONS = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "EVALUATED",
  "RESUBMISSION_REQUESTED",
  "PENDING",
] as const;

export async function listSubmissions(
  tenantId: string,
  params: {
    course_id?: string;
    assignment_id?: string;
    status?: string;
    submitted_from?: string;
    submitted_to?: string;
    page?: number;
    limit?: number;
  }
): Promise<{
  data: SubmissionListItem[];
  total: number;
  page: number;
  limit: number;
  status_options: readonly string[];
}> {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  let query = db
    .selectFrom("assignment_submissions")
    .innerJoin("tenant_members", (join) =>
      join
        .onRef("tenant_members.id", "=", "assignment_submissions.tenant_member_id")
        .on("tenant_members.tenant_id", "=", tenantId)
    )
    .innerJoin("assignments", (join) =>
      join
        .onRef("assignments.id", "=", "assignment_submissions.assignment_id")
        .on("assignments.tenant_id", "=", tenantId)
    )
    .leftJoin("assignment_evaluations", (join) =>
      join
        .onRef("assignment_evaluations.submission_id", "=", "assignment_submissions.id")
        .on("assignment_evaluations.tenant_id", "=", tenantId)
    )
    .select([
      "assignment_submissions.id",
      "assignment_submissions.tenant_member_id",
      "tenant_members.name as member_name",
      "tenant_members.email as member_email",
      "tenant_members.avatar_url as member_avatar_url",
      "assignment_submissions.status",
      "assignment_submissions.submitted_at",
      "assignment_submissions.content_type",
      "assignment_evaluations.score",
      "assignment_evaluations.max_score",
      "assignment_evaluations.feedback",
      "assignment_evaluations.evaluated_at",
      "assignments.title as assignment_title",
      "assignments.max_score as assignment_max_score",
    ])
    .where("assignment_submissions.tenant_id", "=", tenantId)
    .orderBy("assignment_submissions.submitted_at", "desc");

  if (params.course_id) {
    query = query.where("assignment_submissions.course_id", "=", params.course_id);
  }
  if (params.assignment_id) {
    query = query.where(
      "assignment_submissions.assignment_id",
      "=",
      params.assignment_id
    );
  }
  if (params.status) {
    query = query.where(
      "assignment_submissions.status",
      "=",
      params.status as "PENDING" | "SUBMITTED" | "UNDER_REVIEW" | "EVALUATED" | "RESUBMISSION_REQUESTED"
    );
  }
  if (params.submitted_from) {
    const from = new Date(params.submitted_from);
    from.setHours(0, 0, 0, 0);
    query = query.where("assignment_submissions.submitted_at", ">=", from);
  }
  if (params.submitted_to) {
    const to = new Date(params.submitted_to);
    to.setHours(23, 59, 59, 999);
    query = query.where("assignment_submissions.submitted_at", "<=", to);
  }

  const countQuery = query
    .clearSelect()
    .clearOrderBy()
    .select(db.fn.countAll().as("count"));
  const totalResult = await countQuery.executeTakeFirst();
  const total = Number(totalResult?.count ?? 0);

  const rows = await query.limit(limit).offset(offset).execute();

  return {
    data: rows.map((r) => ({
      id: r.id,
      tenant_member_id: r.tenant_member_id,
      member_name: r.member_name,
      member_email: r.member_email,
      member_avatar_url: r.member_avatar_url,
      status: r.status,
      submitted_at: r.submitted_at?.toISOString() ?? null,
      content_type: r.content_type,
      score: r.score ?? null,
      max_score: r.max_score ?? null,
      feedback: r.feedback,
      evaluated_at: r.evaluated_at?.toISOString() ?? null,
      assignment_title: r.assignment_title,
      assignment_max_score: r.assignment_max_score,
    })),
    total,
    page,
    limit,
    status_options: SUBMISSION_STATUS_OPTIONS,
  };
}

export async function getSubmissionById(
  tenantId: string,
  submissionId: string
): Promise<{
  id: string;
  assignment_id: string;
  tenant_member_id: string;
  content_type: string;
  text_content: string | null;
  pdf_key: string | null;
  status: string;
  submitted_at: Date | null;
  member_name: string;
  member_email: string | null;
  assignment_title: string;
  assignment_max_score: number;
  assignment_passing_score: number | null;
  score: number | null;
  max_score: number | null;
  feedback: string | null;
  evaluated_at: Date | null;
} | null> {
  const row = await db
    .selectFrom("assignment_submissions")
    .innerJoin("tenant_members", (join) =>
      join
        .onRef("tenant_members.id", "=", "assignment_submissions.tenant_member_id")
        .on("tenant_members.tenant_id", "=", tenantId)
    )
    .innerJoin("assignments", (join) =>
      join
        .onRef("assignments.id", "=", "assignment_submissions.assignment_id")
        .on("assignments.tenant_id", "=", tenantId)
    )
    .leftJoin("assignment_evaluations", (join) =>
      join
        .onRef("assignment_evaluations.submission_id", "=", "assignment_submissions.id")
        .on("assignment_evaluations.tenant_id", "=", tenantId)
    )
    .select([
      "assignment_submissions.id",
      "assignment_submissions.assignment_id",
      "assignment_submissions.tenant_member_id",
      "assignment_submissions.content_type",
      "assignment_submissions.text_content",
      "assignment_submissions.pdf_key",
      "assignment_submissions.status",
      "assignment_submissions.submitted_at",
      "tenant_members.name as member_name",
      "tenant_members.email as member_email",
      "assignments.title as assignment_title",
      "assignments.max_score as assignment_max_score",
      "assignments.passing_score as assignment_passing_score",
      "assignment_evaluations.score",
      "assignment_evaluations.max_score",
      "assignment_evaluations.feedback",
      "assignment_evaluations.evaluated_at",
    ])
    .where("assignment_submissions.tenant_id", "=", tenantId)
    .where("assignment_submissions.id", "=", submissionId)
    .executeTakeFirst();

  if (!row) return null;

  return {
    id: row.id,
    assignment_id: row.assignment_id,
    tenant_member_id: row.tenant_member_id,
    content_type: row.content_type,
    text_content: row.text_content,
    pdf_key: row.pdf_key,
    status: row.status,
    submitted_at: row.submitted_at,
    member_name: row.member_name,
    member_email: row.member_email,
    assignment_title: row.assignment_title,
    assignment_max_score: row.assignment_max_score,
    assignment_passing_score: row.assignment_passing_score ?? null,
    score: row.score ?? null,
    max_score: row.max_score ?? null,
    feedback: row.feedback,
    evaluated_at: row.evaluated_at ?? null,
  };
}

export async function updateSubmissionStatus(
  tenantId: string,
  submissionId: string,
  status: "PENDING" | "SUBMITTED" | "UNDER_REVIEW" | "EVALUATED" | "RESUBMISSION_REQUESTED"
): Promise<boolean> {
  const now = new Date();
  const result = await db
    .updateTable("assignment_submissions")
    .set({ status, updated_at: now })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", submissionId)
    .executeTakeFirst();
  return Number(result?.numUpdatedRows ?? 0) > 0;
}

export async function upsertEvaluation(
  tenantId: string,
  submissionId: string,
  assignmentId: string,
  tenantMemberId: string,
  data: {
    score: number;
    max_score: number;
    feedback?: string | null;
    evaluated_by: string;
  }
): Promise<void> {
  const now = new Date();

  const existing = await db
    .selectFrom("assignment_evaluations")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("submission_id", "=", submissionId)
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable("assignment_evaluations")
      .set({
        score: data.score,
        max_score: data.max_score,
        feedback: data.feedback ?? null,
        evaluated_by: data.evaluated_by,
        evaluated_at: now,
        updated_at: now,
      })
      .where("tenant_id", "=", tenantId)
      .where("submission_id", "=", submissionId)
      .execute();
  } else {
    const id = ulid();
    await db
      .insertInto("assignment_evaluations")
      .values({
        id,
        tenant_id: tenantId,
        submission_id: submissionId,
        assignment_id: assignmentId,
        tenant_member_id: tenantMemberId,
        score: data.score,
        max_score: data.max_score,
        feedback: data.feedback ?? null,
        evaluated_by: data.evaluated_by,
        evaluated_at: now,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
}
