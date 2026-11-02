import { db } from "../db/connection";

/**
 * Aggregates behind the composite exam endpoints.
 *
 * Both queries exist because the honest answer to an admin's question needs
 * numbers from several tables at once, and getting them by walking a list and
 * querying per row is the thing this codebase does not do. "How many hard
 * physics questions have I got?" is one GROUP BY, not one query per bank; the
 * evaluator's queue is one join, not one query per attempt.
 */
class ExamWorkflowsRepository {
  /**
   * Question counts per bank, split by subject, difficulty and status.
   *
   * One grouped scan for the whole workspace; the service folds the rows into
   * a per-bank shape. Banks with no questions still have to appear, which is
   * why the bank list is joined from the left.
   */
  async questionCounts(
    tenantId: string,
    bankId?: string
  ): Promise<
    Array<{
      bank_id: string;
      bank_name: string;
      subject: string | null;
      difficulty: string | null;
      status: string | null;
      count: number;
    }>
  > {
    let query = db
      .selectFrom("test_question_banks as b")
      .leftJoin("test_questions as q", (join) =>
        join.onRef("q.question_bank_id", "=", "b.id").on("q.tenant_id", "=", tenantId)
      )
      .select(({ fn }) => [
        "b.id as bank_id",
        "b.name as bank_name",
        "q.subject as subject",
        "q.difficulty as difficulty",
        "q.status as status",
        fn.count<number>("q.id").as("count"),
      ])
      .where("b.tenant_id", "=", tenantId)
      .groupBy(["b.id", "b.name", "q.subject", "q.difficulty", "q.status"])
      .orderBy("b.name", "asc");

    if (bankId) query = query.where("b.id", "=", bankId);

    const rows = await query.execute();
    return rows.map((r) => ({
      bank_id: String(r.bank_id),
      bank_name: String(r.bank_name),
      subject: r.subject == null ? null : String(r.subject),
      difficulty: r.difficulty == null ? null : String(r.difficulty),
      status: r.status == null ? null : String(r.status),
      count: Number(r.count ?? 0),
    }));
  }

  /**
   * Every descriptive answer still waiting for a person, with the attempt and
   * the question it belongs to.
   *
   * The evaluator screen asks two questions at once ("which attempts are
   * waiting?" and "what do I have to read?") and the existing pair of routes
   * answers them one attempt at a time. This answers both in a single pass so
   * the whole queue is one call.
   */
  async pendingAnswers(
    tenantId: string,
    params: { testId?: string; seriesId?: string; limit: number }
  ) {
    let query = db
      .selectFrom("test_attempt_answers as ans")
      .innerJoin("test_attempts as a", "a.id", "ans.attempt_id")
      .innerJoin("test_questions as q", "q.id", "ans.question_id")
      .innerJoin("tests as t", "t.id", "a.test_id")
      .leftJoin("test_series as ts", "ts.id", "a.test_series_id")
      .leftJoin("tenant_members as m", "m.id", "a.learner_id")
      .select([
        "ans.id as answer_id",
        "ans.answer as answer",
        "ans.marks_awarded as marks_awarded",
        "a.id as attempt_id",
        "a.submitted_at as submitted_at",
        "q.id as question_id",
        "q.stem as stem",
        "q.marks as max_marks",
        "t.id as test_id",
        "t.name as test_name",
        "ts.title as series_title",
        "m.name as learner_name",
        "m.email as learner_email",
      ])
      .where("ans.tenant_id", "=", tenantId)
      .where("ans.grading_status", "=", "PENDING_REVIEW")
      .where("q.type", "=", "DESCRIPTIVE")
      .orderBy("a.submitted_at", "asc")
      .limit(params.limit);

    if (params.testId) query = query.where("a.test_id", "=", params.testId);
    if (params.seriesId) query = query.where("a.test_series_id", "=", params.seriesId);

    return query.execute();
  }

  /** How many answers are waiting in total, so a truncated queue can say so. */
  async pendingAnswerCount(
    tenantId: string,
    params: { testId?: string; seriesId?: string }
  ): Promise<number> {
    let query = db
      .selectFrom("test_attempt_answers as ans")
      .innerJoin("test_attempts as a", "a.id", "ans.attempt_id")
      .innerJoin("test_questions as q", "q.id", "ans.question_id")
      .select(({ fn }) => fn.count<number>("ans.id").as("total"))
      .where("ans.tenant_id", "=", tenantId)
      .where("ans.grading_status", "=", "PENDING_REVIEW")
      .where("q.type", "=", "DESCRIPTIVE");

    if (params.testId) query = query.where("a.test_id", "=", params.testId);
    if (params.seriesId) query = query.where("a.test_series_id", "=", params.seriesId);

    const row = await query.executeTakeFirst();
    return Number(row?.total ?? 0);
  }
}

const examWorkflowsRepository = new ExamWorkflowsRepository();
export default examWorkflowsRepository;
