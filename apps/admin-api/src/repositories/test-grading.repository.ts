import type { Transaction } from "kysely";
import { sql } from "kysely";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import { attemptTotalMarksSql } from "../utils/attempt-total-marks.util";

/**
 * Data access for the evaluator manual-grading flow (descriptive test-series
 * questions). Attempts land in grading_status = PENDING_REVIEW after submit;
 * an evaluator marks each descriptive answer, and once all are marked the
 * attempt score is recomputed and grading_status flips to COMPLETED.
 */
class TestGradingRepository {
  /** Attempts with descriptive answers still awaiting a manual grade. */
  async listPendingAttempts(
    tenantId: string,
    params: { testId?: string; seriesId?: string; page: number; limit: number }
  ) {
    const offset = (params.page - 1) * params.limit;

    let listQuery = db
      .selectFrom("test_attempts as a")
      .innerJoin("tests as t", "t.id", "a.test_id")
      .leftJoin("test_series as ts", "ts.id", "a.test_series_id")
      .leftJoin("tenant_members as m", "m.id", "a.learner_id")
      .select([
        "a.id as attempt_id",
        "a.test_id",
        "a.test_series_id",
        "a.submitted_at",
        "a.grading_status",
        "a.score",
        "t.name as test_name",
        "ts.title as series_title",
        "m.name as learner_name",
        "m.email as learner_email",
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.grading_status", "=", "PENDING_REVIEW");

    let countQuery = db
      .selectFrom("test_attempts")
      .select(db.fn.count<number>("id").as("total"))
      .where("tenant_id", "=", tenantId)
      .where("grading_status", "=", "PENDING_REVIEW");

    if (params.testId) {
      listQuery = listQuery.where("a.test_id", "=", params.testId);
      countQuery = countQuery.where("test_id", "=", params.testId);
    }
    if (params.seriesId) {
      listQuery = listQuery.where("a.test_series_id", "=", params.seriesId);
      countQuery = countQuery.where("test_series_id", "=", params.seriesId);
    }

    const [rows, totalRow] = await Promise.all([
      listQuery
        .orderBy("a.submitted_at", "asc")
        .limit(params.limit)
        .offset(offset)
        .execute(),
      countQuery.executeTakeFirst(),
    ]);

    const attemptIds = rows.map((r) => r.attempt_id);
    const counts = attemptIds.length
      ? await db
          .selectFrom("test_attempt_answers")
          .select(["attempt_id", db.fn.count<number>("id").as("cnt")])
          .where("tenant_id", "=", tenantId)
          .where("grading_status", "=", "PENDING_REVIEW")
          .where("attempt_id", "in", attemptIds)
          .groupBy("attempt_id")
          .execute()
      : [];
    const pendingByAttempt = new Map(
      counts.map((c) => [c.attempt_id, Number(c.cnt)])
    );

    return {
      attempts: rows.map((r) => ({
        ...r,
        pending_count: pendingByAttempt.get(r.attempt_id) ?? 0,
      })),
      total: Number(totalRow?.total ?? 0),
    };
  }

  /** An attempt + its descriptive answers (with question stem + max marks). */
  async getAttemptForGrading(tenantId: string, attemptId: string) {
    const attempt = await db
      .selectFrom("test_attempts as a")
      .innerJoin("tests as t", "t.id", "a.test_id")
      .leftJoin("test_series as ts", "ts.id", "a.test_series_id")
      .leftJoin("tenant_members as m", "m.id", "a.learner_id")
      .select([
        "a.id",
        "a.test_id",
        "a.test_series_id",
        "a.grading_status",
        "a.score",
        "a.submitted_at",
        "t.name as test_name",
        attemptTotalMarksSql().as("total_marks"),
        "ts.title as series_title",
        "m.name as learner_name",
        "m.email as learner_email",
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.id", "=", attemptId)
      .executeTakeFirst();
    if (!attempt) return null;

    const answers = await db
      .selectFrom("test_attempt_answers as ans")
      .innerJoin("test_questions as q", "q.id", "ans.question_id")
      .select([
        "ans.id as answer_id",
        "ans.question_id",
        "ans.answer",
        "ans.marks_awarded",
        "ans.grading_status",
        "ans.grader_remarks",
        "ans.graded_at",
        "q.stem",
        "q.marks",
        "q.explanation",
      ])
      .where("ans.tenant_id", "=", tenantId)
      .where("ans.attempt_id", "=", attemptId)
      .where("q.type", "=", "DESCRIPTIVE")
      .orderBy("ans.created_at", "asc")
      .execute();

    return { attempt, answers };
  }

  /** The answer + its question type/max-marks (for grade validation). */
  async findAnswerWithQuestion(tenantId: string, answerId: string) {
    return db
      .selectFrom("test_attempt_answers as ans")
      .innerJoin("test_questions as q", "q.id", "ans.question_id")
      .select([
        "ans.id",
        "ans.attempt_id",
        "ans.grading_status",
        "q.marks",
        "q.type",
      ])
      .where("ans.tenant_id", "=", tenantId)
      .where("ans.id", "=", answerId)
      .executeTakeFirst();
  }

  /** Persist a manual grade on a single descriptive answer. */
  async gradeAnswer(
    tenantId: string,
    answerId: string,
    data: { marksAwarded: number; gradedBy: string | null; remarks: string | null },
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("test_attempt_answers")
      .set({
        marks_awarded: data.marksAwarded as unknown as string,
        grading_status: "MANUALLY_GRADED",
        graded_by: data.gradedBy,
        graded_at: new Date(),
        grader_remarks: data.remarks,
        updated_at: new Date(),
      })
      .where("id", "=", answerId)
      .where("tenant_id", "=", tenantId)
      .execute();
  }

  /** Remaining pending descriptive answers + the sum of ALL awarded marks. */
  async getAttemptGradingSummary(
    tenantId: string,
    attemptId: string,
    trx?: Transaction<DB>
  ): Promise<{ pendingCount: number; awardedTotal: number }> {
    const runner = trx || db;
    const [pending, sum] = await Promise.all([
      runner
        .selectFrom("test_attempt_answers")
        .select(db.fn.count<number>("id").as("cnt"))
        .where("tenant_id", "=", tenantId)
        .where("attempt_id", "=", attemptId)
        .where("grading_status", "=", "PENDING_REVIEW")
        .executeTakeFirst(),
      runner
        .selectFrom("test_attempt_answers")
        .select(sql<string>`coalesce(sum(marks_awarded), 0)`.as("total"))
        .where("tenant_id", "=", tenantId)
        .where("attempt_id", "=", attemptId)
        .executeTakeFirst(),
    ]);
    return {
      pendingCount: Number(pending?.cnt ?? 0),
      awardedTotal: Number(sum?.total ?? 0),
    };
  }

  /**
   * Attempt + the marks it was graded out of, used to recompute the score.
   *
   * Must be the attempt's own served total, not `tests.total_marks`, a
   * random-X / blueprint test serves a different subset to every learner, so
   * using the test total here would overwrite the percentage learner-api
   * computed at submit with one measured against the wrong denominator.
   */
  async findAttempt(tenantId: string, attemptId: string) {
    return db
      .selectFrom("test_attempts as a")
      .innerJoin("tests as t", "t.id", "a.test_id")
      .select([
        "a.id",
        "a.test_id",
        attemptTotalMarksSql().as("total_marks"),
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.id", "=", attemptId)
      .executeTakeFirst();
  }

  async updateAttemptScore(
    tenantId: string,
    attemptId: string,
    data: { score: number; percentage: number; gradingStatus: string },
    trx?: Transaction<DB>
  ): Promise<void> {
    await (trx || db)
      .updateTable("test_attempts")
      .set({
        score: data.score as unknown as string,
        percentage: data.percentage as unknown as string,
        grading_status: data.gradingStatus as "COMPLETED" | "PENDING_REVIEW",
        updated_at: new Date(),
      })
      .where("id", "=", attemptId)
      .where("tenant_id", "=", tenantId)
      .execute();
  }
}

export default new TestGradingRepository();
