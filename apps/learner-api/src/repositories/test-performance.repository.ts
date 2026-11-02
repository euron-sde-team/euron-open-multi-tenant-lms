import { sql } from "kysely";

import { db } from "../db/connection";

export interface PerfFactRow {
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  difficulty: string;
  type: string;
  total: number;
  correct: number;
}

export interface RecentActivityRow {
  source: "TEST";
  id: string;
  title: string | null;
  score: number | null;
  totalMarks: number | null;
  at: string;
}

function num(v: unknown): number {
  return typeof v === "string" ? parseInt(v, 10) : Number(v ?? 0);
}

class TestPerformanceRepository {
  /**
   * Per (subject, chapter, topic, difficulty, type) answer facts for a learner,
   * from REAL test attempts (graded answers only). The service rolls these up.
   */
  async attemptFacts(
    tenantId: string,
    learnerId: string
  ): Promise<PerfFactRow[]> {
    const rows = await db
      .selectFrom("test_attempt_answers as a")
      .innerJoin("test_attempts as t", "t.id", "a.attempt_id")
      .innerJoin("test_questions as q", "q.id", "a.question_id")
      .select(["q.subject", "q.chapter", "q.topic", "q.difficulty", "q.type"])
      .select(sql<string>`count(*)`.as("total"))
      .select(sql<string>`count(*) filter (where a.is_correct)`.as("correct"))
      .where("t.tenant_id", "=", tenantId)
      .where("t.learner_id", "=", learnerId)
      .where("a.is_correct", "is not", null)
      .groupBy(["q.subject", "q.chapter", "q.topic", "q.difficulty", "q.type"])
      .execute();
    return rows.map((r) => ({
      subject: r.subject,
      chapter: r.chapter,
      topic: r.topic,
      difficulty: String(r.difficulty),
      type: String(r.type),
      total: num(r.total),
      correct: num(r.correct),
    }));
  }

  /** Recent finished test attempts, newest first. */
  async recentActivity(
    tenantId: string,
    learnerId: string,
    limit: number
  ): Promise<RecentActivityRow[]> {
    const attempts = await db
      .selectFrom("test_attempts as t")
      .innerJoin("tests", "tests.id", "t.test_id")
      .select(["t.id", "tests.name as title", "t.scaled_score", "t.score", "t.scaled_score_max", "t.submitted_at"])
      .where("t.tenant_id", "=", tenantId)
      .where("t.learner_id", "=", learnerId)
      .where("t.status", "in", ["SUBMITTED", "AUTO_SUBMITTED"] as never[])
      .orderBy("t.submitted_at", "desc")
      .limit(limit)
      .execute();
    const toIso = (v: unknown): string =>
      v instanceof Date ? v.toISOString() : String(v ?? "");
    const merged: RecentActivityRow[] = [
      ...attempts.map((a) => ({
        source: "TEST" as const,
        id: a.id,
        title: a.title,
        score:
          a.scaled_score !== null
            ? Number(a.scaled_score)
            : a.score !== null
              ? Number(a.score)
              : null,
        totalMarks: a.scaled_score_max ?? null,
        at: toIso(a.submitted_at),
      })),
    ];
    return merged
      .sort((x, y) => (x.at < y.at ? 1 : -1))
      .slice(0, limit);
  }
}

export default new TestPerformanceRepository();
