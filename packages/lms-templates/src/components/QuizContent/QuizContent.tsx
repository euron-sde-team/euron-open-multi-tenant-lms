"use client";

import React, { useEffect, useState } from "react";
import { ClipboardCheck, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { DragDropQuestion } from "./DragDropQuestion";

export interface QuizOption {
  id: string;
  text?: string;
  option_text?: string;
  is_correct?: boolean;
}

export type QuizQuestionType = "MCQ" | "DRAG_DROP";

export interface QuizQuestion {
  id: string;
  text?: string;
  question?: string;
  marks: number;
  /** Question type, undefined (legacy data) is treated as MCQ */
  question_type?: QuizQuestionType;
  options: QuizOption[];
  /** User's selected option id (after submission, from API) */
  user_selected_option_id?: string;
}

export interface QuizAttempt {
  id: string;
  status: string;
  score: number;
  total_marks: number;
  started_at: string;
  completed_at: string | null;
}

export interface QuizData {
  id: string;
  title: string;
  instructions: string | null;
  max_score: number;
  pass_percentage: number;
  due_date: string | null;
  question_count?: number;
  questions?: QuizQuestion[];
  attempt?: QuizAttempt | null;
}

interface QuizContentProps {
  quiz: QuizData;
  /** Fetches full quiz detail (includes questions, attempt). Used to refresh after start/submit. */
  fetchQuizDetail?: (quizId: string, includeCorrect?: boolean) => Promise<QuizData>;
  /** Starts a new attempt */
  onStartAttempt?: (quizId: string) => Promise<void>;
  /** Submits answers */
  onSubmitAttempt?: (
    quizId: string,
    answers: Array<{ question_id: string; option_id: string }>
  ) => Promise<void>;
  /** Marks quiz complete for progress */
  onMarkComplete?: (quizId: string) => Promise<void>;
  /** Whether user has access (enrolled) */
  hasAccess?: boolean;
  aspectRatio?: number;
  className?: string;
}

function getOptionText(opt: QuizOption): string {
  return opt.text ?? opt.option_text ?? "";
}

function getQuestionText(q: QuizQuestion): string {
  return q.text ?? q.question ?? "";
}

export function QuizContent({
  quiz,
  fetchQuizDetail,
  onStartAttempt,
  onSubmitAttempt,
  onMarkComplete,
  hasAccess = true,
  aspectRatio = 2.35,
  className,
}: QuizContentProps) {
  const [detail, setDetail] = useState<QuizData | null>(quiz.questions ? quiz : null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(!quiz.questions && !!fetchQuizDetail);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayQuiz = detail ?? quiz;
  const questions = displayQuiz.questions ?? [];
  const attempt = displayQuiz.attempt;
  const isSubmitted = attempt?.status === "PASSED" || attempt?.status === "FAILED";
  const isPastDue = quiz.due_date && new Date(quiz.due_date) < new Date();

  useEffect(() => {
    if (!quiz.id || !fetchQuizDetail) return;
    if (quiz.questions && quiz.questions.length > 0) {
      setDetail(quiz);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    fetchQuizDetail(quiz.id)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load quiz");
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [quiz.id, quiz.questions, fetchQuizDetail]);

  // When quiz is submitted but we don't have correct answers yet, refetch with includeCorrect
  const hasCorrectAnswers = questions.some((q) =>
    q.options.some((o) => o.is_correct !== undefined)
  );
  useEffect(() => {
    if (
      !quiz.id ||
      !fetchQuizDetail ||
      !isSubmitted ||
      hasCorrectAnswers ||
      !attempt
    )
      return;
    let cancelled = false;
    fetchQuizDetail(quiz.id, true)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [quiz.id, fetchQuizDetail, isSubmitted, hasCorrectAnswers, attempt]);

  const handleStart = async () => {
    if (!onStartAttempt || !quiz.id) return;
    setError(null);
    setIsStarting(true);
    try {
      await onStartAttempt(quiz.id);
      if (fetchQuizDetail) {
        const d = await fetchQuizDetail(quiz.id);
        setDetail(d);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start quiz");
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubmit = async () => {
    if (!onSubmitAttempt || !quiz.id) return;
    const answerList = Object.entries(answers)
      .filter(([, optId]) => optId)
      .map(([qId, optId]) => ({ question_id: qId, option_id: optId }));
    if (answerList.length === 0) {
      setError("Please answer at least one question.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmitAttempt(quiz.id, answerList);
      if (fetchQuizDetail) {
        const d = await fetchQuizDetail(quiz.id, true);
        setDetail(d);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!onMarkComplete || !quiz.id) return;
    setIsMarkingComplete(true);
    try {
      await onMarkComplete(quiz.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark complete");
    } finally {
      setIsMarkingComplete(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-lg border border-border/50 bg-muted/30 p-12",
          className
        )}
        style={{ aspectRatio }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading quiz...</p>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-lg border border-border/50 bg-muted/30 p-12",
          className
        )}
        style={{ aspectRatio }}
      >
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  // Submitted: show results
  if (isSubmitted && attempt) {
    const passed = attempt.status === "PASSED";
    const showCorrectAnswers = questions.some((q) =>
      q.options.some((o) => o.is_correct !== undefined)
    );

    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-lg border border-border/50 bg-background",
          className
        )}
      >
        <div className="space-y-6 p-4 sm:p-6">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg p-4",
              passed ? "bg-green-50 dark:bg-green-950/30" : "bg-amber-50 dark:bg-amber-950/30"
            )}
          >
            {passed ? (
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400 shrink-0" />
            ) : (
              <XCircle className="h-10 w-10 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <div>
              <h3 className="font-semibold text-foreground">
                {passed ? "Quiz Passed" : "Quiz Not Passed"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Score: {attempt.score} / {attempt.total_marks}
                {displayQuiz.pass_percentage > 0 &&
                  ` (${displayQuiz.pass_percentage}% required to pass)`}
              </p>
            </div>
          </div>

          {showCorrectAnswers && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Review Answers</h4>
              {questions.map((q, idx) => {
                const userSelectedId = q.user_selected_option_id;
                return (
                  <div key={q.id} className="rounded-lg border border-border/50 p-4 space-y-2">
                    <p className="font-medium text-foreground">
                      {idx + 1}. {getQuestionText(q)}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt) => {
                        const isCorrect = opt.is_correct;
                        const isUserSelected = userSelectedId === opt.id;
                        const showUserLabel = isUserSelected && userSelectedId != null;
                        const isWrongSelection = isUserSelected && !isCorrect;
                        return (
                          <div
                            key={opt.id}
                            className={cn(
                              "rounded-md px-3 py-2 text-sm",
                              isCorrect && "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 font-medium border border-green-200 dark:border-green-800",
                              isWrongSelection && "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-medium border border-red-200 dark:border-red-800",
                              !isCorrect && !isWrongSelection && "text-muted-foreground"
                            )}
                          >
                            {isCorrect && "✓ "}
                            {isWrongSelection && "✗ "}
                            {showUserLabel && (
                              <span className="font-semibold">(Your answer) </span>
                            )}
                            {getOptionText(opt)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {hasAccess && onStartAttempt && !isPastDue && (
              <button
                type="button"
                onClick={handleStart}
                disabled={isStarting}
                className="flex items-center gap-2 rounded-md border border-primary bg-transparent px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Reattempt Quiz"
                )}
              </button>
            )}
            {hasAccess && onMarkComplete && (
              <button
                type="button"
                onClick={handleMarkComplete}
                disabled={isMarkingComplete}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isMarkingComplete ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Marking...
                  </>
                ) : (
                  "Mark as Complete"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Not started: show start button
  if (!attempt || attempt.status !== "IN_PROGRESS") {
    const canStart = hasAccess && !isPastDue && onStartAttempt;

    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-lg border border-border/50 bg-background",
          className
        )}
      >
        <div
          className="flex flex-col items-center justify-center gap-4 p-8 sm:p-12"
          style={{ aspectRatio }}
        >
          <div className="rounded-full bg-muted/80 p-4">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">{displayQuiz.title}</h3>
            {displayQuiz.instructions?.trim() && (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap max-w-md">
                {displayQuiz.instructions}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {questions.length > 0
                ? `${questions.length} question${questions.length !== 1 ? "s" : ""} • Max score: ${displayQuiz.max_score}`
                : `Max score: ${displayQuiz.max_score}`}
            </p>
            {displayQuiz.due_date && (
              <p className="mt-1 text-xs text-muted-foreground">
                Due: {new Date(displayQuiz.due_date).toLocaleDateString()}
              </p>
            )}
          </div>
          {canStart && (
            <button
              type="button"
              onClick={handleStart}
              disabled={isStarting}
              className="flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Quiz"
              )}
            </button>
          )}
          {isPastDue && (
            <p className="text-sm text-muted-foreground">The due date has passed.</p>
          )}
        </div>
      </div>
    );
  }

  // In progress: show questions
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border/50 bg-background",
        className
      )}
    >
      <div className="space-y-6 p-4 sm:p-6">
        {displayQuiz.instructions?.trim() && (
          <div className="rounded-lg bg-muted/30 p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Instructions</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {displayQuiz.instructions}
            </p>
          </div>
        )}

        <div className="space-y-6">
          {questions.map((q, idx) =>
            q.question_type === "DRAG_DROP" ? (
              <div key={q.id} className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Question {idx + 1}
                  {q.marks > 0 && <span className="ml-2">({q.marks} marks)</span>}
                </p>
                <DragDropQuestion
                  questionText={getQuestionText(q)}
                  questionClassName="font-medium text-foreground"
                  options={q.options.map((opt) => ({
                    id: opt.id,
                    text: getOptionText(opt),
                  }))}
                  selectedOptionId={answers[q.id] ?? null}
                  onSelect={(optId) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: optId }))
                  }
                  onClear={() =>
                    setAnswers((prev) => {
                      const next = { ...prev };
                      delete next[q.id];
                      return next;
                    })
                  }
                />
              </div>
            ) : (
              <div key={q.id} className="space-y-3">
                <p className="font-medium text-foreground">
                  {idx + 1}. {getQuestionText(q)}
                  {q.marks > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">({q.marks} marks)</span>
                  )}
                </p>
                <div className="space-y-2 pl-4">
                  {q.options.map((opt) => (
                    <label
                      key={opt.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors",
                        answers[q.id] === opt.id
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:bg-muted/30"
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt.id}
                        checked={answers[q.id] === opt.id}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">{getOptionText(opt)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || Object.keys(answers).length === 0}
            className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Quiz"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}