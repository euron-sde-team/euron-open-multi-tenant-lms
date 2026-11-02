import { Router } from "express";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  getDashboard,
  getCourseStats,
  getBookStats,
  getEnrollmentBreakdown,
  getBookAccessBreakdown,
  getUserStats,
  getPostHogInsights,
  getPostHogCourseAnalytics,
  getPostHogBookAnalytics,
  getPostHogUserAnalytics,
  getPostHogPageHeatmap,
  getPostHogReplayEmbedToken,
} from "../controllers/dashboard.controller";
import {
  requestAnalyticsExport,
  getAnalyticsExportStatus,
  downloadAnalyticsExport,
} from "../controllers/analytics-export.controller";
import {
  getAnalyticsOverview,
  getAnalyticsRecentSignups,
  getAnalyticsRecentOrders,
  getAnalyticsUsers,
  getEnrolmentRoster,
  getAnalyticsRecentSuccessfulPayments,
  getAnalyticsUsersProgress,
  getAnalyticsUserCourseProgress,
  getAnalyticsCourseLearnerProgress,
  getAnalyticsUserDetail,
  getAnalyticsCourses,
  getAnalyticsCourseDetail,
  getAnalyticsBooks,
  getAnalyticsBookDetail,
  getAnalyticsBundles,
  getAnalyticsPayments,
  getAnalyticsCertificates,
  getAnalyticsCertificateDetails,
  getAnalyticsCoupons,
  getAnalyticsQuizzes,
  getAnalyticsEngagement,
  getAnalyticsBookReading,
  getAnalyticsCart,
  getAnalyticsBookmarks,
  getAnalyticsBookmarkDetails,
  getAnalyticsCourseWatchTime,
  getAnalyticsMemberWatchTime,
  getAnalyticsWatchTimeOverview,
} from "../controllers/analytics.controller";
import { asyncHandler } from "../utils/asynchandler";

const dashboardRouter: Router = Router();

dashboardRouter.use(asyncHandler(authenticateTenantUser));

dashboardRouter.get("/", asyncHandler(requirePermission("analytics.dashboard")), asyncHandler(getDashboard));
dashboardRouter.get("/courses-stats", asyncHandler(requirePermission("analytics.courses")), asyncHandler(getCourseStats));
dashboardRouter.get("/books-stats", asyncHandler(requirePermission("analytics.books")), asyncHandler(getBookStats));
dashboardRouter.get("/enrollment-breakdown", asyncHandler(requirePermission("analytics.courses")), asyncHandler(getEnrollmentBreakdown));
dashboardRouter.get("/book-access-breakdown", asyncHandler(requirePermission("analytics.books")), asyncHandler(getBookAccessBreakdown));
dashboardRouter.get("/users-stats", asyncHandler(requirePermission("analytics.users")), asyncHandler(getUserStats));
dashboardRouter.get("/posthog-insights", asyncHandler(requirePermission("analytics.web")), asyncHandler(getPostHogInsights));
dashboardRouter.get("/posthog-insights/course/:slug", asyncHandler(requirePermission("analytics.web")), asyncHandler(getPostHogCourseAnalytics));
dashboardRouter.get("/posthog-insights/book/:slug", asyncHandler(requirePermission("analytics.web")), asyncHandler(getPostHogBookAnalytics));
dashboardRouter.get("/posthog-insights/user/:userId", asyncHandler(requirePermission("analytics.web")), asyncHandler(getPostHogUserAnalytics));
dashboardRouter.get("/posthog-insights/page-heatmap", asyncHandler(requirePermission("analytics.web")), asyncHandler(getPostHogPageHeatmap));
dashboardRouter.get("/posthog-insights/replay-embed-token", asyncHandler(requirePermission("analytics.web")), asyncHandler(getPostHogReplayEmbedToken));

dashboardRouter.get("/analytics/overview", asyncHandler(requirePermission("analytics.dashboard")), asyncHandler(getAnalyticsOverview));
dashboardRouter.get("/analytics/overview/recent-signups", asyncHandler(requirePermission("analytics.dashboard")), asyncHandler(getAnalyticsRecentSignups));
dashboardRouter.get("/analytics/overview/recent-orders", asyncHandler(requirePermission("analytics.dashboard")), asyncHandler(getAnalyticsRecentOrders));
dashboardRouter.get("/analytics/users", asyncHandler(requirePermission("analytics.users")), asyncHandler(getAnalyticsUsers));
// Course-wise learner roster: one row per learner per course, for the Excel report.
dashboardRouter.get("/analytics/enrolment-roster", asyncHandler(requirePermission("analytics.users")), asyncHandler(getEnrolmentRoster));
// Master cohort table (one row per member). MUST be registered before the
// `:userId` param route below, or Express matches "progress" as a userId.
dashboardRouter.get("/analytics/users/progress", asyncHandler(requirePermission("analytics.users")), asyncHandler(getAnalyticsUsersProgress));
// Purchase feed on the Users Analytics page. Also before `:userId` (see above).
// Gated on analytics.revenue, not analytics.users, the rows carry money.
dashboardRouter.get("/analytics/users/recent-payments", asyncHandler(requirePermission("analytics.revenue")), asyncHandler(getAnalyticsRecentSuccessfulPayments));
dashboardRouter.get("/analytics/users/:userId/course-progress", asyncHandler(requirePermission("analytics.users")), asyncHandler(getAnalyticsUserCourseProgress));
dashboardRouter.get("/analytics/users/:userId", asyncHandler(requirePermission("analytics.users")), asyncHandler(getAnalyticsUserDetail));
dashboardRouter.get("/analytics/courses", asyncHandler(requirePermission("analytics.courses")), asyncHandler(getAnalyticsCourses));
dashboardRouter.get("/analytics/courses/:courseId", asyncHandler(requirePermission("analytics.courses")), asyncHandler(getAnalyticsCourseDetail));
dashboardRouter.get("/analytics/courses/:courseId/learner-progress", asyncHandler(requirePermission("analytics.users")), asyncHandler(getAnalyticsCourseLearnerProgress));
dashboardRouter.get("/analytics/books", asyncHandler(requirePermission("analytics.books")), asyncHandler(getAnalyticsBooks));
dashboardRouter.get("/analytics/books/:bookId", asyncHandler(requirePermission("analytics.books")), asyncHandler(getAnalyticsBookDetail));
dashboardRouter.get("/analytics/bundles", asyncHandler(requirePermission("analytics.bundles")), asyncHandler(getAnalyticsBundles));
dashboardRouter.get("/analytics/payments", asyncHandler(requirePermission("analytics.revenue")), asyncHandler(getAnalyticsPayments));
dashboardRouter.get("/analytics/certificates/details", asyncHandler(requirePermission("analytics.certificates")), asyncHandler(getAnalyticsCertificateDetails));
dashboardRouter.get("/analytics/certificates", asyncHandler(requirePermission("analytics.certificates")), asyncHandler(getAnalyticsCertificates));
dashboardRouter.get("/analytics/coupons", asyncHandler(requirePermission("analytics.coupons")), asyncHandler(getAnalyticsCoupons));
dashboardRouter.get("/analytics/quizzes", asyncHandler(requirePermission("analytics.quizzes")), asyncHandler(getAnalyticsQuizzes));
dashboardRouter.get("/analytics/engagement", asyncHandler(requirePermission("analytics.engagement")), asyncHandler(getAnalyticsEngagement));
dashboardRouter.get("/analytics/book-reading", asyncHandler(requirePermission("analytics.books")), asyncHandler(getAnalyticsBookReading));
dashboardRouter.get("/analytics/cart", asyncHandler(requirePermission("analytics.cart")), asyncHandler(getAnalyticsCart));
dashboardRouter.get("/analytics/bookmarks", asyncHandler(requirePermission("analytics.engagement")), asyncHandler(getAnalyticsBookmarks));
dashboardRouter.get("/analytics/bookmarks/details", asyncHandler(requirePermission("analytics.engagement")), asyncHandler(getAnalyticsBookmarkDetails));

// Watch-time drilldowns. Per-course (lecture breakdown + drop-off + top viewers)
// is gated on analytics.engagement (course-level aggregate). Per-user (member's
// course breakdown + recent lectures) returns individual learner activity, so
// it sits behind analytics.users, the same trust boundary as the existing
// /analytics/users/:userId endpoint.
dashboardRouter.get(
  "/analytics/courses/:courseId/watch-time",
  asyncHandler(requirePermission("analytics.engagement")),
  asyncHandler(getAnalyticsCourseWatchTime)
);
dashboardRouter.get(
  "/analytics/users/:userId/watch-time",
  asyncHandler(requirePermission("analytics.users")),
  asyncHandler(getAnalyticsMemberWatchTime)
);
// Platform-wide watch-time overview, aggregates totals + top courses, viewers,
// and lectures across the whole tenant. Powers /dashboard/analytics/watch-time.
dashboardRouter.get(
  "/analytics/watch-time",
  asyncHandler(requirePermission("analytics.engagement")),
  asyncHandler(getAnalyticsWatchTimeOverview)
);

// Analytics export (async BullMQ-based)
dashboardRouter.post("/analytics/export", asyncHandler(requirePermission("analytics.dashboard")), asyncHandler(requestAnalyticsExport));
dashboardRouter.get("/analytics/export/:jobId", asyncHandler(requirePermission("analytics.dashboard")), asyncHandler(getAnalyticsExportStatus));
dashboardRouter.get("/analytics/export/:jobId/download", asyncHandler(requirePermission("analytics.dashboard")), asyncHandler(downloadAnalyticsExport));

export default dashboardRouter;
