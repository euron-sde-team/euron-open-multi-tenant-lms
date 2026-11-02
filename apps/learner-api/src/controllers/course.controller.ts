/**
 * Public course controller, serves published course LMS data, reviews, and QnA.
 */

import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import courseService from "../services/course.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/** Safely extract a single route param as string (Express 5 types params as string | string[]). */
function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

function getTenantMemberId(req: Request): string {
  const user = req.user as { id: string } | undefined;
  if (!user?.id) throw new UnauthorizedError("Authentication required");
  return user.id;
}

/**
 * GET /courses
 * List published courses with pagination.
 * Query params: page, limit, sortBy, sortOrder, mode, course_type
 */
export const listPublishedCourses = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);

  // Parse query params
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 8;
  const VALID_SORT_COLUMNS = ["created_at", "title", "sort_order"] as const;
  const rawSortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "";
  const sortBy = VALID_SORT_COLUMNS.includes(rawSortBy as any)
    ? (rawSortBy as "created_at" | "title" | "sort_order")
    : "sort_order";
  const sortOrder = typeof req.query.sortOrder === "string"
    ? (req.query.sortOrder as "asc" | "desc")
    : "asc";

  // Parse mode query param (LIVE, SELF_PACED, HYBRID)
  const validModes = ["SELF_PACED"];
  const modeParam = typeof req.query.mode === "string" ? req.query.mode.toUpperCase() : undefined;
  const mode = modeParam && validModes.includes(modeParam)
    ? (modeParam as "SELF_PACED")
    : undefined;

  // Parse course_type query param (NORMAL, PROJECT)
  const validCourseTypes = ["NORMAL", "PROJECT"];
  const courseTypeParam = typeof req.query.course_type === "string" ? req.query.course_type.toUpperCase() : undefined;
  const courseType = courseTypeParam && validCourseTypes.includes(courseTypeParam)
    ? (courseTypeParam as "NORMAL" | "PROJECT")
    : undefined;

  // Parse category query param (filter by category slug)
  const categorySlug = typeof req.query.category === "string" ? req.query.category.trim() : undefined;

  const bookmarkedOnly =
    typeof req.query.bookmarked_only === "string" &&
    req.query.bookmarked_only.toLowerCase() === "true";
  const enrolledOnly =
    typeof req.query.enrolled_only === "string" &&
    req.query.enrolled_only.toLowerCase() === "true";
  const completedOnly =
    typeof req.query.completed_only === "string" &&
    req.query.completed_only.toLowerCase() === "true";
  const purchaseModeParam = typeof req.query.purchase_mode === "string" ? req.query.purchase_mode.toUpperCase() : undefined;
  const purchaseMode =
    purchaseModeParam === "FREE" || purchaseModeParam === "PAID" ? purchaseModeParam : undefined;

  const memberId = req.user?.id;
  const data = await courseService.listPublishedCourses(
    tenantId,
    {
      page,
      limit,
      sortBy,
      sortOrder,
      mode,
      courseType,
      categorySlug,
      bookmarkedOnly,
      enrolledOnly,
      purchaseMode,
      completedOnly,
      // Tenant-level gate: restrict this learner to enrolled courses only.
      enforceEnrolledOnly: req.tenant?.enrolledCoursesOnly === true,
    },
    memberId
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Courses retrieved successfully",
  });
};

/**
 * GET /courses/by-slug/:slug
 * Returns full LMS tree for a published course.
 */
export const getCourseBySlug = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(param(req, "slug") || "");
  if (!slug) throw new NotFoundError("Slug is required");

  const memberId = req.user?.id;
  const data = await courseService.getPublishedCourseBySlug(tenantId, slug, memberId);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Course retrieved successfully",
  });
};

/**
 * GET /courses/:courseId/reviews
 * List reviews for a course.
 */
export const getCourseReviews = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");

  const data = await courseService.listReviews(tenantId, courseId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Reviews retrieved successfully",
  });
};

/**
 * POST /courses/:courseId/reviews
 * Create a review (auth required; one per member per course).
 */
export const createCourseReview = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const tenantMemberId = getTenantMemberId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");

  const body = req.body as { rating?: number; review_text?: string | null };
  const rating = typeof body?.rating === "number" ? body.rating : 0;
  const review_text = body?.review_text ?? null;

  const review = await courseService.createReview(tenantId, courseId, tenantMemberId, {
    rating,
    review_text,
  });
  sendSuccessResponse({
    res,
    data: review,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Review submitted successfully",
  });
};

/**
 * GET /courses/:courseId/access-status
 * Auth required. Returns { has_access, reason? } for re-checking access
 * on lecture change or tab focus without re-fetching the curriculum.
 */
export const getCourseAccessStatus = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const tenantId = getTenantId(req);
  const tenantMemberId = getTenantMemberId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");
  const status = await courseService.getAccessStatus(
    tenantId,
    courseId,
    tenantMemberId
  );
  sendSuccessResponse({
    res,
    data: status,
    statusCode: HttpSuccessStatus.OK,
    message: "Access status retrieved",
  });
};
