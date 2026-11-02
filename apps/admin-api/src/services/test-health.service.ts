import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import testHealthRepository from "../repositories/test-health.repository";
import testModulesRepository from "../repositories/test-modules.repository";
import testQuestionBanksRepository from "../repositories/test-question-banks.repository";
import testQuestionsRepository from "../repositories/test-questions.repository";
import testsRepository from "../repositories/tests.repository";

const MIN_GRADED_FOR_STATS = 10;

export interface AdaptiveHealthResponse {
  totalAttempts: number;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    paths: Array<{ pathKey: string; count: number; pct: number }>;
    modules: Array<{
      moduleId: string;
      stageNo: number;
      variant: string;
      attempts: number;
      avgRawCorrect: number | null;
      questionCount: number;
    }>;
  }>;
}

export interface QuestionHealthEntry {
  questionId: string;
  difficulty: string;
  declaredVsObserved: "MATCH" | "RELABEL_SUGGESTED" | "INSUFFICIENT_DATA";
  suggestedDifficulty: "EASY" | "MEDIUM" | "HARD" | null;
  attempts: number;
  pValue: number | null;
  pointBiserial: number | null;
  avgTimeSec: number | null;
  flags: string[];
}

function observedDifficulty(p: number): "EASY" | "MEDIUM" | "HARD" {
  if (p >= 0.75) return "EASY";
  if (p >= 0.4) return "MEDIUM";
  return "HARD";
}

class TestHealthService {
  /**
   * Routing distribution + per-module averages for a published adaptive
   * test. The path split is the primary threshold-calibration signal: if
   * nearly everyone (or nearly no one) routes to the harder variant, the
   * routing threshold or module 1 difficulty is miscalibrated.
   */
  async getAdaptiveHealth(
    tenantId: string,
    testId: string
  ): Promise<AdaptiveHealthResponse> {
    const test = await testsRepository.findById(testId);
    if (!test) throw new NotFoundError("Test not found");
    if (test.tenant_id !== tenantId)
      throw new ForbiddenError("You do not have access to this test");
    if (String(test.mode) !== "ADAPTIVE")
      throw new BadRequestError("Adaptive health is only available for adaptive tests");

    const [sections, modules, stats, totalAttempts] = await Promise.all([
      testsRepository.findSectionsByTest(testId, tenantId),
      testModulesRepository.findModulesByTest(testId, tenantId),
      testHealthRepository.findAttemptModuleStats(tenantId, testId),
      testHealthRepository.countSubmittedAttempts(tenantId, testId),
    ]);

    // Group completed attempt-modules per attempt per section to derive the
    // taken path, and per module for averages.
    const byAttemptSection = new Map<string, typeof stats>();
    const byModule = new Map<string, { attempts: number; rawSum: number }>();
    for (const row of stats) {
      const key = `${row.attempt_id}|${row.section_id}`;
      const list = byAttemptSection.get(key) ?? [];
      list.push(row);
      byAttemptSection.set(key, list);

      const agg = byModule.get(row.module_id) ?? { attempts: 0, rawSum: 0 };
      agg.attempts += 1;
      agg.rawSum += Number(row.raw_correct ?? 0);
      byModule.set(row.module_id, agg);
    }

    const pathCounts = new Map<string, Map<string, number>>();
    for (const [key, rows] of byAttemptSection.entries()) {
      const sectionId = key.split("|")[1];
      const pathKey = rows
        .filter((r) => Number(r.stage_no) >= 2)
        .sort((a, b) => Number(a.stage_no) - Number(b.stage_no))
        .map((r) => r.variant)
        .join(">");
      const counts = pathCounts.get(sectionId) ?? new Map<string, number>();
      counts.set(pathKey, (counts.get(pathKey) ?? 0) + 1);
      pathCounts.set(sectionId, counts);
    }

    return {
      totalAttempts,
      sections: sections.map((section) => {
        const counts = pathCounts.get(section.id) ?? new Map<string, number>();
        const totalForSection = Array.from(counts.values()).reduce(
          (a, b) => a + b,
          0
        );
        return {
          sectionId: section.id,
          sectionName: section.name,
          paths: Array.from(counts.entries())
            .map(([pathKey, count]) => ({
              pathKey,
              count,
              pct:
                totalForSection > 0
                  ? Math.round((count / totalForSection) * 1000) / 10
                  : 0,
            }))
            .sort((a, b) => b.count - a.count),
          modules: modules
            .filter((m) => m.section_id === section.id)
            .map((m) => {
              const agg = byModule.get(m.id);
              return {
                moduleId: m.id,
                stageNo: Number(m.stage_no),
                variant: m.variant,
                attempts: agg?.attempts ?? 0,
                avgRawCorrect: agg
                  ? Math.round((agg.rawSum / agg.attempts) * 10) / 10
                  : null,
                questionCount: Number(m.question_count),
              };
            }),
        };
      }),
    };
  }

  /**
   * Classical test theory stats per question for a bank: p-value (proportion
   * correct), point-biserial discrimination vs attempt score, avg time, and
   * actionable flags (likely bad key, too easy/hard, relabel suggestions).
   * This is the calibration feedback loop for adaptive pools.
   */
  async getQuestionHealth(
    tenantId: string,
    bankId: string,
    params: { page?: number; limit?: number }
  ): Promise<{
    questions: QuestionHealthEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    const bank = await testQuestionBanksRepository.findById(bankId, tenantId);
    if (!bank) throw new NotFoundError("Question bank not found");

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const list = await testQuestionsRepository.findByTenantId(tenantId, {
      question_bank_id: bankId,
      page,
      limit,
    });
    const questions = list.questions;
    const total = list.total;

    const stats = await testHealthRepository.findQuestionStats(
      tenantId,
      questions.map((q) => q.id)
    );
    const statById = new Map(stats.map((s) => [s.question_id, s]));

    const entries: QuestionHealthEntry[] = questions.map((q) => {
      const s = statById.get(q.id);
      const graded = Number(s?.graded ?? 0);
      const declared = String(q.difficulty ?? "MEDIUM");
      if (!s || graded < MIN_GRADED_FOR_STATS) {
        return {
          questionId: q.id,
          difficulty: declared,
          declaredVsObserved: "INSUFFICIENT_DATA",
          suggestedDifficulty: null,
          attempts: graded,
          pValue: null,
          pointBiserial: null,
          avgTimeSec: s?.avg_time_sec != null ? Math.round(Number(s.avg_time_sec)) : null,
          flags: graded > 0 ? [`Only ${graded} graded responses (need ${MIN_GRADED_FOR_STATS})`] : [],
        };
      }

      const p = Number(s.correct) / graded;
      const q1 = 1 - p;
      const sd = Number(s.score_sd ?? 0);
      let rpb: number | null = null;
      if (
        sd > 0 &&
        s.mean_score_correct !== null &&
        s.mean_score_incorrect !== null &&
        p > 0 &&
        q1 > 0
      ) {
        rpb =
          ((Number(s.mean_score_correct) - Number(s.mean_score_incorrect)) / sd) *
          Math.sqrt(p * q1);
        rpb = Math.round(rpb * 100) / 100;
      }

      const flags: string[] = [];
      if (p > 0.9) flags.push("Very easy (p > 0.9)");
      if (p < 0.2) flags.push("Very hard or flawed (p < 0.2)");
      if (rpb !== null && rpb < 0)
        flags.push("Negative discrimination: likely wrong answer key");
      else if (rpb !== null && rpb < 0.2) flags.push("Weak discrimination (< 0.2)");

      const suggested = observedDifficulty(p);
      return {
        questionId: q.id,
        difficulty: declared,
        declaredVsObserved: suggested === declared ? "MATCH" : "RELABEL_SUGGESTED",
        suggestedDifficulty: suggested,
        attempts: graded,
        pValue: Math.round(p * 100) / 100,
        pointBiserial: rpb,
        avgTimeSec: s.avg_time_sec != null ? Math.round(Number(s.avg_time_sec)) : null,
        flags,
      };
    });

    return { questions: entries, total, page, limit };
  }
}

export default new TestHealthService();
