import { ulid } from "ulid";
import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type {
  DB,
  test_modules,
  test_module_questions,
  test_module_score_scales,
  test_norm_tables,
} from "../db/types";

/** Postgres `Json` columns require valid JSON syntax, always stringify, strip null bytes. */
function serializeJson(value: unknown): string {
  return JSON.stringify(value).replace(/\\u0000/g, "");
}

export type TestModuleRow = test_modules;
export type TestModuleQuestionRow = test_module_questions;
export type TestModuleScoreScaleRow = test_module_score_scales;
export type TestNormTableRow = test_norm_tables;

export interface NormTablePoint {
  score: number;
  percentile: number;
}

export interface NormTableInput {
  points: NormTablePoint[];
  max_score: number;
}

export interface CreateModuleInput {
  tenant_id: string;
  test_id: string;
  section_id: string;
  stage_no: number;
  variant: string;
  difficulty_rank?: number;
  question_count: number;
  pretest_count?: number;
  time_limit_min: number;
  routing_rules?: unknown | null;
}

export interface UpdateModuleInput {
  difficulty_rank?: number;
  question_count?: number;
  pretest_count?: number;
  time_limit_min?: number;
  routing_rules?: unknown | null;
}

export interface ScoreScaleInput {
  path_key: string;
  scale: number[];
  scale_max: number;
}

class TestModulesRepository {
  // ---------- Modules ----------
  async findModulesByTest(
    testId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestModuleRow[]> {
    const rows = await (trx || db)
      .selectFrom("test_modules")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .orderBy("stage_no", "asc")
      .orderBy("difficulty_rank", "asc")
      .execute();
    return rows as unknown as TestModuleRow[];
  }

  async findModulesBySection(
    sectionId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestModuleRow[]> {
    const rows = await (trx || db)
      .selectFrom("test_modules")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("section_id", "=", sectionId)
      .orderBy("stage_no", "asc")
      .orderBy("difficulty_rank", "asc")
      .execute();
    return rows as unknown as TestModuleRow[];
  }

  async findModuleById(
    moduleId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestModuleRow | null> {
    const row = await (trx || db)
      .selectFrom("test_modules")
      .selectAll()
      .where("id", "=", moduleId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return (row as unknown as TestModuleRow) ?? null;
  }

  async createModule(
    data: CreateModuleInput,
    trx?: Transaction<DB>
  ): Promise<TestModuleRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_modules")
      .values({
        id,
        tenant_id: data.tenant_id,
        test_id: data.test_id,
        section_id: data.section_id,
        stage_no: data.stage_no,
        variant: data.variant,
        difficulty_rank: data.difficulty_rank ?? 0,
        question_count: data.question_count,
        pretest_count: data.pretest_count ?? 0,
        time_limit_min: data.time_limit_min,
        routing_rules:
          data.routing_rules === undefined || data.routing_rules === null
            ? null
            : serializeJson(data.routing_rules),
        created_at: now,
        updated_at: now,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestModuleRow;
  }

  async updateModule(
    moduleId: string,
    tenantId: string,
    data: UpdateModuleInput,
    trx?: Transaction<DB>
  ): Promise<TestModuleRow | null> {
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (data.difficulty_rank !== undefined) updateData.difficulty_rank = data.difficulty_rank;
    if (data.question_count !== undefined) updateData.question_count = data.question_count;
    if (data.pretest_count !== undefined) updateData.pretest_count = data.pretest_count;
    if (data.time_limit_min !== undefined) updateData.time_limit_min = data.time_limit_min;
    if (data.routing_rules !== undefined)
      updateData.routing_rules =
        data.routing_rules === null ? null : serializeJson(data.routing_rules);

    const row = await (trx || db)
      .updateTable("test_modules")
      .set(updateData)
      .where("id", "=", moduleId)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestModuleRow) ?? null;
  }

  async deleteModule(
    moduleId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("test_modules")
      .where("id", "=", moduleId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  // ---------- Module questions ----------
  async findQuestionsByTest(
    testId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestModuleQuestionRow[]> {
    const rows = await (trx || db)
      .selectFrom("test_module_questions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .orderBy("order_index", "asc")
      .execute();
    return rows as unknown as TestModuleQuestionRow[];
  }

  async findQuestionsByModule(
    moduleId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestModuleQuestionRow[]> {
    const rows = await (trx || db)
      .selectFrom("test_module_questions")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("module_id", "=", moduleId)
      .orderBy("order_index", "asc")
      .execute();
    return rows as unknown as TestModuleQuestionRow[];
  }

  async addModuleQuestions(
    items: Array<{
      tenant_id: string;
      test_id: string;
      module_id: string;
      question_id: string;
      is_pretest?: boolean;
      order_index?: number;
    }>,
    trx?: Transaction<DB>
  ): Promise<void> {
    if (items.length === 0) return;
    const now = new Date();
    const values = items.map((i) => ({
      id: ulid(),
      tenant_id: i.tenant_id,
      test_id: i.test_id,
      module_id: i.module_id,
      question_id: i.question_id,
      is_pretest: i.is_pretest ?? false,
      order_index: i.order_index ?? 0,
      created_at: now,
    }));
    await (trx || db)
      .insertInto("test_module_questions")
      .values(values as never[])
      .onConflict((oc) => oc.columns(["module_id", "question_id"]).doNothing())
      .execute();
  }

  async updateModuleQuestion(
    moduleId: string,
    questionId: string,
    tenantId: string,
    data: { is_pretest?: boolean; order_index?: number },
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const updateData: Record<string, unknown> = {};
    if (data.is_pretest !== undefined) updateData.is_pretest = data.is_pretest;
    if (data.order_index !== undefined) updateData.order_index = data.order_index;
    if (Object.keys(updateData).length === 0) return true;
    const result = await (trx || db)
      .updateTable("test_module_questions")
      .set(updateData)
      .where("tenant_id", "=", tenantId)
      .where("module_id", "=", moduleId)
      .where("question_id", "=", questionId)
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0) > 0;
  }

  async removeModuleQuestion(
    moduleId: string,
    questionId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const result = await (trx || db)
      .deleteFrom("test_module_questions")
      .where("tenant_id", "=", tenantId)
      .where("module_id", "=", moduleId)
      .where("question_id", "=", questionId)
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  // ---------- Score scales ----------
  async findScoreScalesByTest(
    testId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestModuleScoreScaleRow[]> {
    const rows = await (trx || db)
      .selectFrom("test_module_score_scales")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .orderBy("path_key", "asc")
      .execute();
    return rows as unknown as TestModuleScoreScaleRow[];
  }

  async findScoreScalesBySection(
    sectionId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestModuleScoreScaleRow[]> {
    const rows = await (trx || db)
      .selectFrom("test_module_score_scales")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("section_id", "=", sectionId)
      .orderBy("path_key", "asc")
      .execute();
    return rows as unknown as TestModuleScoreScaleRow[];
  }

  /** Replace-all semantics per section: empty `scales` clears the section's tables. */
  async replaceScoreScalesForSection(
    tenantId: string,
    testId: string,
    sectionId: string,
    scales: ScoreScaleInput[],
    trx?: Transaction<DB>
  ): Promise<TestModuleScoreScaleRow[]> {
    const run = async (conn: Transaction<DB>) => {
      await conn
        .deleteFrom("test_module_score_scales")
        .where("tenant_id", "=", tenantId)
        .where("section_id", "=", sectionId)
        .execute();
      if (scales.length === 0) return [] as TestModuleScoreScaleRow[];
      const now = new Date();
      const values = scales.map((s) => ({
        id: ulid(),
        tenant_id: tenantId,
        test_id: testId,
        section_id: sectionId,
        path_key: s.path_key,
        scale: serializeJson(s.scale),
        scale_max: s.scale_max,
        created_at: now,
        updated_at: now,
      }));
      const rows = await conn
        .insertInto("test_module_score_scales")
        .values(values as never[])
        .returningAll()
        .execute();
      return rows as unknown as TestModuleScoreScaleRow[];
    };
    if (trx) return run(trx);
    return db.transaction().execute(run);
  }

  // ---------- Norm tables (score-to-percentile, per test) ----------
  async findNormTableByTest(
    testId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestNormTableRow | null> {
    const row = await (trx || db)
      .selectFrom("test_norm_tables")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .executeTakeFirst();
    return (row as unknown as TestNormTableRow) ?? null;
  }

  /** Replace-all semantics per test: null/empty input clears the table. */
  async replaceNormTableForTest(
    tenantId: string,
    testId: string,
    input: NormTableInput | null,
    trx?: Transaction<DB>
  ): Promise<TestNormTableRow | null> {
    const run = async (conn: Transaction<DB>) => {
      await conn
        .deleteFrom("test_norm_tables")
        .where("tenant_id", "=", tenantId)
        .where("test_id", "=", testId)
        .execute();
      if (!input || input.points.length === 0) return null;
      const now = new Date();
      const row = await conn
        .insertInto("test_norm_tables")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          test_id: testId,
          points: serializeJson(input.points),
          max_score: input.max_score,
          created_at: now,
          updated_at: now,
        } as never)
        .returningAll()
        .executeTakeFirst();
      return (row as unknown as TestNormTableRow) ?? null;
    };
    if (trx) return run(trx);
    return db.transaction().execute(run);
  }
}

export default new TestModulesRepository();
