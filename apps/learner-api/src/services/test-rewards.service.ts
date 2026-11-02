import { ulid } from "ulid";

import { db } from "../db/connection";
import logger from "../utils/logger";
import certificateService from "./certificate.service";

interface ScholarshipTier {
  min: number;
  label: string;
  amount?: number;
  currency?: string;
}

export interface AttemptRewards {
  certificateNumber: string | null;
  /** Newly-flagged (PENDING) scholarship awards from this attempt. */
  scholarships: Array<{ name: string; tierLabel: string; status: string }>;
}

function parseTiers(raw: unknown): ScholarshipTier[] {
  const arr = typeof raw === "string" ? safeJson(raw) : raw;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      min: Number(t.min ?? NaN),
      label: String(t.label ?? ""),
      amount: t.amount != null ? Number(t.amount) : undefined,
      currency: t.currency != null ? String(t.currency) : undefined,
    }))
    .filter((t) => Number.isFinite(t.min));
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Highest tier whose `min` the value clears, or null. */
function pickTier(tiers: ScholarshipTier[], value: number): ScholarshipTier | null {
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  for (const t of sorted) if (value >= t.min) return t;
  return null;
}

class TestRewardsService {
  /**
   * Run once after an attempt is graded: auto-issue a certificate if earned and
   * flag any qualifying scholarship awards (PENDING, for admin review). Entirely
   * best-effort, never throws into the submit path.
   */
  async onAttemptGraded(params: {
    tenantId: string;
    memberId: string;
    testId: string;
    seriesId: string | null;
    attemptId: string;
    percentage: number;
    scaledScore: number | null;
  }): Promise<AttemptRewards> {
    const out: AttemptRewards = { certificateNumber: null, scholarships: [] };
    try {
      const test = await db
        .selectFrom("tests")
        .select(["certificate_enabled", "certificate_min_score_pct"])
        .where("id", "=", params.testId)
        .where("tenant_id", "=", params.tenantId)
        .executeTakeFirst();

      if (test?.certificate_enabled) {
        const minPct =
          test.certificate_min_score_pct != null
            ? Number(test.certificate_min_score_pct)
            : null;
        const cert = await certificateService.issueTestCertificateIfEarned({
          tenantId: params.tenantId,
          memberId: params.memberId,
          testId: params.testId,
          attemptId: params.attemptId,
          percentage: params.percentage,
          minScorePct: minPct,
        });
        out.certificateNumber = cert?.certificateNumber ?? null;
      }
    } catch (err) {
      logger.warn("[test-rewards] certificate issue failed", {
        attemptId: params.attemptId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      out.scholarships = await this.flagScholarships(params);
    } catch (err) {
      logger.warn("[test-rewards] scholarship flagging failed", {
        attemptId: params.attemptId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return out;
  }

  /**
   * Issue rewards for one already-graded attempt, loading its final score from the
   * DB. Called by the internal endpoint that tenant-admin pings the moment an
   * evaluator finishes marking, so the certificate is issued (and emailed) without
   * waiting for the learner to reopen their result. Only acts on COMPLETED attempts
   * (descriptive grading done); onAttemptGraded is idempotent, so double-firing with
   * the on-read path is safe.
   */
  async issueForAttempt(
    tenantId: string,
    attemptId: string
  ): Promise<{ issued: boolean; reason?: string; certificateNumber?: string | null }> {
    const attempt = await db
      .selectFrom("test_attempts")
      .select([
        "id",
        "learner_id",
        "test_id",
        "test_series_id",
        "percentage",
        "scaled_score",
        "grading_status",
      ])
      .where("id", "=", attemptId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!attempt) return { issued: false, reason: "not_found" };
    if (String(attempt.grading_status) !== "COMPLETED") {
      return { issued: false, reason: "not_completed" };
    }

    const result = await this.onAttemptGraded({
      tenantId,
      memberId: attempt.learner_id,
      testId: attempt.test_id,
      seriesId: attempt.test_series_id,
      attemptId: attempt.id,
      percentage: Number(attempt.percentage ?? 0),
      scaledScore:
        attempt.scaled_score != null ? Number(attempt.scaled_score) : null,
    });
    return { issued: true, certificateNumber: result.certificateNumber };
  }

  private async flagScholarships(params: {
    tenantId: string;
    memberId: string;
    testId: string;
    seriesId: string | null;
    attemptId: string;
    percentage: number;
    scaledScore: number | null;
  }): Promise<AttemptRewards["scholarships"]> {
    // Scholarships mapped to this test OR its series.
    let q = db
      .selectFrom("test_scholarships")
      .select(["id", "name", "basis", "tiers"])
      .where("tenant_id", "=", params.tenantId)
      .where("status", "=", "ACTIVE");
    q = params.seriesId
      ? q.where((eb) =>
          eb.or([
            eb("test_id", "=", params.testId),
            eb("test_series_id", "=", params.seriesId),
          ])
        )
      : q.where("test_id", "=", params.testId);
    const scholarships = await q.execute();

    const flagged: AttemptRewards["scholarships"] = [];
    for (const s of scholarships) {
      const tiers = parseTiers(s.tiers);
      const value =
        String(s.basis) === "SCALED"
          ? (params.scaledScore ?? 0)
          : params.percentage;
      const tier = pickTier(tiers, value);
      if (!tier) continue;

      const now = new Date();
      const result = await db
        .insertInto("test_scholarship_awards")
        .values({
          id: ulid(),
          tenant_id: params.tenantId,
          scholarship_id: s.id,
          member_id: params.memberId,
          attempt_id: params.attemptId,
          tier_label: tier.label,
          amount: (tier.amount ?? null) as unknown as string | null,
          currency: tier.currency ?? null,
          score: value as unknown as string,
          status: "PENDING",
          flagged_at: now,
          created_at: now,
          updated_at: now,
        })
        // One award per (scholarship, member), re-attempts don't duplicate.
        .onConflict((oc) => oc.columns(["scholarship_id", "member_id"]).doNothing())
        .executeTakeFirst();

      if (Number(result?.numInsertedOrUpdatedRows ?? 0) > 0) {
        flagged.push({ name: s.name, tierLabel: tier.label, status: "PENDING" });
      }
    }
    return flagged;
  }
}

export default new TestRewardsService();
