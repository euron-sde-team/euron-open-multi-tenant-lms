import { ulid } from "ulid";
import { sql, type Transaction } from "kysely";
import { db } from "../db/connection";
import type {
  DB,
  test_attempts,
  test_attempt_answers,
  test_attempt_modules,
} from "../db/types";
import type { test_attempt_status, test_attempt_module_status } from "../db/enums";

/**
 * Serialize any value as a Postgres JSON literal. Postgres `Json` columns
 * reject plain strings, they must be JSON-quoted. Always JSON.stringify and
 * strip null bytes which Postgres rejects.
 */
function serializeJson(value: unknown): string {
  return JSON.stringify(value).replace(/\\u0000/g, "");
}

export type TestAttemptRow = test_attempts;
export type TestAttemptAnswerRow = test_attempt_answers;
export type TestAttemptModuleRow = test_attempt_modules;

export interface CreateAttemptModuleInput {
  tenant_id: string;
  attempt_id: string;
  module_id: string;
  section_id: string;
  stage_no: number;
  variant: string;
  order_index: number;
  status: "PENDING" | "IN_PROGRESS";
  question_ids: string[];
  pretest_ids: string[];
  time_limit_sec: number;
  started_at?: Date | null;
}

export interface CreateAttemptInput {
  tenant_id: string;
  learner_id: string;
  test_id: string;
  test_series_id: string;
  time_remaining_sec: number;
  /**
   * Fixed question set for this attempt (random X mode). Empty array means
   * "serve all questions in the test", no per-attempt subset.
   */
  question_ids?: string[];
}

export interface UpsertAnswerInput {
  attempt_id: string;
  tenant_id: string;
  question_id: string;
  answer: unknown;
  time_spent_sec?: number;
  marked_for_review?: boolean;
}

class TestAttemptsRepository {
  async findById(
    attemptId: string,
    tenantId?: string
  ): Promise<TestAttemptRow | null> {
    let q = db
      .selectFrom("test_attempts")
      .selectAll()
      .where("id", "=", attemptId);
    if (tenantId) q = q.where("tenant_id", "=", tenantId);
    const row = await q.executeTakeFirst();
    return (row as unknown as TestAttemptRow) ?? null;
  }

  async findInProgressByTestAndLearner(
    tenantId: string,
    learnerId: string,
    testId: string
  ): Promise<TestAttemptRow | null> {
    const row = await db
      .selectFrom("test_attempts")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("learner_id", "=", learnerId)
      .where("test_id", "=", testId)
      .where("status", "=", "IN_PROGRESS" as test_attempt_status)
      .orderBy("started_at", "desc")
      .executeTakeFirst();
    return (row as unknown as TestAttemptRow) ?? null;
  }

  async findByLearnerAndTest(
    tenantId: string,
    learnerId: string,
    testId: string
  ): Promise<TestAttemptRow[]> {
    const rows = await db
      .selectFrom("test_attempts")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("learner_id", "=", learnerId)
      .where("test_id", "=", testId)
      .orderBy("started_at", "desc")
      .execute();
    return rows as unknown as TestAttemptRow[];
  }

  /**
   * Latest attempt per test for a learner. Returns one row per test with the
   * most recent started_at. Single SQL: (tenant, learner, test_id IN (...))
   * ordered by started_at desc; we de-dup in JS keeping the first per test.
   * Used by the catalog detail to drive sequential locking + smart CTAs.
   */
  async findLatestByLearnerForTests(
    tenantId: string,
    learnerId: string,
    testIds: string[]
  ): Promise<Map<string, { id: string; status: string; startedAt: Date | string }>> {
    if (testIds.length === 0) return new Map();
    const rows = await db
      .selectFrom("test_attempts")
      .select(["id", "test_id", "status", "started_at"])
      .where("tenant_id", "=", tenantId)
      .where("learner_id", "=", learnerId)
      .where("test_id", "in", testIds)
      .orderBy("started_at", "desc")
      .execute();
    const out = new Map<
      string,
      { id: string; status: string; startedAt: Date | string }
    >();
    for (const r of rows) {
      if (out.has(r.test_id)) continue;
      out.set(r.test_id, {
        id: r.id,
        status: String(r.status),
        startedAt: r.started_at as unknown as Date | string,
      });
    }
    return out;
  }

  async findByLearnerAndSeries(
    tenantId: string,
    learnerId: string,
    seriesId: string
  ): Promise<TestAttemptRow[]> {
    const rows = await db
      .selectFrom("test_attempts")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("learner_id", "=", learnerId)
      .where("test_series_id", "=", seriesId)
      .orderBy("started_at", "desc")
      .execute();
    return rows as unknown as TestAttemptRow[];
  }

  async create(
    data: CreateAttemptInput,
    trx?: Transaction<DB>
  ): Promise<TestAttemptRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_attempts")
      .values({
        id,
        tenant_id: data.tenant_id,
        learner_id: data.learner_id,
        test_id: data.test_id,
        test_series_id: data.test_series_id,
        started_at: now,
        time_remaining_sec: data.time_remaining_sec,
        status: "IN_PROGRESS" as test_attempt_status,
        question_ids: data.question_ids ?? [],
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestAttemptRow;
  }

  async updateTimeRemaining(
    attemptId: string,
    tenantId: string,
    seconds: number
  ): Promise<void> {
    await db
      .updateTable("test_attempts")
      .set({ time_remaining_sec: seconds, updated_at: new Date() })
      .where("id", "=", attemptId)
      .where("tenant_id", "=", tenantId)
      .execute();
  }

  async finalize(
    attemptId: string,
    tenantId: string,
    data: {
      status: string;
      grading_status?: string;
      score: number;
      /** What this attempt was graded out of. Recorded so it never has to be
       *  reconstructed from a test that may have changed since. */
      total_marks?: number | null;
      percentage: number;
      percentile?: number | null;
      rank?: number | null;
      predicted_rank_min?: number | null;
      predicted_rank_max?: number | null;
      analytics?: unknown;
      scaled_score?: number | null;
      scaled_score_max?: number | null;
    },
    trx?: Transaction<DB>
  ): Promise<TestAttemptRow | null> {
    const now = new Date();
    const updateData: Record<string, unknown> = {
      status: data.status as test_attempt_status,
      submitted_at: now,
      score: data.score,
      percentage: data.percentage,
      updated_at: now,
    };
    if (data.grading_status !== undefined)
      updateData.grading_status = data.grading_status;
    if (data.total_marks !== undefined) updateData.total_marks = data.total_marks;
    if (data.percentile !== undefined) updateData.percentile = data.percentile;
    if (data.rank !== undefined) updateData.rank = data.rank;
    if (data.predicted_rank_min !== undefined)
      updateData.predicted_rank_min = data.predicted_rank_min;
    if (data.predicted_rank_max !== undefined)
      updateData.predicted_rank_max = data.predicted_rank_max;
    if (data.analytics !== undefined) updateData.analytics = serializeJson(data.analytics);
    if (data.scaled_score !== undefined) updateData.scaled_score = data.scaled_score;
    if (data.scaled_score_max !== undefined)
      updateData.scaled_score_max = data.scaled_score_max;

    const row = await (trx || db)
      .updateTable("test_attempts")
      .set(updateData)
      .where("id", "=", attemptId)
      .where("tenant_id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestAttemptRow) ?? null;
  }

  /**
   * Persist a proctoring update: the running tab-switch count and the typed
   * violation log (TAB_SWITCH / MULTI_MONITOR / FULLSCREEN_EXIT / …). Used by
   * live, in-attempt proctoring events.
   */
  async recordProctoring(
    attemptId: string,
    tenantId: string,
    data: { tabSwitchCount: number; flags: unknown }
  ): Promise<void> {
    await db
      .updateTable("test_attempts")
      .set({
        tab_switch_count: data.tabSwitchCount,
        proctoring_flags: serializeJson(data.flags),
        updated_at: new Date(),
      })
      .where("id", "=", attemptId)
      .where("tenant_id", "=", tenantId)
      .execute();
  }

  /** Put an attempt onto an inter-section break until `breakEndsAt`. */
  async enterBreak(
    attemptId: string,
    tenantId: string,
    breakEndsAt: Date,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("test_attempts")
      .set({
        status: "ON_BREAK" as test_attempt_status,
        break_ends_at: breakEndsAt,
        updated_at: new Date(),
      })
      .where("id", "=", attemptId)
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "IN_PROGRESS" as test_attempt_status)
      .execute();
  }

  /**
   * Clear the break flag and return the attempt to IN_PROGRESS. Guarded on the
   * current ON_BREAK status so a double-resume is a no-op.
   */
  async clearBreak(
    attemptId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<boolean> {
    const row = await (trx || db)
      .updateTable("test_attempts")
      .set({
        status: "IN_PROGRESS" as test_attempt_status,
        break_ends_at: null,
        updated_at: new Date(),
      })
      .where("id", "=", attemptId)
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "ON_BREAK" as test_attempt_status)
      .returning("id")
      .executeTakeFirst();
    return Boolean(row);
  }

  /**
   * Rank and percentile for a score, against the test's CURRENT cohort.
   *
   * The values stored on the attempt were computed once at submit, against
   * whoever had finished by then, and never revisited. The cohort keeps growing
   * underneath them, so an early submitter is ranked among a handful of peers
   * and a late one among everybody: two learners with the same score on the
   * same test end up with different percentiles, and a zero score can show as
   * rank 1 purely for being submitted first.
   *
   * Recomputing on read makes equal scores produce equal numbers by
   * construction. Definitions are unchanged from what submit wrote, so values
   * stay comparable: rank counts strictly higher scores (ties share a rank),
   * percentile is the share scoring strictly lower.
   */
  async findCohortStats(
    tenantId: string,
    testId: string,
    score: number | null
  ): Promise<{ percentile: number | null; rank: number | null }> {
    if (score === null || Number.isNaN(score)) {
      return { percentile: null, rank: null };
    }
    const row = await db
      .selectFrom("test_attempts")
      .select([
        sql<string>`count(*)`.as("total"),
        sql<string>`count(*) filter (where score < ${score}::numeric)`.as("lower"),
        sql<string>`count(*) filter (where score > ${score}::numeric)`.as("higher"),
      ])
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .where("status", "in", ["SUBMITTED", "AUTO_SUBMITTED"] as test_attempt_status[])
      .where("score", "is not", null)
      .executeTakeFirst();

    const total = Number(row?.total ?? 0);
    if (total === 0) return { percentile: null, rank: null };
    const lower = Number(row?.lower ?? 0);
    const higher = Number(row?.higher ?? 0);
    return {
      percentile: Number(((lower / total) * 100).toFixed(2)),
      rank: higher + 1,
    };
  }

  async findAllScoresForTest(
    tenantId: string,
    testId: string
  ): Promise<Array<{ score: number }>> {
    const rows = await db
      .selectFrom("test_attempts")
      .select(["score"])
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .where("status", "in", ["SUBMITTED", "AUTO_SUBMITTED"] as test_attempt_status[])
      .where("score", "is not", null)
      .execute();
    return rows.map((r) => ({ score: Number(r.score ?? 0) }));
  }

  async findAllScaledScoresForTest(
    tenantId: string,
    testId: string
  ): Promise<Array<{ score: number }>> {
    const rows = await db
      .selectFrom("test_attempts")
      .select(["scaled_score"])
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .where("status", "in", ["SUBMITTED", "AUTO_SUBMITTED"] as test_attempt_status[])
      .where("scaled_score", "is not", null)
      .execute();
    return rows.map((r) => ({ score: Number(r.scaled_score ?? 0) }));
  }

  /** Append served question ids to the attempt's running list (adaptive modules). */
  async appendQuestionIds(
    attemptId: string,
    tenantId: string,
    ids: string[],
    trx?: Transaction<DB>
  ): Promise<void> {
    if (ids.length === 0) return;
    await (trx || db)
      .updateTable("test_attempts")
      .set({
        question_ids: sql`array_cat(question_ids, ${ids})`,
        updated_at: new Date(),
      } as never)
      .where("id", "=", attemptId)
      .where("tenant_id", "=", tenantId)
      .execute();
  }

  /**
   * Overwrite an attempt module's served question ids. Used to self-heal a
   * module that was created with an empty pool (e.g. a routed adaptive stage
   * whose questions were not sampled) so the learner is never shown an empty
   * section.
   */
  async setModuleQuestionIds(
    attemptModuleId: string,
    tenantId: string,
    scored: string[],
    pretest: string[],
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("test_attempt_modules")
      .set({
        question_ids: scored,
        pretest_ids: pretest,
        updated_at: new Date(),
      } as never)
      .where("id", "=", attemptModuleId)
      .where("tenant_id", "=", tenantId)
      .execute();
  }

  // ---- Attempt modules (adaptive) ----
  async findModules(
    attemptId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<TestAttemptModuleRow[]> {
    const rows = await (trx || db)
      .selectFrom("test_attempt_modules")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("attempt_id", "=", attemptId)
      .orderBy("order_index", "asc")
      .execute();
    return rows as unknown as TestAttemptModuleRow[];
  }

  async createAttemptModule(
    data: CreateAttemptModuleInput,
    trx?: Transaction<DB>
  ): Promise<TestAttemptModuleRow> {
    const id = ulid();
    const now = new Date();
    const row = await (trx || db)
      .insertInto("test_attempt_modules")
      .values({
        id,
        tenant_id: data.tenant_id,
        attempt_id: data.attempt_id,
        module_id: data.module_id,
        section_id: data.section_id,
        stage_no: data.stage_no,
        variant: data.variant,
        order_index: data.order_index,
        status: data.status as test_attempt_module_status,
        question_ids: data.question_ids,
        pretest_ids: data.pretest_ids,
        time_limit_sec: data.time_limit_sec,
        started_at: data.started_at ?? null,
        created_at: now,
        updated_at: now,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as unknown as TestAttemptModuleRow;
  }

  /**
   * CAS activation: PENDING -> IN_PROGRESS. Returns null when another worker
   * or tab already activated (or the row is gone), caller re-reads state.
   */
  async activateModule(
    attemptModuleId: string,
    tenantId: string,
    startedAt: Date,
    trx?: Transaction<DB>
  ): Promise<TestAttemptModuleRow | null> {
    const row = await (trx || db)
      .updateTable("test_attempt_modules")
      .set({
        status: "IN_PROGRESS" as test_attempt_module_status,
        started_at: startedAt,
        updated_at: new Date(),
      })
      .where("id", "=", attemptModuleId)
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "PENDING" as test_attempt_module_status)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestAttemptModuleRow) ?? null;
  }

  /**
   * CAS completion: IN_PROGRESS -> COMPLETED. Returns null when another
   * worker or tab won the race, caller re-reads state and responds
   * idempotently instead of double-routing.
   */
  async completeModule(
    attemptModuleId: string,
    tenantId: string,
    data: {
      completed_at: Date;
      raw_correct: number;
      raw_score: number;
      routed_to_variant?: string | null;
      auto_completed: boolean;
    },
    trx?: Transaction<DB>
  ): Promise<TestAttemptModuleRow | null> {
    const row = await (trx || db)
      .updateTable("test_attempt_modules")
      .set({
        status: "COMPLETED" as test_attempt_module_status,
        completed_at: data.completed_at,
        raw_correct: data.raw_correct,
        raw_score: data.raw_score as unknown as string,
        routed_to_variant: data.routed_to_variant ?? null,
        auto_completed: data.auto_completed,
        updated_at: new Date(),
      })
      .where("id", "=", attemptModuleId)
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "IN_PROGRESS" as test_attempt_module_status)
      .returningAll()
      .executeTakeFirst();
    return (row as unknown as TestAttemptModuleRow) ?? null;
  }

  // ---- Answers ----
  async findAnswers(
    attemptId: string,
    tenantId: string
  ): Promise<TestAttemptAnswerRow[]> {
    const rows = await db
      .selectFrom("test_attempt_answers")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("attempt_id", "=", attemptId)
      .execute();
    return rows as unknown as TestAttemptAnswerRow[];
  }

  async upsertAnswer(
    data: UpsertAnswerInput,
    trx?: Transaction<DB>
  ): Promise<void> {
    const id = ulid();
    const now = new Date();
    const answerJson =
      data.answer === null || data.answer === undefined
        ? null
        : serializeJson(data.answer);
    await (trx || db)
      .insertInto("test_attempt_answers")
      .values({
        id,
        attempt_id: data.attempt_id,
        tenant_id: data.tenant_id,
        question_id: data.question_id,
        answer: answerJson,
        time_spent_sec: data.time_spent_sec ?? 0,
        marked_for_review: data.marked_for_review ?? false,
        created_at: now,
        updated_at: now,
      } as never)
      .onConflict((oc) =>
        oc.columns(["attempt_id", "question_id"]).doUpdateSet({
          answer: answerJson,
          time_spent_sec: data.time_spent_sec ?? 0,
          marked_for_review: data.marked_for_review ?? false,
          updated_at: now,
        } as never)
      )
      .execute();
  }

  async updateAnswerCorrectness(
    answerId: string,
    tenantId: string,
    isCorrect: boolean,
    marksAwarded: number,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("test_attempt_answers")
      .set({
        is_correct: isCorrect,
        marks_awarded: marksAwarded as unknown as string,
        grading_status: "AUTO_GRADED",
        updated_at: new Date(),
      })
      .where("id", "=", answerId)
      .where("tenant_id", "=", tenantId)
      .execute();
  }

  /**
   * Flag a descriptive answer for manual grading: correctness + marks stay null
   * (excluded from the auto score) until an evaluator marks it.
   */
  async markAnswerPendingReview(
    answerId: string,
    tenantId: string,
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("test_attempt_answers")
      .set({
        is_correct: null,
        marks_awarded: null,
        grading_status: "PENDING_REVIEW",
        graded_by: null,
        graded_at: null,
        updated_at: new Date(),
      })
      .where("id", "=", answerId)
      .where("tenant_id", "=", tenantId)
      .execute();
  }
}

export default new TestAttemptsRepository();
