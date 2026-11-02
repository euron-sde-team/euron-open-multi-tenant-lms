"use client";

import { cn } from "@open-mtlms/core";
import { useToast } from "@/components/ui/use-toast";
import { Clock, Loader2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useReducer,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import {
  getQuizDetail,
  startAttempt,
  submitAttempt,
  markQuizComplete,
  listQuizAttempts,
  getQuizAttemptReview,
  type QuizAttemptSummary,
} from "@/lib/api/quizzes";

import { QuizLanding } from "./QuizLanding";
import { QuizProgressBar } from "./QuizProgressBar";
import { QuizQuestion } from "./QuizQuestion";
import { QuizNavigation } from "./QuizNavigation";
import { QuizResults } from "./QuizResults";

// ── Types ──

interface QuizOption {
  id: string;
  text?: string;
  option_text?: string;
  is_correct?: boolean;
}

interface QuizQuestionData {
  id: string;
  text?: string;
  question?: string;
  marks: number;
  /** Question type, undefined (legacy data) is treated as MCQ */
  question_type?: "MCQ" | "DRAG_DROP";
  options: QuizOption[];
  user_selected_option_id?: string;
  /** Multi-blank DRAG_DROP: per-blank option ids the learner chose. */
  user_selected_answer?: unknown;
}

interface QuizData {
  id: string;
  title: string;
  instructions: string | null;
  max_score: number;
  pass_percentage: number;
  due_date: string | null;
  /** Overall time limit in minutes; null = no timer. */
  duration_min?: number | null;
  question_count?: number;
  /** How many questions will actually be asked (random subset when configured). */
  effective_question_count?: number;
  proctoring_enabled?: boolean;
  proctor_camera?: boolean;
  proctor_max_tab_switches?: number | null;
  calculator_mode?: string;
  questions?: QuizQuestionData[];
  attempt?: {
    id: string;
    status: string;
    score: number;
    total_marks: number;
    started_at: string;
    completed_at: string | null;
  } | null;
}

// ── State Machine ──

type Phase = "loading" | "landing" | "in_progress" | "submitting" | "results";

// An answer is a single option id (MCQ / single-blank DRAG_DROP) or one option
// id per blank for multi-blank DRAG_DROP (null = an unfilled blank).
type QuizAnswer = string | (string | null)[];

interface QuizState {
  phase: Phase;
  quiz: QuizData | null;
  questions: QuizQuestionData[];
  currentIndex: number;
  answers: Record<string, QuizAnswer>;
  result: {
    score: number;
    total_marks: number;
    status: string;
    passed: boolean;
    questions: QuizQuestionData[];
  } | null;
  error: string | null;
  isStarting: boolean;
  isMarkingComplete: boolean;
}

type QuizAction =
  | { type: "LOAD_SUCCESS"; quiz: QuizData }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "START_ATTEMPT_BEGIN" }
  | { type: "START_ATTEMPT_SUCCESS"; quiz: QuizData }
  | { type: "START_ATTEMPT_ERROR"; error: string }
  | { type: "SET_ANSWER"; questionId: string; value: QuizAnswer | null }
  | { type: "CLEAR_ANSWER"; questionId: string }
  | { type: "GO_TO_QUESTION"; index: number }
  | { type: "NEXT_QUESTION" }
  | { type: "PREV_QUESTION" }
  | { type: "SUBMIT_START" }
  | {
      type: "SUBMIT_SUCCESS";
      result: {
        score: number;
        total_marks: number;
        status: string;
        passed: boolean;
        questions: QuizQuestionData[];
      };
    }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "REATTEMPT_BEGIN" }
  | { type: "REATTEMPT_SUCCESS"; quiz: QuizData }
  | { type: "REATTEMPT_ERROR"; error: string }
  | { type: "MARK_COMPLETE_BEGIN" }
  | { type: "MARK_COMPLETE_DONE" };

function getInitialPhase(quiz: QuizData): Phase {
  const attempt = quiz.attempt;
  if (attempt?.status === "PASSED" || attempt?.status === "FAILED") {
    return "results";
  }
  if (attempt?.status === "IN_PROGRESS") {
    return "in_progress";
  }
  return "landing";
}

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "LOAD_SUCCESS": {
      const phase = getInitialPhase(action.quiz);
      const questions = action.quiz.questions ?? [];
      return {
        ...state,
        phase,
        quiz: action.quiz,
        questions,
        error: null,
        // If we have a completed attempt with correct answer data, build result
        result:
          phase === "results" && action.quiz.attempt
            ? {
                score: action.quiz.attempt.score,
                total_marks: action.quiz.attempt.total_marks,
                status: action.quiz.attempt.status,
                passed: action.quiz.attempt.status === "PASSED",
                questions,
              }
            : null,
      };
    }

    case "LOAD_ERROR":
      return { ...state, phase: "landing", error: action.error };

    case "START_ATTEMPT_BEGIN":
      return { ...state, isStarting: true, error: null };

    case "START_ATTEMPT_SUCCESS": {
      const questions = action.quiz.questions ?? [];
      return {
        ...state,
        phase: "in_progress",
        quiz: action.quiz,
        questions,
        currentIndex: 0,
        answers: {},
        result: null,
        isStarting: false,
        error: null,
      };
    }

    case "START_ATTEMPT_ERROR":
      return { ...state, isStarting: false, error: action.error };

    case "SET_ANSWER": {
      // Treat a null/empty answer as a clear so palette + submit stay accurate.
      const isEmpty =
        action.value === null ||
        action.value === "" ||
        (Array.isArray(action.value) && !action.value.some((x) => x));
      if (isEmpty) {
        const answers = { ...state.answers };
        delete answers[action.questionId];
        return { ...state, answers };
      }
      return {
        ...state,
        answers: {
          ...state.answers,
          [action.questionId]: action.value as QuizAnswer,
        },
      };
    }

    case "CLEAR_ANSWER": {
      const answers = { ...state.answers };
      delete answers[action.questionId];
      return { ...state, answers };
    }

    case "GO_TO_QUESTION":
      return {
        ...state,
        currentIndex: Math.max(0, Math.min(action.index, state.questions.length - 1)),
      };

    case "NEXT_QUESTION":
      return {
        ...state,
        currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1),
      };

    case "PREV_QUESTION":
      return {
        ...state,
        currentIndex: Math.max(state.currentIndex - 1, 0),
      };

    case "SUBMIT_START":
      return { ...state, phase: "submitting", error: null };

    case "SUBMIT_SUCCESS":
      return {
        ...state,
        phase: "results",
        result: action.result,
        error: null,
      };

    case "SUBMIT_ERROR":
      return { ...state, phase: "in_progress", error: action.error };

    case "REATTEMPT_BEGIN":
      return { ...state, isStarting: true, error: null };

    case "REATTEMPT_SUCCESS": {
      const questions = action.quiz.questions ?? [];
      return {
        ...state,
        phase: "in_progress",
        quiz: action.quiz,
        questions,
        currentIndex: 0,
        answers: {},
        result: null,
        isStarting: false,
        error: null,
      };
    }

    case "REATTEMPT_ERROR":
      return { ...state, isStarting: false, error: action.error };

    case "MARK_COMPLETE_BEGIN":
      return { ...state, isMarkingComplete: true };

    case "MARK_COMPLETE_DONE":
      return { ...state, isMarkingComplete: false };

    default:
      return state;
  }
}

const initialState: QuizState = {
  phase: "loading",
  quiz: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  result: null,
  error: null,
  isStarting: false,
  isMarkingComplete: false,
};

// ── Component ──

interface FullPageQuizProps {
  quizId: string;
  quizTitle: string;
  courseTitle: string;
  hasAccess: boolean;
  onClose: () => void;
  onQuizComplete: () => void;
}

export function FullPageQuiz({
  quizId,
  quizTitle,
  courseTitle,
  hasAccess: _hasAccess,
  onClose,
  onQuizComplete,
}: FullPageQuizProps) {
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const { toast } = useToast();
  const mountedRef = useRef(true);
  // Re-attempt history (per-attempt analytics). Newest first.
  const [attempts, setAttempts] = useState<QuizAttemptSummary[]>([]);
  // Which past attempt the results view is showing (null = the latest).
  const [viewingAttemptId, setViewingAttemptId] = useState<string | null>(null);
  // Seconds left on a timed quiz (null = untimed or not currently taking).
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  // Cleanup ref
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load the attempt history whenever results are shown (and after each submit).
  useEffect(() => {
    if (state.phase !== "results") return;
    let active = true;
    listQuizAttempts(quizId)
      .then((list) => {
        if (active && mountedRef.current) setAttempts(list);
      })
      .catch(() => {
        /* history is non-critical */
      });
    return () => {
      active = false;
    };
  }, [state.phase, state.result, quizId]);

  const handleViewAttempt = useCallback(
    async (attemptId: string) => {
      try {
        const review = await getQuizAttemptReview(quizId, attemptId);
        if (!mountedRef.current) return;
        setViewingAttemptId(attemptId);
        dispatch({
          type: "SUBMIT_SUCCESS",
          result: {
            score: review.score,
            total_marks: review.total_marks,
            status: review.status,
            passed: review.status === "PASSED",
            questions: review.questions as QuizQuestionData[],
          },
        });
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to load attempt",
        });
      }
    },
    [quizId, toast]
  );

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Handle browser back button via hash
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Push #quiz hash so browser back closes the overlay
    const url = window.location.href.replace(/#.*$/, "");
    window.history.pushState(null, "", url + "#quiz");

    const handlePopState = () => {
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Clean up #quiz hash on unmount if still present
      if (window.location.hash === "#quiz") {
        window.history.replaceState(null, "", window.location.href.replace(/#quiz$/, ""));
      }
    };
  }, []); // Run once on mount

  // Keyboard navigation
  useEffect(() => {
    if (state.phase !== "in_progress") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") dispatch({ type: "PREV_QUESTION" });
      if (e.key === "ArrowRight") dispatch({ type: "NEXT_QUESTION" });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.phase]);

  // Load quiz
  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;

    getQuizDetail(quizId, true)
      .then((quiz) => {
        if (!cancelled && mountedRef.current) {
          dispatch({ type: "LOAD_SUCCESS", quiz: quiz as QuizData });
        }
      })
      .catch((err) => {
        if (!cancelled && mountedRef.current) {
          dispatch({
            type: "LOAD_ERROR",
            error: err instanceof Error ? err.message : "Failed to load quiz",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [quizId]);

  // Handlers
  const handleStart = useCallback(async () => {
    dispatch({ type: "START_ATTEMPT_BEGIN" });
    try {
      await startAttempt(quizId);
      const quiz = await getQuizDetail(quizId);
      if (mountedRef.current) {
        dispatch({ type: "START_ATTEMPT_SUCCESS", quiz: quiz as QuizData });
      }
    } catch (err) {
      if (mountedRef.current) {
        dispatch({
          type: "START_ATTEMPT_ERROR",
          error: err instanceof Error ? err.message : "Failed to start quiz",
        });
      }
    }
  }, [quizId]);

  const handleSubmit = useCallback(async (auto = false) => {
    dispatch({ type: "SUBMIT_START" });
    const answerList: Array<{
      question_id: string;
      option_id: string;
      answer?: (string | null)[];
    }> = [];
    for (const [qId, val] of Object.entries(state.answers)) {
      if (Array.isArray(val)) {
        // Multi-blank: send the per-blank array + a primary option_id (first
        // filled blank) so the server's NOT NULL FK stays satisfied.
        const primary = val.find((x) => typeof x === "string" && x) as
          | string
          | undefined;
        if (primary) {
          answerList.push({ question_id: qId, option_id: primary, answer: val });
        }
      } else if (val) {
        answerList.push({ question_id: qId, option_id: val });
      }
    }

    // A manual submit needs at least one answer. An automatic submit (the timer
    // ran out) always goes through, even with nothing answered (scored 0).
    if (answerList.length === 0 && !auto) {
      dispatch({ type: "SUBMIT_ERROR", error: "Please answer at least one question." });
      return;
    }

    try {
      await submitAttempt(quizId, answerList);
      // Fetch with correct answers to show review
      const quiz = await getQuizDetail(quizId, true);
      const quizData = quiz as QuizData;
      const attempt = quizData.attempt;
      if (mountedRef.current && attempt) {
        setViewingAttemptId(null);
        dispatch({
          type: "SUBMIT_SUCCESS",
          result: {
            score: attempt.score,
            total_marks: attempt.total_marks,
            status: attempt.status,
            passed: attempt.status === "PASSED",
            questions: quizData.questions ?? [],
          },
        });
        toast({
          title: attempt.status === "PASSED" ? "Quiz Passed!" : "Quiz Submitted",
          description: `Score: ${attempt.score}/${attempt.total_marks}`,
        });

        // The backend marks quiz progress complete on ANY submission, so the
        // lesson must unlock the next one regardless of pass/fail, only the
        // explicit markQuizComplete call stays pass-gated.
        if (attempt.status === "PASSED") {
          try {
            await markQuizComplete(quizId);
          } catch {
            // Non-critical
          }
        }
        onQuizComplete();
      }
    } catch (err) {
      if (mountedRef.current) {
        dispatch({
          type: "SUBMIT_ERROR",
          error: err instanceof Error ? err.message : "Failed to submit quiz",
        });
      }
    }
  }, [quizId, state.answers, toast, onQuizComplete]);

  const handleReattempt = useCallback(async () => {
    setViewingAttemptId(null);
    dispatch({ type: "REATTEMPT_BEGIN" });
    try {
      await startAttempt(quizId);
      const quiz = await getQuizDetail(quizId);
      if (mountedRef.current) {
        dispatch({ type: "REATTEMPT_SUCCESS", quiz: quiz as QuizData });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to start a new attempt";
      if (mountedRef.current) {
        dispatch({ type: "REATTEMPT_ERROR", error: msg });
        // Surface the reason (e.g. re-attempt limit reached), the results
        // screen otherwise gives no feedback when a re-attempt is rejected.
        toast({ title: "Cannot re-attempt", description: msg });
      }
    }
  }, [quizId, toast]);

  const handleMarkComplete = useCallback(async () => {
    dispatch({ type: "MARK_COMPLETE_BEGIN" });
    try {
      await markQuizComplete(quizId);
      onQuizComplete();
      toast({ title: "Marked as complete" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to mark complete",
      });
    } finally {
      if (mountedRef.current) {
        dispatch({ type: "MARK_COMPLETE_DONE" });
      }
    }
  }, [quizId, onQuizComplete, toast]);

  // Overall quiz countdown + auto-submit. The deadline is the attempt's server
  // start time plus the configured limit, so it survives a reload (resume) and
  // can't be gamed by pausing the tab. When it hits zero the quiz auto-submits.
  const durationMin = state.quiz?.duration_min ?? null;
  const attemptStartedAt = state.quiz?.attempt?.started_at ?? null;
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    if (state.phase !== "in_progress" || !durationMin || !attemptStartedAt) {
      setRemainingSec(null);
      return;
    }
    autoSubmittedRef.current = false;
    const deadline =
      new Date(attemptStartedAt).getTime() + durationMin * 60_000;
    const tick = () => {
      const remainingMs = deadline - Date.now();
      setRemainingSec(Math.max(0, Math.ceil(remainingMs / 1000)));
      if (remainingMs <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        toast({
          title: "Time's up",
          description: "Your quiz was submitted automatically.",
        });
        void handleSubmitRef.current(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.phase, durationMin, attemptStartedAt, toast]);

  const handleClose = useCallback(() => {
    // Clean up hash and close
    if (window.location.hash === "#quiz") {
      window.history.replaceState(null, "", window.location.href.replace(/#quiz$/, ""));
    }
    onClose();
  }, [onClose]);

  const answeredSet = useMemo(
    () =>
      new Set(
        Object.entries(state.answers)
          .filter(([, v]) => (Array.isArray(v) ? v.some((x) => x) : Boolean(v)))
          .map(([k]) => k)
      ),
    [state.answers]
  );

  const questionIds = useMemo(
    () => state.questions.map((q) => q.id),
    [state.questions]
  );

  const isPastDue = !!(state.quiz?.due_date && new Date(state.quiz.due_date) < new Date());
  const currentQuestion = state.questions[state.currentIndex] ?? null;

  // Render content based on phase
  const content = (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Loading */}
      {state.phase === "loading" && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading quiz...</p>
          </div>
        </div>
      )}

      {/* Landing */}
      {state.phase === "landing" && state.quiz && (
        <>
          <Header onClose={handleClose} title="" />
          <div className="flex-1 overflow-y-auto">
            <QuizLanding
              title={state.quiz.title || quizTitle}
              courseTitle={courseTitle}
              instructions={state.quiz.instructions}
              questionCount={
                // Show how many questions will actually be asked. The backend
                // sends the effective count (a random subset when configured);
                // fall back to the served array length, then any stored total.
                state.quiz.effective_question_count ??
                (state.questions.length > 0
                  ? state.questions.length
                  : state.quiz.question_count ?? 0)
              }
              maxScore={state.quiz.max_score}
              passPercentage={state.quiz.pass_percentage}
              dueDate={state.quiz.due_date}
              durationMin={state.quiz.duration_min}
              isPastDue={isPastDue}
              hasInProgressAttempt={
                state.quiz.attempt?.status === "IN_PROGRESS"
              }
              onStart={handleStart}
              onClose={handleClose}
              isStarting={state.isStarting}
            />
          </div>
        </>
      )}

      {/* In Progress / Submitting */}
      {(state.phase === "in_progress" || state.phase === "submitting") &&
        currentQuestion && (
          <>
            <Header
              onClose={handleClose}
              title={state.quiz?.title || quizTitle}
              right={
                remainingSec != null ? (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums",
                      remainingSec <= 60
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-foreground"
                    )}
                    aria-label="Time remaining"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {formatCountdown(remainingSec)}
                  </div>
                ) : undefined
              }
            />
            <QuizProgressBar
              current={state.currentIndex}
              total={state.questions.length}
            />
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
                <QuizQuestion
                  question={currentQuestion}
                  index={state.currentIndex}
                  total={state.questions.length}
                  value={state.answers[currentQuestion.id] ?? null}
                  onChange={(value) =>
                    dispatch({
                      type: "SET_ANSWER",
                      questionId: currentQuestion.id,
                      value,
                    })
                  }
                />
                {state.error && (
                  <p className="mt-4 text-center text-sm text-destructive">
                    {state.error}
                  </p>
                )}
              </div>
            </div>
            <QuizNavigation
              currentIndex={state.currentIndex}
              total={state.questions.length}
              answeredQuestions={answeredSet}
              questionIds={questionIds}
              onPrev={() => dispatch({ type: "PREV_QUESTION" })}
              onNext={() => dispatch({ type: "NEXT_QUESTION" })}
              onGoTo={(idx) =>
                dispatch({ type: "GO_TO_QUESTION", index: idx })
              }
              onSubmit={() => handleSubmit()}
              isSubmitting={state.phase === "submitting"}
            />
          </>
        )}

      {/* Results */}
      {state.phase === "results" && state.result && (
        <>
          <Header
            onClose={handleClose}
            title={state.quiz?.title || quizTitle}
          />
          <div className="flex-1 overflow-y-auto">
            <QuizResults
              score={state.result.score}
              totalMarks={state.result.total_marks}
              status={state.result.status}
              passPercentage={state.quiz?.pass_percentage ?? 0}
              questions={state.result.questions}
              onReattempt={handleReattempt}
              onMarkComplete={handleMarkComplete}
              onClose={handleClose}
              isReattempting={state.isStarting}
              isMarkingComplete={state.isMarkingComplete}
              isPastDue={isPastDue}
              attempts={attempts}
              viewingAttemptId={viewingAttemptId ?? attempts[0]?.id ?? null}
              onViewAttempt={handleViewAttempt}
            />
          </div>
        </>
      )}

      {/* Error fallback */}
      {state.phase === "landing" && !state.quiz && state.error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-destructive">{state.error}</p>
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-primary hover:underline"
          >
            Back to Course
          </button>
        </div>
      )}
    </div>
  );

  // Render as portal
  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}

// ── Header ──

function Header({
  onClose,
  title,
  right,
}: {
  onClose: () => void;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-background px-4 py-3 sm:px-6">
      <h2 className="truncate text-sm font-semibold text-foreground">
        {title}
      </h2>
      <div className="flex items-center gap-3">
        {right}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          )}
          aria-label="Close quiz"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Seconds → "M:SS" (or "H:MM:SS" past an hour) for the quiz countdown. */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
