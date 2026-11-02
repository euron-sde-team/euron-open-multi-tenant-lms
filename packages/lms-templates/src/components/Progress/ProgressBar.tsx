"use client";

import React from "react";
import { cn } from "../../lib/utils";

interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show percentage text */
  showLabel?: boolean;
  /** Label position */
  labelPosition?: "inside" | "outside" | "top";
  /** Color variant */
  variant?: "default" | "success" | "warning" | "info";
  /** Animate the progress bar */
  animated?: boolean;
  /** Additional class name */
  className?: string;
}

const SIZES = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

const COLORS = {
  default: "bg-primary",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  info: "bg-blue-500",
};

export function ProgressBar({
  value,
  max = 100,
  size = "md",
  showLabel = false,
  labelPosition = "outside",
  variant = "default",
  animated = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  // Determine color based on progress if using default variant
  const getProgressColor = () => {
    if (variant !== "default") return COLORS[variant];
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 70) return "bg-primary";
    if (percentage >= 30) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Top Label */}
      {showLabel && labelPosition === "top" && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-foreground">Progress</span>
          <span className="text-sm text-muted-foreground">
            {Math.round(percentage)}%
          </span>
        </div>
      )}

      {/* Progress Bar Container */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex-1 rounded-full bg-muted overflow-hidden",
            SIZES[size]
          )}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              getProgressColor(),
              animated && "animate-pulse"
            )}
            style={{ width: `${percentage}%` }}
          >
            {/* Inside Label */}
            {showLabel && labelPosition === "inside" && size === "lg" && (
              <span className="flex items-center justify-center h-full text-xs font-medium text-white">
                {Math.round(percentage)}%
              </span>
            )}
          </div>
        </div>

        {/* Outside Label */}
        {showLabel && labelPosition === "outside" && (
          <span className="text-sm font-medium text-muted-foreground min-w-[3rem]">
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    </div>
  );
}

export default ProgressBar;
