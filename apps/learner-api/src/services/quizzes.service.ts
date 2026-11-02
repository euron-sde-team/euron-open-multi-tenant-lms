import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import courseService from "./course.service";
import certificateService from "./certificate.service";
import * as quizzesRepo from "../repositories/quizzes.repository";

export async function listQuizzesForUser(
  tenantId: string,
  memberId: string,
  courseId: string,
  query?: { section_id?: string; lesson_id?: string; scope?: string }
) {
  await courseService.ensureEnrolled(tenantId, courseId, memberId);
  const quizzes = await quizzesRepo.getQuizzesForCourse(
    tenantId,
    memberId,
    courseId,
    query
  );
  return quizzes;
}

export async function getQuizDetail(
  tenantId: string,
  memberId: string,
  quizId: string,
  includeCorrectAnswers: boolean
) {
  const quiz = await quizzesRepo.getQuizById(tenantId, quizId);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  await courseService.ensureEnrolled(tenantId, quiz.course_id, memberId);

  if (String(quiz.status) !== "PUBLISHED") {
    throw new ForbiddenError("Quiz is not available");
  }

  const attempt = await quizzesRepo.getLatestAttempt(
    tenantId,
    memberId,
    quizId
  );

  // Seed the shuffle with the attempt id so questions/options are shuffled but
  // stay in a stable order for the whole attempt (and reshuffle for a new one).
  const fullQuiz = await quizzesRepo.getQuizWithQuestions(
    tenantId,
    quizId,
    includeCorrectAnswers,
    attempt?.id
  );
  if (!fullQuiz) {
    throw new NotFoundError("Quiz not found");
  }

  let questions = fullQuiz.questions;

  // When the attempt has a fixed random question set, return ONLY those
  // questions, in their stored (persisted) order.
  const attemptQuestionIds = attempt?.question_ids ?? [];
  if (attemptQuestionIds.length > 0) {
    const byId = new Map(questions.map((q) => [q.id, q]));
    questions = attemptQuestionIds
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => q !== undefined);
  }

  if (
    attempt &&
    (attempt.status === "PASSED" || attempt.status === "FAILED") &&
    includeCorrectAnswers
  ) {
    const userAnswers = await quizzesRepo.getAttemptAnswers(
      tenantId,
      attempt.id
    );
    questions = questions.map((q) => {
      const ua = userAnswers.get(q.id);
      return {
        ...q,
        user_selected_option_id: ua?.option_id,
        // Multi-blank DRAG_DROP: the per-blank option ids chosen by the learner.
        user_selected_answer: ua?.answer ?? null,
      };
    });
  }

  // The count shown on the pre-start landing should reflect how many questions
  // will actually be asked, not the full pool. When random_question_count is a
  // positive integer smaller than the pool, only that many are served per attempt.
  const poolSize = fullQuiz.questions.length;
  const randomCount = Number(
    (quiz as { random_question_count?: number | null }).random_question_count ?? 0
  );
  const effectiveQuestionCount =
    attemptQuestionIds.length > 0
      ? questions.length
      : Number.isInteger(randomCount) && randomCount > 0 && randomCount < poolSize
        ? randomCount
        : poolSize;

  return {
    ...fullQuiz,
    questions,
    effective_question_count: effectiveQuestionCount,
    duration_min: quiz.duration_min ?? null,
    attempt: attempt
      ? {
          id: attempt.id,
          status: attempt.status,
          score: attempt.score,
          total_marks: attempt.total_marks,
          started_at: attempt.started_at.toISOString(),
          completed_at: attempt.completed_at?.toISOString() ?? null,
        }
      : null,
  };
}

export async function startAttempt(
  tenantId: string,
  memberId: string,
  quizId: string
) {
  const quiz = await quizzesRepo.getQuizById(tenantId, quizId);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  await courseService.ensureEnrolled(tenantId, quiz.course_id, memberId);

  if (String(quiz.status) !== "PUBLISHED") {
    throw new ForbiddenError("Quiz is not available");
  }

  if (quiz.due_date && new Date() > quiz.due_date) {
    throw new BadRequestError("Quiz deadline has passed");
  }

  // Re-attempt policy. Resuming an IN_PROGRESS attempt is always allowed;
  // starting a NEW attempt is gated: allow_reattempt=false → a single attempt,
  // otherwise up to max_attempts completed attempts (null = unlimited).
  const priorAttempts = await quizzesRepo.listAttemptsByMemberAndQuiz(
    tenantId,
    memberId,
    quizId
  );
  const hasInProgress = priorAttempts.some(
    (a) => String(a.status) === "IN_PROGRESS"
  );
  if (!hasInProgress) {
    const attemptLimit = quiz.allow_reattempt ? quiz.max_attempts ?? null : 1;
    if (attemptLimit !== null) {
      const completed = priorAttempts.filter((a) =>
        ["PASSED", "FAILED"].includes(String(a.status))
      ).length;
      if (completed >= attemptLimit) {
        throw new BadRequestError(
          attemptLimit === 1
            ? "Re-attempts are not allowed for this quiz"
            : `You have used all ${attemptLimit} attempts for this quiz`
        );
      }
    }
  }

  const attempt = await quizzesRepo.getOrCreateAttempt(
    tenantId,
    memberId,
    quiz.course_id,
    quizId
  );

  if (String(attempt.status) !== "IN_PROGRESS") {
    throw new BadRequestError(
      "You have already completed this quiz. Start a new attempt from the quiz list."
    );
  }

  // Random question mode: fix the question set for this attempt once.
  // If random_question_count >= total questions, all questions are used.
  const randomCount = Number(quiz.random_question_count ?? 0);
  if (randomCount > 0 && (attempt.question_ids ?? []).length === 0) {
    const questionIds = await quizzesRepo.pickRandomQuestionIds(
      tenantId,
      quizId,
      randomCount
    );
    if (questionIds.length > 0) {
      await quizzesRepo.setAttemptQuestionIds(
        tenantId,
        attempt.id,
        questionIds
      );
    }
  }

  return {
    id: attempt.id,
    status: attempt.status,
    score: attempt.score,
    total_marks: attempt.total_marks,
    started_at: attempt.started_at.toISOString(),
    completed_at: attempt.completed_at?.toISOString() ?? null,
    duration_min: quiz.duration_min ?? null,
  };
}

export async function submitAttempt(
  tenantId: string,
  memberId: string,
  quizId: string,
  answers: Array<{ question_id: string; option_id: string; answer?: unknown }>,
  tabSwitchCount?: number
) {
  const quiz = await quizzesRepo.getQuizById(tenantId, quizId);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  await courseService.ensureEnrolled(tenantId, quiz.course_id, memberId);

  const attempt = await quizzesRepo.getLatestAttempt(
    tenantId,
    memberId,
    quizId
  );
  if (!attempt || String(attempt.status) !== "IN_PROGRESS") {
    throw new BadRequestError(
      "No active attempt found. Please start the quiz first."
    );
  }

  // An empty array is allowed: a timed quiz auto-submits when the clock runs
  // out even if nothing was answered (scored 0). Only a missing payload is invalid.
  if (!Array.isArray(answers)) {
    throw new BadRequestError("Answers are required");
  }

  await quizzesRepo.submitAttemptAnswers(
    tenantId,
    attempt.id,
    answers
  );

  if (typeof tabSwitchCount === "number") {
    await quizzesRepo.setAttemptTabSwitches(
      tenantId,
      attempt.id,
      tabSwitchCount
    );
  }

  const result = await quizzesRepo.computeAndUpdateAttemptScore(
    tenantId,
    attempt.id,
    Number(quiz.pass_percentage)
  );

  const passed = result.status === "PASSED";
  await quizzesRepo.upsertMemberQuizProgress(
    tenantId,
    memberId,
    quizId,
    quiz.course_id,
    quiz.lesson_id,
    passed
  );

  if (passed && quiz.course_id) {
    void certificateService.maybeIssueCourseCertificateOnCompletion(
      tenantId,
      quiz.course_id,
      memberId
    );
  }

  const fullQuiz = await quizzesRepo.getQuizWithQuestions(
    tenantId,
    quizId,
    true,
    attempt.id
  );

  const userAnswers = await quizzesRepo.getAttemptAnswers(
    tenantId,
    attempt.id
  );

  // Mirror getQuizDetail: with a fixed random question set, return only
  // those questions in their stored order.
  let resultQuestions = fullQuiz?.questions ?? [];
  const attemptQuestionIds = attempt.question_ids ?? [];
  if (attemptQuestionIds.length > 0) {
    const byId = new Map(resultQuestions.map((q) => [q.id, q]));
    resultQuestions = attemptQuestionIds
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => q !== undefined);
  }

  const questionsWithUserAnswers = resultQuestions.map((q) => {
    const ua = userAnswers.get(q.id);
    return {
      ...q,
      user_selected_option_id: ua?.option_id,
      user_selected_answer: ua?.answer ?? null,
    };
  });

  return {
    attempt_id: attempt.id,
    score: result.score,
    total_marks: result.total_marks,
    status: result.status,
    passed,
    questions: questionsWithUserAnswers,
  };
}

/**
 * All of a learner's attempts for a quiz, newest first, the re-attempt history
 * with per-attempt score/percentage. Each is reviewable via getAttemptReview.
 */
export async function listAttempts(
  tenantId: string,
  memberId: string,
  quizId: string
) {
  const quiz = await quizzesRepo.getQuizById(tenantId, quizId);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  await courseService.ensureEnrolled(tenantId, quiz.course_id, memberId);

  const rows = await quizzesRepo.listAttemptsByMemberAndQuiz(
    tenantId,
    memberId,
    quizId
  );
  const total = rows.length;
  return rows.map((a, i) => ({
    id: a.id,
    // rows are newest-first, so the oldest attempt is #1.
    attempt_number: total - i,
    status: a.status,
    score: a.score,
    total_marks: a.total_marks,
    percentage:
      a.total_marks > 0 ? Math.round((a.score / a.total_marks) * 100) : 0,
    started_at: a.started_at.toISOString(),
    completed_at: a.completed_at ? a.completed_at.toISOString() : null,
  }));
}

/** Per-attempt review: the questions, correct answers, and what the learner chose. */
export async function getAttemptReview(
  tenantId: string,
  memberId: string,
  quizId: string,
  attemptId: string
) {
  const quiz = await quizzesRepo.getQuizById(tenantId, quizId);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  await courseService.ensureEnrolled(tenantId, quiz.course_id, memberId);

  const attempt = await quizzesRepo.getAttempt(tenantId, attemptId);
  if (
    !attempt ||
    attempt.tenant_member_id !== memberId ||
    attempt.quiz_id !== quizId
  ) {
    throw new NotFoundError("Attempt not found");
  }

  const fullQuiz = await quizzesRepo.getQuizWithQuestions(
    tenantId,
    quizId,
    true,
    attemptId
  );
  const userAnswers = await quizzesRepo.getAttemptAnswers(tenantId, attemptId);

  let questions = fullQuiz?.questions ?? [];
  const frozenIds = attempt.question_ids ?? [];
  if (frozenIds.length > 0) {
    const byId = new Map(questions.map((q) => [q.id, q]));
    questions = frozenIds
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => q !== undefined);
  }

  return {
    attempt_id: attempt.id,
    score: attempt.score,
    total_marks: attempt.total_marks,
    status: attempt.status,
    questions: questions.map((q) => {
      const ua = userAnswers.get(q.id);
      return {
        ...q,
        user_selected_option_id: ua?.option_id,
        user_selected_answer: ua?.answer ?? null,
      };
    }),
  };
}

export async function getAttempt(
  tenantId: string,
  memberId: string,
  quizId: string
) {
  const quiz = await quizzesRepo.getQuizById(tenantId, quizId);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  await courseService.ensureEnrolled(tenantId, quiz.course_id, memberId);

  const attempt = await quizzesRepo.getLatestAttempt(
    tenantId,
    memberId,
    quizId
  );
  if (!attempt) {
    return null;
  }

  return {
    id: attempt.id,
    status: attempt.status,
    score: attempt.score,
    total_marks: attempt.total_marks,
    started_at: attempt.started_at.toISOString(),
    completed_at: attempt.completed_at?.toISOString() ?? null,
    duration_min: quiz.duration_min ?? null,
  };
}

export async function markQuizComplete(
  tenantId: string,
  memberId: string,
  quizId: string
) {
  const quiz = await quizzesRepo.getQuizById(tenantId, quizId);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  await courseService.ensureEnrolled(tenantId, quiz.course_id, memberId);

  await quizzesRepo.upsertMemberQuizProgress(
    tenantId,
    memberId,
    quizId,
    quiz.course_id,
    quiz.lesson_id,
    true
  );

  if (quiz.course_id) {
    void certificateService.maybeIssueCourseCertificateOnCompletion(
      tenantId,
      quiz.course_id,
      memberId
    );
  }

  const progress = await quizzesRepo.getMemberQuizProgress(
    tenantId,
    memberId,
    quizId
  );
  return {
    completed: progress?.completed ?? true,
    completed_at: progress?.completed_at?.toISOString() ?? new Date().toISOString(),
  };
}
