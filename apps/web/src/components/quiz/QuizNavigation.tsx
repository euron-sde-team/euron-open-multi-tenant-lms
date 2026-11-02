"use client";

import { useEffect, useRef } from "react";

import { cn } from "@open-mtlms/core";
import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";

interface QuizNavigationProps {
  currentIndex: number;
  total: number;
  answeredQuestions: Set<string>;
  questionIds: string[];
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  className?: string;
}

export function QuizNavigation({
  currentIndex,
  total,
  answeredQuestions,
  questionIds,
  onPrev,
  onNext,
  onGoTo,
  onSubmit,
  isSubmitting,
  className,
}: QuizNavigationProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;
  const answeredCount = answeredQuestions.size;
  const currentDotRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    currentDotRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentIndex]);

  return (
    <div
      className={cn(
        "border-t border-border/50 bg-background/95 backdrop-blur-sm",
        className
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        {/* Previous */}
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Question dots, desktop */}
        <div className="mx-3 hidden min-w-0 flex-1 md:block">
          <div className="overflow-x-auto px-1 py-1.5 [scrollbar-width:thin]">
            <div className="mx-auto flex w-max items-center gap-1.5">
              {questionIds.map((qId, idx) => {
                const isAnswered = answeredQuestions.has(qId);
                const isCurrent = idx === currentIndex;

                return (
                  <button
                    key={qId}
                    ref={isCurrent ? currentDotRef : undefined}
                    type="button"
                    onClick={() => onGoTo(idx)}
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full transition-all",
                      isCurrent
                        ? "scale-125 bg-primary ring-2 ring-primary/30"
                        : isAnswered
                          ? "bg-primary/60 hover:bg-primary"
                          : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
                    )}
                    aria-label={`Go to question ${idx + 1}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Question counter, mobile */}
        <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground md:hidden">
          <span className="font-semibold text-foreground">
            {currentIndex + 1}
          </span>
          <span>/</span>
          <span>{total}</span>
          <span className="ml-1 text-xs">
            ({answeredCount} answered)
          </span>
        </div>

        {/* Next / Submit */}
        {isLast ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || answeredCount === 0}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Submitting...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Submit Quiz</span>
                <span className="sm:hidden">Submit</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
