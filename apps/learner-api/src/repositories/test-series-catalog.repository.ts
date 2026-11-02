import { db } from "../db/connection";
import type {
  test_series,
  test_series_tests,
  tests,
  test_sections,
  test_section_questions,
  test_questions,
  test_modules,
  test_module_questions,
  test_module_score_scales,
  test_norm_tables,
} from "../db/types";
import type {
  test_series_pricing_type,
  test_series_visibility,
  test_status,
} from "../db/enums";

export type TestSeriesRow = test_series;
export type TestSeriesTestRow = test_series_tests;
export type TestRow = tests;
export type TestSectionRow = test_sections;
export type TestSectionQuestionRow = test_section_questions;
export type TestQuestionRow = test_questions;
export type TestModuleRow = test_modules;
export type TestModuleQuestionRow = test_module_questions;
export type TestModuleScoreScaleRow = test_module_score_scales;
export type TestNormTableRow = test_norm_tables;

export interface AdaptiveTestConfig {
  modules: TestModuleRow[];
  moduleQuestions: TestModuleQuestionRow[];
  scoreScales: TestModuleScoreScaleRow[];
  questions: TestQuestionRow[];
  /** Per-test score-to-percentile concordance; null when not configured. */
  normTable: TestNormTableRow | null;
}

class TestSeriesCatalogRepository {
  /**
   * `ordered` applies the arrangement tenant admins dragged into place. When
   * off (the default) this keeps the historical newest-first ordering, so
   * nothing changes for tenants that never enable the feature.
   *
   * Ties on sort_order fall back to created_at DESC, which matters for rows
   * created after an arrangement was saved: they land at 0 and would otherwise
   * come back in whatever order Postgres felt like.
   */
  async findPublishedByTenant(
    tenantId: string,
    params: {
      search?: string;
      category?: string;
      pricing?: string;
      ordered?: boolean;
    } = {}
  ): Promise<TestSeriesRow[]> {
    let q = db
      .selectFrom("test_series")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PUBLISHED" as test_status)
      .where("visibility", "=", "PUBLIC" as test_series_visibility);

    if (params.search) {
      q = q.where("title", "ilike", `%${params.search}%`);
    }
    if (params.category) {
      q = q.where("category", "=", params.category);
    }
    if (params.pricing) {
      q = q.where("pricing_type", "=", params.pricing as test_series_pricing_type);
    }

    if (params.ordered) q = q.orderBy("sort_order", "asc");
    const rows = await q.orderBy("created_at", "desc").limit(100).execute();
    return rows as unknown as TestSeriesRow[];
  }

  async findBySlugForCatalog(
    tenantId: string,
    slug: string
  ): Promise<TestSeriesRow | null> {
    const row = await db
      .selectFrom("test_series")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .executeTakeFirst();
    if (!row) return null;
    // Catalog only returns PUBLIC + PUBLISHED, but UNLISTED accessible via direct slug
    if (
      String(row.status) !== "PUBLISHED" ||
      String(row.visibility) === "PRIVATE"
    ) {
      return null;
    }
    return row as unknown as TestSeriesRow;
  }

  async findById(
    tenantId: string,
    seriesId: string
  ): Promise<TestSeriesRow | null> {
    const row = await db
      .selectFrom("test_series")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", seriesId)
      .executeTakeFirst();
    return (row as unknown as TestSeriesRow) ?? null;
  }

  async listSeriesTests(
    tenantId: string,
    seriesId: string
  ): Promise<Array<TestSeriesTestRow & { test: TestRow }>> {
    const seriesTests = await db
      .selectFrom("test_series_tests")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_series_id", "=", seriesId)
      .orderBy("order_index", "asc")
      .execute();
    if (seriesTests.length === 0) return [];

    const testIds = seriesTests.map((st) => st.test_id);
    const tests = await db
      .selectFrom("tests")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "in", testIds)
      .execute();
    const byId = new Map(tests.map((t) => [t.id, t]));
    return seriesTests
      .map((st) => {
        const test = byId.get(st.test_id);
        if (!test) return null;
        return { ...st, test } as unknown as TestSeriesTestRow & { test: TestRow };
      })
      .filter((x): x is TestSeriesTestRow & { test: TestRow } => x !== null);
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

  /** Sections + pooling config for a set of tests, to compute served counts. */
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

  async getTestForAttempt(
    tenantId: string,
    testId: string
  ): Promise<{
    test: TestRow;
    sections: TestSectionRow[];
    sectionQuestions: TestSectionQuestionRow[];
    questions: TestQuestionRow[];
  } | null> {
    const test = await db
      .selectFrom("tests")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", testId)
      .executeTakeFirst();
    if (!test) return null;

    const sections = await db
      .selectFrom("test_sections")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .orderBy("order_index", "asc")
      .execute();

    const sectionQuestions = await db
      .selectFrom("test_section_questions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .orderBy("order_index", "asc")
      .execute();

    const questionIds = sectionQuestions.map((sq) => sq.question_id);
    const questions = questionIds.length
      ? await db
          .selectFrom("test_questions")
          .selectAll()
          .where("tenant_id", "=", tenantId)
          .where("id", "in", questionIds)
          .execute()
      : [];

    return {
      test: test as unknown as TestRow,
      sections: sections as unknown as TestSectionRow[],
      sectionQuestions: sectionQuestions as unknown as TestSectionQuestionRow[],
      questions: questions as unknown as TestQuestionRow[],
    };
  }

  /**
   * Adaptive (MST) authoring config for a test: modules, module question
   * pools, score scales and the referenced question rows. Question rows for
   * adaptive tests live here, NOT in getTestForAttempt (which reads
   * test_section_questions, empty for adaptive tests).
   */
  async getAdaptiveConfigForTest(
    tenantId: string,
    testId: string
  ): Promise<AdaptiveTestConfig> {
    const [modules, moduleQuestions, scoreScales, normTableRows] = await Promise.all([
      db
        .selectFrom("test_modules")
        .selectAll()
        .where("tenant_id", "=", tenantId)
        .where("test_id", "=", testId)
        .orderBy("stage_no", "asc")
        .orderBy("difficulty_rank", "asc")
        .execute(),
      db
        .selectFrom("test_module_questions")
        .selectAll()
        .where("tenant_id", "=", tenantId)
        .where("test_id", "=", testId)
        .orderBy("order_index", "asc")
        .execute(),
      db
        .selectFrom("test_module_score_scales")
        .selectAll()
        .where("tenant_id", "=", tenantId)
        .where("test_id", "=", testId)
        .execute(),
      db
        .selectFrom("test_norm_tables")
        .selectAll()
        .where("tenant_id", "=", tenantId)
        .where("test_id", "=", testId)
        .execute(),
    ]);

    const questionIds = Array.from(
      new Set(moduleQuestions.map((mq) => mq.question_id))
    );
    const questions = questionIds.length
      ? await db
          .selectFrom("test_questions")
          .selectAll()
          .where("tenant_id", "=", tenantId)
          .where("id", "in", questionIds)
          .execute()
      : [];

    return {
      modules: modules as unknown as TestModuleRow[],
      moduleQuestions: moduleQuestions as unknown as TestModuleQuestionRow[],
      scoreScales: scoreScales as unknown as TestModuleScoreScaleRow[],
      questions: questions as unknown as TestQuestionRow[],
      normTable: (normTableRows[0] as unknown as TestNormTableRow) ?? null,
    };
  }
}

export default new TestSeriesCatalogRepository();
