"use client";

import { cn } from "@open-mtlms/core";

interface QuizProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

export function QuizProgressBar({ current, total, className }: QuizProgressBarProps) {
  const percent = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;

  return (
    <div className={cn("h-1 w-full bg-muted", className)}>
      <div
        className="h-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
