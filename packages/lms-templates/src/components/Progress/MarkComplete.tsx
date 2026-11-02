"use client";

import React, { useState } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface MarkCompleteProps {
  /** Whether the lesson is completed */
  isCompleted: boolean;
  /** Called when completion status is toggled */
  onToggle: () => Promise<void>;
  /** Whether toggle is disabled */
  disabled?: boolean;
  /** Display variant */
  variant?: "button" | "checkbox" | "icon";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Label text */
  label?: string;
  /** Show label */
  showLabel?: boolean;
  /** Additional class name */
  className?: string;
}

const ICON_SIZES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function MarkComplete({
  isCompleted,
  onToggle,
  disabled = false,
  variant = "button",
  size = "md",
  label,
  showLabel = true,
  className,
}: MarkCompleteProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    try {
      await onToggle();
    } catch (error) {
      console.error("Failed to toggle completion:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const defaultLabel = isCompleted ? "Completed" : "Mark as Complete";
  const displayLabel = label || defaultLabel;

  // Icon variant
  if (variant === "icon") {
    return (
      <button
        onClick={handleToggle}
        disabled={disabled || isLoading}
        className={cn(
          "relative rounded-full transition-all",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isCompleted
            ? "text-green-600 bg-green-100 dark:bg-green-900/50"
            : "text-muted-foreground bg-muted hover:bg-muted/80",
          size === "sm" && "p-1",
          size === "md" && "p-1.5",
          size === "lg" && "p-2",
          className
        )}
        title={displayLabel}
      >
        {isLoading ? (
          <Loader2 className={cn(ICON_SIZES[size], "animate-spin")} />
        ) : isCompleted ? (
          <Check className={ICON_SIZES[size]} />
        ) : (
          <Circle className={ICON_SIZES[size]} />
        )}
      </button>
    );
  }

  // Checkbox variant
  if (variant === "checkbox") {
    return (
      <label
        className={cn(
          "flex items-center gap-2 cursor-pointer",
          (disabled || isLoading) && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <div
          className={cn(
            "relative flex items-center justify-center rounded border-2 transition-all",
            isCompleted
              ? "bg-green-600 border-green-600 text-white"
              : "bg-background border-muted-foreground/30 hover:border-primary",
            size === "sm" && "h-4 w-4",
            size === "md" && "h-5 w-5",
            size === "lg" && "h-6 w-6"
          )}
          onClick={handleToggle}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isCompleted ? (
            <Check className="h-3 w-3" />
          ) : null}
        </div>
        {showLabel && (
          <span
            className={cn(
              "select-none",
              size === "sm" && "text-sm",
              size === "md" && "text-sm",
              size === "lg" && "text-base",
              isCompleted && "text-muted-foreground line-through"
            )}
          >
            {displayLabel}
          </span>
        )}
      </label>
    );
  }

  // Button variant (default)
  return (
    <button
      onClick={handleToggle}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg transition-all",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isCompleted
          ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className={cn(ICON_SIZES[size], "animate-spin")} />
      ) : isCompleted ? (
        <Check className={ICON_SIZES[size]} />
      ) : (
        <Circle className={ICON_SIZES[size]} />
      )}
      {showLabel && <span>{displayLabel}</span>}
    </button>
  );
}

export default MarkComplete;
