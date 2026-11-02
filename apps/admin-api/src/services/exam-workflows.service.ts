import { BadRequestError } from "../errors/bad-request.error";
import examWorkflowsRepository from "../repositories/exam-workflows.repository";
import type { CreateTestQuestionInput } from "../repositories/test-questions.repository";
import testAnalyticsService from "./test-analytics.service";
import testGradingService from "./test-grading.service";
import testQuestionBanksService from "./test-question-banks.service";
import testQuestionsService from "./test-questions.service";
import testScholarshipsService from "./test-scholarships.service";
import testTaxonomyService from "./test-taxonomy.service";
import testsService from "./tests.service";

/**
 * Whole exam jobs, done in one call.
 *
 * WHY THIS LAYER EXISTS
 * ---------------------
 * The exam routes are shaped around the screens that call them, and a screen
 * has the luxury of a person clicking through it. Filling a question bank is
 * "find the bank, or make one, then import". Marking a batch of
 * descriptive answers is one request per answer, after one request per attempt
 * to find out what the answers even are.
 *
 * Handing each of those steps to an assistant as its own tool is how a plan
 * ends up eleven steps long and half-landed: every seam is a place to stop
 * with the job unfinished and nothing to show for it. Each method here is one
 * sentence an admin says, done as one transaction of intent, and the routes in
 * front of them are what the agent capability layer dispatches to.
 *
 * Every method delegates to the existing domain services rather than reaching
 * for the database, so entitlement checks, validation, audit records and the
 * background jobs they trigger all still happen exactly once, in one place.
 */

/* ------------------------------------------------------------------ */
/*  Question banks                                                     */
/* ------------------------------------------------------------------ */

export interface ImportQuestionsInput {
  bank_id?: string;
  bank_name?: string;
  questions: Array<Omit<CreateTestQuestionInput, "tenant_id" | "question_bank_id">>;
}

interface BankInventory {
  bankId: string;
  bankName: string;
  questionCount: number;
  published: number;
  draft: number;
  archived: number;
  easy: number;
  medium: number;
  hard: number;
  subjects: Array<{ subject: string; count: number; easy: number; medium: number; hard: number }>;
}

/** How many subjects to name per bank before saying "and N more". */
const MAX_SUBJECTS_PER_BANK = 12;
/** Answers returned by one look at the grading queue. */
const MAX_QUEUE_ANSWERS = 40;
/** Answers one grading call may mark. */
const MAX_GRADE_BATCH = 50;

class ExamWorkflowsService {
  /**
   * What the workspace has to build papers out of: every bank, how many
   * questions are in it, and how they split by subject, difficulty and
   * publish state. Optionally narrowed to one bank.
   *
   * This is the answer to "have I got enough hard physics questions for a
   * thirty-question paper", which otherwise takes a bank list plus a count
   * query per bank per difficulty.
   */
  async questionInventory(
    tenantId: string,
    params: { bankId?: string } = {}
  ): Promise<{
    banks: BankInventory[];
    totalQuestions: number;
    syllabus: Array<{ id: string; kind: string; name: string; parentId: string | null }>;
  }> {
    const [rows, syllabusNodes] = await Promise.all([
      examWorkflowsRepository.questionCounts(tenantId, params.bankId),
      testTaxonomyService.list(tenantId),
    ]);

    const banks = new Map<string, BankInventory>();
    const subjectTallies = new Map<
      string,
      Map<string, { count: number; easy: number; medium: number; hard: number }>
    >();

    for (const row of rows) {
      let bank = banks.get(row.bank_id);
      if (!bank) {
        bank = {
          bankId: row.bank_id,
          bankName: row.bank_name,
          questionCount: 0,
          published: 0,
          draft: 0,
          archived: 0,
          easy: 0,
          medium: 0,
          hard: 0,
          subjects: [],
        };
        banks.set(row.bank_id, bank);
        subjectTallies.set(row.bank_id, new Map());
      }
      // A bank with no questions still produces one row, with null everywhere.
      if (row.count === 0 || row.status == null) continue;

      bank.questionCount += row.count;
      if (row.status === "PUBLISHED") bank.published += row.count;
      else if (row.status === "ARCHIVED") bank.archived += row.count;
      else bank.draft += row.count;

      if (row.difficulty === "EASY") bank.easy += row.count;
      else if (row.difficulty === "HARD") bank.hard += row.count;
      else bank.medium += row.count;

      const subject = row.subject?.trim() || "Untagged";
      const tally = subjectTallies.get(row.bank_id)!;
      const entry = tally.get(subject) ?? { count: 0, easy: 0, medium: 0, hard: 0 };
      entry.count += row.count;
      if (row.difficulty === "EASY") entry.easy += row.count;
      else if (row.difficulty === "HARD") entry.hard += row.count;
      else entry.medium += row.count;
      tally.set(subject, entry);
    }

    for (const [bankId, tally] of subjectTallies) {
      const bank = banks.get(bankId);
      if (!bank) continue;
      bank.subjects = [...tally.entries()]
        .map(([subject, counts]) => ({ subject, ...counts }))
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_SUBJECTS_PER_BANK);
    }

    const list = [...banks.values()].sort((a, b) => b.questionCount - a.questionCount);
    return {
      banks: list,
      totalQuestions: list.reduce((sum, b) => sum + b.questionCount, 0),
      syllabus: syllabusNodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        name: node.name,
        parentId: node.parentId ?? null,
      })),
    };
  }

  /**
   * Put a batch of questions into a bank, making the bank when it does not
   * exist yet.
   *
   * `bank_name` rather than only an id is the whole point: "add these to the
   * physics bank" is one sentence, and resolving it here removes both a lookup
   * and the "question bank not found" dead end that follows a near miss on the
   * name.
   */
  async importQuestions(
    tenantId: string,
    input: ImportQuestionsInput,
    actorId?: string
  ): Promise<{
    bankId: string;
    bankName: string;
    bankCreated: boolean;
    created: number;
    skipped: number;
    failed: Array<{ index: number; error: string }>;
    duplicates: Array<{ question: string; reason: string }>;
  }> {
    const questions = Array.isArray(input.questions) ? input.questions : [];
    if (questions.length === 0) {
      throw new BadRequestError(
        "questions is required: send the questions to import, each with its own answer key."
      );
    }

    let bankId = input.bank_id?.trim();
    let bankName = input.bank_name?.trim() ?? "";
    let bankCreated = false;

    if (bankId) {
      const bank = await testQuestionBanksService.getById(tenantId, bankId);
      bankName = bank.name;
    } else {
      if (!bankName) {
        throw new BadRequestError(
          "Send either bank_id or bank_name so the questions have somewhere to land."
        );
      }
      const wanted = bankName.toLowerCase();
      const existing = await testQuestionBanksService.list(tenantId, {
        search: bankName,
        limit: 50,
      });
      const match = existing.banks.find((b) => b.name.trim().toLowerCase() === wanted);
      if (match) {
        bankId = match.id;
        bankName = match.name;
      } else {
        const created = await testQuestionBanksService.create(
          tenantId,
          { name: bankName },
          actorId
        );
        bankId = created.id;
        bankName = created.name;
        bankCreated = true;
      }
    }

    const result = await testQuestionsService.bulkCreate(tenantId, bankId!, questions, actorId);
    return { bankId: bankId!, bankName, bankCreated, ...result };
  }

  /* ---------------------------------------------------------------- */
  /*  Results                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * One test's numbers and the attempts behind them, filtered the way an
   * admin asks for them: "who scored below forty percent", "who is still
   * waiting to be marked".
   */
  async testResults(
    tenantId: string,
    testId: string,
    params: {
      belowPercentage?: number;
      abovePercentage?: number;
      limit?: number;
    } = {}
  ) {
    const limit = Math.min(Math.max(params.limit ?? 25, 1), 200);
    const [test, analytics, attempts] = await Promise.all([
      testsService.getById(tenantId, testId),
      testAnalyticsService.getTestAnalytics(tenantId, testId),
      testsService.listAttempts(tenantId, testId),
    ]);

    const matching = attempts.filter((attempt) => {
      const pct = attempt.percentage;
      if (params.belowPercentage !== undefined) {
        if (pct == null || pct >= params.belowPercentage) return false;
      }
      if (params.abovePercentage !== undefined) {
        if (pct == null || pct <= params.abovePercentage) return false;
      }
      return true;
    });

    return {
      test: {
        id: test.id,
        name: test.name,
        status: test.status,
        totalMarks: test.totalMarks,
        durationMin: test.durationMin,
      },
      analytics,
      matched: matching.length,
      attempts: matching.slice(0, limit).map((attempt) => ({
        learnerName: attempt.learnerName,
        learnerEmail: attempt.learnerEmail,
        score: attempt.score,
        percentage: attempt.percentage,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
      })),
      truncated: matching.length > limit,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Grading                                                          */
  /* ---------------------------------------------------------------- */

  /** Everything waiting for an evaluator, attempt by attempt, in one call. */
  async gradingQueue(
    tenantId: string,
    params: { testId?: string; seriesId?: string; limit?: number } = {}
  ) {
    const limit = Math.min(Math.max(params.limit ?? MAX_QUEUE_ANSWERS, 1), MAX_QUEUE_ANSWERS);
    const [rows, total] = await Promise.all([
      examWorkflowsRepository.pendingAnswers(tenantId, { ...params, limit }),
      examWorkflowsRepository.pendingAnswerCount(tenantId, params),
    ]);

    const byAttempt = new Map<
      string,
      {
        attemptId: string;
        learnerName: string;
        learnerEmail: string | null;
        testName: string;
        seriesTitle: string | null;
        submittedAt: string | null;
        answers: Array<{
          answerId: string;
          question: string;
          learnerAnswer: unknown;
          maxMarks: number;
        }>;
      }
    >();

    for (const row of rows) {
      const attemptId = String(row.attempt_id);
      let attempt = byAttempt.get(attemptId);
      if (!attempt) {
        attempt = {
          attemptId,
          learnerName: (row.learner_name as string | null) ?? "Unknown",
          learnerEmail: (row.learner_email as string | null) ?? null,
          testName: String(row.test_name ?? ""),
          seriesTitle: (row.series_title as string | null) ?? null,
          submittedAt:
            row.submitted_at instanceof Date
              ? row.submitted_at.toISOString()
              : row.submitted_at
                ? String(row.submitted_at)
                : null,
          answers: [],
        };
        byAttempt.set(attemptId, attempt);
      }
      attempt.answers.push({
        answerId: String(row.answer_id),
        question: stemText(row.stem),
        learnerAnswer: row.answer,
        maxMarks: Number(row.max_marks ?? 0),
      });
    }

    return {
      attempts: [...byAttempt.values()],
      answersWaiting: total,
      returned: rows.length,
      truncated: total > rows.length,
    };
  }

  /**
   * Mark one or several descriptive answers.
   *
   * Marking is a batch job for the person doing it (they read a paper and mark
   * every question on it), so it is a batch call here. Each answer is graded
   * through the existing service, which recomputes the attempt score and, when
   * the last pending answer is marked, releases the result to the learner.
   */
  async gradeAnswers(
    tenantId: string,
    marks: Array<{ answer_id: string; marks_awarded: number; remarks?: string | null }>,
    graderId: string | null
  ) {
    if (!Array.isArray(marks) || marks.length === 0) {
      throw new BadRequestError(
        "marks is required: send at least one { answer_id, marks_awarded }. Read grading.queue for the answer ids."
      );
    }
    if (marks.length > MAX_GRADE_BATCH) {
      throw new BadRequestError(
        `At most ${MAX_GRADE_BATCH} answers can be marked in one call. Send them in smaller batches.`
      );
    }

    const graded: Array<{
      answerId: string;
      attemptId: string;
      score: number;
      gradingStatus: string;
    }> = [];
    const failed: Array<{ answerId: string; reason: string }> = [];
    const attemptsCompleted = new Set<string>();

    // Sequential on purpose: every grade recomputes the attempt total, and two
    // answers on the same attempt marked in parallel would race that sum.
    for (const entry of marks) {
      const answerId = String(entry?.answer_id ?? "").trim();
      if (!answerId) {
        failed.push({ answerId: "", reason: "answer_id is missing" });
        continue;
      }
      try {
        const result = await testGradingService.gradeAnswer(tenantId, answerId, graderId, {
          marksAwarded: Number(entry.marks_awarded),
          remarks: entry.remarks ?? null,
        });
        graded.push({
          answerId,
          // Carried back so the caller can read the marked attempt itself
          // rather than trusting this count.
          attemptId: String(result.attemptId ?? ""),
          score: Number(result.score ?? 0),
          gradingStatus: String(result.gradingStatus ?? ""),
        });
        if (String(result.gradingStatus ?? "") === "COMPLETED") {
          attemptsCompleted.add(String(result.attemptId ?? ""));
        }
      } catch (error) {
        failed.push({
          answerId,
          reason: error instanceof Error ? error.message : "Could not be marked",
        });
      }
    }

    return {
      graded: graded.length,
      failed,
      results: graded,
      attemptsCompleted: attemptsCompleted.size,
    };
  }

  /* ---------------------------------------------------------------- */
  /*  Scholarships                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Confirm or reject scholarship awards in one go.
   *
   * An award list is read as a batch and decided as a batch ("confirm the top
   * ten"), so deciding them one request at a time is a fan-out that either
   * half-lands or hits the planner's own fan-out ceiling.
   */
  async decideAwards(
    tenantId: string,
    input: { award_ids: string[]; status: string },
    decidedBy?: string
  ) {
    const status = String(input?.status ?? "").toUpperCase();
    if (status !== "CONFIRMED" && status !== "REJECTED") {
      throw new BadRequestError("status must be CONFIRMED or REJECTED.");
    }
    const ids = Array.isArray(input?.award_ids)
      ? [...new Set(input.award_ids.map((id) => String(id).trim()).filter(Boolean))]
      : [];
    if (ids.length === 0) {
      throw new BadRequestError(
        "award_ids is required: read the awards list first and send the ids to decide."
      );
    }
    if (ids.length > MAX_GRADE_BATCH) {
      throw new BadRequestError(
        `At most ${MAX_GRADE_BATCH} awards can be decided in one call. Send them in smaller batches.`
      );
    }

    const decided: string[] = [];
    const failed: Array<{ awardId: string; reason: string }> = [];
    for (const awardId of ids) {
      try {
        await testScholarshipsService.decideAward(tenantId, awardId, status, decidedBy);
        decided.push(awardId);
      } catch (error) {
        failed.push({
          awardId,
          reason: error instanceof Error ? error.message : "Could not be decided",
        });
      }
    }
    return { status, decided: decided.length, failed };
  }
}

/** A question stem is either plain text or an object carrying `text`. */
function stemText(stem: unknown): string {
  if (typeof stem === "string") return stem;
  if (stem && typeof stem === "object") {
    const text = (stem as Record<string, unknown>).text;
    if (typeof text === "string") return text;
  }
  return "";
}

const examWorkflowsService = new ExamWorkflowsService();
export default examWorkflowsService;
