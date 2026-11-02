import { ulid } from "ulid";
import { db } from "../db/connection";
import type { quizzes } from "../db/types";

export type QuizRow = quizzes;

export interface CreateQuizInput {
  tenant_id: string;
  course_id: string;
  section_id?: string | null;
  lesson_id?: string | null;
  source_lecture_id?: string | null;
  title: string;
  instructions?: string | null;
  scope?: "COURSE" | "SECTION" | "LESSON";
  status?: "DRAFT" | "PUBLISHED";
  max_score?: number;
  pass_percentage?: number;
  duration_min?: number | null;
  due_date?: Date | null;
  ai_generated?: boolean;
  sort_order?: number;
}

export interface UpdateQuizInput {
  title?: string;
  instructions?: string | null;
  scope?: "COURSE" | "SECTION" | "LESSON";
  section_id?: string | null;
  max_score?: number;
  pass_percentage?: number;
  duration_min?: number | null;
  due_date?: Date | null;
  sort_order?: number;
  random_question_count?: number | null;
  allow_reattempt?: boolean;
  max_attempts?: number | null;
  proctoring_enabled?: boolean;
  proctor_camera?: boolean;
  proctor_max_tab_switches?: number | null;
  calculator_mode?: string;
}

export interface ListQuizzesParams {
  course_id: string;
  section_id?: string;
  lesson_id?: string;
  status?: "DRAFT" | "PUBLISHED";
  scope?: "COURSE" | "SECTION" | "LESSON";
  page?: number;
  limit?: number;
}

export interface ListQuizzesResult {
  data: QuizRow[];
  total: number;
  page: number;
  limit: number;
}

export async function findById(
  tenantId: string,
  id: string
): Promise<QuizRow | null> {
  const row = await db
    .selectFrom("quizzes")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .executeTakeFirst();
  return row as unknown as QuizRow | null;
}

export async function findByIdWithJoins(
  tenantId: string,
  id: string
): Promise<
  | (QuizRow & {
      course_title?: string;
      section_title?: string;
      lesson_title?: string;
    })
  | null
> {
  const row = await db
    .selectFrom("quizzes")
    .leftJoin("courses", "courses.id", "quizzes.course_id")
    .leftJoin("course_sections", "course_sections.id", "quizzes.section_id")
    .leftJoin("course_lessons", "course_lessons.id", "quizzes.lesson_id")
    .select([
      "quizzes.id",
      "quizzes.tenant_id",
      "quizzes.course_id",
      "quizzes.section_id",
      "quizzes.lesson_id",
      "quizzes.source_lecture_id",
      "quizzes.title",
      "quizzes.instructions",
      "quizzes.scope",
      "quizzes.status",
      "quizzes.max_score",
      "quizzes.pass_percentage",
      "quizzes.duration_min",
      "quizzes.due_date",
      "quizzes.ai_generated",
      "quizzes.sort_order",
      "quizzes.random_question_count",
      "quizzes.allow_reattempt",
      "quizzes.max_attempts",
      "quizzes.proctoring_enabled",
      "quizzes.proctor_camera",
      "quizzes.proctor_max_tab_switches",
      "quizzes.calculator_mode",
      "quizzes.created_at",
      "quizzes.updated_at",
      "courses.title as course_title",
      "course_sections.title as section_title",
      "course_lessons.title as lesson_title",
    ])
    .where("quizzes.tenant_id", "=", tenantId)
    .where("quizzes.id", "=", id)
    .executeTakeFirst();
  return row as unknown as (QuizRow & {
    course_title?: string;
    section_title?: string;
    lesson_title?: string;
  }) | null;
}

export async function list(
  tenantId: string,
  params: ListQuizzesParams
): Promise<ListQuizzesResult> {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  let query = db
    .selectFrom("quizzes")
    .selectAll()
    .where("quizzes.tenant_id", "=", tenantId)
    .where("quizzes.course_id", "=", params.course_id);

  if (params.section_id) {
    query = query.where("quizzes.section_id", "=", params.section_id);
  }
  if (params.lesson_id) {
    query = query.where("quizzes.lesson_id", "=", params.lesson_id);
  }
  if (params.status) {
    query = query.where("quizzes.status", "=", params.status);
  }
  if (params.scope) {
    query = query.where("quizzes.scope", "=", params.scope);
  }

  const countQuery = query.clearSelect().select(db.fn.countAll().as("count"));
  const totalResult = await countQuery.executeTakeFirst();
  const total = Number(totalResult?.count ?? 0);

  const rows = await query
    .orderBy("quizzes.sort_order", "asc")
    .orderBy("quizzes.created_at", "asc")
    .limit(limit)
    .offset(offset)
    .execute();

  return {
    data: rows as unknown as QuizRow[],
    total,
    page,
    limit,
  };
}

export async function create(data: CreateQuizInput): Promise<QuizRow> {
  const id = ulid();
  const now = new Date();
  const row = await db
    .insertInto("quizzes")
    .values({
      id,
      tenant_id: data.tenant_id,
      course_id: data.course_id,
      section_id: data.section_id ?? null,
      lesson_id: data.lesson_id ?? null,
      source_lecture_id: data.source_lecture_id ?? null,
      title: data.title,
      instructions: data.instructions ?? null,
      scope: (data.scope ?? "LESSON") as "COURSE" | "SECTION" | "LESSON",
      status: (data.status ?? "DRAFT") as "DRAFT" | "PUBLISHED",
      max_score: data.max_score ?? 100,
      pass_percentage: data.pass_percentage ?? 60,
      duration_min: data.duration_min ?? null,
      due_date: data.due_date ?? null,
      ai_generated: data.ai_generated ?? false,
      sort_order: data.sort_order ?? 0,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as QuizRow;
}

export async function update(
  tenantId: string,
  id: string,
  data: UpdateQuizInput
): Promise<QuizRow | null> {
  const now = new Date();
  const updateData: Record<string, unknown> = { updated_at: now };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.instructions !== undefined) updateData.instructions = data.instructions;
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.section_id !== undefined) updateData.section_id = data.section_id;
  if (data.max_score !== undefined) updateData.max_score = data.max_score;
  if (data.pass_percentage !== undefined) updateData.pass_percentage = data.pass_percentage;
  if (data.duration_min !== undefined) updateData.duration_min = data.duration_min;
  if (data.due_date !== undefined) updateData.due_date = data.due_date;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
  if (data.random_question_count !== undefined)
    updateData.random_question_count = data.random_question_count;
  if (data.allow_reattempt !== undefined)
    updateData.allow_reattempt = data.allow_reattempt;
  if (data.max_attempts !== undefined)
    updateData.max_attempts = data.max_attempts;
  if (data.proctoring_enabled !== undefined)
    updateData.proctoring_enabled = data.proctoring_enabled;
  if (data.proctor_camera !== undefined)
    updateData.proctor_camera = data.proctor_camera;
  if (data.proctor_max_tab_switches !== undefined)
    updateData.proctor_max_tab_switches = data.proctor_max_tab_switches;
  if (data.calculator_mode !== undefined)
    updateData.calculator_mode = data.calculator_mode;

  const row = await db
    .updateTable("quizzes")
    .set(updateData)
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as QuizRow | null;
}

export async function updateStatus(
  tenantId: string,
  id: string,
  status: "DRAFT" | "PUBLISHED"
): Promise<QuizRow | null> {
  const now = new Date();
  const row = await db
    .updateTable("quizzes")
    .set({ status, updated_at: now })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  return row as unknown as QuizRow | null;
}

export async function remove(tenantId: string, id: string): Promise<boolean> {
  const result = await db
    .deleteFrom("quizzes")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .executeTakeFirst();
  return Number(result?.numDeletedRows ?? 0) > 0;
}
