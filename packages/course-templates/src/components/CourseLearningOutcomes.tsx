"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";

interface CourseLearningOutcomesProps {
  outcomes: string[];
  className?: string;
  variant?: "card" | "inline";
}

export function CourseLearningOutcomes({
  outcomes,
  className,
  variant = "card",
}: CourseLearningOutcomesProps) {
  if (outcomes.length === 0) {
    return null;
  }

  if (variant === "inline") {
    return (
      <div className={cn("space-y-4", className)}>
        {outcomes.map((outcome, index) => (
          <div key={index} className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "hsl(var(--primary))" }} />
            <span className="text-lg" style={{ color: "hsl(var(--card-foreground))" }}>
              {outcome}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section
      className={cn("rounded-xl border p-6", className)}
      style={{
        backgroundColor: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <h2
        className="text-xl font-bold mb-6 flex items-center gap-2"
        style={{ color: "hsl(var(--card-foreground))" }}
      >
        <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
        What You&apos;ll Learn
      </h2>
      <div className="space-y-2">
        {outcomes.map((outcome, index) => (
          <div key={index} className="flex items-start gap-3 py-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "hsl(var(--primary))" }} />
            <span className="text-sm" style={{ color: "hsl(var(--card-foreground))" }}>
              {outcome}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
