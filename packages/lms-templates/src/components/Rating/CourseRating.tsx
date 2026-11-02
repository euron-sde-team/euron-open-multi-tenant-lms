"use client";

import React, { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import type { LMSRating, LMSRatingSummary } from "../../types";
import { StarRating } from "./StarRating";
import { cn, formatRelativeTime, getInitials } from "../../lib/utils";

interface CourseRatingProps {
  /** Rating summary */
  summary?: LMSRatingSummary;
  /** List of ratings/reviews */
  ratings: LMSRating[];
  /** Current user's rating (if any) */
  userRating?: LMSRating | null;
  /** Called when rating is submitted */
  onSubmit?: (rating: number, review?: string) => Promise<void>;
  /** Whether submission is loading */
  isLoading?: boolean;
  /** Title for the section */
  title?: string;
  /** Show individual reviews */
  showReviews?: boolean;
  /** Maximum reviews to show initially */
  maxReviews?: number;
  /** Additional class name */
  className?: string;
}

export function CourseRating({
  summary,
  ratings,
  userRating,
  onSubmit,
  isLoading = false,
  title = "Course Ratings",
  showReviews = true,
  maxReviews = 5,
  className,
}: CourseRatingProps) {
  const [selectedRating, setSelectedRating] = useState(0);
  const [review, setReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const displayedRatings = showAllReviews ? ratings : ratings.slice(0, maxReviews);

  // Hide the form if user has already submitted a rating
  const hasAlreadyRated = !!userRating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit || selectedRating === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit(selectedRating, review.trim() || undefined);
    } catch (error) {
      console.error("Failed to submit rating:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("space-y-8", className)}>
      {/* Header */}
      <h3 className="text-lg font-semibold">{title}</h3>

      {/* Summary Section */}
      {summary && (
        <div className="flex flex-col gap-6 sm:flex-row">
          {/* Average Rating */}
          <div className="flex flex-col items-center sm:items-start">
            <div className="text-4xl font-bold">
              {summary.averageRating.toFixed(1)}
            </div>
            <StarRating value={summary.averageRating} readOnly size="md" />
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.totalRatings} {summary.totalRatings === 1 ? "rating" : "ratings"}
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.ratingDistribution[star as keyof typeof summary.ratingDistribution];
              const percentage =
                summary.totalRatings > 0
                  ? (count / summary.totalRatings) * 100
                  : 0;

              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-6 text-sm">{star}</span>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-yellow-400 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-10 text-sm text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rating Form, only shown if user hasn't rated yet */}
      {onSubmit && !hasAlreadyRated && (
        <form onSubmit={handleSubmit}>
          <h4 className="mb-3 font-medium">Rate This Course</h4>

          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <StarRating
              value={selectedRating}
              onChange={setSelectedRating}
              size="lg"
            />
            {selectedRating > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedRating === 1 && "Poor"}
                {selectedRating === 2 && "Fair"}
                {selectedRating === 3 && "Good"}
                {selectedRating === 4 && "Very Good"}
                {selectedRating === 5 && "Excellent"}
              </span>
            )}
          </div>

          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Share your experience with this course (optional)"
            rows={3}
            className={cn(
              "w-full resize-none rounded-lg border px-3 py-2 text-sm",
              "bg-background placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/50"
            )}
            disabled={isSubmitting}
          />

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || selectedRating === 0}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2",
                "bg-primary text-sm font-medium text-primary-foreground",
                "transition-colors hover:bg-primary/90",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Rating</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Reviews List */}
      {showReviews && ratings.length > 0 && (
        <div className="space-y-1">
          <h4 className="mb-4 font-medium">Reviews</h4>

          {isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse py-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-4 w-32 rounded bg-muted" />
                      <div className="h-12 w-full rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {displayedRatings.map((rating) => (
                <div key={rating.id} className="py-4 first:pt-0">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {rating.userAvatar ? (
                        <img
                          src={rating.userAvatar}
                          alt={rating.userName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <span className="text-sm font-medium text-muted-foreground">
                            {getInitials(rating.userName)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {rating.userName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(rating.createdAt)}
                        </span>
                      </div>

                      <StarRating
                        value={rating.rating}
                        readOnly
                        size="sm"
                        className="mt-1"
                      />

                      {rating.review && (
                        <p className="mt-2 text-sm text-foreground/80">
                          {rating.review}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {ratings.length > maxReviews && (
                <button
                  onClick={() => setShowAllReviews(!showAllReviews)}
                  className="w-full py-3 text-sm text-primary hover:underline"
                >
                  {showAllReviews
                    ? "Show less"
                    : `Show all ${ratings.length} reviews`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && ratings.length === 0 && !summary && (
        <div className="py-8 text-center">
          <Star className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">
            No ratings yet. Be the first to rate this course!
          </p>
        </div>
      )}
    </div>
  );
}

export default CourseRating;
