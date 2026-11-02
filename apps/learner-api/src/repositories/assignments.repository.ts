import { ulid } from "ulid";
import { db } from "../db/connection";

export interface AssignmentListItem {
  id: string;
  title: string;
  instructions: string | null;
  content_type: string;
  scope: string;
  max_score: number;
  due_date: Date | null;
  sort_order: number;
  has_submitted: boolean;
  submission_status: string | null;
  score: number | null;
}

export interface AssignmentDetail {
  id: string;
  tenant_id: string;
  course_id: string;
  section_id: string | null;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  content_type: string;
  pdf_key: string | null;
  resource_links: string[];
  scope: string;
  max_score: number;
  due_date: Date | null;
  sort_order: number;
  pdf_url?: string | null;
  submission?: {
    id: string;
    content_type: string;
    text_content: string | null;
    status: string;
    submitted_at: string | null;
    evaluation?: {
      score: number;
      max_score: number;
      feedback: string | null;
      evaluated_at: string;
    };
  } | null;
}

export interface SubmissionWithEval {
  id: string;
  content_type: string;
  text_content: string | null;
  pdf_key: string | null;
  status: string;
  submitted_at: string | null;
  pdf_url?: string | null;
  evaluation?: {
    score: number;
    max_score: number;
    feedback: string | null;
    evaluated_at: string;
  } | null;
}

export async function listPublishedAssignments(
  tenantId: string,
  memberId: string,
  courseId: string,
  filters?: { section_id?: string; lesson_id?: string; scope?: string }
): Promise<AssignmentListItem[]> {
  let query = db
    .selectFrom("assignments")
    .leftJoin("assignment_submissions", (join) =>
      join
        .onRef("assignment_submissions.assignment_id", "=", "assignments.id")
        .on("assignment_submissions.tenant_member_id", "=", memberId)
        .on("assignment_submissions.tenant_id", "=", tenantId)
    )
    .leftJoin("assignment_evaluations", "assignment_evaluations.submission_id", "assignment_submissions.id")
    .select([
      "assignments.id",
      "assignments.title",
      "assignments.instructions",
      "assignments.content_type",
      "assignments.scope",
      "assignments.max_score",
      "assignments.due_date",
      "assignments.sort_order",
      "assignment_submissions.id as submission_id",
      "assignment_submissions.status as submission_status",
      "assignment_evaluations.score",
    ])
    .where("assignments.tenant_id", "=", tenantId)
    .where("assignments.course_id", "=", courseId)
    .where("assignments.status", "=", "PUBLISHED")
    .orderBy("assignments.sort_order", "asc")
    .orderBy("assignments.created_at", "asc");

  if (filters?.section_id) {
    query = query.where("assignments.section_id", "=", filters.section_id);
  }
  if (filters?.lesson_id) {
    query = query.where("assignments.lesson_id", "=", filters.lesson_id);
  }
  if (filters?.scope) {
    query = query.where(
      "assignments.scope",
      "=",
      filters.scope as "COURSE" | "SECTION" | "LESSON"
    );
  }

  const rows = await query.execute();

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    instructions: r.instructions,
    content_type: r.content_type,
    scope: r.scope,
    max_score: r.max_score,
    due_date: r.due_date,
    sort_order: r.sort_order,
    has_submitted: !!r.submission_id,
    submission_status: r.submission_status,
    score: r.score ?? null,
  }));
}

export async function getAssignmentById(
  tenantId: string,
  id: string
): Promise<{
  id: string;
  tenant_id: string;
  course_id: string;
  section_id: string | null;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  content_type: string;
  pdf_key: string | null;
  resource_links: string[];
  scope: string;
  status: string;
  max_score: number;
  passing_score: number | null;
  due_date: Date | null;
  sort_order: number;
} | null> {
  const row = await db
    .selectFrom("assignments")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .where("status", "=", "PUBLISHED")
    .executeTakeFirst();
  return row ? (row as unknown as NonNullable<typeof row>) : null;
}

/** Get published assignment linked to a lesson (for course tree). */
export async function getAssignmentByLessonId(
  tenantId: string,
  lessonId: string
): Promise<{
  id: string;
  tenant_id: string;
  course_id: string;
  section_id: string | null;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  content_type: string;
  pdf_key: string | null;
  max_score: number;
  due_date: Date | null;
} | null> {
  const row = await db
    .selectFrom("assignments")
    .select([
      "id",
      "tenant_id",
      "course_id",
      "section_id",
      "lesson_id",
      "title",
      "instructions",
      "content_type",
      "pdf_key",
      "max_score",
      "due_date",
    ])
    .where("tenant_id", "=", tenantId)
    .where("lesson_id", "=", lessonId)
    .where("status", "=", "PUBLISHED")
    .executeTakeFirst();
  return row ? (row as unknown as NonNullable<typeof row>) : null;
}

export async function getSubmissionByAssignmentAndMember(
  tenantId: string,
  assignmentId: string,
  memberId: string
): Promise<{
  id: string;
  content_type: string;
  text_content: string | null;
  pdf_key: string | null;
  status: string;
  submitted_at: Date | null;
} | null> {
  const row = await db
    .selectFrom("assignment_submissions")
    .select([
      "id",
      "content_type",
      "text_content",
      "pdf_key",
      "status",
      "submitted_at",
    ])
    .where("tenant_id", "=", tenantId)
    .where("assignment_id", "=", assignmentId)
    .where("tenant_member_id", "=", memberId)
    .executeTakeFirst();
  return row ? (row as unknown as NonNullable<typeof row>) : null;
}

export async function getEvaluationBySubmissionId(
  tenantId: string,
  submissionId: string
): Promise<{
  score: number;
  max_score: number;
  feedback: string | null;
  evaluated_at: Date;
} | null> {
  const row = await db
    .selectFrom("assignment_evaluations")
    .select(["score", "max_score", "feedback", "evaluated_at"])
    .where("tenant_id", "=", tenantId)
    .where("submission_id", "=", submissionId)
    .executeTakeFirst();
  return row ? (row as unknown as NonNullable<typeof row>) : null;
}

export async function upsertSubmission(
  tenantId: string,
  assignmentId: string,
  courseId: string,
  memberId: string,
  data: {
    content_type: "TEXT" | "PDF";
    text_content?: string | null;
    pdf_key?: string | null;
  }
): Promise<{ id: string }> {
  const now = new Date();
  const id = ulid();

  const row = await db
    .insertInto("assignment_submissions")
    .values({
      id,
      tenant_id: tenantId,
      assignment_id: assignmentId,
      tenant_member_id: memberId,
      course_id: courseId,
      content_type: data.content_type,
      text_content: data.text_content ?? null,
      pdf_key: data.pdf_key ?? null,
      status: "SUBMITTED",
      submitted_at: now,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.columns(["tenant_id", "assignment_id", "tenant_member_id"]).doUpdateSet({
        content_type: data.content_type,
        text_content: data.text_content ?? null,
        pdf_key: data.pdf_key ?? null,
        status: "SUBMITTED",
        submitted_at: now,
        updated_at: now,
      })
    )
    .returning(["id"])
    .executeTakeFirstOrThrow();

  return { id: row.id };
}

export async function upsertMemberAssignmentProgress(
  tenantId: string,
  memberId: string,
  assignmentId: string,
  courseId: string,
  lessonId: string | null,
  completed: boolean
): Promise<void> {
  const now = new Date();
  const id = ulid();

  await db
    .insertInto("member_assignment_progress")
    .values({
      id,
      tenant_id: tenantId,
      tenant_member_id: memberId,
      assignment_id: assignmentId,
      course_id: courseId,
      lesson_id: lessonId,
      completed,
      completed_at: completed ? now : null,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.columns(["tenant_id", "tenant_member_id", "assignment_id"]).doUpdateSet({
        completed,
        completed_at: completed ? now : null,
        updated_at: now,
      })
    )
    .execute();
}

export async function getMemberAssignmentProgress(
  tenantId: string,
  memberId: string,
  assignmentId: string
): Promise<{
  id: string;
  completed: boolean;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
} | null> {
  const row = await db
    .selectFrom("member_assignment_progress")
    .select(["id", "completed", "completed_at", "created_at", "updated_at"])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("assignment_id", "=", assignmentId)
    .executeTakeFirst();
  return row ? (row as unknown as NonNullable<typeof row>) : null;
}
