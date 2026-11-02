import { sql } from "kysely";

import { db } from "../db/connection";
import type { test_attempt_status } from "../db/enums";

export interface LeaderEntry {
  learnerId: string;
  name: string;
  avatarUrl: string | null;
  value: number;
  meta?: number;
}

function num(v: unknown): number {
  return typeof v === "string" ? Number(v) : Number(v ?? 0);
}

class EngagementRepository {
  /**
   * Best score per learner on a test (scaled when present, else raw), ranked
   * desc. Returns the FULL ranked list so the service can both slice the top-N
   * and locate the caller's own rank.
   */
  async testLeaderboard(
    tenantId: string,
    testId: string
  ): Promise<LeaderEntry[]> {
    const rows = await db
      .selectFrom("test_attempts as t")
      .innerJoin("tenant_members as m", "m.id", "t.learner_id")
      .select(["t.learner_id", "m.name", "m.avatar_url"])
      .select(sql<string>`max(coalesce(t.scaled_score, t.score))`.as("best"))
      .select(sql<string>`count(*)`.as("attempts"))
      .where("t.tenant_id", "=", tenantId)
      .where("t.test_id", "=", testId)
      .where("t.status", "in", [
        "SUBMITTED",
        "AUTO_SUBMITTED",
      ] as test_attempt_status[])
      .groupBy(["t.learner_id", "m.name", "m.avatar_url"])
      .orderBy("best", "desc")
      .execute();
    return rows.map((r) => ({
      learnerId: r.learner_id,
      name: r.name,
      avatarUrl: r.avatar_url,
      value: num(r.best),
      meta: num(r.attempts),
    }));
  }

  /** Distinct UTC activity dates (YYYY-MM-DD) for a learner (test attempts). */
  async learnerActivityDates(
    tenantId: string,
    learnerId: string
  ): Promise<string[]> {
    const rows = await db
      .selectFrom("test_attempts")
      .select(sql<string>`to_char(started_at at time zone 'UTC', 'YYYY-MM-DD')`.as("d"))
      .where("tenant_id", "=", tenantId)
      .where("learner_id", "=", learnerId)
      .distinct()
      .execute();
    return Array.from(new Set(rows.map((r) => r.d))).sort();
  }
}

export default new EngagementRepository();
