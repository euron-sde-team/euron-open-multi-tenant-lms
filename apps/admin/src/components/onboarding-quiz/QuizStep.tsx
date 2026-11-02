"use client";

import { Button, cn } from "@open-mtlms/core";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import type { QuizQuestion } from "./quiz.config";

interface Props {
  question: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  selectedSingle?: string;
  selectedMulti?: string[];
  onSelectSingle: (value: string) => void;
  onToggleMulti: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function QuizStep({
  question,
  questionIndex,
  totalQuestions,
  selectedSingle,
  selectedMulti = [],
  onSelectSingle,
  onToggleMulti,
  onBack,
  onNext,
}: Props) {
  const isMulti = question.multi;
  // Multi-select can advance even with zero selections (treated as "skip").
  const canAdvance = isMulti ? true : !!selectedSingle;

  return (
    // Re-mount key on questionIndex makes every question slide in fresh
    // instead of crossfading awkwardly through the previous question's text.
    <div
      key={questionIndex}
      className="flex w-full flex-col animate-in fade-in slide-in-from-right-2 duration-300"
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
        Question {questionIndex + 1} of {totalQuestions}
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {question.label}
      </h1>
      {question.helper && (
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {question.helper}
        </p>
      )}

      <div
        className={cn(
          "mt-7 grid gap-2.5",
          question.options.length > 4 ? "sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        {question.options.map((opt, idx) => {
          const isSelected = isMulti
            ? selectedMulti.includes(opt)
            : selectedSingle === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() =>
                isMulti ? onToggleMulti(opt) : onSelectSingle(opt)
              }
              aria-pressed={isSelected}
              // Stagger entrance: each option fades+slides in 30ms after
              // the previous one. Cheap motion, big perceived polish.
              style={{ animationDelay: `${idx * 30}ms`, animationFillMode: "both" }}
              className={cn(
                "group relative flex items-center justify-between overflow-hidden rounded-xl border bg-card p-4 text-left",
                "animate-in fade-in slide-in-from-bottom-1 duration-300",
                "transition-all duration-200 ease-out will-change-transform",
                "hover:border-primary/50 hover:bg-primary/[0.03] hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5",
                "active:translate-y-0",
                isSelected
                  ? "border-primary bg-primary/[0.06] shadow-md shadow-primary/15 ring-1 ring-primary/30"
                  : "border-border/60",
              )}
            >
              {/* Soft gradient sheen on selected */}
              {isSelected && (
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-primary/[0.03]" />
              )}
              <span
                className={cn(
                  "relative text-sm font-medium transition-colors sm:text-[15px]",
                  isSelected ? "text-foreground" : "text-foreground/85",
                )}
              >
                {opt}
              </span>
              <span
                className={cn(
                  "relative ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                  isSelected
                    ? "scale-100 border-primary bg-primary text-primary-foreground"
                    : "scale-90 border-border/70 bg-transparent text-transparent group-hover:scale-100 group-hover:border-primary/50",
                )}
                aria-hidden="true"
              >
                <Check
                  className={cn(
                    "h-3 w-3 transition-all duration-200",
                    isSelected ? "scale-100 opacity-100" : "scale-50 opacity-0",
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="group rounded-xl"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Back
        </Button>
        {isMulti ? (
          <Button
            type="button"
            onClick={onNext}
            disabled={!canAdvance}
            className="group h-11 rounded-xl px-6 text-sm font-medium shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 disabled:shadow-none"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Pick an option to continue
          </span>
        )}
      </div>
    </div>
  );
}
