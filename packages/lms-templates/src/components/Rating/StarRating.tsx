"use client";

import React, { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "../../lib/utils";

interface StarRatingProps {
  /** Current rating value (0-5) */
  value: number;
  /** Maximum rating (default: 5) */
  max?: number;
  /** Called when rating changes */
  onChange?: (value: number) => void;
  /** Whether rating is read-only */
  readOnly?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show numeric value */
  showValue?: boolean;
  /** Additional class name */
  className?: string;
}

const SIZES = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

const GAPS = {
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1.5",
};

export function StarRating({
  value,
  max = 5,
  onChange,
  readOnly = false,
  size = "md",
  showValue = false,
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  const handleClick = (rating: number) => {
    if (!readOnly && onChange) {
      // Allow un-rating by clicking the same star
      onChange(rating === value ? 0 : rating);
    }
  };

  const handleMouseEnter = (rating: number) => {
    if (!readOnly) {
      setHoverValue(rating);
    }
  };

  const handleMouseLeave = () => {
    setHoverValue(null);
  };

  return (
    <div className={cn("flex items-center", GAPS[size], className)}>
      <div
        className={cn("flex items-center", GAPS[size])}
        onMouseLeave={handleMouseLeave}
      >
        {Array.from({ length: max }, (_, i) => {
          const rating = i + 1;
          const isFilled = rating <= displayValue;
          const isHalf = !isFilled && rating - 0.5 <= displayValue;

          return (
            <button
              key={rating}
              type="button"
              onClick={() => handleClick(rating)}
              onMouseEnter={() => handleMouseEnter(rating)}
              disabled={readOnly}
              className={cn(
                "relative transition-transform",
                !readOnly && "hover:scale-110 cursor-pointer",
                readOnly && "cursor-default"
              )}
              aria-label={`Rate ${rating} out of ${max}`}
            >
              <Star
                className={cn(
                  SIZES[size],
                  "transition-colors",
                  isFilled
                    ? "fill-yellow-400 text-yellow-400"
                    : isHalf
                      ? "fill-yellow-400/50 text-yellow-400"
                      : "fill-transparent text-muted-foreground/40"
                )}
              />
            </button>
          );
        })}
      </div>

      {showValue && (
        <span
          className={cn(
            "font-medium text-foreground",
            size === "sm" && "text-sm",
            size === "md" && "text-base",
            size === "lg" && "text-lg"
          )}
        >
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export default StarRating;
