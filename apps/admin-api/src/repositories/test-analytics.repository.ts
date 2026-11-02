import { db } from "../db/connection";
import { attemptTotalMarksSql } from "../utils/attempt-total-marks.util";
import {
  attemptPercentileSql,
  attemptRankSql,
} from "../utils/attempt-rank.util";

/**
 * Read-only aggregation queries for per-test analytics (tenant admin).
 * All attempt/answer data lives in the same Postgres the tenant-admin backend
 * connects to, so we query it directly, no learner-api round trip.
 *
 * Strategy: pull the (modest) per-test attempt rows and per-question answer
 * rows in two indexed queries, then aggregate in the service (median, buckets,
 * topic/difficulty rollups). Keeps SQL simple and the heavy shaping in JS.
 */

export interface TestMetaRow {
  id: string;
  title: string;
  mode: string;
  pass_criteria_pct: string | null;
  total_marks: string | number | null;
}

export interface AttemptRow {
  id: string;
  learner_id: string;
  learner_name: string | null;
  learner_email: string | null;
  status: string;
  score: string | null;
  percentage: string | null;
  percentile: string | null;
  rank: number | null;
  tab_switch_count: number;
  started_at: Date | string;
  submitted_at: Date | string | null;
  /** Only populated for series queries, the attempt's own test pass criteria. */
  pass_criteria_pct?: string | null;
}

export interface SeriesMetaRow {
  id: string;
  title: string;
}

export interface AnswerRow {
  question_id: string;
  is_correct: boolean | null;
  marks_awarded: string | null;
  time_spent_sec: number;
  q_type: string;
  q_difficulty: string | null;
  q_subject: string | null;
  q_topic: string | null;
  q_stem: unknown;
}


export interface RawAttemptRow {
  id: string;
  test_id: string;
  test_name: string | null;
  learner_id: string;
  learner_name: string | null;
  learner_email: string | null;
  learner_phone: string | null;
  status: string;
  grading_status: string;
  score: string | null;
  attempt_total_marks: string | null;
  percentage: string | null;
  percentile: string | null;
  rank: number | null;
  scaled_score: string | null;
  scaled_score_max: number | null;
  tab_switch_count: number;
  started_at: Date | string;
  submitted_at: Date | string | null;
}

export interface RawAnswerRow {
  attempt_id: string;
  test_id: string;
  test_name: string | null;
  learner_name: string | null;
  learner_email: string | null;
  status: string;
  question_id: string;
  q_type: string;
  q_difficulty: string | null;
  q_subject: string | null;
  q_chapter: string | null;
  q_topic: string | null;
  q_stem: unknown;
  q_options: unknown;
  q_correct_answer: unknown;
  learner_answer: unknown;
  is_correct: boolean | null;
  marks_awarded: string | null;
  q_marks: string | null;
  q_negative_marks: string | null;
  time_spent_sec: number;
  marked_for_review: boolean;
  grading_status: string;
  submitted_at: Date | string | null;
}

class TestAnalyticsRepository {
  async getTestMeta(
    tenantId: string,
    testId: string
  ): Promise<TestMetaRow | undefined> {
    return db
      .selectFrom("tests")
      .select(["id", "name as title", "mode", "pass_criteria_pct", "total_marks"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", testId)
      .executeTakeFirst() as Promise<TestMetaRow | undefined>;
  }

  /** Count of questions configured on the test (section questions). */
  async getQuestionCount(tenantId: string, testId: string): Promise<number> {
    const row = await db
      .selectFrom("test_section_questions")
      .select((eb) => eb.fn.countAll().as("c"))
      .where("tenant_id", "=", tenantId)
      .where("test_id", "=", testId)
      .executeTakeFirst();
    const c = (row as { c?: unknown })?.c;
    return typeof c === "string" ? parseInt(c, 10) : Number(c ?? 0);
  }

  /** All attempts for the test, with learner identity. */
  async getAttempts(tenantId: string, testId: string): Promise<AttemptRow[]> {
    return db
      .selectFrom("test_attempts as a")
      .innerJoin("tenant_members as m", "m.id", "a.learner_id")
      .select([
        "a.id as id",
        "a.learner_id as learner_id",
        "m.name as learner_name",
        "m.email as learner_email",
        "a.status as status",
        "a.score as score",
        "a.percentage as percentage",
        "a.percentile as percentile",
        "a.rank as rank",
        "a.tab_switch_count as tab_switch_count",
        "a.started_at as started_at",
        "a.submitted_at as submitted_at",
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.test_id", "=", testId)
      .orderBy("a.score", "desc")
      .execute() as Promise<AttemptRow[]>;
  }

  /**
   * Every answer row across this test's attempts, joined to question metadata.
   * Drives per-question, difficulty, and topic/subject aggregation.
   */
  async getAnswerRows(tenantId: string, testId: string): Promise<AnswerRow[]> {
    return db
      .selectFrom("test_attempt_answers as ans")
      .innerJoin("test_attempts as a", "a.id", "ans.attempt_id")
      .innerJoin("test_questions as q", "q.id", "ans.question_id")
      .select([
        "ans.question_id as question_id",
        "ans.is_correct as is_correct",
        "ans.marks_awarded as marks_awarded",
        "ans.time_spent_sec as time_spent_sec",
        "q.type as q_type",
        "q.difficulty as q_difficulty",
        "q.subject as q_subject",
        "q.topic as q_topic",
        "q.stem as q_stem",
      ])
      .where("ans.tenant_id", "=", tenantId)
      .where("a.test_id", "=", testId)
      .where("a.status", "in", ["SUBMITTED", "AUTO_SUBMITTED"])
      .execute() as Promise<AnswerRow[]>;
  }

  // ── Series-level (aggregate across every test in a series) ───────────────

  async getSeriesMeta(
    tenantId: string,
    seriesId: string
  ): Promise<SeriesMetaRow | undefined> {
    return db
      .selectFrom("test_series")
      .select(["id", "title"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", seriesId)
      .executeTakeFirst() as Promise<SeriesMetaRow | undefined>;
  }

  /** Test IDs that belong to a series. */
  async getSeriesTestIds(tenantId: string, seriesId: string): Promise<string[]> {
    const rows = await db
      .selectFrom("test_series_tests")
      .select(["test_id"])
      .where("tenant_id", "=", tenantId)
      .where("test_series_id", "=", seriesId)
      .execute();
    return rows.map((r) => r.test_id as string);
  }

  /** Combined question count across a set of tests. */
  async getQuestionCountForTests(
    tenantId: string,
    testIds: string[]
  ): Promise<number> {
    if (testIds.length === 0) return 0;
    const row = await db
      .selectFrom("test_section_questions")
      .select((eb) => eb.fn.countAll().as("c"))
      .where("tenant_id", "=", tenantId)
      .where("test_id", "in", testIds)
      .executeTakeFirst();
    const c = (row as { c?: unknown })?.c;
    return typeof c === "string" ? parseInt(c, 10) : Number(c ?? 0);
  }

  /** All attempts across a set of tests, with each attempt's pass criteria. */
  async getAttemptsForTests(
    tenantId: string,
    testIds: string[]
  ): Promise<AttemptRow[]> {
    if (testIds.length === 0) return [];
    return db
      .selectFrom("test_attempts as a")
      .innerJoin("tenant_members as m", "m.id", "a.learner_id")
      .innerJoin("tests as t", "t.id", "a.test_id")
      .select([
        "a.id as id",
        "a.learner_id as learner_id",
        "m.name as learner_name",
        "m.email as learner_email",
        "a.status as status",
        "a.score as score",
        "a.percentage as percentage",
        "a.percentile as percentile",
        "a.rank as rank",
        "a.tab_switch_count as tab_switch_count",
        "a.started_at as started_at",
        "a.submitted_at as submitted_at",
        "t.pass_criteria_pct as pass_criteria_pct",
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.test_id", "in", testIds)
      .orderBy("a.score", "desc")
      .execute() as Promise<AttemptRow[]>;
  }

  /** Every answer row across a set of tests' submitted attempts. */
  async getAnswerRowsForTests(
    tenantId: string,
    testIds: string[]
  ): Promise<AnswerRow[]> {
    if (testIds.length === 0) return [];
    return db
      .selectFrom("test_attempt_answers as ans")
      .innerJoin("test_attempts as a", "a.id", "ans.attempt_id")
      .innerJoin("test_questions as q", "q.id", "ans.question_id")
      .select([
        "ans.question_id as question_id",
        "ans.is_correct as is_correct",
        "ans.marks_awarded as marks_awarded",
        "ans.time_spent_sec as time_spent_sec",
        "q.type as q_type",
        "q.difficulty as q_difficulty",
        "q.subject as q_subject",
        "q.topic as q_topic",
        "q.stem as q_stem",
      ])
      .where("ans.tenant_id", "=", tenantId)
      .where("a.test_id", "in", testIds)
      .where("a.status", "in", ["SUBMITTED", "AUTO_SUBMITTED"])
      .execute() as Promise<AnswerRow[]>;
  }

  /**
   * EVERY attempt, one row each.
   *
   * Distinct from the analytics `learners` array, which keeps only each
   * learner's best attempt and therefore hides re-attempts. A tenant analysing
   * the raw data needs all of them, including in-progress ones, which is what
   * the export sheet is for.
   *
   * Carries the per-attempt denominator and a live percentile and rank, so the
   * sheet matches the attempts report rather than the frozen at-submit values.
   */
  async getRawAttempts(
    tenantId: string,
    testIds: string[]
  ): Promise<RawAttemptRow[]> {
    if (testIds.length === 0) return [];
    return db
      .selectFrom("test_attempts as a")
      .leftJoin("tests as t", "t.id", "a.test_id")
      .leftJoin("tenant_members as m", "m.id", "a.learner_id")
      .select([
        "a.id as id",
        "a.test_id as test_id",
        "t.name as test_name",
        "a.learner_id as learner_id",
        "m.name as learner_name",
        "m.email as learner_email",
        "m.phone as learner_phone",
        "a.status as status",
        "a.grading_status as grading_status",
        "a.score as score",
        "a.percentage as percentage",
        "a.scaled_score as scaled_score",
        "a.scaled_score_max as scaled_score_max",
        "a.tab_switch_count as tab_switch_count",
        "a.started_at as started_at",
        "a.submitted_at as submitted_at",
        attemptTotalMarksSql().as("attempt_total_marks"),
        attemptPercentileSql().as("percentile"),
        attemptRankSql().as("rank"),
      ])
      .where("a.tenant_id", "=", tenantId)
      .where("a.test_id", "in", testIds)
      .orderBy("m.name", "asc")
      .orderBy("a.started_at", "asc")
      .limit(50000)
      .execute() as Promise<RawAttemptRow[]>;
  }

  /**
   * One row per learner per question, for the raw sheet in the export.
   *
   * The aggregated sheets answer "how did the cohort do"; this is the table
   * underneath them, so a tenant can pivot it however they like. Scoped to the
   * given tests and capped, since a large batch multiplies out fast.
   */
  async getRawAnswerRows(
    tenantId: string,
    testIds: string[]
  ): Promise<RawAnswerRow[]> {
    if (testIds.length === 0) return [];
    return db
      .selectFrom("test_attempt_answers as ans")
      .innerJoin("test_attempts as a", "a.id", "ans.attempt_id")
      .innerJoin("test_questions as q", "q.id", "ans.question_id")
      .leftJoin("tests as t", "t.id", "a.test_id")
      .leftJoin("tenant_members as m", "m.id", "a.learner_id")
      .select([
        "a.id as attempt_id",
        "a.test_id as test_id",
        "t.name as test_name",
        "m.name as learner_name",
        "m.email as learner_email",
        "a.status as status",
        "a.submitted_at as submitted_at",
        "ans.question_id as question_id",
        "q.type as q_type",
        "q.difficulty as q_difficulty",
        "q.subject as q_subject",
        "q.chapter as q_chapter",
        "q.topic as q_topic",
        "q.stem as q_stem",
        "q.options as q_options",
        "q.correct_answer as q_correct_answer",
        "q.marks as q_marks",
        "q.negative_marks as q_negative_marks",
        "ans.answer as learner_answer",
        "ans.is_correct as is_correct",
        "ans.marks_awarded as marks_awarded",
        "ans.time_spent_sec as time_spent_sec",
        "ans.marked_for_review as marked_for_review",
        "ans.grading_status as grading_status",
      ])
      .where("ans.tenant_id", "=", tenantId)
      .where("a.test_id", "in", testIds)
      .where("a.status", "in", ["SUBMITTED", "AUTO_SUBMITTED"])
      .orderBy("m.name", "asc")
      .orderBy("a.id", "asc")
      .limit(100000)
      .execute() as Promise<RawAnswerRow[]>;
  }
}

export const testAnalyticsRepository = new TestAnalyticsRepository();
export default testAnalyticsRepository;
