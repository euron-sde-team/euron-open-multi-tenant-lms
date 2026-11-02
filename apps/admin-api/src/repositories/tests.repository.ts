import { ulid } from "ulid";
import { sql, type Transaction } from "kysely";
import { db } from "../db/connection";
import type {
  DB,
  tests,
  test_sections,
  test_section_questions,
} from "../db/types";
import type { test_status, test_show_solutions, test_mode } from "../db/enums";
import { attemptTotalMarksSql } from "../utils/attempt-total-marks.util";
import {
  attemptPercentileSql,
  attemptRankSql,
} from "../utils/attempt-rank.util";

/** Postgres `Json` columns require valid JSON syntax, always stringify, strip null bytes. */
function serializeJson(value: unknown): string {
  return JSON.stringify(value).replace(/\\u0000/g, "");
}

export type TestRow = tests;
export type TestSectionRow = test_sections;
export type TestSectionQuestionRow = test_section_questions;

export interface TestsListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface TestsListResult {
  tests: TestRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTestInput {
  tenant_id: string;
  name: string;
  description?: string | null;
  cover_image_key?: string | null;
  duration_min: number;
  total_marks?: number;
  status?: string;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  show_solutions?: string;
  allow_reattempt?: boolean;
  max_attempts?: number | null;
  proctoring_enabled?: boolean;
  proctor_camera?: boolean;
  proctor_max_tab_switches?: number | null;
  proctor_mic?: boolean;
  proctor_fullscreen?: boolean;
  proctor_block_copy_paste?: boolean;
  proctor_action?: string;
  available_from?: Date | string | null;
  available_until?: Date | string | null;
  certificate_enabled?: boolean;
  certificate_template_id?: string | null;
  certificate_min_score_pct?: number | null;
  calculator_mode?: string;
  pass_criteria_pct?: number | null;
  target_exam?: string | null;
  target_rank_curve_id?: string | null;
  random_question_count?: number | null;
  mode?: string;
  created_by?: string | null;
}

export interface UpdateTestInput {
  name?: string;
  description?: string | null;
  cover_image_key?: string | null;
  duration_min?: number;
  total_marks?: number;
  status?: string;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  show_solutions?: string;
  allow_reattempt?: boolean;
  max_attempts?: number | null;
  proctoring_enabled?: boolean;
  proctor_camera?: boolean;
  proctor_max_tab_switches?: number | null;
  proctor_mic?: boolean;
  proctor_fullscreen?: boolean;
  proctor_block_copy_paste?: boolean;
  proctor_action?: string;
  available_from?: Date | string | null;
  available_until?: Date | string | null;
  certificate_enabled?: boolean;
  certificate_template_id?: string | null;
  certificate_min_score_pct?: number | null;
  calculator_mode?: string;
  pass_criteria_pct?: number | null;
  target_exam?: string | null;
  target_rank_curve_id?: string | null;
  random_question_count?: number | null;
}

export interface CreateTestSectionInput {
  tenant_id: string;
  test_id: string;
  name: string;
  instructions?: string | null;
  time_limit_min?: number | null;
  order_index?: number;
  marking_scheme?: unknown;
  question_selection?: unknown;
  question_bank_id?: string | null;
  random_question_count?: number | null;
}

export interface UpdateTestSectionInput {
  name?: string;
  instructions?: string | null;
  time_limit_min?: number | null;
  order_index?: number;
  marking_scheme?: unknown;
  question_selection?: unknown;
  question_bank_id?: string | null;
  random_question_count?: number | null;
}

class TestsRepository {
  async findByTenantId(
    tenantId: string,
    params: TestsListParams = {}
  ): Promise<TestsListResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    let countQuery = db
      .selectFrom("tests")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    let listQuery = db
      .selectFrom("tests")
      .selectAll()
      .where("tenant_id", "=", tenantId);

    if (params.status) {
      countQuery = countQuery.where("status", "=", params.status as test_status);
      listQuery = listQuery.where("status", "=", params.status as test_status);
    }
    if (params.search) {
      const term = `%${params.search}%`;
      countQuery = countQuery.where("name", "ilike", term);
      listQuery = listQuery.where("name", "ilike", term);
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    const rows = await listQuery
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return {
      tests: rows as unknown as TestRow[],
      total,
      page,
      limit,
    };
  }

  async findById(id: string, tenantId?: string): Promise<TestRow | null> {
    let query = db.selectFrom("tests").selectAll().where("id", "=", id);
    if (tenantId) query = query.where("tenant_id", "=", tenantId);
    const row = await query.executeTakeFirst();
    return (row as unknown as TestRow) ?? null;
  }

  /** Pool question count per test (for effective-marks display of random tests). */
  async countSectionQuestionsByTestIds(
    tenantId: string,
    testIds: string[]
  ): Promise<Map<string, number>> {
    if (testIds.length === 0) return new Map();
    const rows = await db
      .selectFrom("test_section_questions")
      .select("test_id")
      .select((eb) => eb.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("test_id", "in", testIds)
      .groupBy("test_id")
      .execute();
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.test_id, Number(r.count ?? 0));
    return map;
  }

  /** Sections (with their pooling config) for a set of tests, used to compute
   *  how many questions each test actually serves per attempt. */
  async findSectionsByTestIds(
    tenantId: string,
    testIds: string[]
  ): Promise<
    Array<{
      test_id: string;
      id: string;
      question_selection: unknown;
      random_question_count: number | null;
    }>
  > {
    if (testIds.length === 0) return [];
    return db
      .selectFrom("test_sections")
      .select(["test_id", "id", "question_selection", "random_question_count"])
      .where("tenant_id", "=", tenantId)
      .where("test_id", "in", testIds)
      .execute();
  }

  /** Question counts grouped by section id. */
  async countSectionQuestionsBySectionIds(
    tenantId: string,
    sectionIds: string[]
  ): Promise<Map<string, number>> {
    if (sectionIds.length === 0) return new Map();
    const rows = await db
      .selectFrom("test_section_questions")
      .select("section_id")
      .select((eb) => eb.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("section_id", "in", sectionIds)
      .groupBy("section_id")
      .execute();
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.section_id, Number(r.count ?? 0));
    return map;
  }

  /**
   * Section-question attachments across a set of tests, joined with each
   * question's real marks and blueprint-matching fields. Used to compute the
   * EXACT marks a learner is served per attempt (summing the real marks of the
   * blueprint/random selection) instead of a count-proportional estimate, which
   * breaks the moment question marks are non-uniform (e.g. 40×1 + 10×2 shown as
   * 50 instead of 60).
   */
  async findServedMarksInputByTestIds(
    tenantId: string,
    testIds: string[]
  ): Promise<
    Array<{
      test_id: string;
      section_id: string;
      question_id: string;
      order_index: number | null;
      marks_override: string | null;
      marks: string;
      difficulty: string;
      subject_node_id: string | null;
      chapter_node_id: string | null;
      topic_node_id: string | null;
    }>
  > {
    if (testIds.length === 0) return [];
    const rows = await db
      .selectFrom("test_section_questions as sq")
      .innerJoin("test_questions as q", "q.id", "sq.question_id")
      .select([
        "sq.test_id as test_id",
        "sq.section_id as section_id",
        "sq.question_id as question_id",
        "sq.order_index as order_index",
        "sq.marks_override as marks_override",
        "q.marks as marks",
        "q.difficulty as difficulty",
        "q.subject_node_id as subject_node_id",
        "q.chapter_node_id as chapter_node_id",
        "q.topic_node_id as topic_node_id",
      ])
      .where("sq.tenant_id", "=", tenantId)
      .where("q.tenant_id", "=", tenantId)
      .where("sq.test_id", "in", testIds)
      .orderBy("sq.order_index", "asc")
      .execute();
    return rows as unknown as Array<{
      test_id: string;
      section_id: string;
      question_id: string;
      order_index: number | null;
      marks_override: string | null;
      marks: string;
      difficulty: string;
      subject_node_id: string | null;
      chapter_node_id: string | null;
      topic_node_id: string | null;
    }>;
  }

  /** Learner attempts for a test (newest first) with proctoring + score fields,
   *  for the admin attempts & proctoring report. Capped to a sane page size. */
  async listAttemptsForTest(tenantId: string, testId: string) {
    return db
      .selectFrom("test_attempts as a")
      .leftJoin("tenant_members as m", "m.id", "a.learner_id")
      .leftJoin("tests as t", "t.id", "a.test_id")
      .select([
        "a.id",
        "a.learner_id",
        "a.status",
        "a.score",
        "a.percentage",
        "a.scaled_score",
        "a.scaled_score_max",
        attemptPercentileSql().as("percentile"),
        attemptRankSql().as("rank"),
        "a.started_at",
        "a.submitted_at",
        "a.tab_switch_count",
        "a.proctoring_flags",
        "m.name as learner_name",
        "m.email as learner_email",
        "m.phone as learner_phone",
        attemptTotalMarksSql().as("attempt_total_marks"),
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.test_id", "=", testId)
      .orderBy("a.started_at", "desc")
      .limit(2000)
      .execute();
  }

  /** All learner attempts across every test in a SERIES (batch-wise report),
   *  joined with the test name + member details. Newest first. */
  async listAttemptsForSeries(tenantId: string, seriesId: string) {
    return db
      .selectFrom("test_attempts as a")
      .leftJoin("tenant_members as m", "m.id", "a.learner_id")
      .leftJoin("tests as t", "t.id", "a.test_id")
      .select([
        "a.id",
        "a.test_id",
        "t.name as test_name",
        "a.learner_id",
        "a.status",
        "a.score",
        "a.percentage",
        "a.scaled_score",
        "a.scaled_score_max",
        attemptPercentileSql().as("percentile"),
        attemptRankSql().as("rank"),
        "a.started_at",
        "a.submitted_at",
        "a.tab_switch_count",
        "a.proctoring_flags",
        "m.name as learner_name",
        "m.email as learner_email",
        "m.phone as learner_phone",
        attemptTotalMarksSql().as("attempt_total_marks"),
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.test_series_id", "=", seriesId)
      .orderBy("a.started_at", "desc")
      .limit(5000)
      .execute();
  }

  /**
   * Everything needed to replay ONE attempt question by question for staff.
   *
   * Returns the raw pieces; the service assembles them, because which questions
   * were actually served depends on the test mode:
   *  - standard → `attempt.question_ids`, or the whole section pool when empty
   *  - adaptive → the question ids carried on the attempt's modules
   * Skipped questions have no `test_attempt_answers` row at all, so the served
   * pool has to come from the test structure rather than from the answers.
   */

  /**
   * Learners who have attempted any test, newest activity first.
   *
   * Driven off test_attempts rather than tenant_members so the list is exactly
   * the people who have sat something, not every member on the tenant.
   */
  async listLearnersWithAttempts(
    tenantId: string,
    params: { search?: string; page: number; limit: number }
  ) {
    const offset = (params.page - 1) * params.limit;
    // Escape the LIKE metacharacters so a literal % or _ is not a wildcard.
    const term = params.search?.trim()
      ? `%${params.search.trim().replace(/([\\%_])/g, "\\$1")}%`
      : null;

    let listQuery = db
      .selectFrom("test_attempts as a")
      .innerJoin("tenant_members as m", "m.id", "a.learner_id")
      .select([
        "a.learner_id as learner_id",
        "m.name as learner_name",
        "m.email as learner_email",
        "m.phone as learner_phone",
        sql<string>`count(*)`.as("attempt_count"),
        sql<string>`count(distinct a.test_id)`.as("test_count"),
        sql<string>`count(*) filter (where a.status in ('SUBMITTED','AUTO_SUBMITTED'))`.as(
          "submitted_count"
        ),
        sql<string>`round(avg(a.percentage) filter (where a.percentage is not null), 2)`.as(
          "avg_percentage"
        ),
        sql<Date | null>`max(a.submitted_at)`.as("last_submitted_at"),
      ])
      .where("a.tenant_id", "=", tenantId)
      .groupBy(["a.learner_id", "m.name", "m.email", "m.phone"]);

    let countQuery = db
      .selectFrom("test_attempts as a")
      .innerJoin("tenant_members as m", "m.id", "a.learner_id")
      .select(sql<string>`count(distinct a.learner_id)`.as("total"))
      .where("a.tenant_id", "=", tenantId);

    if (term) {
      listQuery = listQuery.where((eb) =>
        eb.or([
          eb("m.name", "ilike", term),
          eb("m.email", "ilike", term),
          eb("m.phone", "ilike", term),
        ])
      );
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("m.name", "ilike", term),
          eb("m.email", "ilike", term),
          eb("m.phone", "ilike", term),
        ])
      );
    }

    const [rows, totalRow] = await Promise.all([
      listQuery
        .orderBy(sql`max(a.submitted_at) desc nulls last`)
        .limit(params.limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    return { learners: rows, total: Number(totalRow?.total ?? 0) };
  }

  /**
   * Every attempt one learner has made, across every test and series.
   *
   * The per test and per series reports answer "how did this test go". This
   * answers "how is this learner doing", which is the view faculty asked for
   * when they wanted to see a specific test taken by a specific user without
   * first knowing which series it belonged to.
   */
  async listAttemptsForLearner(tenantId: string, learnerId: string) {
    return db
      .selectFrom("test_attempts as a")
      .leftJoin("tests as t", "t.id", "a.test_id")
      .leftJoin("test_series as ts", "ts.id", "a.test_series_id")
      .leftJoin("tenant_members as m", "m.id", "a.learner_id")
      .select([
        "a.id",
        "a.test_id",
        "t.name as test_name",
        "t.pass_criteria_pct",
        "a.test_series_id",
        "ts.title as series_title",
        "a.learner_id",
        "a.status",
        "a.grading_status",
        "a.score",
        "a.percentage",
        "a.scaled_score",
        "a.scaled_score_max",
        "a.started_at",
        "a.submitted_at",
        "a.tab_switch_count",
        "a.proctoring_flags",
        "m.name as learner_name",
        "m.email as learner_email",
        "m.phone as learner_phone",
        attemptTotalMarksSql().as("attempt_total_marks"),
        attemptPercentileSql().as("percentile"),
        attemptRankSql().as("rank"),
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.learner_id", "=", learnerId)
      .orderBy("a.started_at", "desc")
      .limit(1000)
      .execute();
  }

  async getAttemptReview(tenantId: string, attemptId: string) {
    const attempt = await db
      .selectFrom("test_attempts as a")
      .innerJoin("tests as t", "t.id", "a.test_id")
      .leftJoin("test_series as ts", "ts.id", "a.test_series_id")
      .leftJoin("tenant_members as m", "m.id", "a.learner_id")
      .select([
        "a.id",
        "a.test_id",
        "a.test_series_id",
        "a.learner_id",
        "a.status",
        "a.grading_status",
        "a.score",
        "a.percentage",
        attemptPercentileSql().as("percentile"),
        attemptRankSql().as("rank"),
        "a.scaled_score",
        "a.scaled_score_max",
        "a.question_ids",
        "a.started_at",
        "a.submitted_at",
        "a.tab_switch_count",
        "t.name as test_name",
        "t.mode as test_mode",
        "t.pass_criteria_pct",
        "t.shuffle_questions",
        "t.shuffle_options",
        "ts.title as series_title",
        "m.name as learner_name",
        "m.email as learner_email",
        "m.phone as learner_phone",
        attemptTotalMarksSql().as("attempt_total_marks"),
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.id", "=", attemptId)
      .executeTakeFirst();
    if (!attempt) return null;

    const [answers, sectionQuestions, modules] = await Promise.all([
      db
        .selectFrom("test_attempt_answers")
        .select([
          "question_id",
          "answer",
          "is_correct",
          "marks_awarded",
          "time_spent_sec",
          "marked_for_review",
          "grading_status",
          "grader_remarks",
        ])
        .where("tenant_id", "=", tenantId)
        .where("attempt_id", "=", attemptId)
        .execute(),
      db
        .selectFrom("test_section_questions as sq")
        .innerJoin("test_sections as s", "s.id", "sq.section_id")
        .innerJoin("test_questions as q", "q.id", "sq.question_id")
        .select([
          "sq.question_id",
          "sq.marks_override",
          "s.id as section_id",
          "s.name as section_name",
          "q.type",
          "q.difficulty",
          "q.stem",
          "q.options",
          "q.correct_answer",
          "q.explanation",
          "q.marks",
          "q.negative_marks",
          "q.subject",
          "q.chapter",
          "q.topic",
        ])
        .where("sq.tenant_id", "=", tenantId)
        .where("sq.test_id", "=", attempt.test_id)
        .orderBy("s.order_index", "asc")
        .orderBy("sq.order_index", "asc")
        .execute(),
      db
        .selectFrom("test_attempt_modules")
        .select(["module_id", "section_id", "order_index", "question_ids", "pretest_ids"])
        .where("tenant_id", "=", tenantId)
        .where("attempt_id", "=", attemptId)
        .orderBy("order_index", "asc")
        .execute(),
    ]);

    return { attempt, answers, sectionQuestions, modules };
  }

  /** Questions by id, with section context, the adaptive review's question source. */
  async findQuestionsForReview(tenantId: string, questionIds: string[]) {
    if (questionIds.length === 0) return [];
    return db
      .selectFrom("test_questions")
      .select([
        "id",
        "type",
        "difficulty",
        "stem",
        "options",
        "correct_answer",
        "explanation",
        "marks",
        "negative_marks",
        "subject",
        "chapter",
        "topic",
      ])
      .where("tenant_id", "=", tenantId)
      .where("id", "in", questionIds)
      .execute();
  }

  /** Each test's own random_question_count, for the served count and marks calc. */
  async findRandomCountsByTestIds(
    tenantId: string,
    testIds: string[]
  ): Promise<Map<string, number | null>> {
    if (testIds.length === 0) return new Map();
    const rows = await db
      .selectFrom("tests")
      .select(["id", "random_question_count"])
      .where("tenant_id", "=", tenantId)
      .where("id", "in", testIds)
      .execute();
    return new Map(rows.map((r) => [r.id, r.random_question_count ?? null]));
  }

  async create(data: CreateTestInput, trx?: Transaction<DB>): Promise<TestRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("tests")
      .values({
        id,
        tenant_id: data.tenant_id,
        name: data.name,
        description: data.description ?? null,
        cover_image_key: data.cover_image_key ?? null,
        duration_min: data.duration_min,
        total_marks: (data.total_marks ?? 0) as unknown as string,
        status: (data.status ?? "DRAFT") as test_status,
        shuffle_questions: data.shuffle_questions ?? false,
        shuffle_options: data.shuffle_options ?? false,
        show_solutions: (data.show_solutions ?? "IMMEDIATE") as test_show_solutions,
        allow_reattempt: data.allow_reattempt ?? false,
        max_attempts: data.max_attempts ?? null,
        proctoring_enabled: data.proctoring_enabled ?? false,
        proctor_camera: data.proctor_camera ?? false,
        proctor_max_tab_switches: data.proctor_max_tab_switches ?? null,
        proctor_mic: data.proctor_mic ?? false,
        proctor_fullscreen: data.proctor_fullscreen ?? false,
        proctor_block_copy_paste: data.proctor_block_copy_paste ?? false,
        proctor_action: data.proctor_action ?? "WARN",
        available_from: (data.available_from ?? null) as unknown as Date | null,
        available_until: (data.available_until ?? null) as unknown as Date | null,
        certificate_enabled: data.certificate_enabled ?? false,
        certificate_template_id: data.certificate_template_id ?? null,
        certificate_min_score_pct: (data.certificate_min_score_pct ?? null) as unknown as
          | string
          | null,
        calculator_mode: data.calculator_mode ?? "NONE",
        pass_criteria_pct: (data.pass_criteria_pct ?? null) as unknown as string | null,
        target_exam: data.target_exam ?? null,
        target_rank_curve_id: data.target_rank_curve_id ?? null,
        random_question_count: data.random_question_count ?? null,
        mode: (data.mode ?? "STANDARD") as test_mode,
        created_by: data.created_by ?? null,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestRow;
  }

  async update(
    id: string,
    tenantId: string,
    data: UpdateTestInput,
    trx?: Transaction<DB>
  ): Promise<TestRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.cover_image_key !== undefined) updateData.cover_image_key = data.cover_image_key;
    if (data.duration_min !== undefined) updateData.duration_min = data.duration_min;
    if (data.total_marks !== undefined) updateData.total_marks = data.total_marks;
    if (data.status !== undefined) updateData.status = data.status as test_status;
    if (data.shuffle_questions !== undefined) updateData.shuffle_questions = data.shuffle_questions;
    if (data.shuffle_options !== undefined) updateData.shuffle_options = data.shuffle_options;
    if (data.show_solutions !== undefined)
      updateData.show_solutions = data.show_solutions as test_show_solutions;
    if (data.allow_reattempt !== undefined) updateData.allow_reattempt = data.allow_reattempt;
    if (data.max_attempts !== undefined) updateData.max_attempts = data.max_attempts;
    if (data.proctoring_enabled !== undefined)
      updateData.proctoring_enabled = data.proctoring_enabled;
    if (data.proctor_camera !== undefined)
      updateData.proctor_camera = data.proctor_camera;
    if (data.proctor_max_tab_switches !== undefined)
      updateData.proctor_max_tab_switches = data.proctor_max_tab_switches;
    if (data.proctor_mic !== undefined) updateData.proctor_mic = data.proctor_mic;
    if (data.proctor_fullscreen !== undefined)
      updateData.proctor_fullscreen = data.proctor_fullscreen;
    if (data.proctor_block_copy_paste !== undefined)
      updateData.proctor_block_copy_paste = data.proctor_block_copy_paste;
    if (data.proctor_action !== undefined)
      updateData.proctor_action = data.proctor_action;
    if (data.available_from !== undefined)
      updateData.available_from = data.available_from;
    if (data.available_until !== undefined)
      updateData.available_until = data.available_until;
    if (data.certificate_enabled !== undefined)
      updateData.certificate_enabled = data.certificate_enabled;
    if (data.certificate_template_id !== undefined)
      updateData.certificate_template_id = data.certificate_template_id;
    if (data.certificate_min_score_pct !== undefined)
      updateData.certificate_min_score_pct = data.certificate_min_score_pct;
    if (data.calculator_mode !== undefined)
      updateData.calculator_mode = data.calculator_mode;
    if (data.pass_criteria_pct !== undefined)
      updateData.pass_criteria_pct = data.pass_criteria_pct;
    if (data.target_exam !== undefined) updateData.target_exam = data.target_exam;
    if (data.target_rank_curve_id !== undefined)
      updateData.target_rank_curve_id = data.target_rank_curve_id;
    if (data.random_question_count !== undefined)
      updateData.random_question_count = data.random_question_count;

    const row = await (trx || db)
      .updateTable("tests")
      .set(updateData)
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestRow) ?? null;
  }

  async delete(id: string, tenantId: string, trx?: Transaction<DB>): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("tests")
      .where("id", "=", id)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  async countByTenantAndStatus(tenantId: string, status?: string): Promise<number> {
    let query = db
      .selectFrom("tests")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId);
    if (status) query = query.where("status", "=", status as test_status);
    const row = await query.executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  // ---------- Sections ----------
  async findSectionsByTest(
    testId: string,
    tenantId: string
  ): Promise<TestSectionRow[]> {
    const rows = await db
      .selectFrom("test_sections")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .orderBy("order_index", "asc")
      .execute();
    return rows as unknown as TestSectionRow[];
  }

  async findSectionById(
    sectionId: string,
    tenantId: string
  ): Promise<TestSectionRow | null> {
    const row = await db
      .selectFrom("test_sections")
      .selectAll()
      .where("id", "=", sectionId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return (row as unknown as TestSectionRow) ?? null;
  }

  async createSection(
    data: CreateTestSectionInput,
    trx?: Transaction<DB>
  ): Promise<TestSectionRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_sections")
      .values({
        id,
        tenant_id: data.tenant_id,
        test_id: data.test_id,
        name: data.name,
        instructions: data.instructions ?? null,
        time_limit_min: data.time_limit_min ?? null,
        order_index: data.order_index ?? 0,
        marking_scheme:
          data.marking_scheme === undefined || data.marking_scheme === null
            ? null
            : serializeJson(data.marking_scheme),
        question_selection:
          data.question_selection === undefined || data.question_selection === null
            ? null
            : serializeJson(data.question_selection),
        question_bank_id: data.question_bank_id ?? null,
        random_question_count: data.random_question_count ?? null,
        created_at: now,
        updated_at: now,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestSectionRow;
  }

  async updateSection(
    sectionId: string,
    tenantId: string,
    data: UpdateTestSectionInput,
    trx?: Transaction<DB>
  ): Promise<TestSectionRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = { updated_at: now };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.time_limit_min !== undefined) updateData.time_limit_min = data.time_limit_min;
    if (data.order_index !== undefined) updateData.order_index = data.order_index;
    if (data.marking_scheme !== undefined)
      updateData.marking_scheme =
        data.marking_scheme === null ? null : serializeJson(data.marking_scheme);
    if (data.question_selection !== undefined)
      updateData.question_selection =
        data.question_selection === null
          ? null
          : serializeJson(data.question_selection);
    if (data.question_bank_id !== undefined)
      updateData.question_bank_id = data.question_bank_id;
    if (data.random_question_count !== undefined)
      updateData.random_question_count = data.random_question_count;

    const row = await (trx || db)
      .updateTable("test_sections")
      .set(updateData)
      .where("id", "=", sectionId)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestSectionRow) ?? null;
  }

  async deleteSection(
    sectionId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("test_sections")
      .where("id", "=", sectionId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  // ---------- Section questions ----------
  async findSectionQuestions(
    sectionId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestSectionQuestionRow[]> {
    const rows = await (trx || db)
      .selectFrom("test_section_questions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("section_id", "=", sectionId)
      .orderBy("order_index", "asc")
      .execute();
    return rows as unknown as TestSectionQuestionRow[];
  }

  async findSectionQuestionsByTest(
    testId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestSectionQuestionRow[]> {
    const rows = await (trx || db)
      .selectFrom("test_section_questions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .orderBy("order_index", "asc")
      .execute();
    return rows as unknown as TestSectionQuestionRow[];
  }

  /**
   * Distinct tests that currently attach a given question. Used to refresh the
   * stored total_marks of every affected test when the question's own marks
   * change or the question is deleted.
   */
  async findTestIdsUsingQuestion(
    questionId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<string[]> {
    const rows = await (trx || db)
      .selectFrom("test_section_questions")
      .select("test_id")
      .distinct()
      .where("tenant_id", "=", tenantId)
      .where("question_id", "=", questionId)
      .execute();
    return rows.map((r) => r.test_id);
  }

  async addSectionQuestions(
    items: Array<{
      tenant_id: string;
      test_id: string;
      section_id: string;
      question_id: string;
      order_index?: number;
      marks_override?: number | null;
    }>,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (items.length === 0) return;
    const now = new Date();
    const values = items.map((i) => ({
      id: ulid(),
      tenant_id: i.tenant_id,
      test_id: i.test_id,
      section_id: i.section_id,
      question_id: i.question_id,
      order_index: i.order_index ?? 0,
      marks_override: (i.marks_override ?? null) as unknown as string | null,
      created_at: now,
    }));
    await (trx || db)
      .insertInto("test_section_questions")
      .values(values as never[])
      .onConflict((oc) => oc.columns(["section_id", "question_id"]).doNothing())
      .execute();
  }

  /** Replace all of a section's questions with a fresh pool (delete + insert). */
  async replaceSectionQuestions(
    sectionId: string,
    tenantId: string,
    testId: string,
    questionIds: string[],
    trx?: Transaction<DB>
  ): Promise<void> {
    const conn = trx || db;
    await conn
      .deleteFrom("test_section_questions")
      .where("tenant_id", "=", tenantId)
      .where("section_id", "=", sectionId)
      .execute();
    if (questionIds.length === 0) return;
    const now = new Date();
    const values = questionIds.map((qid, idx) => ({
      id: ulid(),
      tenant_id: tenantId,
      test_id: testId,
      section_id: sectionId,
      question_id: qid,
      order_index: idx,
      marks_override: null as unknown as string | null,
      created_at: now,
    }));
    await conn
      .insertInto("test_section_questions")
      .values(values as never[])
      .onConflict((oc) => oc.columns(["section_id", "question_id"]).doNothing())
      .execute();
  }

  async removeSectionQuestion(
    sectionId: string,
    questionId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("test_section_questions")
      .where("tenant_id", "=", tenantId)
      .where("section_id", "=", sectionId)
      .where("question_id", "=", questionId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  async reorderSectionQuestions(
    sectionId: string,
    tenantId: string,
    orderedQuestionIds: string[],
    trx?: Transaction<DB>
  ): Promise<void> {
    const conn = trx || db;
    for (let i = 0; i < orderedQuestionIds.length; i++) {
      await conn
        .updateTable("test_section_questions")
        .set({ order_index: i })
        .where("tenant_id", "=", tenantId)
        .where("section_id", "=", sectionId)
        .where("question_id", "=", orderedQuestionIds[i])
        .execute();
    }
  }
}

export default new TestsRepository();
