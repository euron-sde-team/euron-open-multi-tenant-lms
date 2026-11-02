import { NotFoundError } from "../errors/not-found.error";
import testAnalyticsRepository, {
  type AttemptRow,
} from "../repositories/test-analytics.repository";

const num = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "bigint") return Number(v);
  const p = parseFloat(String(v));
  return Number.isFinite(p) ? p : 0;
};

const toDate = (v: Date | string | null): Date | null =>
  v == null ? null : v instanceof Date ? v : new Date(v);

/** Plain-text preview of a (possibly rich) question stem. */
function stemPreview(stem: unknown): string {
  let s = "";
  if (typeof stem === "string") s = stem;
  else if (stem && typeof stem === "object") {
    const t = (stem as { text?: unknown }).text;
    if (typeof t === "string") s = t;
  }
  s = s.replace(/<[^>]+>/g, " ").replace(/_{2,}/g, "____").replace(/\s+/g, " ").trim();
  return s.length > 90 ? `${s.slice(0, 87)}…` : s;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface TestAnalytics {
  test: {
    id: string;
    title: string;
    mode: string;
    passCriteriaPct: number | null;
    totalMarks: number | null;
    questionCount: number;
  };
  kpis: {
    totalAttempts: number;
    submitted: number;
    inProgress: number;
    avgScore: number;
    medianScore: number;
    highScore: number;
    lowScore: number;
    avgPercentage: number;
    passRate: number;
    avgPercentile: number;
    avgDurationSec: number;
    avgTabSwitches: number;
  };
  scoreDistribution: Array<{ bucket: string; count: number }>;
  difficulty: Array<{
    difficulty: string;
    answered: number;
    correct: number;
    accuracyPct: number;
  }>;
  typeBreakdown: Array<{
    type: string;
    answered: number;
    correct: number;
    accuracyPct: number;
  }>;
  funnel: { started: number; submitted: number; passed: number };
  percentileBands: Array<{ band: string; count: number }>;
  topics: Array<{
    topic: string;
    answered: number;
    correct: number;
    accuracyPct: number;
    avgTimeSec: number;
  }>;
  questions: Array<{
    questionId: string;
    stem: string;
    type: string;
    difficulty: string;
    topic: string;
    answered: number;
    correct: number;
    accuracyPct: number;
    avgTimeSec: number;
  }>;
  leaderboard: Array<{
    rank: number | null;
    learnerName: string;
    learnerEmail: string;
    score: number;
    percentage: number;
    percentile: number | null;
    durationSec: number | null;
    attempts: number;
  }>;
  /** Best attempt per learner, drives the user search + top performers. */
  learners: Array<{
    learnerId: string;
    name: string;
    email: string;
    status: string;
    score: number | null;
    percentage: number | null;
    percentile: number | null;
    rank: number | null;
    durationSec: number | null;
    tabSwitchCount: number;
    attempts: number;
    /** Every attempt by this learner, oldest first. */
    attemptHistory: Array<{
      status: string;
      score: number | null;
      percentage: number | null;
      percentile: number | null;
      durationSec: number | null;
      startedAt: string | null;
      submittedAt: string | null;
    }>;
  }>;
  insights: string[];
}

function durationSec(a: AttemptRow): number | null {
  const start = toDate(a.started_at);
  const end = toDate(a.submitted_at);
  if (!start || !end) return null;
  const d = Math.round((end.getTime() - start.getTime()) / 1000);
  return d >= 0 ? d : null;
}

interface MetaInput {
  id: string;
  title: string;
  mode: string;
  passCriteriaPct: number | null;
  totalMarks: number | null;
}

class TestAnalyticsService {
  async getTestAnalytics(
    tenantId: string,
    testId: string
  ): Promise<TestAnalytics> {
    const meta = await testAnalyticsRepository.getTestMeta(tenantId, testId);
    if (!meta) throw new NotFoundError("Test not found");

    const [attempts, answers, questionCount] = await Promise.all([
      testAnalyticsRepository.getAttempts(tenantId, testId),
      testAnalyticsRepository.getAnswerRows(tenantId, testId),
      testAnalyticsRepository.getQuestionCount(tenantId, testId),
    ]);

    return this.computeAnalytics(
      {
        id: meta.id,
        title: meta.title,
        mode: String(meta.mode ?? "STANDARD"),
        passCriteriaPct:
          meta.pass_criteria_pct != null ? num(meta.pass_criteria_pct) : null,
        totalMarks: meta.total_marks != null ? num(meta.total_marks) : null,
      },
      attempts,
      answers,
      questionCount
    );
  }

  /**
   * Series analytics, the exact same shape as a single test, aggregated across
   * every test in the series. Pass rate is computed per-attempt against each
   * test's own pass criteria (series has no single criterion).
   */
  async getSeriesAnalytics(
    tenantId: string,
    seriesId: string
  ): Promise<TestAnalytics> {
    const meta = await testAnalyticsRepository.getSeriesMeta(tenantId, seriesId);
    if (!meta) throw new NotFoundError("Test series not found");

    const testIds = await testAnalyticsRepository.getSeriesTestIds(
      tenantId,
      seriesId
    );

    const [attempts, answers, questionCount] = await Promise.all([
      testAnalyticsRepository.getAttemptsForTests(tenantId, testIds),
      testAnalyticsRepository.getAnswerRowsForTests(tenantId, testIds),
      testAnalyticsRepository.getQuestionCountForTests(tenantId, testIds),
    ]);

    return this.computeAnalytics(
      {
        id: meta.id,
        title: meta.title,
        mode: "SERIES",
        passCriteriaPct: null,
        totalMarks: null,
      },
      attempts,
      answers,
      questionCount
    );
  }

  private computeAnalytics(
    meta: MetaInput,
    attempts: AttemptRow[],
    answers: Awaited<ReturnType<typeof testAnalyticsRepository.getAnswerRows>>,
    questionCount: number
  ): TestAnalytics {
    const submittedAttempts = attempts.filter((a) => a.status === "SUBMITTED");
    const passPct = meta.passCriteriaPct;

    // Pass criteria is per-attempt when present (series spans many tests with
    // different criteria); otherwise fall back to the single test's criterion.
    const attemptPasses = (a: AttemptRow): boolean => {
      const crit =
        a.pass_criteria_pct != null ? num(a.pass_criteria_pct) : passPct;
      return crit != null && num(a.percentage) >= crit;
    };
    const hasPassCriteria =
      passPct != null ||
      submittedAttempts.some((a) => a.pass_criteria_pct != null);

    // ── KPIs ────────────────────────────────────────────────────────────
    const scores = submittedAttempts.map((a) => num(a.score));
    const pcts = submittedAttempts.map((a) => num(a.percentage));
    const percentiles = submittedAttempts
      .map((a) => (a.percentile == null ? null : num(a.percentile)))
      .filter((v): v is number => v != null);
    const durations = submittedAttempts
      .map(durationSec)
      .filter((v): v is number => v != null);
    const passed = submittedAttempts.filter(attemptPasses).length;

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    const kpis = {
      totalAttempts: attempts.length,
      submitted: submittedAttempts.length,
      inProgress: attempts.filter((a) => a.status === "IN_PROGRESS").length,
      avgScore: round1(avg(scores)),
      medianScore: round1(median(scores)),
      highScore: scores.length ? round1(Math.max(...scores)) : 0,
      lowScore: scores.length ? round1(Math.min(...scores)) : 0,
      avgPercentage: round1(avg(pcts)),
      passRate:
        hasPassCriteria && submittedAttempts.length
          ? round1((passed / submittedAttempts.length) * 100)
          : 0,
      avgPercentile: round1(avg(percentiles)),
      avgDurationSec: Math.round(avg(durations)),
      avgTabSwitches: round1(avg(submittedAttempts.map((a) => num(a.tab_switch_count)))),
    };

    // ── Score distribution (10 buckets by percentage) ───────────────────
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      bucket: `${i * 10}-${i * 10 + 10}`,
      count: 0,
    }));
    for (const p of pcts) {
      const idx = Math.min(9, Math.max(0, Math.floor(p / 10)));
      buckets[idx].count += 1;
    }

    // ── Per-question + difficulty + topic rollups ───────────────────────
    const qMap = new Map<
      string,
      {
        stem: string;
        type: string;
        difficulty: string;
        topic: string;
        answered: number;
        correct: number;
        time: number;
      }
    >();
    const diffMap = new Map<string, { answered: number; correct: number }>();
    const typeMap = new Map<string, { answered: number; correct: number }>();
    const topicMap = new Map<
      string,
      { answered: number; correct: number; time: number }
    >();

    for (const r of answers) {
      const diff = (r.q_difficulty || "UNSPECIFIED").toUpperCase();
      const topic = r.q_topic || r.q_subject || "Uncategorized";
      const correct = r.is_correct === true ? 1 : 0;

      let q = qMap.get(r.question_id);
      if (!q) {
        q = {
          stem: stemPreview(r.q_stem),
          type: r.q_type,
          difficulty: diff,
          topic,
          answered: 0,
          correct: 0,
          time: 0,
        };
        qMap.set(r.question_id, q);
      }
      q.answered += 1;
      q.correct += correct;
      q.time += num(r.time_spent_sec);

      const d = diffMap.get(diff) ?? { answered: 0, correct: 0 };
      d.answered += 1;
      d.correct += correct;
      diffMap.set(diff, d);

      const ty = typeMap.get(r.q_type) ?? { answered: 0, correct: 0 };
      ty.answered += 1;
      ty.correct += correct;
      typeMap.set(r.q_type, ty);

      const t = topicMap.get(topic) ?? { answered: 0, correct: 0, time: 0 };
      t.answered += 1;
      t.correct += correct;
      t.time += num(r.time_spent_sec);
      topicMap.set(topic, t);
    }

    const questions = [...qMap.entries()]
      .map(([questionId, q]) => ({
        questionId,
        stem: q.stem,
        type: q.type,
        difficulty: q.difficulty,
        topic: q.topic,
        answered: q.answered,
        correct: q.correct,
        accuracyPct: q.answered ? round1((q.correct / q.answered) * 100) : 0,
        avgTimeSec: q.answered ? Math.round(q.time / q.answered) : 0,
      }))
      .sort((a, b) => a.accuracyPct - b.accuracyPct);

    const DIFF_ORDER = ["EASY", "MEDIUM", "HARD", "UNSPECIFIED"];
    const difficulty = [...diffMap.entries()]
      .map(([d, v]) => ({
        difficulty: d,
        answered: v.answered,
        correct: v.correct,
        accuracyPct: v.answered ? round1((v.correct / v.answered) * 100) : 0,
      }))
      .sort(
        (a, b) =>
          DIFF_ORDER.indexOf(a.difficulty) - DIFF_ORDER.indexOf(b.difficulty)
      );

    const topics = [...topicMap.entries()]
      .map(([topic, v]) => ({
        topic,
        answered: v.answered,
        correct: v.correct,
        accuracyPct: v.answered ? round1((v.correct / v.answered) * 100) : 0,
        avgTimeSec: v.answered ? Math.round(v.time / v.answered) : 0,
      }))
      .sort((a, b) => a.accuracyPct - b.accuracyPct);

    const typeBreakdown = [...typeMap.entries()]
      .map(([type, v]) => ({
        type,
        answered: v.answered,
        correct: v.correct,
        accuracyPct: v.answered ? round1((v.correct / v.answered) * 100) : 0,
      }))
      .sort((a, b) => b.answered - a.answered);

    // ── Completion funnel + percentile bands ────────────────────────────
    const funnel = {
      started: attempts.length,
      submitted: submittedAttempts.length,
      passed,
    };

    const bandDefs: Array<[string, (p: number) => boolean]> = [
      ["0-25", (p) => p < 25],
      ["25-50", (p) => p >= 25 && p < 50],
      ["50-75", (p) => p >= 50 && p < 75],
      ["75-90", (p) => p >= 75 && p < 90],
      ["90-100", (p) => p >= 90],
    ];
    const percentileBands = bandDefs.map(([band, test]) => ({
      band,
      count: percentiles.filter(test).length,
    }));

    // ── Learners (best attempt per user) + leaderboard ──────────────────
    // A learner may attempt the same test multiple times. Keep ONE row per
    // learner, their best attempt (highest score; a submitted attempt always
    // beats an in-progress one), so top performers never repeat a person.
    const bestByLearner = new Map<string, AttemptRow>();
    const attemptCountByLearner = new Map<string, number>();
    const attemptsByLearner = new Map<string, AttemptRow[]>();
    for (const a of attempts) {
      attemptCountByLearner.set(
        a.learner_id,
        (attemptCountByLearner.get(a.learner_id) ?? 0) + 1
      );
      const list = attemptsByLearner.get(a.learner_id) ?? [];
      list.push(a);
      attemptsByLearner.set(a.learner_id, list);
      const prev = bestByLearner.get(a.learner_id);
      const isSubmitted = a.status === "SUBMITTED";
      const prevSubmitted = prev?.status === "SUBMITTED";
      const better =
        !prev ||
        (isSubmitted && !prevSubmitted) ||
        (isSubmitted && prevSubmitted && num(a.score) > num(prev.score));
      if (better) bestByLearner.set(a.learner_id, a);
    }
    const bestAttempts = [...bestByLearner.values()];

    const learners = bestAttempts.map((a) => ({
      learnerId: a.learner_id,
      name: a.learner_name || "-",
      email: a.learner_email || "-",
      status: a.status,
      score: a.status === "SUBMITTED" ? round1(num(a.score)) : null,
      percentage: a.status === "SUBMITTED" ? round1(num(a.percentage)) : null,
      percentile: a.percentile == null ? null : round1(num(a.percentile)),
      rank: a.rank,
      durationSec: durationSec(a),
      tabSwitchCount: num(a.tab_switch_count),
      attempts: attemptCountByLearner.get(a.learner_id) ?? 1,
      // Every attempt this learner made, oldest first, for attempt-over-attempt
      // comparison in the UI.
      attemptHistory: (attemptsByLearner.get(a.learner_id) ?? [])
        .slice()
        .sort(
          (x, y) =>
            (toDate(x.started_at)?.getTime() ?? 0) -
            (toDate(y.started_at)?.getTime() ?? 0)
        )
        .map((x) => ({
          status: x.status,
          score: x.status === "SUBMITTED" ? round1(num(x.score)) : null,
          percentage: x.status === "SUBMITTED" ? round1(num(x.percentage)) : null,
          percentile: x.percentile == null ? null : round1(num(x.percentile)),
          durationSec: durationSec(x),
          startedAt: toDate(x.started_at)?.toISOString() ?? null,
          submittedAt: toDate(x.submitted_at)?.toISOString() ?? null,
        })),
    }));

    const leaderboard = bestAttempts
      .filter((a) => a.status === "SUBMITTED")
      .sort((x, y) => num(y.score) - num(x.score))
      .slice(0, 25)
      .map((a) => ({
        rank: a.rank,
        learnerName: a.learner_name || "-",
        learnerEmail: a.learner_email || "-",
        score: round1(num(a.score)),
        percentage: round1(num(a.percentage)),
        percentile: a.percentile == null ? null : round1(num(a.percentile)),
        durationSec: durationSec(a),
        attempts: attemptCountByLearner.get(a.learner_id) ?? 1,
    }));

    // ── Insights (computed takeaways) ───────────────────────────────────
    const insights: string[] = [];
    if (submittedAttempts.length === 0) {
      insights.push("No submitted attempts yet, analytics will populate once learners complete this test.");
    } else {
      insights.push(
        `${kpis.submitted} learner(s) completed this test with an average of ${kpis.avgPercentage}% (median score ${kpis.medianScore}).`
      );
      if (hasPassCriteria)
        insights.push(
          passPct != null
            ? `Pass rate is ${kpis.passRate}% against the ${passPct}% pass criteria.`
            : `Pass rate is ${kpis.passRate}% across the series' tests.`
        );
      if (topics.length > 0 && topics[0].accuracyPct < 60)
        insights.push(
          `Weakest area: "${topics[0].topic}" at ${topics[0].accuracyPct}% accuracy, consider reinforcing this topic.`
        );
      if (topics.length > 1) {
        const best = topics[topics.length - 1];
        insights.push(
          `Strongest area: "${best.topic}" at ${best.accuracyPct}% accuracy.`
        );
      }
      if (questions.length > 0 && questions[0].accuracyPct < 50)
        insights.push(
          `Hardest question (${questions[0].accuracyPct}% correct): "${questions[0].stem}".`
        );
      const hard = difficulty.find((d) => d.difficulty === "HARD");
      if (hard)
        insights.push(
          `Hard questions averaged ${hard.accuracyPct}% accuracy across ${hard.answered} answers.`
        );
    }

    return {
      test: {
        id: meta.id,
        title: meta.title,
        mode: meta.mode,
        passCriteriaPct: meta.passCriteriaPct,
        totalMarks: meta.totalMarks,
        questionCount,
      },
      kpis,
      scoreDistribution: buckets,
      difficulty,
      typeBreakdown,
      funnel,
      percentileBands,
      topics,
      questions,
      leaderboard,
      learners,
      insights,
    };
  }
}

export const testAnalyticsService = new TestAnalyticsService();
export default testAnalyticsService;
