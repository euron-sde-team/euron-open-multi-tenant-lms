import { ulid } from "ulid";
import { db } from "../db/connection";
import type { assignments } from "../db/types";
import type {
  assignment_status,
  assignment_scope,
  assignment_content_type,
} from "../db/enums";

export type AssignmentRow = assignments;

export interface CreateAssignmentInput {
  tenant_id: string;
  course_id: string;
  section_id?: string | null;
  lesson_id?: string | null;
  source_lecture_id?: string | null;
  title: string;
  instructions?: string | null;
  content_type?: assignment_content_type;
  pdf_key?: string | null;
  resource_links?: string[];
  scope: assignment_scope;
  status?: assignment_status;
  max_score?: number;
  passing_score?: number | null;
  due_date?: Date | null;
  ai_generated?: boolean;
  sort_order?: number;
}

export interface UpdateAssignmentInput {
  title?: string;
  instructions?: string | null;
  content_type?: assignment_content_type;
  pdf_key?: string | null;
  resource_links?: string[];
  scope?: assignment_scope;
  section_id?: string | null;
  lesson_id?: string | null;
  max_score?: number;
  passing_score?: number | null;
  due_date?: Date | null;
  sort_order?: number;
}

export interface ListAssignmentsParams {
  course_id: string;
  section_id?: string;
  lesson_id?: string;
  status?: assignment_status;
  scope?: assignment_scope;
  page?: number;
  limit?: number;
}

export interface ListAssignmentsResult {
  data: AssignmentRow[];
  total: number;
  page: number;
  limit: number;
}

export async function findById(
  tenantId: string,
  id: string
): Promise<AssignmentRow | null> {
  const row = await db
    .selectFrom("assignments")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .executeTakeFirst();
  return row as unknown as AssignmentRow | null;
}

export async function findByIdWithJoins(
  tenantId: string,
  id: string
): Promise<
  | (AssignmentRow & {
      course_title?: string;
      section_title?: string;
      lesson_title?: string;
    })
  | null
> {
  const row = await db
    .selectFrom("assignments")
    .leftJoin("courses", "courses.id", "assignments.course_id")
    .leftJoin("course_sections", "course_sections.id", "assignments.section_id")
    .leftJoin("course_lessons", "course_lessons.id", "assignments.lesson_id")
    .select([
      "assignments.id",
      "assignments.tenant_id",
      "assignments.course_id",
      "assignments.section_id",
      "assignments.lesson_id",
      "assignments.source_lecture_id",
      "assignments.title",
      "assignments.instructions",
      "assignments.content_type",
      "assignments.pdf_key",
      "assignments.resource_links",
      "assignments.scope",
      "assignments.status",
      "assignments.max_score",
      "assignments.passing_score",
      "assignments.due_date",
      "assignments.ai_generated",
      "assignments.sort_order",
      "assignments.created_at",
      "assignments.updated_at",
      "courses.title as course_title",
      "course_sections.title as section_title",
      "course_lessons.title as lesson_title",
    ])
    .where("assignments.tenant_id", "=", tenantId)
    .where("assignments.id", "=", id)
    .executeTakeFirst();
  return row as unknown as (AssignmentRow & {
    course_title?: string;
    section_title?: string;
    lesson_title?: string;
  }) | null;
}

export async function list(
  tenantId: string,
  params: ListAssignmentsParams
): Promise<ListAssignmentsResult> {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  let query = db
    .selectFrom("assignments")
    .selectAll()
    .where("assignments.tenant_id", "=", tenantId)
    .where("assignments.course_id", "=", params.course_id);

  if (params.section_id) {
    query = query.where("assignments.section_id", "=", params.section_id);
  }
  if (params.lesson_id) {
    query = query.where("assignments.lesson_id", "=", params.lesson_id);
  }
  if (params.status) {
    query = query.where("assignments.status", "=", params.status);
  }
  if (params.scope) {
    query = query.where("assignments.scope", "=", params.scope);
  }

  const countQuery = query.clearSelect().select(db.fn.countAll().as("count"));
  const totalResult = await countQuery.executeTakeFirst();
  const total = Number(totalResult?.count ?? 0);

  const rows = await query
    .orderBy("assignments.sort_order", "asc")
    .orderBy("assignments.created_at", "asc")
    .limit(limit)
    .offset(offset)
    .execute();

  return {
    data: rows as unknown as AssignmentRow[],
    total,
    page,
    limit,
  };
}

export async function create(
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
      section_id: data.section_id ?? null,
      lesson_id: data.lesson_id ?? null,
      source_lecture_id: data.source_lecture_id ?? null,
      title: data.title,
      instructions: data.instructions ?? null,
      content_type: data.content_type ?? "TEXT",
      pdf_key: data.pdf_key ?? null,
      resource_links: data.resource_links ?? [],
      scope: data.scope,
      status: data.status ?? "DRAFT",
      max_score: data.max_score ?? 100,
      passing_score: data.passing_score ?? null,
      due_date: data.due_date ?? null,
      ai_generated: data.ai_generated ?? false,
      sort_order: data.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as AssignmentRow;
}

export async function update(
  tenantId: string,
  id: string,
  data: UpdateAssignmentInput
): Promise<AssignmentRow | null> {
  const now = new Date();
  const updateData: Record<string, unknown> = { updated_at: now };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.instructions !== undefined) updateData.instructions = data.instructions;
  if (data.content_type !== undefined) updateData.content_type = data.content_type;
  if (data.pdf_key !== undefined) updateData.pdf_key = data.pdf_key;
  if (data.resource_links !== undefined) updateData.resource_links = data.resource_links;
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.section_id !== undefined) updateData.section_id = data.section_id;
  if (data.lesson_id !== undefined) updateData.lesson_id = data.lesson_id;
  if (data.max_score !== undefined) updateData.max_score = data.max_score;
  if (data.passing_score !== undefined) updateData.passing_score = data.passing_score;
  if (data.due_date !== undefined) updateData.due_date = data.due_date;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;

  const row = await db
    .updateTable("assignments")
    .set(updateData)
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as AssignmentRow | null;
}

export async function updateStatus(
  tenantId: string,
  id: string,
  status: assignment_status
): Promise<AssignmentRow | null> {
  const now = new Date();
  const row = await db
    .updateTable("assignments")
    .set({ status, updated_at: now })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as AssignmentRow | null;
}

export async function updatePdfKey(
  tenantId: string,
  id: string,
  pdfKey: string | null
): Promise<AssignmentRow | null> {
  const now = new Date();
  const row = await db
    .updateTable("assignments")
    .set({ pdf_key: pdfKey, content_type: pdfKey ? "PDF" : "TEXT", updated_at: now })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as AssignmentRow | null;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  const result = await db
    .deleteFrom("assignments")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .executeTakeFirst();
  return Number(result?.numDeletedRows ?? 0) > 0;
}
