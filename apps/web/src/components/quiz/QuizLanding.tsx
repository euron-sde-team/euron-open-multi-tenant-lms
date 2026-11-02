"use client";

import { cn } from "@open-mtlms/core";
import {
  HelpCircle,
  Trophy,
  Clock,
  FileText,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface QuizLandingProps {
  title: string;
  courseTitle: string;
  instructions: string | null;
  questionCount: number;
  maxScore: number;
  passPercentage: number;
  dueDate: string | null;
  /** Overall time limit in minutes; null = untimed. */
  durationMin?: number | null;
  isPastDue: boolean;
  hasInProgressAttempt: boolean;
  onStart: () => void;
  onClose: () => void;
  isStarting: boolean;
  className?: string;
}

export function QuizLanding({
  title,
  courseTitle,
  instructions,
  questionCount,
  maxScore,
  passPercentage,
  dueDate,
  durationMin,
  isPastDue,
  hasInProgressAttempt,
  onStart,
  onClose,
  isStarting,
  className,
}: QuizLandingProps) {
  return (
    <div
      className={cn(
        "flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6",
        className
      )}
    >
      <div className="w-full max-w-lg">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-primary/10 p-5">
            <HelpCircle className="h-12 w-12 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {courseTitle}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
        </div>

        {/* Instructions */}
        {instructions?.trim() && (
          <div className="mb-6 rounded-xl border border-border/50 bg-muted/30 p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4" />
              Instructions
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {instructions}
            </p>
          </div>
        )}

        {/* Meta */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetaCard
            label="Questions"
            value={String(questionCount)}
            icon={<FileText className="h-4 w-4" />}
          />
          <MetaCard
            label="Max Score"
            value={String(maxScore)}
            icon={<Trophy className="h-4 w-4" />}
          />
          <MetaCard
            label="Pass %"
            value={`${passPercentage}%`}
            icon={<Trophy className="h-4 w-4" />}
          />
          {durationMin != null && (
            <MetaCard
              label="Time Limit"
              value={`${durationMin} min`}
              icon={<Clock className="h-4 w-4" />}
            />
          )}
          {dueDate && (
            <MetaCard
              label="Due Date"
              value={new Date(dueDate).toLocaleDateString()}
              icon={<Clock className="h-4 w-4" />}
            />
          )}
        </div>

        {/* Past due warning */}
        {isPastDue && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              The due date for this quiz has passed.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {!isPastDue && (
            <button
              type="button"
              onClick={onStart}
              disabled={isStarting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : hasInProgressAttempt ? (
                "Resume Quiz"
              ) : (
                "Start Quiz"
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Course
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
