"use client";

import React, { useState } from "react";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { StarRating } from "./StarRating";
import { cn } from "../../lib/utils";

interface LessonRatingProps {
  /** Current user's rating (if any) */
  userRating?: number | null;
  /** Average rating for this lesson */
  averageRating?: number;
  /** Total ratings count */
  totalRatings?: number;
  /** Called when rating is submitted */
  onSubmit?: (rating: number) => Promise<void>;
  /** Display variant */
  variant?: "stars" | "thumbs" | "compact";
  /** Whether submission is loading */
  isLoading?: boolean;
  /** Additional class name */
  className?: string;
}

export function LessonRating({
  userRating,
  averageRating,
  totalRatings = 0,
  onSubmit,
  variant = "compact",
  isLoading = false,
  className,
}: LessonRatingProps) {
  const [selectedRating, setSelectedRating] = useState(userRating || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thumbsValue, setThumbsValue] = useState<"up" | "down" | null>(
    userRating ? (userRating >= 3 ? "up" : "down") : null
  );

  const handleStarRating = async (value: number) => {
    if (!onSubmit || value === selectedRating) return;
    
    setSelectedRating(value);
    setIsSubmitting(true);
    try {
      await onSubmit(value);
    } catch (error) {
      setSelectedRating(userRating || 0);
      console.error("Failed to submit rating:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThumbsRating = async (value: "up" | "down") => {
    if (!onSubmit) return;
    
    const rating = value === "up" ? 5 : 1;
    if (thumbsValue === value) return;
    
    setThumbsValue(value);
    setIsSubmitting(true);
    try {
      await onSubmit(rating);
    } catch (error) {
      setThumbsValue(userRating ? (userRating >= 3 ? "up" : "down") : null);
      console.error("Failed to submit rating:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Thumbs variant
  if (variant === "thumbs") {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <span className="text-sm text-muted-foreground">Was this helpful?</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleThumbsRating("up")}
            disabled={isSubmitting}
            className={cn(
              "p-2 rounded-lg transition-colors",
              "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              thumbsValue === "up" && "text-green-600 bg-green-50 dark:bg-green-950/50"
            )}
            title="Yes, helpful"
          >
            <ThumbsUp
              className={cn(
                "h-5 w-5",
                thumbsValue === "up" && "fill-current"
              )}
            />
          </button>
          <button
            onClick={() => handleThumbsRating("down")}
            disabled={isSubmitting}
            className={cn(
              "p-2 rounded-lg transition-colors",
              "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              thumbsValue === "down" && "text-red-600 bg-red-50 dark:bg-red-950/50"
            )}
            title="Not helpful"
          >
            <ThumbsDown
              className={cn(
                "h-5 w-5",
                thumbsValue === "down" && "fill-current"
              )}
            />
          </button>
        </div>
      </div>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-2">
          <StarRating
            value={selectedRating || averageRating || 0}
            onChange={onSubmit ? handleStarRating : undefined}
            readOnly={!onSubmit || isSubmitting}
            size="sm"
          />
          {averageRating !== undefined && (
            <span className="text-sm text-muted-foreground">
              {averageRating.toFixed(1)}
            </span>
          )}
        </div>
        {totalRatings > 0 && (
          <span className="text-xs text-muted-foreground">
            ({totalRatings})
          </span>
        )}
        {isSubmitting && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  // Stars variant (full)
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Rate this lesson</span>
        {averageRating !== undefined && totalRatings > 0 && (
          <span className="text-sm text-muted-foreground">
            Avg: {averageRating.toFixed(1)} ({totalRatings} ratings)
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <StarRating
          value={selectedRating}
          onChange={onSubmit ? handleStarRating : undefined}
          readOnly={!onSubmit || isSubmitting}
          size="md"
        />
        {isSubmitting && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {selectedRating > 0 && !isSubmitting && (
          <span className="text-sm text-muted-foreground">
            {selectedRating === 1 && "Poor"}
            {selectedRating === 2 && "Fair"}
            {selectedRating === 3 && "Good"}
            {selectedRating === 4 && "Very Good"}
            {selectedRating === 5 && "Excellent"}
          </span>
        )}
      </div>
    </div>
  );
}

export default LessonRating;
