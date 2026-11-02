import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { db } from "../db/connection";
import testSeriesCatalogRepository from "../repositories/test-series-catalog.repository";
import testSeriesEnrollmentsRepository from "../repositories/test-series-enrollments.repository";
import testAttemptsRepository, {
  type TestAttemptRow,
  type TestAttemptAnswerRow,
} from "../repositories/test-attempts.repository";
import testRankPredictorService from "./test-rank-predictor.service";
import testAnalyticsService from "./test-analytics.service";
import testRewardsService from "./test-rewards.service";
import testAdaptiveAttemptService, {
  type AdaptiveAttemptInfo,
} from "./test-adaptive-attempt.service";
import logger from "../utils/logger";
import { pickLeastServed } from "../repositories/question-serve-stats.repository";
import { selectBlueprintQuestions } from "../utils/test-blueprint.util";
import {
  gradeAnswer,
  parseJson,
  shuffleArray,
  computeTimeRemaining,
} from "../utils/test-grading.util";
import type { test_attempt_status, test_status } from "../db/enums";

export interface StartAttemptInput {
  testId: string;
  seriesId: string;
}

export interface AttemptStateResponse {
  attemptId: string;
  status: string;
  testId: string;
  seriesId: string;
  startedAt: string;
  submittedAt: string | null;
  timeRemainingSec: number;
  totalDurationSec: number;
  test: {
    id: string;
    name: string;
    description: string | null;
    durationMin: number;
    totalMarks: string;
    showSolutions: string;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    proctoringEnabled: boolean;
    proctorCamera: boolean;
    proctorMaxTabSwitches: number | null;
    proctorMic: boolean;
    proctorFullscreen: boolean;
    proctorBlockCopyPaste: boolean;
    proctorAction: string;
    calculatorMode: string;
  };
  sections: Array<{
    id: string;
    name: string;
    instructions: string | null;
    timeLimitMin: number | null;
    orderIndex: number;
    questionIds: string[];
  }>;
  questions: Array<{
    id: string;
    type: string;
    stem: unknown;
    options: unknown;
    marks: string;
    negativeMarks: string;
  }>;
  answers: Record<string, { answer: unknown; markedForReview: boolean }>;
  mode: string;
  /**
   * Set when the attempt is on an inter-section break (status ON_BREAK): the
   * ISO instant the break ends. The client shows a countdown + "Resume now".
   */
  breakEndsAt?: string | null;
  /** Present only for ADAPTIVE attempts: current-module progress metadata. */
  adaptive?: AdaptiveAttemptInfo;
}

class TestAttemptService {
  /**
   * V1 model: every authenticated learner can attempt any PUBLISHED test series.
   * If they don't have an enrollment row yet, auto-create one (source = FREE)
   * so we still track who has touched the series for analytics + per-user limits.
   */
  private async ensureAccess(
    tenantId: string,
    memberId: string,
    seriesId: string,
    _testId: string
  ): Promise<void> {
    const enrolled = await testSeriesEnrollmentsRepository.hasActiveAccess(
      tenantId,
      memberId,
      seriesId
    );
    if (enrolled) return;

    // Auto-enroll on first attempt, no payment / explicit enroll required
    await testSeriesEnrollmentsRepository.upsert({
      tenant_id: tenantId,
      tenant_member_id: memberId,
      test_series_id: seriesId,
      source: "FREE",
    });
  }

  async startAttempt(
    tenantId: string,
    memberId: string,
    input: StartAttemptInput
  ): Promise<AttemptStateResponse> {
    const series = await testSeriesCatalogRepository.findById(tenantId, input.seriesId);
    if (!series) throw new NotFoundError("Series not found");
    if (String(series.status) !== "PUBLISHED") {
      throw new BadRequestError("Series is not available for attempts");
    }

    await this.ensureAccess(tenantId, memberId, input.seriesId, input.testId);

    // Sequential access enforcement
    if (String(series.access_mode) === "SEQUENTIAL") {
      const seriesTests = await testSeriesCatalogRepository.listSeriesTests(
        tenantId,
        input.seriesId
      );
      const sorted = [...seriesTests].sort(
        (a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0)
      );
      const idx = sorted.findIndex((st) => st.test_id === input.testId);
      if (idx > 0) {
        const prevTestId = sorted[idx - 1].test_id;
        const prevAttempts = await testAttemptsRepository.findByLearnerAndTest(
          tenantId,
          memberId,
          prevTestId
        );
        const hasAnyAttempt = prevAttempts.some((a) =>
          ["SUBMITTED", "AUTO_SUBMITTED"].includes(String(a.status))
        );
        if (!hasAnyAttempt) {
          throw new BadRequestError(
            "You must complete the previous test before attempting this one"
          );
        }
      }
    }

    // Resume an existing in-progress attempt if present
    const existing = await testAttemptsRepository.findInProgressByTestAndLearner(
      tenantId,
      memberId,
      input.testId
    );
    if (existing) {
      return this.buildAttemptState(tenantId, existing);
    }

    // Otherwise, ensure test is published and create new
    const tree = await testSeriesCatalogRepository.getTestForAttempt(
      tenantId,
      input.testId
    );
    if (!tree) throw new NotFoundError("Test not found");
    if (String(tree.test.status) !== ("PUBLISHED" as test_status)) {
      throw new BadRequestError("Test is not available for attempts");
    }

    // Scheduling window: block starts outside the [available_from, available_until]
    // window when configured. Defaults are null = always available.
    const now = Date.now();
    const availFrom = tree.test.available_from
      ? new Date(tree.test.available_from as unknown as string).getTime()
      : null;
    const availUntil = tree.test.available_until
      ? new Date(tree.test.available_until as unknown as string).getTime()
      : null;
    if (availFrom !== null && now < availFrom) {
      throw new BadRequestError(
        `This test opens on ${new Date(availFrom).toUTCString()}.`
      );
    }
    if (availUntil !== null && now > availUntil) {
      throw new BadRequestError("This test's deadline has passed.");
    }

    const totalSec = Number(tree.test.duration_min ?? 0) * 60;
    if (totalSec <= 0) throw new BadRequestError("Test duration is invalid");

    // Resolve the ordered question pool from section_questions (snapshot order).
    // tree.questions is fetched via id IN (...) so it is NOT ordered, the
    // canonical order comes from section_questions.order_index.
    const orderedPoolIds = tree.sectionQuestions.map((sq) => sq.question_id);

    // Random X questions per attempt. When random_question_count is a positive
    // integer < pool size, freeze a random subset on the attempt row. Otherwise
    // store an empty array, which downstream treats as "serve all questions".
    const randomCount = Number(tree.test.random_question_count ?? 0);
    let attemptQuestionIds: string[] = [];

    // Per-section distribution blueprint takes precedence: pick the configured
    // counts per chapter/subject/topic + difficulty. Different questions every
    // attempt (least-served), same counts. Returns null when no section defines
    // a blueprint, in which case we fall back to the test-level random count.
    const blueprintIds = await selectBlueprintQuestions(
      tree.sections,
      tree.sectionQuestions,
      tree.questions.map((q) => ({
        id: q.id,
        subject_node_id: q.subject_node_id,
        chapter_node_id: q.chapter_node_id,
        topic_node_id: q.topic_node_id,
        difficulty: String(q.difficulty),
      })),
      (poolIds, count) =>
        pickLeastServed(tenantId, "TEST", input.testId, poolIds, count)
    );
    if (blueprintIds !== null) {
      attemptQuestionIds = blueprintIds;
    } else if (
      Number.isInteger(randomCount) &&
      randomCount > 0 &&
      randomCount < orderedPoolIds.length
    ) {
      // Overlap-controlled selection: spread questions across learners so two
      // attempts on a large pool share well under ~20-25% of questions.
      attemptQuestionIds = await pickLeastServed(
        tenantId,
        "TEST",
        input.testId,
        orderedPoolIds,
        randomCount
      );
    }

    // Re-attempt policy: allow_reattempt=false → a single attempt; otherwise up
    // to max_attempts submitted attempts (null = unlimited).
    {
      const attemptLimit = tree.test.allow_reattempt
        ? tree.test.max_attempts ?? null
        : 1;
      if (attemptLimit !== null) {
        const past = await testAttemptsRepository.findByLearnerAndTest(
          tenantId,
          memberId,
          input.testId
        );
        const submittedCount = past.filter((a) =>
          ["SUBMITTED", "AUTO_SUBMITTED"].includes(String(a.status))
        ).length;
        if (submittedCount >= attemptLimit) {
          throw new BadRequestError(
            attemptLimit === 1
              ? "Re-attempts are not allowed for this test"
              : `You have used all ${attemptLimit} attempts for this test`
          );
        }
      }
    }

    if (String(tree.test.mode) === "ADAPTIVE") {
      const adaptiveAttempt = await testAdaptiveAttemptService.createAttempt(
        tenantId,
        memberId,
        input,
        { test: tree.test, sections: tree.sections }
      );
      return testAdaptiveAttemptService.buildState(tenantId, adaptiveAttempt, {
        test: tree.test,
        sections: tree.sections,
      });
    }

    const attempt = await testAttemptsRepository.create({
      tenant_id: tenantId,
      learner_id: memberId,
      test_id: input.testId,
      test_series_id: input.seriesId,
      time_remaining_sec: totalSec,
      question_ids: attemptQuestionIds,
    });

    return this.buildAttemptState(tenantId, attempt);
  }

  async getAttempt(
    tenantId: string,
    memberId: string,
    attemptId: string
  ): Promise<AttemptStateResponse> {
    const attempt = await testAttemptsRepository.findById(attemptId, tenantId);
    if (!attempt) throw new NotFoundError("Attempt not found");
    if (attempt.learner_id !== memberId)
      throw new ForbiddenError("You do not have access to this attempt");
    return this.buildAttemptState(tenantId, attempt);
  }

  /**
   * A learner's full attempt history for a test, newest first, the per-attempt
   * records. Each is openable via its result page (keyed by attempt id).
   */
  async listAttempts(
    tenantId: string,
    memberId: string,
    testId: string
  ): Promise<
    Array<{
      id: string;
      attempt_number: number;
      status: string;
      score: number | null;
      percentage: number | null;
      started_at: string;
      submitted_at: string | null;
    }>
  > {
    const rows = await testAttemptsRepository.findByLearnerAndTest(
      tenantId,
      memberId,
      testId
    );
    const total = rows.length;
    const iso = (v: unknown): string | null =>
      v == null ? null : v instanceof Date ? v.toISOString() : String(v);
    return rows.map((a, i) => ({
      id: a.id,
      // rows are newest-first, so the oldest attempt is #1.
      attempt_number: total - i,
      status: String(a.status),
      score: a.score == null ? null : Number(a.score),
      percentage: a.percentage == null ? null : Number(a.percentage),
      started_at: iso(a.started_at) ?? "",
      submitted_at: iso(a.submitted_at),
    }));
  }

  private async buildAttemptState(
    tenantId: string,
    attempt: TestAttemptRow
  ): Promise<AttemptStateResponse> {
    const tree = await testSeriesCatalogRepository.getTestForAttempt(
      tenantId,
      attempt.test_id
    );
    if (!tree) throw new NotFoundError("Test not found");

    if (String(tree.test.mode) === "ADAPTIVE") {
      return testAdaptiveAttemptService.buildState(tenantId, attempt, {
        test: tree.test,
        sections: tree.sections,
      });
    }

    const startedAtMs = (attempt.started_at instanceof Date
      ? attempt.started_at
      : new Date(attempt.started_at as unknown as string)
    ).getTime();
    const totalDurationSec = Number(tree.test.duration_min ?? 0) * 60;
    const remaining =
      String(attempt.status) === "IN_PROGRESS"
        ? computeTimeRemaining(
            startedAtMs,
            totalDurationSec,
            attempt.time_remaining_sec
          )
        : 0;

    // Fixed random-question subset for this attempt (empty = serve all).
    const attemptQuestionIds = (attempt.question_ids ?? []) as unknown as string[];
    const allowedQuestionIds =
      attemptQuestionIds.length > 0 ? new Set(attemptQuestionIds) : null;
    const isServed = (questionId: string): boolean =>
      allowedQuestionIds === null || allowedQuestionIds.has(questionId);

    // Map section_id -> question_ids in order (restricted to served subset)
    const sqByQuestion = new Map<string, { sectionId: string; orderIndex: number }>();
    const sectionQuestionIds = new Map<string, string[]>();
    for (const sq of tree.sectionQuestions) {
      if (!isServed(sq.question_id)) continue;
      sqByQuestion.set(sq.question_id, {
        sectionId: sq.section_id,
        orderIndex: Number(sq.order_index ?? 0),
      });
      const list = sectionQuestionIds.get(sq.section_id) ?? [];
      list.push(sq.question_id);
      sectionQuestionIds.set(sq.section_id, list);
    }

    // Optional shuffling (deterministic by attempt.id)
    const shuffleSeed = attempt.id;
    const sections = tree.sections.map((s) => {
      let qIds = sectionQuestionIds.get(s.id) ?? [];
      if (tree.test.shuffle_questions) {
        qIds = shuffleArray(qIds, shuffleSeed + s.id);
      }
      return {
        id: s.id,
        name: s.name,
        instructions: s.instructions,
        timeLimitMin: s.time_limit_min,
        orderIndex: Number(s.order_index ?? 0),
        questionIds: qIds,
      };
    });

    // Build questions payload (no correct_answer leaked!), restricted to the
    // served subset so a random-X attempt only ever sees its frozen questions.
    const questionsById = new Map(tree.questions.map((q) => [q.id, q]));
    const questionsPayload = Array.from(questionsById.values())
      .filter((q) => isServed(q.id))
      .map((q) => {
        let options = parseJson(q.options);
        if (tree.test.shuffle_options && Array.isArray(options)) {
          options = shuffleArray(options as unknown[], shuffleSeed + q.id);
        }
        return {
          id: q.id,
          type: String(q.type),
          stem: parseJson(q.stem),
          options,
          marks: String(q.marks),
          negativeMarks: String(q.negative_marks),
        };
      });

    // Exact served marks for this attempt (sum of the questions actually served).
    const servedMarks = questionsPayload.reduce(
      (sum, q) => sum + Number(q.marks ?? 0),
      0
    );

    // Existing answers
    const answerRows = await testAttemptsRepository.findAnswers(attempt.id, tenantId);
    const answers: AttemptStateResponse["answers"] = {};
    for (const a of answerRows) {
      answers[a.question_id] = {
        answer: parseJson(a.answer),
        markedForReview: Boolean(a.marked_for_review),
      };
    }

    return {
      attemptId: attempt.id,
      status: String(attempt.status),
      testId: attempt.test_id,
      seriesId: attempt.test_series_id,
      startedAt: new Date(startedAtMs).toISOString(),
      submittedAt:
        attempt.submitted_at instanceof Date
          ? attempt.submitted_at.toISOString()
          : (attempt.submitted_at as string | null),
      timeRemainingSec: remaining,
      totalDurationSec,
      mode: "STANDARD",
      test: {
        id: tree.test.id,
        name: tree.test.name,
        description: tree.test.description,
        durationMin: Number(tree.test.duration_min ?? 0),
        totalMarks: String(servedMarks),
        showSolutions: String(tree.test.show_solutions),
        shuffleQuestions: Boolean(tree.test.shuffle_questions),
        shuffleOptions: Boolean(tree.test.shuffle_options),
        proctoringEnabled: Boolean(tree.test.proctoring_enabled),
        proctorCamera: Boolean(tree.test.proctor_camera),
        proctorMaxTabSwitches:
          tree.test.proctor_max_tab_switches === null ||
          tree.test.proctor_max_tab_switches === undefined
            ? null
            : Number(tree.test.proctor_max_tab_switches),
        proctorMic: Boolean(tree.test.proctor_mic),
        proctorFullscreen: Boolean(tree.test.proctor_fullscreen),
        proctorBlockCopyPaste: Boolean(tree.test.proctor_block_copy_paste),
        proctorAction: String(tree.test.proctor_action ?? "WARN"),
        calculatorMode: String(tree.test.calculator_mode ?? "NONE"),
      },
      sections,
      questions: questionsPayload,
      answers,
    };
  }

  async patchAnswer(
    tenantId: string,
    memberId: string,
    attemptId: string,
    body: {
      question_id: string;
      answer: unknown;
      time_spent_sec?: number;
      marked_for_review?: boolean;
    }
  ): Promise<{ ok: true }> {
    const attempt = await testAttemptsRepository.findById(attemptId, tenantId);
    if (!attempt) throw new NotFoundError("Attempt not found");
    if (attempt.learner_id !== memberId)
      throw new ForbiddenError("You do not have access to this attempt");
    if (String(attempt.status) !== "IN_PROGRESS")
      throw new BadRequestError("This attempt is no longer in progress");

    // Adaptive attempts (those with module rows) restrict autosaves to the
    // CURRENT live module. Standard attempts have zero module rows, so this
    // is one cheap indexed read for them.
    const modules = await testAttemptsRepository.findModules(attemptId, tenantId);
    if (modules.length > 0) {
      await testAdaptiveAttemptService.guardPatch(
        tenantId,
        attempt,
        modules,
        body.question_id
      );
    }

    await testAttemptsRepository.upsertAnswer({
      attempt_id: attemptId,
      tenant_id: tenantId,
      question_id: body.question_id,
      answer: body.answer,
      time_spent_sec: body.time_spent_sec,
      marked_for_review: body.marked_for_review,
    });
    return { ok: true };
  }

  /**
   * Record a live proctoring event during an in-progress attempt. Appends a
   * typed violation to `proctoring_flags` and keeps the running tab-switch
   * count. Returns the running count + whether the test's configured tab-switch
   * limit is exceeded so the client can warn / auto-submit. Best-effort: a
   * not-in-progress attempt is rejected rather than mutated.
   */
  async recordProctoringEvent(
    tenantId: string,
    memberId: string,
    attemptId: string,
    event: { type: string; count?: number; detail?: string }
  ): Promise<{
    tabSwitchCount: number;
    maxTabSwitches: number | null;
    limitExceeded: boolean;
    flagCount: number;
  }> {
    const attempt = await testAttemptsRepository.findById(attemptId, tenantId);
    if (!attempt) throw new NotFoundError("Attempt not found");
    if (attempt.learner_id !== memberId)
      throw new ForbiddenError("You do not have access to this attempt");
    if (String(attempt.status) !== "IN_PROGRESS")
      throw new BadRequestError("Attempt is not in progress");

    const ALLOWED = new Set([
      "TAB_SWITCH",
      "WINDOW_BLUR",
      "MULTI_MONITOR",
      "FULLSCREEN_EXIT",
      "COPY",
      "PASTE",
      "RIGHT_CLICK",
      "FACE_LOST",
    ]);
    const type = String(event.type || "").toUpperCase();
    if (!ALLOWED.has(type))
      throw new BadRequestError("Unknown proctoring event type");

    const existing = parseJson(attempt.proctoring_flags);
    const flags: Array<{ type: string; at: string; detail?: string }> =
      Array.isArray(existing) ? existing : [];
    // Cap the log so a misbehaving client cannot grow the row unbounded.
    if (flags.length < 500) {
      flags.push({
        type,
        at: new Date().toISOString(),
        ...(event.detail
          ? { detail: String(event.detail).slice(0, 200) }
          : {}),
      });
    }

    // Tab leaves: trust an explicit running count when provided, else increment.
    let tabSwitchCount = Number(attempt.tab_switch_count ?? 0);
    if (type === "TAB_SWITCH" || type === "WINDOW_BLUR") {
      tabSwitchCount =
        typeof event.count === "number" && event.count >= 0
          ? Math.floor(event.count)
          : tabSwitchCount + 1;
    }

    await testAttemptsRepository.recordProctoring(attemptId, tenantId, {
      tabSwitchCount,
      flags,
    });

    const testRow = await db
      .selectFrom("tests")
      .select("proctor_max_tab_switches")
      .where("tenant_id", "=", tenantId)
      .where("id", "=", attempt.test_id)
      .executeTakeFirst();
    const maxTabSwitches =
      testRow?.proctor_max_tab_switches === null ||
      testRow?.proctor_max_tab_switches === undefined
        ? null
        : Number(testRow.proctor_max_tab_switches);

    return {
      tabSwitchCount,
      maxTabSwitches,
      limitExceeded: maxTabSwitches !== null && tabSwitchCount > maxTabSwitches,
      flagCount: flags.length,
    };
  }

  async submitAttempt(
    tenantId: string,
    memberId: string,
    attemptId: string,
    options: { autoSubmit?: boolean; tabSwitchCount?: number } = {}
  ): Promise<{
    attemptId: string;
    score: number;
    totalMarks: number;
    percentage: number;
    percentile: number | null;
    rank: number | null;
    scaledScore: number | null;
    scaledScoreMax: number | null;
  }> {
    const attempt = await testAttemptsRepository.findById(attemptId, tenantId);
    if (!attempt) throw new NotFoundError("Attempt not found");
    if (attempt.learner_id !== memberId)
      throw new ForbiddenError("You do not have access to this attempt");
    if (String(attempt.status) !== "IN_PROGRESS") {
      // Idempotent: already submitted, return current state
      return {
        attemptId: attempt.id,
        score: Number(attempt.score ?? 0),
        totalMarks: 0,
        percentage: Number(attempt.percentage ?? 0),
        percentile:
          attempt.percentile === null || attempt.percentile === undefined
            ? null
            : Number(attempt.percentile),
        rank: attempt.rank,
        scaledScore:
          attempt.scaled_score === null || attempt.scaled_score === undefined
            ? null
            : Number(attempt.scaled_score),
        scaledScoreMax: attempt.scaled_score_max ?? null,
      };
    }

    // Record the proctoring tab-switch count before grading/finalizing.
    if (typeof options.tabSwitchCount === "number") {
      await db
        .updateTable("test_attempts")
        .set({ tab_switch_count: options.tabSwitchCount })
        .where("tenant_id", "=", tenantId)
        .where("id", "=", attemptId)
        .execute();
    }

    // Adaptive attempts (module rows present) submit through the module
    // engine: remaining modules are graded + completed, then finalized.
    const attemptModules = await testAttemptsRepository.findModules(
      attemptId,
      tenantId
    );
    if (attemptModules.length > 0) {
      return testAdaptiveAttemptService.endTestEarly(
        tenantId,
        memberId,
        attempt,
        options
      );
    }

    const tree = await testSeriesCatalogRepository.getTestForAttempt(
      tenantId,
      attempt.test_id
    );
    if (!tree) throw new NotFoundError("Test not found");

    const overrideById = new Map<string, string | null>();
    for (const sq of tree.sectionQuestions) {
      overrideById.set(
        sq.question_id,
        (sq.marks_override as unknown as string) ?? null
      );
    }

    // Restrict grading + total marks to the served subset (random-X mode).
    // Empty question_ids means the whole pool was served.
    const attemptQuestionIds = (attempt.question_ids ?? []) as unknown as string[];
    const allowedQuestionIds =
      attemptQuestionIds.length > 0 ? new Set(attemptQuestionIds) : null;
    const servedQuestions =
      allowedQuestionIds === null
        ? tree.questions
        : tree.questions.filter((q) => allowedQuestionIds.has(q.id));

    // Total marks = sum of served questions' marks (override wins). Falls back
    // to the snapshot total when no subset was frozen and a stored total exists.
    const marksForQuestion = (q: (typeof tree.questions)[number]): number => {
      const overrideStr = overrideById.get(q.id);
      return overrideStr ? Number(overrideStr) : Number(q.marks ?? 0);
    };
    const totalMarks =
      allowedQuestionIds === null
        ? Number(tree.test.total_marks ?? 0)
        : servedQuestions.reduce((sum, q) => sum + marksForQuestion(q), 0);

    const answers = await testAttemptsRepository.findAnswers(attemptId, tenantId);
    const answersByQuestion = new Map<string, TestAttemptAnswerRow>();
    for (const a of answers) answersByQuestion.set(a.question_id, a);

    let score = 0;
    let hasPendingDescriptive = false;
    await db.transaction().execute(async (trx) => {
      for (const q of servedQuestions) {
        const a = answersByQuestion.get(q.id);
        if (!a) continue;
        // Descriptive (free-text) answers cannot be auto-graded, leave marks +
        // correctness null, flag for manual review, and exclude from the auto
        // score. An evaluator marks them later (see the tenant-admin grading
        // flow), which recomputes the final score.
        if (String(q.type) === "DESCRIPTIVE") {
          hasPendingDescriptive = true;
          await testAttemptsRepository.markAnswerPendingReview(
            a.id,
            tenantId,
            trx
          );
          continue;
        }
        const marks = marksForQuestion(q);
        const negativeMarks = Number(q.negative_marks ?? 0);
        const result = gradeAnswer(
          String(q.type),
          q.correct_answer,
          parseJson(a.answer),
          marks,
          negativeMarks
        );
        score += result.marksAwarded;
        // Keep the in-memory answer in sync with what we just wrote to the DB.
        // `answers` (and `answersByQuestion`, which references the same objects)
        // was loaded pre-grading with is_correct=null; advanced analytics runs
        // off this array below, so without this it would treat every answer as
        // wrong (reporting "0% right" even on a perfect score).
        a.is_correct = result.isCorrect;
        a.marks_awarded = String(result.marksAwarded);
        await testAttemptsRepository.updateAnswerCorrectness(
          a.id,
          tenantId,
          result.isCorrect,
          result.marksAwarded,
          trx
        );
      }
    });

    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

    // Compute percentile + rank from existing submitted attempts for this test
    const existingScores = await testAttemptsRepository.findAllScoresForTest(
      tenantId,
      attempt.test_id
    );
    const allScoresIncludingMine = [...existingScores, { score }];
    const sortedDesc = [...allScoresIncludingMine].sort((a, b) => b.score - a.score);
    const rank = sortedDesc.findIndex((s) => s.score === score) + 1; // 1-based, ties take same rank
    const lower = allScoresIncludingMine.filter((s) => s.score < score).length;
    const percentile =
      allScoresIncludingMine.length > 0
        ? (lower / allScoresIncludingMine.length) * 100
        : 0;

    // Compute predicted rank (best-effort)
    let predictedRankMin: number | null = null;
    let predictedRankMax: number | null = null;
    try {
      const prediction = await testRankPredictorService.predictForTest(
        tenantId,
        attempt.test_id,
        percentile
      );
      if (prediction) {
        predictedRankMin = prediction.min;
        predictedRankMax = prediction.max;
      }
    } catch (err) {
      logger.warn("[test-attempt] rank prediction failed", err);
    }

    // Compute advanced analytics (best-effort, never blocks submit)
    let analytics: unknown = null;
    try {
      analytics = await testAnalyticsService.compute({
        tenantId,
        learnerId: memberId,
        testId: attempt.test_id,
        testSeriesId: attempt.test_series_id,
        // Only the questions this attempt actually served: NOT the whole pool.
        // In random-X / blueprint mode the pool is far larger than what the
        // learner saw; passing the full pool counts every unserved question as
        // wrong (0%), polluting the heatmap and producing bogus "you got 0%
        // right" recommendations for topics that were never on the test.
        questions: servedQuestions,
        sectionQuestions: tree.sectionQuestions,
        answers,
        totalDurationSec: Number(tree.test.duration_min ?? 0) * 60,
        scorePct: percentage,
      });
    } catch (err) {
      logger.warn("[test-attempt] advanced analytics failed", err);
    }

    await testAttemptsRepository.finalize(attemptId, tenantId, {
      status: options.autoSubmit
        ? ("AUTO_SUBMITTED" as test_attempt_status)
        : ("SUBMITTED" as test_attempt_status),
      // Attempts with answered descriptive questions await an evaluator; the
      // score above counts only the auto-graded questions until then.
      grading_status: hasPendingDescriptive ? "PENDING_REVIEW" : "NOT_REQUIRED",
      score,
      // Record the denominator, not just the ratio. The served set can differ
      // per learner and the test's questions can change later, so this is the
      // only moment it is knowable for certain.
      total_marks: totalMarks,
      percentage,
      percentile,
      rank,
      predicted_rank_min: predictedRankMin,
      predicted_rank_max: predictedRankMax,
      analytics,
    });

    // Certificates + scholarships (best-effort, never blocks submit).
    // Defer for attempts awaiting manual grading: the score/percentage here is
    // provisional (auto-graded only), so a certificate must NOT be issued before
    // the evaluator finishes. Rewards run once the attempt is COMPLETED (see the
    // result read, which fires them on the final score).
    if (!hasPendingDescriptive) {
      await testRewardsService.onAttemptGraded({
        tenantId,
        memberId,
        testId: attempt.test_id,
        seriesId: attempt.test_series_id,
        attemptId,
        percentage,
        scaledScore: null,
      });
    }

    return {
      attemptId,
      score,
      totalMarks,
      percentage,
      percentile,
      rank,
      scaledScore: null,
      scaledScoreMax: null,
    };
  }

  /** Adaptive only: grade the active module, route, and serve the next one. */
  async submitModule(
    tenantId: string,
    memberId: string,
    attemptId: string,
    attemptModuleId: string
  ) {
    const attempt = await testAttemptsRepository.findById(attemptId, tenantId);
    if (!attempt) throw new NotFoundError("Attempt not found");
    if (attempt.learner_id !== memberId)
      throw new ForbiddenError("You do not have access to this attempt");
    return testAdaptiveAttemptService.submitModule(
      tenantId,
      memberId,
      attempt,
      attemptModuleId
    );
  }

  /** Resume early from an inter-section break (adaptive attempts only). */
  async resumeBreak(
    tenantId: string,
    memberId: string,
    attemptId: string
  ): Promise<AttemptStateResponse> {
    const attempt = await testAttemptsRepository.findById(attemptId, tenantId);
    if (!attempt) throw new NotFoundError("Attempt not found");
    if (attempt.learner_id !== memberId)
      throw new ForbiddenError("You do not have access to this attempt");
    return testAdaptiveAttemptService.resumeBreak(tenantId, memberId, attempt);
  }
}

export default new TestAttemptService();
