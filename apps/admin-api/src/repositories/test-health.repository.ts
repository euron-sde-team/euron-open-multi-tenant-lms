import { sql } from "kysely";
import { db } from "../db/connection";
import type { test_attempt_status } from "../db/enums";

export interface AttemptModuleStatRow {
  attempt_id: string;
  module_id: string;
  section_id: string;
  stage_no: number;
  variant: string;
  raw_correct: number | null;
  status: string;
}

export interface QuestionStatRow {
  question_id: string;
  graded: number;
  correct: number;
  avg_time_sec: number | null;
  mean_score_correct: number | null;
  mean_score_incorrect: number | null;
  score_sd: number | null;
}

const SUBMITTED: test_attempt_status[] = [
  "SUBMITTED",
  "AUTO_SUBMITTED",
] as test_attempt_status[];

class TestHealthRepository {
  /** Completed attempt-module rows for all submitted attempts of a test. */
  async findAttemptModuleStats(
    tenantId: string,
    testId: string
  ): Promise<AttemptModuleStatRow[]> {
    const rows = await db
      .selectFrom("test_attempt_modules as tam")
      .innerJoin("test_attempts as ta", "ta.id", "tam.attempt_id")
      .select([
        "tam.attempt_id",
        "tam.module_id",
        "tam.section_id",
        "tam.stage_no",
        "tam.variant",
        "tam.raw_correct",
        "tam.status",
      ])
      .where("tam.tenant_id", "=", tenantId)
      .where("ta.tenant_id", "=", tenantId)
      .where("ta.test_id", "=", testId)
      .where("ta.status", "in", SUBMITTED)
      .where("tam.status", "=", "COMPLETED" as never)
      .execute();
    return rows as unknown as AttemptModuleStatRow[];
  }

  async countSubmittedAttempts(tenantId: string, testId: string): Promise<number> {
    const row = await db
      .selectFrom("test_attempts")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .where("status", "in", SUBMITTED)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  /**
   * Classical test theory aggregates per question over graded answers from
   * submitted attempts. The point-biserial inputs (group means + overall
   * stddev of attempt scores) come back as aggregates so no per-answer rows
   * leave the database.
   */
  async findQuestionStats(
    tenantId: string,
    questionIds: string[]
  ): Promise<QuestionStatRow[]> {
    if (questionIds.length === 0) return [];
    const rows = await db
      .selectFrom("test_attempt_answers as a")
      .innerJoin("test_attempts as t", "t.id", "a.attempt_id")
      .select([
        "a.question_id",
        sql<number>`count(*) filter (where a.is_correct is not null)::int`.as(
          "graded"
        ),
        sql<number>`count(*) filter (where a.is_correct = true)::int`.as("correct"),
        sql<number | null>`avg(a.time_spent_sec)`.as("avg_time_sec"),
        sql<number | null>`avg(t.score) filter (where a.is_correct = true)`.as(
          "mean_score_correct"
        ),
        sql<number | null>`avg(t.score) filter (where a.is_correct = false)`.as(
          "mean_score_incorrect"
        ),
        sql<number | null>`stddev_pop(t.score) filter (where a.is_correct is not null)`.as(
          "score_sd"
        ),
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("t.tenant_id", "=", tenantId)
      .where("a.question_id", "in", questionIds)
      .where("t.status", "in", SUBMITTED)
      .groupBy("a.question_id")
      .execute();
    return rows as unknown as QuestionStatRow[];
  }
}

export default new TestHealthRepository();
