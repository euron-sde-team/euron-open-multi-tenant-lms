import { db } from "../db/connection";

export interface CourseRatingSummary {
  averageRating: number;
  totalRatings: number;
}

export interface CourseReviewRow {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  rating: number;
  review_text: string | null;
  is_visible: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * List reviews for a course (visible only by default; admin can show hidden).
 */
export async function findReviewsByCourseId(
  tenantId: string,
  courseId: string,
  options?: { showHidden?: boolean }
): Promise<CourseReviewRow[]> {
  const base = db
    .selectFrom("course_reviews")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId);
  const q = options?.showHidden
    ? base.orderBy("created_at", "desc")
    : base.where("is_visible", "=", true).orderBy("created_at", "desc");
  const rows = await q.execute();
  return rows as unknown as CourseReviewRow[];
}

/**
 * Get average rating and total count for a course from course_reviews.
 * Only includes visible reviews (is_visible = true).
 */
export async function getCourseRatingSummary(
  tenantId: string,
  courseId: string
): Promise<CourseRatingSummary> {
  const row = await db
    .selectFrom("course_reviews")
    .select([
      db.fn.avg<number>("rating").as("average_rating"),
      db.fn.count<number>("id").as("total_ratings"),
    ])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .where("is_visible", "=", true)
    .executeTakeFirst();

  const avg = row?.average_rating;
  const total = Number(row?.total_ratings ?? 0);

  // When no reviews, return 0 for both; caller can hide rating when totalRatings === 0
  return {
    averageRating: total > 0 && avg != null ? Number(Number(avg).toFixed(1)) : 0,
    totalRatings: total,
  };
}
