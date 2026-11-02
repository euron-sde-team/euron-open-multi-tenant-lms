import { db } from "../db/connection";
import logger from "../utils/logger";
import type {
  TestAttemptAnswerRow,
} from "../repositories/test-attempts.repository";
import type {
  TestQuestionRow,
  TestSectionQuestionRow,
} from "../repositories/test-series-catalog.repository";

export interface StrengthCell {
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  total: number;
  correct: number;
  pct: number;
}

export interface AdvancedAnalytics {
  /** topic × difficulty grid; flattened for easy rendering */
  strengthHeatmap: StrengthCell[];
  /** 0-100, accuracy weighted by speed (faster correct answers score higher) */
  timeEfficiency: number;
  /** 0-100-100 means very consistent across this learner's series attempts so far */
  consistency: number;
  /** 0-100 composite, accuracy + coverage + speed + consistency */
  examReadiness: number;
  /** Average score of attempts at percentile ≥ 90 for this test */
  topPercentileAvgScore: number | null;
  /** Plain-English next steps */
  recommendations: string[];
}

interface ComputeInput {
  tenantId: string;
  learnerId: string;
  testId: string;
  testSeriesId: string;
  questions: TestQuestionRow[];
  sectionQuestions: TestSectionQuestionRow[];
  answers: TestAttemptAnswerRow[];
  totalDurationSec: number;
  scorePct: number;
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

class TestAnalyticsService {
  async compute(input: ComputeInput): Promise<AdvancedAnalytics> {
    const { questions, answers, totalDurationSec } = input;
    const answersByQ = new Map<string, TestAttemptAnswerRow>();
    for (const a of answers) answersByQ.set(a.question_id, a);

    // --- Strength heatmap (topic × difficulty) ---
    const cellMap = new Map<
      string,
      { topic: string; difficulty: StrengthCell["difficulty"]; total: number; correct: number }
    >();
    for (const q of questions) {
      const topic = q.topic ?? q.chapter ?? q.subject ?? "Other";
      const difficulty = String(q.difficulty) as StrengthCell["difficulty"];
      const key = `${topic}|${difficulty}`;
      const cell = cellMap.get(key) ?? { topic, difficulty, total: 0, correct: 0 };
      cell.total += 1;
      const a = answersByQ.get(q.id);
      if (a?.is_correct === true) cell.correct += 1;
      cellMap.set(key, cell);
    }
    const strengthHeatmap: StrengthCell[] = Array.from(cellMap.values()).map((c) => ({
      ...c,
      pct: c.total === 0 ? 0 : Math.round((c.correct / c.total) * 1000) / 10,
    }));

    // --- Time efficiency: correct answers + low time spent → high score ---
    let weightedSum = 0;
    let weightTotal = 0;
    for (const q of questions) {
      const a = answersByQ.get(q.id);
      if (!a) continue;
      const timeSec = Number(a.time_spent_sec ?? 0);
      // Expected time per question: total duration / number of questions
      const expectedSec = safeDiv(totalDurationSec, questions.length);
      // ratio < 1 = used less than expected (efficient); cap at 2x for stability
      const ratio = expectedSec > 0 ? timeSec / expectedSec : 1;
      const speedScore = clamp01(1 - (ratio - 1) / 1); // 1 if ratio<=1, ramps down to 0 at ratio=2
      const correctMultiplier = a.is_correct === true ? 1 : 0.2;
      weightedSum += speedScore * correctMultiplier;
      weightTotal += 1;
    }
    const timeEfficiency = Math.round(safeDiv(weightedSum, weightTotal) * 100);

    // --- Consistency: stddev of submitted scores in this series (lower is better) ---
    let consistency = 100;
    try {
      const seriesScoresRows = await db
        .selectFrom("test_attempts")
        .select(["score", "percentage"])
        .where("tenant_id", "=", input.tenantId)
        .where("learner_id", "=", input.learnerId)
        .where("test_series_id", "=", input.testSeriesId)
        .where("status", "in", ["SUBMITTED", "AUTO_SUBMITTED"])
        .where("percentage", "is not", null)
        .execute();
      const pcts = seriesScoresRows
        .map((r) => Number(r.percentage ?? 0))
        .filter((n) => Number.isFinite(n));
      if (pcts.length >= 2) {
        const mean = pcts.reduce((s, n) => s + n, 0) / pcts.length;
        const variance =
          pcts.reduce((s, n) => s + (n - mean) * (n - mean), 0) / pcts.length;
        const stddev = Math.sqrt(variance);
        // Map stddev (0-30) → 100..0; >30 means very inconsistent
        consistency = Math.max(0, Math.round(100 - (stddev / 30) * 100));
      }
    } catch (err) {
      logger.warn("[test-analytics] consistency compute failed", err);
    }

    // --- Top-10% comparison ---
    let topPercentileAvgScore: number | null = null;
    try {
      const topRows = await db
        .selectFrom("test_attempts")
        .select(["score"])
        .where("tenant_id", "=", input.tenantId)
        .where("test_id", "=", input.testId)
        .where("status", "in", ["SUBMITTED", "AUTO_SUBMITTED"])
        .where("percentile", ">=", "90")
        .where("score", "is not", null)
        .execute();
      if (topRows.length > 0) {
        const sum = topRows.reduce((s, r) => s + Number(r.score ?? 0), 0);
        topPercentileAvgScore = Math.round((sum / topRows.length) * 100) / 100;
      }
    } catch (err) {
      logger.warn("[test-analytics] top-percentile compute failed", err);
    }

    // --- Exam readiness composite ---
    // 50% accuracy + 25% time efficiency + 25% consistency
    const accuracyComponent = clamp01(input.scorePct / 100) * 50;
    const timeComponent = clamp01(timeEfficiency / 100) * 25;
    const consistencyComponent = clamp01(consistency / 100) * 25;
    const examReadiness = Math.round(
      accuracyComponent + timeComponent + consistencyComponent
    );

    // --- Recommendations: rule-based on weakest topics ---
    const recommendations: string[] = [];
    const weakest = strengthHeatmap
      .filter((c) => c.total >= 2)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);
    for (const w of weakest) {
      if (w.pct < 50) {
        recommendations.push(
          `Revise ${w.topic} (${w.difficulty.toLowerCase()}), you got ${w.pct.toFixed(0)}% right`
        );
      }
    }
    if (timeEfficiency < 40) {
      recommendations.push(
        "Practice timed mock tests, your speed-vs-accuracy balance has room to improve"
      );
    }
    if (consistency < 50) {
      recommendations.push(
        "Aim for steadier scores across attempts, consistency matters as much as peaks"
      );
    }
    if (recommendations.length === 0) {
      recommendations.push("Strong performance, keep practicing harder difficulty levels");
    }

    return {
      strengthHeatmap,
      timeEfficiency,
      consistency,
      examReadiness,
      topPercentileAvgScore,
      recommendations,
    };
  }
}

export default new TestAnalyticsService();
