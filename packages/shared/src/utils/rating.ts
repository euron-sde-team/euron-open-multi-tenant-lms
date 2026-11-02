/**
 * Course rating display precedence.
 *
 * A course carries two independent rating sources:
 *   1. Admin-authored numbers stored on the landing page hero section
 *      (tenant_pages -> "course-hero" content.rating / content.ratingTotalCount)
 *   2. Real learner reviews aggregated from the course_reviews table
 *
 * Rule: the admin-authored pair ALWAYS wins when present. Learner reviews are
 * still listed in the ratings section; they only supply the headline numbers
 * when the admin has not set any.
 *
 * This lives here (and not inline in each caller) because the rule was
 * previously duplicated in apps/web, apps/admin and course-templates, and the
 * copies drifted apart.
 */

export interface CourseRatingSummaryInput {
  averageRating: number;
  totalRatings: number;
}

export interface ResolvedCourseRating {
  rating?: number;
  ratingTotalCount?: number;
}

/** True when the admin has authored a rating or a rating count on the hero. */
export function hasAdminAuthoredRating(
  rating: number | null | undefined,
  ratingTotalCount: number | null | undefined
): boolean {
  return (
    (typeof rating === "number" && rating > 0) ||
    (typeof ratingTotalCount === "number" && ratingTotalCount > 0)
  );
}

/**
 * Resolve the rating numbers to display for a course.
 *
 * Admin-authored values are treated as a single unit so the headline average
 * and its count can never come from two different sources (which would render
 * misleading combinations such as "4.8 (1 rating)").
 */
export function resolveCourseRating(
  adminRating: number | null | undefined,
  adminRatingTotalCount: number | null | undefined,
  lmsSummary?: CourseRatingSummaryInput | null
): ResolvedCourseRating {
  if (hasAdminAuthoredRating(adminRating, adminRatingTotalCount)) {
    return {
      rating: adminRating ?? undefined,
      ratingTotalCount: adminRatingTotalCount ?? undefined,
    };
  }

  if (lmsSummary && lmsSummary.totalRatings > 0) {
    return {
      rating: lmsSummary.averageRating,
      ratingTotalCount: lmsSummary.totalRatings,
    };
  }

  return {
    rating: adminRating ?? undefined,
    ratingTotalCount: adminRatingTotalCount ?? undefined,
  };
}
