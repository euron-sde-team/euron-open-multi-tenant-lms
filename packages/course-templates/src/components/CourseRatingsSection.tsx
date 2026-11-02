"use client";

import { Star } from "lucide-react";
import { cn, formatRelativeTime } from "../lib/utils";
import { useCourseData, useCourseEdit, useIsEditMode } from "../context";
import { CourseSectionWrapper } from "./CourseSectionWrapper";
import type { CourseReviewItem, CourseRatingSummary } from "../types";

export type { CourseReviewItem, CourseRatingSummary };

function formatRatingCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
  return String(count);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";
}

/**
 * Udemy-style course ratings section: summary at top, 2-column grid of reviews.
 * Placed before Course Recommendations. No edit UI.
 */
export function CourseRatingsSection() {
  const { courseData } = useCourseData();
  const { callbacks } = useCourseEdit();
  const isEditMode = useIsEditMode();
  const ratings = (courseData as { ratings?: CourseReviewItem[] }).ratings ?? [];
  const ratingSummary = (courseData as { ratingSummary?: CourseRatingSummary }).ratingSummary;

  const avg = ratingSummary?.averageRating ?? courseData.rating ?? 0;
  const total = ratingSummary?.totalRatings ?? courseData.ratingTotalCount ?? 0;
  const editAvg = (courseData as { adminRatingOverride?: number }).adminRatingOverride ?? courseData.rating ?? 0;
  const editTotal = (courseData as { adminRatingCountOverride?: number }).adminRatingCountOverride ?? courseData.ratingTotalCount ?? 0;

  const hasContent = (avg > 0 && total > 0) || ratings.length > 0;

  return (
    <CourseSectionWrapper
      sectionKey="ratings"
      className="py-8"
      style={{
        backgroundColor: "transparent",
        border: "none",
      }}
    >
      {/* Summary: star + "X.X course rating" + "•" + "X ratings" (or empty state) */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Star className="h-6 w-6 fill-yellow-500 text-yellow-500 shrink-0" />
        {isEditMode && callbacks.onEditRating ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={editAvg || ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) callbacks.onEditRating?.(Math.min(5, Math.max(0, v)), editTotal || undefined);
              }}
              placeholder="0"
              className="w-14 rounded px-1 py-0.5 text-sm border bg-transparent"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            />
            <span style={{ color: "hsl(var(--muted-foreground))" }}>Course Ratings</span>
            <span style={{ color: "hsl(var(--muted-foreground))" }}>•</span>
            <input
              type="number"
              min={0}
              value={editTotal || ""}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v) && v >= 0) callbacks.onEditRating?.(editAvg || 0, v);
              }}
              placeholder="0"
              className="w-16 rounded px-1 py-0.5 text-sm border bg-transparent"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            />
            <span style={{ color: "hsl(var(--muted-foreground))" }}>ratings</span>
          </div>
        ) : hasContent ? (
          <>
            <span className="text-2xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
              {avg.toFixed(1)}
            </span>
            <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>
              Course Ratings
            </span>
            <span style={{ color: "hsl(var(--muted-foreground))" }}>•</span>
            <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>
              {formatRatingCount(total)} ratings
            </span>
          </>
        ) : (
          <span className="font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
            No ratings yet, add a rating above or ratings come from LMS course reviews
          </span>
        )}
      </div>

      {/* 2-column grid of reviews */}
      {ratings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ratings.slice(0, 4).map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-2"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  {r.userAvatar ? (
                    <img
                      src={r.userAvatar}
                      alt={r.userName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: "hsl(var(--primary) / 0.1)",
                        color: "hsl(var(--primary))",
                      }}
                    >
                      {getInitials(r.userName)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm" style={{ color: "hsl(var(--foreground))" }}>{r.userName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn("h-3.5 w-3.5", s <= r.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/40")}
                        />
                      ))}
                    </div>
                    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {formatRelativeTime(r.createdAt)}
                    </span>
                  </div>
                  {r.review && (
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: "hsl(var(--foreground) / 0.8)" }}>
                      {r.review}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CourseSectionWrapper>
  );
}
