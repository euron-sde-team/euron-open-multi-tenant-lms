"use client";

import { cn } from "@open-mtlms/core";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowLeft,
  Loader2,
  Check,
  X,
  Minus,
} from "lucide-react";
import { useEffect, useState } from "react";

interface QuizOption {
  id: string;
  text?: string;
  option_text?: string;
  is_correct?: boolean;
  /** Multi-blank DRAG_DROP: which blank this option is the correct answer for. */
  blank_index?: number | null;
}

interface QuizQuestion {
  id: string;
  text?: string;
  question?: string;
  marks: number;
  options: QuizOption[];
  user_selected_option_id?: string;
  /** Multi-blank DRAG_DROP: per-blank option ids the learner chose. */
  user_selected_answer?: unknown;
}

function isMultiBlank(q: QuizQuestion): boolean {
  return q.options.some(
    (o) => o.blank_index !== null && o.blank_index !== undefined
  );
}

function userAnswerArray(q: QuizQuestion): string[] {
  return Array.isArray(q.user_selected_answer)
    ? q.user_selected_answer.map((x) => (x == null ? "" : String(x)))
    : [];
}

function isAnswered(q: QuizQuestion): boolean {
  return isMultiBlank(q)
    ? userAnswerArray(q).some((x) => x)
    : Boolean(q.user_selected_option_id);
}

function isQuestionCorrect(q: QuizQuestion): boolean {
  if (isMultiBlank(q)) {
    const correctByBlank = new Map<number, string>();
    for (const o of q.options) {
      if (o.is_correct && o.blank_index != null)
        correctByBlank.set(o.blank_index, o.id);
    }
    if (correctByBlank.size === 0) return false;
    const arr = userAnswerArray(q);
    for (const [blank, id] of correctByBlank) {
      if ((arr[blank] ?? "") !== id) return false;
    }
    return true;
  }
  return (
    q.options.find((o) => o.id === q.user_selected_option_id)?.is_correct ===
    true
  );
}

interface QuizAttemptSummary {
  id: string;
  attempt_number: number;
  status: string;
  score: number;
  total_marks: number;
  percentage: number;
  completed_at: string | null;
}

interface QuizResultsProps {
  score: number;
  totalMarks: number;
  status: string;
  passPercentage: number;
  questions: QuizQuestion[];
  onReattempt: () => void;
  onMarkComplete: () => void;
  onClose: () => void;
  isReattempting: boolean;
  isMarkingComplete: boolean;
  isPastDue: boolean;
  /** Re-attempt history (newest first). When present, a picker is shown. */
  attempts?: QuizAttemptSummary[];
  /** Currently displayed attempt id (for highlighting in the picker). */
  viewingAttemptId?: string | null;
  onViewAttempt?: (attemptId: string) => void;
  className?: string;
}

function getOptionText(opt: QuizOption): string {
  return opt.text ?? opt.option_text ?? "";
}

function getQuestionText(q: QuizQuestion): string {
  return q.text ?? q.question ?? "";
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function QuizResults({
  score,
  totalMarks,
  status,
  passPercentage,
  questions,
  onReattempt,
  onMarkComplete,
  onClose,
  isReattempting,
  isMarkingComplete,
  isPastDue,
  attempts,
  viewingAttemptId,
  onViewAttempt,
  className,
}: QuizResultsProps) {
  const passed = status === "PASSED";
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

  // Calculate stats (multi-blank questions grade per blank, all-or-nothing).
  const correctCount = questions.filter((q) => isQuestionCorrect(q)).length;
  const answeredCount = questions.filter((q) => isAnswered(q)).length;
  const wrongCount = answeredCount - correctCount;
  const unansweredCount = questions.length - answeredCount;

  // Animated score
  const [animatedPercent, setAnimatedPercent] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPercent(percentage), 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  // SVG ring
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPercent / 100) * circumference;

  return (
    <div className={cn("flex min-h-screen flex-col", className)}>
      <div className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-2xl">
          {/* Score Section */}
          <div className="mb-8 flex flex-col items-center text-center sm:mb-10">
            {/* Score Ring */}
            <div className="relative mb-6 h-36 w-36 sm:h-44 sm:w-44">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/30"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className={cn(
                    "transition-all duration-1000 ease-out",
                    passed ? "text-green-500" : "text-amber-500"
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-foreground sm:text-4xl">
                  {animatedPercent}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {score}/{totalMarks}
                </span>
              </div>
            </div>

            {/* Pass/Fail Badge */}
            <div
              className={cn(
                "mb-3 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold",
                passed
                  ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              )}
            >
              {passed ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              {passed ? "Passed" : "Not Passed"}
            </div>

            {passPercentage > 0 && (
              <p className="text-sm text-muted-foreground">
                {passPercentage}% required to pass
              </p>
            )}
          </div>

          {/* Stats Row */}
          <div className="mb-8 grid grid-cols-3 gap-3 sm:mb-10">
            <StatCard
              label="Correct"
              value={correctCount}
              icon={<Check className="h-4 w-4" />}
              color="green"
            />
            <StatCard
              label="Wrong"
              value={wrongCount}
              icon={<X className="h-4 w-4" />}
              color="red"
            />
            <StatCard
              label="Skipped"
              value={unansweredCount}
              icon={<Minus className="h-4 w-4" />}
              color="gray"
            />
          </div>

          {/* Actions */}
          <div className="mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:justify-center">
            {!isPastDue && (
              <button
                type="button"
                onClick={onReattempt}
                disabled={isReattempting}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
              >
                {isReattempting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Reattempt Quiz
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onMarkComplete}
              disabled={isMarkingComplete}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isMarkingComplete ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Marking...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Mark as Complete
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Course
            </button>
          </div>

          {/* Previous attempts (re-attempt history) */}
          {attempts && attempts.length > 1 && (
            <div className="mb-8">
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                Previous attempts
              </h3>
              <div className="flex flex-col gap-2">
                {attempts.map((a) => {
                  const active = a.id === viewingAttemptId;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onViewAttempt?.(a.id)}
                      disabled={a.status === "IN_PROGRESS"}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:bg-muted/40",
                        a.status === "IN_PROGRESS" &&
                          "cursor-default opacity-60"
                      )}
                    >
                      <span className="font-medium text-foreground">
                        Attempt {a.attempt_number}
                        {active && (
                          <span className="ml-2 text-xs text-primary">
                            (viewing)
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-3 text-muted-foreground">
                        <span>
                          {a.score}/{a.total_marks} ({a.percentage}%)
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            a.status === "PASSED"
                              ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                              : a.status === "IN_PROGRESS"
                                ? "bg-muted text-muted-foreground"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          )}
                        >
                          {a.status === "IN_PROGRESS"
                            ? "In progress"
                            : a.status === "PASSED"
                              ? "Passed"
                              : "Not passed"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Answer Review */}
          <div>
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Answer Review
            </h3>
            <div className="flex flex-col gap-4">
              {questions.map((q, idx) => {
                // For multi-blank the learner picks one option per blank, so
                // "selected" is a set; for MCQ it's the single chosen option.
                const selectedIds = isMultiBlank(q)
                  ? new Set(userAnswerArray(q).filter(Boolean))
                  : new Set(
                      q.user_selected_option_id
                        ? [q.user_selected_option_id]
                        : []
                    );
                const hasCorrectData = q.options.some(
                  (o) => o.is_correct !== undefined
                );

                return (
                  <div
                    key={q.id}
                    className="overflow-hidden rounded-xl border border-border/50"
                  >
                    {/* Question header */}
                    <div className="border-b border-border/50 bg-muted/20 px-4 py-3 sm:px-5">
                      <p className="text-sm font-semibold text-foreground">
                        <span className="mr-2 text-muted-foreground">
                          Q{idx + 1}.
                        </span>
                        {getQuestionText(q)}
                      </p>
                      {q.marks > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {q.marks} {q.marks === 1 ? "mark" : "marks"}
                        </p>
                      )}
                    </div>

                    {/* Options */}
                    <div className="divide-y divide-border/30">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = opt.is_correct === true;
                        const isUserSelected = selectedIds.has(opt.id);
                        const isWrongSelection = isUserSelected && !isCorrect;
                        const letter = OPTION_LETTERS[optIdx] ?? String(optIdx + 1);

                        return (
                          <div
                            key={opt.id}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 sm:px-5",
                              hasCorrectData && isCorrect &&
                                "bg-green-50/50 dark:bg-green-950/20",
                              hasCorrectData && isWrongSelection &&
                                "bg-red-50/50 dark:bg-red-950/20"
                            )}
                          >
                            {/* Letter */}
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                                hasCorrectData && isCorrect
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                                  : hasCorrectData && isWrongSelection
                                    ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                                    : "bg-muted text-muted-foreground"
                              )}
                            >
                              {hasCorrectData && isCorrect ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : hasCorrectData && isWrongSelection ? (
                                <X className="h-3.5 w-3.5" />
                              ) : (
                                letter
                              )}
                            </span>

                            {/* Text */}
                            <div className="flex-1 pt-0.5">
                              <span
                                className={cn(
                                  "text-sm",
                                  hasCorrectData && isCorrect &&
                                    "font-medium text-green-700 dark:text-green-300",
                                  hasCorrectData && isWrongSelection &&
                                    "font-medium text-red-700 dark:text-red-300",
                                  !isCorrect && !isWrongSelection &&
                                    "text-muted-foreground"
                                )}
                              >
                                {getOptionText(opt)}
                              </span>
                              {isUserSelected && (
                                <span
                                  className={cn(
                                    "ml-2 text-xs font-semibold",
                                    isCorrect
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-red-600 dark:text-red-400"
                                  )}
                                >
                                  (Your answer)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "green" | "red" | "gray";
}) {
  const colorMap = {
    green: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    gray: "bg-muted text-muted-foreground",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl px-3 py-4",
        colorMap[color]
      )}
    >
      {icon}
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-wider opacity-80">
        {label}
      </span>
    </div>
  );
}
