import { Request, Response } from "express";
import analyticsService from "../services/analytics.service";
import { BadRequestError } from "../errors/bad-request.error";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { order_status, order_type } from "../db/enums";

function parseDateRange(req: Request) {
  const startDate = (req.query.startDate as string) || undefined;
  const endDate = (req.query.endDate as string) || undefined;
  const nocache = req.query.nocache === "1";
  return { startDate, endDate, nocache };
}

/**
 * Ceiling for endpoints the Download Reports screen pulls from. The table views
 * still request their own small page sizes; this only lifts the clamp so a
 * report export can fetch the whole set in one call instead of silently
 * truncating to the first page.
 */
const EXPORT_MAX_LIMIT = 20000;

function parsePagination(req: Request, defaultLimit = 20, maxLimit = 200) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(parseInt(req.query.limit as string) || defaultLimit, maxLimit);
  const search = (req.query.search as string)?.trim() || undefined;
  return { page, limit, search };
}

export const getAnalyticsOverview = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const data = await analyticsService.getOverview(tenantId, startDate, endDate, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Analytics overview retrieved" });
};

export const getAnalyticsRecentSignups = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 10);
  const data = await analyticsService.getRecentSignups(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Recent signups retrieved" });
};

export const getAnalyticsRecentOrders = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 10);
  const data = await analyticsService.getRecentOrders(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Recent orders retrieved" });
};

export const getAnalyticsRecentSuccessfulPayments = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 10);
  const data = await analyticsService.getRecentSuccessfulPayments(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Recent successful payments retrieved" });
};

export const getAnalyticsUsers = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, search } = parsePagination(req, 50);
  // Allow a large limit so "export all filtered" can pull the full set in one
  // call (capped to keep responses bounded); the table view passes limit=50.
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 20000);

  const csvList = (v: unknown): string[] | undefined => {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return undefined;
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  };
  const num = (v: unknown): number | undefined => {
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
  };
  const filters = {
    courseIds: csvList(req.query.courseIds),
    bundleIds: csvList(req.query.bundleIds),
    minAmount: num(req.query.minAmount),
    maxAmount: num(req.query.maxAmount),
    amountScope: req.query.amountScope === "selected" ? ("selected" as const) : ("total" as const),
    enrollmentStatus: csvList(req.query.enrollmentStatus),
    signupFrom: (req.query.signupFrom as string)?.trim() || undefined,
    signupTo: (req.query.signupTo as string)?.trim() || undefined,
  };

  const data = await analyticsService.getUsersAnalytics(tenantId, startDate, endDate, page, limit, search, nocache, filters);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "User analytics retrieved" });
};

/**
 * The course-wise learner roster, for the Download Reports screen.
 *
 * One row per (learner x course). The Users report answers "who are my
 * learners"; this answers "who is on which course, and until when", which a
 * member list cannot express because a learner on three courses is one row
 * there and three rows here.
 */
export const getEnrolmentRoster = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate } = parseDateRange(req);
  const search = (req.query.search as string)?.trim() || undefined;
  // Capped for the same reason every other export is: this is a spreadsheet,
  // not a paged screen, and an unbounded roster on a large academy would be a
  // slow query holding a connection while nobody watches.
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 10000) : 10000;

  const rows = await analyticsService.getEnrolmentRoster(
    tenantId,
    startDate,
    endDate,
    limit,
    search
  );

  sendSuccessResponse({
    res,
    data: { rows, total: rows.length },
    statusCode: HttpSuccessStatus.OK,
    message: "Enrolment roster retrieved",
  });
};

const USERS_PROGRESS_SORT_KEYS = [
  "name",
  "overall_progress_pct",
  "quiz_avg",
  "assignment_pct",
  "total_watch_seconds",
  "last_active",
  "courses_enrolled",
] as const;
type UsersProgressSortBy = (typeof USERS_PROGRESS_SORT_KEYS)[number];

export const getAnalyticsUsersProgress = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { page, search } = parsePagination(req, 50);
  // Large cap so an "export all" pull can fetch the full cohort in one call; the
  // table view passes limit=50.
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 20000);
  const nocache = req.query.nocache === "1";

  const rawSort = String(req.query.sortBy ?? "").trim();
  const sortBy = (USERS_PROGRESS_SORT_KEYS as readonly string[]).includes(rawSort)
    ? (rawSort as UsersProgressSortBy)
    : "overall_progress_pct";
  const sortOrder = req.query.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);
  const courseId = String(req.query.courseId ?? "").trim() || undefined;

  const data = await analyticsService.getUsersProgressAnalytics(
    tenantId,
    { page, limit, search, sortBy, sortOrder, courseId },
    nocache
  );
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "User progress analytics retrieved" });
};

export const getAnalyticsUserCourseProgress = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const userId = String(req.params.userId ?? "").trim();
  if (!userId) throw new BadRequestError("User ID is required");
  const data = await analyticsService.getMemberCourseProgressBreakdown(tenantId, userId);
  sendSuccessResponse({ res, data: { courses: data }, statusCode: HttpSuccessStatus.OK, message: "Member course progress retrieved" });
};

export const getAnalyticsCourseLearnerProgress = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const courseId = String(req.params.courseId ?? "").trim();
  if (!courseId) throw new BadRequestError("Course ID is required");
  const data = await analyticsService.getCourseLearnerProgress(tenantId, courseId);
  sendSuccessResponse({ res, data: { learners: data }, statusCode: HttpSuccessStatus.OK, message: "Course learner progress retrieved" });
};

export const getAnalyticsUserDetail = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const userId = String(req.params.userId ?? "").trim();
  if (!userId) throw new BadRequestError("User ID is required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const tenantSlug = (req.query.tenantSlug as string)?.trim() || undefined;
  const data = await analyticsService.getUserDetailAnalytics(tenantId, userId, startDate, endDate, tenantSlug, nocache);
  if (!data) {
    throw new BadRequestError("User not found");
  }
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "User detail analytics retrieved" });
};

export const getAnalyticsCourses = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getCoursesAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Course analytics retrieved" });
};

export const getAnalyticsCourseDetail = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const courseId = String(req.params.courseId ?? "").trim();
  if (!courseId) throw new BadRequestError("Course ID is required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const tenantSlug = (req.query.tenantSlug as string)?.trim() || undefined;
  const data = await analyticsService.getCourseDetailAnalytics(tenantId, courseId, startDate, endDate, tenantSlug, nocache);
  if (!data) {
    throw new BadRequestError("Course not found");
  }
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Course detail analytics retrieved" });
};

export const getAnalyticsBooks = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getBooksAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Book analytics retrieved" });
};

export const getAnalyticsBookDetail = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const bookId = String(req.params.bookId ?? "").trim();
  if (!bookId) throw new BadRequestError("Book ID is required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const tenantSlug = (req.query.tenantSlug as string)?.trim() || undefined;
  const data = await analyticsService.getBookDetailAnalytics(tenantId, bookId, startDate, endDate, tenantSlug, nocache);
  if (!data) {
    throw new BadRequestError("Book not found");
  }
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Book detail analytics retrieved" });
};

export const getAnalyticsBundles = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getBundlesAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Bundle analytics retrieved" });
};

export const getAnalyticsPayments = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, search } = parsePagination(req);
  // Allow a large limit so "export all filtered" can pull the full set in one
  // call (capped to keep responses bounded); the table view passes limit=20.
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 20000);

  // Whitelist enum values, passing an unknown literal would make Postgres throw
  // "invalid input value for enum" and 500 the request.
  const validStatuses = new Set<string>(Object.values(order_status));
  const validTypes = new Set<string>(Object.values(order_type));
  const csvEnum = (v: unknown, allowed: Set<string>): string[] | undefined => {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return undefined;
    const out = s.split(",").map((x) => x.trim()).filter((x) => allowed.has(x));
    return out.length ? out : undefined;
  };
  const num = (v: unknown): number | undefined => {
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
  };
  const filters = {
    statuses: csvEnum(req.query.statuses, validStatuses),
    orderTypes: csvEnum(req.query.orderTypes, validTypes),
    minAmount: num(req.query.minAmount),
    maxAmount: num(req.query.maxAmount),
  };

  const data = await analyticsService.getPaymentsAnalytics(tenantId, startDate, endDate, page, limit, search, nocache, filters);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Payment analytics retrieved" });
};

export const getAnalyticsCertificates = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getCertificatesAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Certificate analytics retrieved" });
};

export const getAnalyticsCertificateDetails = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getCertificateDetails(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Certificate details retrieved" });
};

export const getAnalyticsCoupons = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getCouponsAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Coupon analytics retrieved" });
};

export const getAnalyticsQuizzes = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getQuizzesAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Quiz analytics retrieved" });
};

export const getAnalyticsEngagement = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getEngagementAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Engagement analytics retrieved" });
};

export const getAnalyticsBookReading = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getBookReadingAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Book reading analytics retrieved" });
};

export const getAnalyticsCart = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getCartAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Cart analytics retrieved" });
};

export const getAnalyticsBookmarks = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getBookmarksAnalytics(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Bookmarks analytics retrieved" });
};

export const getAnalyticsBookmarkDetails = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const { page, limit, search } = parsePagination(req, 20, EXPORT_MAX_LIMIT);
  const data = await analyticsService.getBookmarkDetails(tenantId, startDate, endDate, page, limit, search, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Bookmark details retrieved" });
};

export const getAnalyticsCourseWatchTime = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const courseId = String(req.params.courseId ?? "").trim();
  if (!courseId) throw new BadRequestError("courseId is required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const data = await analyticsService.getCourseWatchTime(tenantId, courseId, startDate, endDate, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Course watch-time analytics retrieved" });
};

export const getAnalyticsMemberWatchTime = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const memberId = String(req.params.userId ?? "").trim();
  if (!memberId) throw new BadRequestError("userId is required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const data = await analyticsService.getMemberWatchTime(tenantId, memberId, startDate, endDate, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Member watch-time analytics retrieved" });
};

export const getAnalyticsWatchTimeOverview = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  const { startDate, endDate, nocache } = parseDateRange(req);
  const data = await analyticsService.getWatchTimeOverview(tenantId, startDate, endDate, nocache);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Watch-time overview retrieved" });
};
