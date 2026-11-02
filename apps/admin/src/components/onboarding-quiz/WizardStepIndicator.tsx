"use client";

import { Check } from "lucide-react";

import { cn } from "@open-mtlms/core";

// Three top-level stages for the onboarding flow. Each stage may contain
// sub-steps (e.g. "Quiz" wraps 5 questions); sub-progress is rendered by
// the wizard separately with a smaller dot bar.
//
// Pattern lifted from
// `apps/admin/src/components/pages/onboarding-wizard/onboarding-wizard.tsx`
// (StepIndicator at lines 30-71) and slimmed to 3 circles.
export const WIZARD_STAGES = [
  { id: "about", label: "About you" },
  { id: "quiz", label: "Quiz" },
  { id: "live", label: "Going live" },
] as const;

export type WizardStageId = (typeof WIZARD_STAGES)[number]["id"];

interface Props {
  current: WizardStageId;
}

export function WizardStepIndicator({ current }: Props) {
  const currentIndex = WIZARD_STAGES.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center justify-center gap-2">
      {WIZARD_STAGES.map((stage, i) => {
        const isActive = stage.id === current;
        const isCompleted = i < currentIndex;
        return (
          <div key={stage.id} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 sm:w-12 transition-colors duration-300",
                  isCompleted || isActive ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300",
                  isActive &&
                    "bg-primary text-primary-foreground shadow-sm shadow-primary/30",
                  isCompleted && "bg-primary text-primary-foreground",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-full bg-primary/40 animate-pulse-ring"
                    aria-hidden
                  />
                )}
                <span className="relative">
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
              </div>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline transition-colors duration-300",
                  isActive
                    ? "text-foreground"
                    : isCompleted
                      ? "text-foreground/80"
                      : "text-muted-foreground",
                )}
              >
                {stage.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
