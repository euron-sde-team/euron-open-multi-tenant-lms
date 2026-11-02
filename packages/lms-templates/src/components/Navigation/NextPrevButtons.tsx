"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LMSLesson } from "../../types";
import { cn } from "../../lib/utils";

interface NextPrevButtonsProps {
  /** Previous lesson (null if at start) */
  previousLesson: LMSLesson | null;
  /** Next lesson (null if at end) */
  nextLesson: LMSLesson | null;
  /** Called when navigating to previous */
  onPrevious?: () => void;
  /** Called when navigating to next */
  onNext?: () => void;
  /** Display variant */
  variant?: "full" | "compact" | "icon-only";
  /** Additional class name */
  className?: string;
}

export function NextPrevButtons({
  previousLesson,
  nextLesson,
  onPrevious,
  onNext,
  variant = "full",
  className,
}: NextPrevButtonsProps) {
  // Icon-only variant
  if (variant === "icon-only") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <button
          onClick={onPrevious}
          disabled={!previousLesson}
          className={cn(
            "p-2 rounded-lg border transition-colors",
            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={previousLesson ? `Previous: ${previousLesson.title}` : "No previous lesson"}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={onNext}
          disabled={!nextLesson}
          className={cn(
            "p-2 rounded-lg border transition-colors",
            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={nextLesson ? `Next: ${nextLesson.title}` : "No next lesson"}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center justify-between gap-4", className)}>
        <button
          onClick={onPrevious}
          disabled={!previousLesson}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="text-sm">Previous</span>
        </button>
        <button
          onClick={onNext}
          disabled={!nextLesson}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <span className="text-sm">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Full variant (default)
  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      {/* Previous Button */}
      <button
        onClick={onPrevious}
        disabled={!previousLesson}
        className={cn(
          "flex flex-col items-start p-4 rounded-lg border text-left transition-colors",
          "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
          <span>Previous</span>
        </div>
        {previousLesson ? (
          <span className="mt-1 font-medium text-sm break-words line-clamp-2">
            {previousLesson.title}
          </span>
        ) : (
          <span className="mt-1 text-sm text-muted-foreground">
            No previous lesson
          </span>
        )}
      </button>

      {/* Next Button */}
      <button
        onClick={onNext}
        disabled={!nextLesson}
        className={cn(
          "flex flex-col items-end p-4 rounded-lg text-right transition-colors",
          "bg-primary/5 border border-primary/20 hover:bg-primary/10",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted"
        )}
      >
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>Next</span>
          <ChevronRight className="h-4 w-4" />
        </div>
        {nextLesson ? (
          <span className="mt-1 font-medium text-sm break-words line-clamp-2 text-primary">
            {nextLesson.title}
          </span>
        ) : (
          <span className="mt-1 text-sm text-muted-foreground">
            Course completed!
          </span>
        )}
      </button>
    </div>
  );
}

export default NextPrevButtons;
