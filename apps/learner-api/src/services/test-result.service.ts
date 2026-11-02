import { db } from "../db/connection";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import testSeriesCatalogRepository, {
  type TestRow,
  type TestSectionRow,
  type TestSeriesRow,
} from "../repositories/test-series-catalog.repository";
import testAttemptsRepository, {
  type TestAttemptRow,
  type TestAttemptAnswerRow,
  type TestAttemptModuleRow,
} from "../repositories/test-attempts.repository";
import { parseJson } from "../utils/test-grading.util";
import testRewardsService from "./test-rewards.service";
import { servedQuestionOrder, shuffleArray } from "../utils/shuffle.util";

export interface ResultPayload {
  attemptId: string;
  testId: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number;
  totalMarks: number;
  /** Attempt-level manual-grading rollup: NOT_REQUIRED | PENDING_REVIEW | COMPLETED. */
  gradingStatus: string;
  /** Total marks of descriptive questions still awaiting an evaluator (0 when none). */
  pendingMarks: number;
  percentage: number;
  /** Counts over the questions actually served in this attempt (not the pool). */
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  percentile: number | null;
  rank: number | null;
  predictedRankMin: number | null;
  predictedRankMax: number | null;
  passCriteriaPct: number | null;
  passed: boolean | null;
  /** Proctoring summary for this attempt (null when proctoring was off). */
  proctoring: {
    tabSwitchCount: number;
    flagCount: number;
    flags: Array<{ type: string; at: string; detail?: string }>;
  } | null;
  /** Earned certificate for this test, if any. */
  certificate: { certificateNumber: string } | null;
  /**
   * The test offers a certificate but grading isn't finished yet, so it can't be
   * issued until the evaluator completes marking. Lets the UI show a "certificate
   * will be issued after evaluation" message instead of nothing.
   */
  certificatePending: boolean;
  /** Scholarship award status from this test, if any. */
  scholarship: {
    name: string;
    tierLabel: string | null;
    status: string;
    amount: number | null;
    currency: string | null;
  } | null;
  sectionBreakdown: Array<{
    sectionId: string;
    sectionName: string;
    attempted: number;
    correct: number;
    wrong: number;
    skipped: number;
    marks: number;
    accuracyPct: number;
    avgTimePerQuestionSec: number;
  }>;
  topicBreakdown: Array<{
    topic: string;
    correctPct: number;
    total: number;
  }>;
  analytics: {
    strengthHeatmap: Array<{
      topic: string;
      difficulty: string;
      total: number;
      correct: number;
      pct: number;
    }>;
    timeEfficiency: number;
    consistency: number;
    examReadiness: number;
    topPercentileAvgScore: number | null;
    recommendations: string[];
  } | null;
  questions: Array<{
    questionId: string;
    type: string;
    stem: unknown;
    options: unknown;
    correctAnswer: unknown;
    yourAnswer: unknown;
    isCorrect: boolean | null;
    marksAwarded: number;
    timeSpentSec: number;
    explanation: string | null;
    bookmarked: boolean;
    /** Per-answer grading state (descriptive questions may be PENDING_REVIEW). */
    gradingStatus: string;
    /** Awaiting an evaluator, for descriptive answers marksAwarded is not final. */
    pendingReview: boolean;
    /** Evaluator's feedback on a descriptive answer, shown to the learner once graded. */
    graderRemarks: string | null;
    /** True when the question was an unscored pilot slot (adaptive only). */
    isPretest?: boolean;
  }>;
  scaledScore: number | null;
  scaledScoreMax: number | null;
  adaptive?: AdaptiveResultBlock | null;
}

export interface AdaptiveResultBlock {
  sections: Array<{
    sectionId: string;
    sectionName: string;
    /** Variants taken at stages >= 2, joined '>' (empty for single-stage). */
    path: string;
    modules: Array<{
      attemptModuleId: string;
      label: string;
      stageNo: number;
      variant: string;
      questionCount: number;
      answeredCount: number;
      rawCorrect: number;
      rawScore: number;
      autoCompleted: boolean;
    }>;
    rawCorrectTotal: number;
    scaledScore: number | null;
    scaleMax: number | null;
    /** Best path's ceiling for this section (max scale_max across configured paths). */
    sectionCeilingMax: number | null;
    /**
     * Module-1 coaching: whether routing gated a harder module and by how much.
     * Null when the section is not adaptive (no stage 2).
     */
    coaching: {
      module1Correct: number;
      module1Total: number;
      /** Smallest Module-1 score that would have reached a harder variant; null if already hardest. */
      neededForHarder: number | null;
      /** max(0, neededForHarder - module1Correct); null if already on the hardest path. */
      gap: number | null;
      reachedHardest: boolean;
    } | null;
  }>;
  totalScaledScore: number | null;
  totalScaleMax: number | null;
}

interface ResultRoutingRule {
  min_correct: number;
  next_variant: string;
}

/** Parse a module's stored routing_rules JSON into a typed list (empty when absent). */
function parseRoutingRulesForResult(value: unknown): ResultRoutingRule[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  const rules: ResultRoutingRule[] = [];
  for (const entry of parsed) {
    if (entry && typeof entry === "object") {
      const e = entry as { min_correct?: unknown; next_variant?: unknown };
      rules.push({
        min_correct: Number(e.min_correct ?? 0),
        next_variant: String(e.next_variant ?? ""),
      });
    }
  }
  return rules;
}

/**
 * Build the proctoring summary from an attempt row. Returns null when there
 * was no proctoring activity (no tab switches and no flags) so the UI can hide
 * the section entirely for non-proctored tests.
 */
function buildProctoring(attempt: {
  tab_switch_count?: unknown;
  proctoring_flags?: unknown;
}): ResultPayload["proctoring"] {
  const tabSwitchCount = Number(attempt.tab_switch_count ?? 0);
  const raw = attempt.proctoring_flags;
  const parsed = typeof raw === "string" ? safeJson(raw) : raw;
  const flags = Array.isArray(parsed)
    ? parsed
        .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
        .map((f) => ({
          type: String(f.type ?? "EVENT"),
          at: String(f.at ?? ""),
          detail: f.detail != null ? String(f.detail) : undefined,
        }))
    : [];
  if (tabSwitchCount === 0 && flags.length === 0) return null;
  return { tabSwitchCount, flagCount: flags.length, flags };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Look up the earned certificate + scholarship award for the result page. */
async function buildRewards(
  tenantId: string,
  memberId: string,
  testId: string
): Promise<{
  certificate: ResultPayload["certificate"];
  scholarship: ResultPayload["scholarship"];
}> {
  const cert = await db
    .selectFrom("test_certificates")
    .select(["certificate_number"])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("test_id", "=", testId)
    .where("status", "=", "ISSUED")
    .executeTakeFirst();

  const award = await db
    .selectFrom("test_scholarship_awards as a")
    .innerJoin("test_scholarships as s", "s.id", "a.scholarship_id")
    .select([
      "s.name as name",
      "a.tier_label as tier_label",
      "a.status as status",
      "a.amount as amount",
      "a.currency as currency",
    ])
    .where("a.tenant_id", "=", tenantId)
    .where("a.member_id", "=", memberId)
    .where((eb) =>
      eb.or([eb("s.test_id", "=", testId), eb("s.test_series_id", "is not", null)])
    )
    .orderBy("a.flagged_at", "desc")
    .executeTakeFirst();

  return {
    certificate: cert ? { certificateNumber: cert.certificate_number } : null,
    scholarship: award
      ? {
          name: String(award.name),
          tierLabel: award.tier_label ?? null,
          status: String(award.status),
          amount: award.amount != null ? Number(award.amount) : null,
          currency: award.currency ?? null,
        }
      : null,
  };
}

class TestResultService {
  async getResult(
    tenantId: string,
    memberId: string,
    attemptId: string
  ): Promise<ResultPayload> {
    const attempt = await testAttemptsRepository.findById(attemptId, tenantId);
    if (!attempt) throw new NotFoundError("Attempt not found");
    if (attempt.learner_id !== memberId)
      throw new ForbiddenError("You do not have access to this attempt");

    const tree = await testSeriesCatalogRepository.getTestForAttempt(
      tenantId,
      attempt.test_id
    );
    if (!tree) throw new NotFoundError("Test not found");

    const series = await testSeriesCatalogRepository.findById(
      tenantId,
      attempt.test_series_id
    );

    const answers = await testAttemptsRepository.findAnswers(attemptId, tenantId);
    const answersByQuestion = new Map<string, TestAttemptAnswerRow>();
    for (const a of answers) answersByQuestion.set(a.question_id, a);

    if (String(tree.test.mode) === "ADAPTIVE") {
      return this.buildAdaptiveResult(
        tenantId,
        memberId,
        attempt,
        tree.test,
        tree.sections,
        series,
        answersByQuestion
      );
    }

    // Random-X mode: an attempt freezes the served subset in question_ids
    // (empty means the whole pool was served). Scope the entire result, total
    // marks, review and breakdowns, to the served questions so it reflects
    // what the learner actually saw, not the full pool.
    const attemptQuestionIds = (attempt.question_ids ?? []) as unknown as string[];
    const servedSet =
      attemptQuestionIds.length > 0 ? new Set(attemptQuestionIds) : null;
    const servedSectionQuestions = servedSet
      ? tree.sectionQuestions.filter((sq) => servedSet.has(sq.question_id))
      : tree.sectionQuestions;
    // In the order the learner saw them (section order, then the attempt's
    // shuffle), not the catalog's row order: the review is numbered from this
    // list and staff compare it against their own review of the same attempt.
    const questionById = new Map(tree.questions.map((q) => [q.id, q]));
    const servedOrder = servedQuestionOrder({
      attemptId: attempt.id,
      sections: tree.sections,
      sectionQuestions: tree.sectionQuestions,
      isServed: (id) => servedSet === null || servedSet.has(id),
      shuffleQuestions: Boolean(tree.test.shuffle_questions),
    });
    const inServedOrder = new Set(servedOrder);
    const servedQuestions = [
      ...servedOrder.flatMap((id) => {
        const q = questionById.get(id);
        return q ? [q] : [];
      }),
      // Anything served but not attached to a section (should not happen) still shows.
      ...tree.questions.filter(
        (q) =>
          (servedSet === null || servedSet.has(q.id)) && !inServedOrder.has(q.id)
      ),
    ];

    // Total marks = sum of served questions' marks (section override wins);
    // falls back to the stored snapshot total when the whole pool was served.
    const marksOverrideById = new Map<string, string | null>();
    for (const sq of tree.sectionQuestions)
      marksOverrideById.set(
        sq.question_id,
        (sq.marks_override as unknown as string) ?? null
      );
    const marksForQuestion = (q: (typeof tree.questions)[number]): number => {
      const o = marksOverrideById.get(q.id);
      return o ? Number(o) : Number(q.marks ?? 0);
    };
    const servedTotalMarks = servedSet
      ? servedQuestions.reduce((sum, q) => sum + marksForQuestion(q), 0)
      : Number(tree.test.total_marks ?? 0);

    // Correct / wrong / skipped counts over the served set.
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    for (const q of servedQuestions) {
      const a = answersByQuestion.get(q.id);
      if (!a || a.answer === null || a.answer === undefined) skippedCount += 1;
      else if (a.is_correct === true) correctCount += 1;
      else if (a.is_correct === false) wrongCount += 1;
    }

    // Build section breakdown
    const sectionMap = new Map<string, { name: string }>();
    for (const s of tree.sections) sectionMap.set(s.id, { name: s.name });

    const sectionStats = new Map<
      string,
      {
        attempted: number;
        correct: number;
        wrong: number;
        skipped: number;
        marks: number;
        timeSec: number;
        questionCount: number;
      }
    >();
    for (const sq of servedSectionQuestions) {
      const stats = sectionStats.get(sq.section_id) ?? {
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        marks: 0,
        timeSec: 0,
        questionCount: 0,
      };
      stats.questionCount += 1;
      const a = answersByQuestion.get(sq.question_id);
      if (!a || a.answer === null || a.answer === undefined) {
        stats.skipped += 1;
      } else {
        stats.attempted += 1;
        if (a.is_correct === true) stats.correct += 1;
        else if (a.is_correct === false) stats.wrong += 1;
        stats.marks += Number(a.marks_awarded ?? 0);
        stats.timeSec += Number(a.time_spent_sec ?? 0);
      }
      sectionStats.set(sq.section_id, stats);
    }

    const sectionBreakdown = Array.from(sectionStats.entries()).map(
      ([sectionId, s]) => ({
        sectionId,
        sectionName: sectionMap.get(sectionId)?.name ?? "Section",
        attempted: s.attempted,
        correct: s.correct,
        wrong: s.wrong,
        skipped: s.skipped,
        marks: s.marks,
        accuracyPct:
          s.attempted > 0 ? Math.round((s.correct / s.attempted) * 1000) / 10 : 0,
        avgTimePerQuestionSec:
          s.questionCount > 0 ? Math.round(s.timeSec / s.questionCount) : 0,
      })
    );

    // Topic breakdown
    const topicStats = new Map<string, { correct: number; total: number }>();
    for (const q of servedQuestions) {
      const topic = q.topic ?? q.chapter ?? q.subject ?? "Other";
      const t = topicStats.get(topic) ?? { correct: 0, total: 0 };
      t.total += 1;
      const a = answersByQuestion.get(q.id);
      if (a?.is_correct === true) t.correct += 1;
      topicStats.set(topic, t);
    }
    const topicBreakdown = Array.from(topicStats.entries()).map(
      ([topic, s]) => ({
        topic,
        correctPct:
          s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0,
        total: s.total,
      })
    );

    // Question review
    //
    // Solution-visibility semantics:
    //   IMMEDIATE          - always show after submit
    //   AFTER_SERIES_END   - show iff series.end_date is set and has passed,
    //                        or (when end_date is null) iff this learner has
    //                        a SUBMITTED/AUTO_SUBMITTED attempt for every
    //                        test in the series. The latter is the natural
    //                        rolling-series interpretation: "after the
    //                        learner has finished the whole series".
    //   NEVER              - never show
    const includeSolutions = await this.resolveIncludeSolutions(
      tenantId,
      memberId,
      attempt,
      String(tree.test.show_solutions),
      series
    );

    let pendingMarks = 0;
    const questionsPayload = servedQuestions.map((q) => {
      const a = answersByQuestion.get(q.id);
      const gradingStatus = String(a?.grading_status ?? "AUTO_GRADED");
      const pendingReview = gradingStatus === "PENDING_REVIEW";
      if (pendingReview) pendingMarks += marksForQuestion(q);
      // Options must appear in the SAME order the student saw during the attempt.
      // The attempt shuffles with seed (attempt.id + question.id); replicate it
      // here so review order matches (correctness is keyed by option id, not
      // position, so the shuffle never changes grading).
      const parsedOpts = parseJson(q.options);
      const options =
        tree.test.shuffle_options && Array.isArray(parsedOpts)
          ? shuffleArray(parsedOpts as unknown[], attempt.id + q.id)
          : parsedOpts;
      return {
        questionId: q.id,
        type: String(q.type),
        stem: parseJson(q.stem),
        options,
        correctAnswer: includeSolutions ? parseJson(q.correct_answer) : null,
        yourAnswer: a ? parseJson(a.answer) : null,
        isCorrect: a ? (a.is_correct ?? null) : null,
        marksAwarded: a ? Number(a.marks_awarded ?? 0) : 0,
        timeSpentSec: a ? Number(a.time_spent_sec ?? 0) : 0,
        // Descriptive questions store the evaluator-only "model answer / grading
        // notes" in `explanation`, never surface it to the learner.
        explanation:
          includeSolutions && String(q.type) !== "DESCRIPTIVE"
            ? q.explanation
            : null,
        bookmarked: false,
        gradingStatus,
        pendingReview,
        graderRemarks: a ? (a.grader_remarks ?? null) : null,
      };
    });

    const passPct = tree.test.pass_criteria_pct
      ? Number(tree.test.pass_criteria_pct as unknown as string)
      : null;
    const percentage = Number(attempt.percentage ?? 0);
    const cohort = await testAttemptsRepository.findCohortStats(
      tenantId,
      attempt.test_id,
      attempt.score === null || attempt.score === undefined
        ? null
        : Number(attempt.score)
    );
    const passed = passPct !== null ? percentage >= passPct : null;

    const analytics =
      (parseJson(attempt.analytics) as ResultPayload["analytics"]) ?? null;

    // Descriptive attempts defer certificates/scholarships at submit (the score
    // is provisional). Once the evaluator has marked everything (COMPLETED),
    // issue them here on the FINAL score. onAttemptGraded is idempotent + swallows
    // its own errors, so repeat reads and failures never affect the result.
    if (String(attempt.grading_status) === "COMPLETED") {
      await testRewardsService.onAttemptGraded({
        tenantId,
        memberId,
        testId: attempt.test_id,
        seriesId: attempt.test_series_id,
        attemptId: attempt.id,
        percentage,
        scaledScore: null,
      });
    }

    const rewards = await buildRewards(tenantId, memberId, attempt.test_id);

    // A certificate is "pending" when grading is still in progress AND the test
    // actually offers one, so the UI can promise it rather than showing nothing.
    let certificatePending = false;
    if (
      !rewards.certificate &&
      String(attempt.grading_status) === "PENDING_REVIEW"
    ) {
      const certTest = await db
        .selectFrom("tests")
        .select(["certificate_enabled"])
        .where("id", "=", attempt.test_id)
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst();
      certificatePending = !!certTest?.certificate_enabled;
    }

    return {
      attemptId: attempt.id,
      testId: attempt.test_id,
      status: String(attempt.status),
      startedAt:
        attempt.started_at instanceof Date
          ? attempt.started_at.toISOString()
          : String(attempt.started_at),
      submittedAt:
        attempt.submitted_at instanceof Date
          ? attempt.submitted_at.toISOString()
          : (attempt.submitted_at as string | null),
      score: Number(attempt.score ?? 0),
      totalMarks: servedTotalMarks,
      gradingStatus: String(attempt.grading_status ?? "NOT_REQUIRED"),
      pendingMarks,
      percentage,
      correctCount,
      wrongCount,
      skippedCount,
      totalQuestions: servedQuestions.length,
      // Recomputed against the current cohort, not the snapshot taken at
      // submit: see findCohortStats. Keeps equal scores on equal percentiles.
      percentile: cohort.percentile,
      rank: cohort.rank,
      predictedRankMin: attempt.predicted_rank_min,
      predictedRankMax: attempt.predicted_rank_max,
      passCriteriaPct: passPct,
      passed,
      proctoring: buildProctoring(attempt),
      certificate: rewards.certificate,
      certificatePending,
      scholarship: rewards.scholarship,
      analytics,
      sectionBreakdown,
      topicBreakdown,
      questions: questionsPayload,
      scaledScore: null,
      scaledScoreMax: null,
    };
  }

  /**
   * Solution-visibility semantics:
   *   IMMEDIATE          - always show after submit
   *   AFTER_SERIES_END   - show iff series.end_date is set and has passed,
   *                        or (when end_date is null) iff this learner has
   *                        a SUBMITTED/AUTO_SUBMITTED attempt for every
   *                        test in the series.
   *   NEVER              - never show
   */
  private async resolveIncludeSolutions(
    tenantId: string,
    memberId: string,
    attempt: TestAttemptRow,
    showSolutions: string,
    series: TestSeriesRow | null
  ): Promise<boolean> {
    if (showSolutions === "IMMEDIATE") return true;
    if (showSolutions !== "AFTER_SERIES_END" || !series) return false;

    const endDate = series.end_date
      ? series.end_date instanceof Date
        ? series.end_date
        : new Date(series.end_date as unknown as string)
      : null;
    if (endDate) return endDate.getTime() <= Date.now();

    const seriesTests = await testSeriesCatalogRepository.listSeriesTests(
      tenantId,
      attempt.test_series_id
    );
    if (seriesTests.length === 0) return false;
    const statuses = await testAttemptsRepository.findLatestByLearnerForTests(
      tenantId,
      memberId,
      seriesTests.map((st) => st.test_id)
    );
    return seriesTests.every((st) => {
      const s = statuses.get(st.test_id);
      return s && (s.status === "SUBMITTED" || s.status === "AUTO_SUBMITTED");
    });
  }

  /**
   * Adaptive (MST) result: the served set lives on test_attempt_modules
   * (test_section_questions is empty for adaptive tests). Pretest questions
   * appear in the review marked unscored but are excluded from breakdowns
   * and totals.
   */
  private async buildAdaptiveResult(
    tenantId: string,
    memberId: string,
    attempt: TestAttemptRow,
    test: TestRow,
    sections: TestSectionRow[],
    series: TestSeriesRow | null,
    answersByQuestion: Map<string, TestAttemptAnswerRow>
  ): Promise<ResultPayload> {
    const [modules, config] = await Promise.all([
      testAttemptsRepository.findModules(attempt.id, tenantId),
      testSeriesCatalogRepository.getAdaptiveConfigForTest(tenantId, attempt.test_id),
    ]);
    const questionById = new Map(config.questions.map((q) => [q.id, q]));
    const sectionById = new Map(sections.map((s) => [s.id, s]));
    const ordered = [...modules].sort(
      (a, b) => Number(a.order_index) - Number(b.order_index)
    );

    const scoredIds: string[] = [];
    const pretestIds: string[] = [];
    for (const m of ordered) {
      scoredIds.push(...((m.question_ids ?? []) as unknown as string[]));
      pretestIds.push(...((m.pretest_ids ?? []) as unknown as string[]));
    }
    const pretestSet = new Set(pretestIds);

    // Section breakdown over served SCORED questions.
    const sectionStats = new Map<
      string,
      {
        attempted: number;
        correct: number;
        wrong: number;
        skipped: number;
        marks: number;
        timeSec: number;
        questionCount: number;
      }
    >();
    for (const m of ordered) {
      const stats = sectionStats.get(m.section_id) ?? {
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        marks: 0,
        timeSec: 0,
        questionCount: 0,
      };
      for (const qid of (m.question_ids ?? []) as unknown as string[]) {
        stats.questionCount += 1;
        const a = answersByQuestion.get(qid);
        if (!a || a.answer === null || a.answer === undefined) {
          stats.skipped += 1;
        } else {
          stats.attempted += 1;
          if (a.is_correct === true) stats.correct += 1;
          else if (a.is_correct === false) stats.wrong += 1;
          stats.marks += Number(a.marks_awarded ?? 0);
          stats.timeSec += Number(a.time_spent_sec ?? 0);
        }
      }
      sectionStats.set(m.section_id, stats);
    }
    const sectionBreakdown = Array.from(sectionStats.entries()).map(
      ([sectionId, s]) => ({
        sectionId,
        sectionName: sectionById.get(sectionId)?.name ?? "Section",
        attempted: s.attempted,
        correct: s.correct,
        wrong: s.wrong,
        skipped: s.skipped,
        marks: s.marks,
        accuracyPct:
          s.attempted > 0 ? Math.round((s.correct / s.attempted) * 1000) / 10 : 0,
        avgTimePerQuestionSec:
          s.questionCount > 0 ? Math.round(s.timeSec / s.questionCount) : 0,
      })
    );

    // Topic breakdown over served SCORED questions.
    const topicStats = new Map<string, { correct: number; total: number }>();
    for (const qid of scoredIds) {
      const q = questionById.get(qid);
      if (!q) continue;
      const topic = q.topic ?? q.chapter ?? q.subject ?? "Other";
      const t = topicStats.get(topic) ?? { correct: 0, total: 0 };
      t.total += 1;
      const a = answersByQuestion.get(qid);
      if (a?.is_correct === true) t.correct += 1;
      topicStats.set(topic, t);
    }
    const topicBreakdown = Array.from(topicStats.entries()).map(([topic, s]) => ({
      topic,
      correctPct: s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0,
      total: s.total,
    }));

    const includeSolutions = await this.resolveIncludeSolutions(
      tenantId,
      memberId,
      attempt,
      String(test.show_solutions),
      series
    );

    const questionsPayload = [...scoredIds, ...pretestIds]
      .map((qid) => questionById.get(qid))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map((q) => {
        const a = answersByQuestion.get(q.id);
        const isPretest = pretestSet.has(q.id);
        // Match the attempt's option order (same seed) so review shows options in
        // the exact order the student saw. Grading is keyed by option id.
        const parsedOpts = parseJson(q.options);
        const options =
          test.shuffle_options && Array.isArray(parsedOpts)
            ? shuffleArray(parsedOpts as unknown[], attempt.id + q.id)
            : parsedOpts;
        return {
          questionId: q.id,
          type: String(q.type),
          stem: parseJson(q.stem),
          options,
          correctAnswer: includeSolutions ? parseJson(q.correct_answer) : null,
          yourAnswer: a ? parseJson(a.answer) : null,
          isCorrect: a ? (a.is_correct ?? null) : null,
          marksAwarded: isPretest ? 0 : a ? Number(a.marks_awarded ?? 0) : 0,
          timeSpentSec: a ? Number(a.time_spent_sec ?? 0) : 0,
          // Descriptive questions store the evaluator-only "model answer / grading
        // notes" in `explanation`, never surface it to the learner.
        explanation:
          includeSolutions && String(q.type) !== "DESCRIPTIVE"
            ? q.explanation
            : null,
          bookmarked: false,
          // Adaptive (MST) tests do not use descriptive questions.
          gradingStatus: String(a?.grading_status ?? "AUTO_GRADED"),
          pendingReview: false,
          graderRemarks: a ? (a.grader_remarks ?? null) : null,
          isPretest,
        };
      });

    const totalMarks = scoredIds.reduce(
      (sum, qid) => sum + Number(questionById.get(qid)?.marks ?? 0),
      0
    );

    // Per-section adaptive block. Per-section scaled values use the CURRENT
    // scale config; the attempt-level totals come from the snapshot columns.
    const scalesByKey = new Map(
      config.scoreScales.map((s) => [`${s.section_id}|${s.path_key}`, s])
    );
    const modulesBySection = new Map<string, TestAttemptModuleRow[]>();
    for (const m of ordered) {
      const list = modulesBySection.get(m.section_id) ?? [];
      list.push(m);
      modulesBySection.set(m.section_id, list);
    }
    // Authoring modules carry the routing rules + variant difficulty ranks the
    // coaching feedback needs (attempt modules only snapshot stage/variant).
    const authModulesBySection = new Map<string, typeof config.modules>();
    for (const m of config.modules) {
      const list = authModulesBySection.get(m.section_id) ?? [];
      list.push(m);
      authModulesBySection.set(m.section_id, list);
    }
    // Best (highest) ceiling configured for each section across all its paths.
    const ceilingBySection = new Map<string, number>();
    for (const s of config.scoreScales) {
      const prev = ceilingBySection.get(s.section_id) ?? 0;
      ceilingBySection.set(s.section_id, Math.max(prev, Number(s.scale_max ?? 0)));
    }
    const adaptiveSections = Array.from(modulesBySection.entries()).map(
      ([sectionId, secModules]) => {
        const path = secModules
          .filter((m) => Number(m.stage_no) >= 2)
          .map((m) => m.variant)
          .join(">");
        const rawCorrectTotal = secModules.reduce(
          (sum, m) => sum + Number(m.raw_correct ?? 0),
          0
        );
        const scaleRow = scalesByKey.get(`${sectionId}|${path}`);
        let scaled: number | null = null;
        let scaleMax: number | null = null;
        if (scaleRow) {
          const arr = parseJson(scaleRow.scale);
          if (Array.isArray(arr) && arr.length > 0) {
            const idx = Math.max(0, Math.min(rawCorrectTotal, arr.length - 1));
            scaled = Number(arr[idx] ?? 0);
            scaleMax = Number(scaleRow.scale_max ?? 0);
          }
        }

        // Coaching: did Module-1 performance gate a harder module? Compare the
        // landed stage-2 variant's difficulty rank against the rules that point
        // to harder variants, and report the smallest Module-1 score needed.
        const authMods = authModulesBySection.get(sectionId) ?? [];
        const stage1Auth = authMods.find((m) => Number(m.stage_no) === 1);
        const stage1Attempt = secModules.find((m) => Number(m.stage_no) === 1);
        const landedStage2 = secModules.find((m) => Number(m.stage_no) === 2);
        const rankByVariant = new Map(
          authMods
            .filter((m) => Number(m.stage_no) === 2)
            .map((m) => [m.variant, Number(m.difficulty_rank ?? 0)])
        );
        let coaching:
          | {
              module1Correct: number;
              module1Total: number;
              neededForHarder: number | null;
              gap: number | null;
              reachedHardest: boolean;
            }
          | null = null;
        if (stage1Auth && stage1Attempt && landedStage2) {
          const rules = parseRoutingRulesForResult(stage1Auth.routing_rules);
          const landedRank = rankByVariant.get(landedStage2.variant) ?? 0;
          const maxRank = Math.max(0, ...Array.from(rankByVariant.values()));
          const module1Correct = Number(stage1Attempt.raw_correct ?? 0);
          const module1Total = (
            (stage1Attempt.question_ids ?? []) as unknown as string[]
          ).length;
          const harderThresholds = rules
            .filter((r) => (rankByVariant.get(r.next_variant) ?? -1) > landedRank)
            .map((r) => r.min_correct);
          const neededForHarder =
            harderThresholds.length > 0 ? Math.min(...harderThresholds) : null;
          coaching = {
            module1Correct,
            module1Total,
            neededForHarder,
            gap:
              neededForHarder !== null
                ? Math.max(0, neededForHarder - module1Correct)
                : null,
            reachedHardest: landedRank >= maxRank,
          };
        }
        const sectionCeilingMax = ceilingBySection.get(sectionId) ?? null;

        return {
          sectionId,
          sectionName: sectionById.get(sectionId)?.name ?? "Section",
          path,
          modules: secModules.map((m) => {
            const served = [
              ...((m.question_ids ?? []) as unknown as string[]),
              ...((m.pretest_ids ?? []) as unknown as string[]),
            ];
            return {
              attemptModuleId: m.id,
              label: `Module ${m.stage_no}`,
              stageNo: Number(m.stage_no),
              variant: m.variant,
              questionCount: served.length,
              answeredCount: served.filter((qid) => {
                const a = answersByQuestion.get(qid);
                return a && a.answer !== null && a.answer !== undefined;
              }).length,
              rawCorrect: Number(m.raw_correct ?? 0),
              rawScore: Number(m.raw_score ?? 0),
              autoCompleted: Boolean(m.auto_completed),
            };
          }),
          rawCorrectTotal,
          scaledScore: scaled,
          scaleMax,
          sectionCeilingMax,
          coaching,
        };
      }
    );

    const scaledScore =
      attempt.scaled_score === null || attempt.scaled_score === undefined
        ? null
        : Number(attempt.scaled_score);
    const scaledScoreMax = attempt.scaled_score_max ?? null;

    const passPct = test.pass_criteria_pct
      ? Number(test.pass_criteria_pct as unknown as string)
      : null;
    const percentage = Number(attempt.percentage ?? 0);
    const cohort = await testAttemptsRepository.findCohortStats(
      tenantId,
      attempt.test_id,
      attempt.score === null || attempt.score === undefined
        ? null
        : Number(attempt.score)
    );
    const rewards = await buildRewards(tenantId, memberId, attempt.test_id);

    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    for (const qid of scoredIds) {
      const a = answersByQuestion.get(qid);
      if (!a || a.answer === null || a.answer === undefined) skippedCount += 1;
      else if (a.is_correct === true) correctCount += 1;
      else if (a.is_correct === false) wrongCount += 1;
    }

    return {
      attemptId: attempt.id,
      testId: attempt.test_id,
      status: String(attempt.status),
      startedAt:
        attempt.started_at instanceof Date
          ? attempt.started_at.toISOString()
          : String(attempt.started_at),
      submittedAt:
        attempt.submitted_at instanceof Date
          ? attempt.submitted_at.toISOString()
          : (attempt.submitted_at as string | null),
      score: Number(attempt.score ?? 0),
      totalMarks,
      gradingStatus: String(attempt.grading_status ?? "NOT_REQUIRED"),
      pendingMarks: 0,
      percentage,
      correctCount,
      wrongCount,
      skippedCount,
      totalQuestions: scoredIds.length,
      // Recomputed against the current cohort, not the snapshot taken at
      // submit: see findCohortStats. Keeps equal scores on equal percentiles.
      percentile: cohort.percentile,
      rank: cohort.rank,
      predictedRankMin: attempt.predicted_rank_min,
      predictedRankMax: attempt.predicted_rank_max,
      passCriteriaPct: passPct,
      passed: passPct !== null ? percentage >= passPct : null,
      proctoring: buildProctoring(attempt),
      certificate: rewards.certificate,
      // Adaptive tests have no descriptive questions, so grading never pends.
      certificatePending: false,
      scholarship: rewards.scholarship,
      analytics: (parseJson(attempt.analytics) as ResultPayload["analytics"]) ?? null,
      sectionBreakdown,
      topicBreakdown,
      questions: questionsPayload,
      scaledScore,
      scaledScoreMax,
      adaptive: {
        sections: adaptiveSections,
        totalScaledScore: scaledScore,
        totalScaleMax: scaledScoreMax,
      },
    };
  }
}

export default new TestResultService();
