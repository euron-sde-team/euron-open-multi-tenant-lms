import { Router } from "express";

import {
  changeLearnerAccess,
  getLearnerOverview,
} from "../controllers/learner-access.controller";
import {
  listMembers,
  getMember,
  createMember,
  updateMemberStatus,
  updateMemberProfile,
  getMemberEnrollments,
  getMemberBookAccess,
  getMemberOrders,
  getMemberCertificates,
  getMemberStats,
  grantCourseAccess,
  revokeCourseAccess,
  updateEnrollmentValidity,
  grantBookAccess,
  revokeBookAccess,
  updateBookAccessValidity,
  getMemberBatchEnrollments,
  grantBatchAccess,
  revokeBatchAccess,
  updateBatchEnrollmentValidity,
  getMemberTestSeriesEnrollments,
  grantTestSeriesAccess,
  revokeTestSeriesAccess,
  updateTestSeriesEnrollmentValidity,
  grantBundleAccess,
  getPublishedCourses,
  getPublishedBooks,
  getMemberDetailStats,
  getMemberCartItems,
  getMemberCouponRedemptions,
  getMemberRefunds,
  getMemberCourseAnalyticsSummary,
  getMemberCourseAnalyticsDetail,
  getMemberCourseAnalyticsExport,
  getMemberQuizAnalytics,
  getMemberAssignmentAnalytics,
  downloadMemberCourseAnalyticsXlsx,
} from "../controllers/members.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const membersRouter: Router = Router();

membersRouter.use(asyncHandler(authenticateTenantUser));

membersRouter.get("/stats", asyncHandler(requirePermission("members.view")), asyncHandler(getMemberStats));
membersRouter.get("/published-courses", asyncHandler(requirePermission("members.view")), asyncHandler(getPublishedCourses));
membersRouter.get("/published-books", asyncHandler(requirePermission("members.view")), asyncHandler(getPublishedBooks));

membersRouter.get("/", asyncHandler(requirePermission("members.view")), asyncHandler(listMembers));
membersRouter.post("/", asyncHandler(requirePermission("members.update")), asyncHandler(createMember));
membersRouter.get("/:memberId", asyncHandler(requirePermission("members.view")), asyncHandler(getMember));
membersRouter.patch("/:memberId/status", asyncHandler(requirePermission("members.update")), asyncHandler(updateMemberStatus));
membersRouter.patch("/:memberId/profile", asyncHandler(requirePermission("members.update")), asyncHandler(updateMemberProfile));

// ---------------------------------------------------------------------------
// Composite learner routes.
//
// Everything below this block is a fragment of one job, split by content type
// because a dashboard shows one tab at a time. These two answer the whole job:
// "tell me about this learner" and "change what they can reach". They compose
// the same services the fragments use, so the revenue-share guard, the batch
// fan-out and the grant notification all still apply.
// ---------------------------------------------------------------------------
membersRouter.get(
  "/:memberId/overview",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getLearnerOverview)
);
membersRouter.post(
  "/:memberId/access",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(changeLearnerAccess)
);

membersRouter.get(
  "/:memberId/enrollments",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberEnrollments)
);
membersRouter.post(
  "/:memberId/enrollments",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(grantCourseAccess)
);
membersRouter.delete(
  "/:memberId/enrollments/:enrollmentId",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(revokeCourseAccess)
);
membersRouter.patch(
  "/:memberId/enrollments/:enrollmentId/validity",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(updateEnrollmentValidity)
);

membersRouter.get(
  "/:memberId/book-access",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberBookAccess)
);
membersRouter.post(
  "/:memberId/book-access",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(grantBookAccess)
);
membersRouter.delete(
  "/:memberId/book-access/:accessId",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(revokeBookAccess)
);
membersRouter.patch(
  "/:memberId/book-access/:accessId/validity",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(updateBookAccessValidity)
);

// Batch / test series / bundle access management
// (admin grants for every sellable type, access-managed storefront support).
membersRouter.get(
  "/:memberId/batch-enrollments",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberBatchEnrollments)
);
membersRouter.post(
  "/:memberId/batch-enrollments",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(grantBatchAccess)
);
membersRouter.delete(
  "/:memberId/batch-enrollments/:enrollmentId",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(revokeBatchAccess)
);
membersRouter.patch(
  "/:memberId/batch-enrollments/:enrollmentId/validity",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(updateBatchEnrollmentValidity)
);

membersRouter.get(
  "/:memberId/test-series-enrollments",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberTestSeriesEnrollments)
);
membersRouter.post(
  "/:memberId/test-series-enrollments",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(grantTestSeriesAccess)
);
membersRouter.delete(
  "/:memberId/test-series-enrollments/:enrollmentId",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(revokeTestSeriesAccess)
);
membersRouter.patch(
  "/:memberId/test-series-enrollments/:enrollmentId/validity",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(updateTestSeriesEnrollmentValidity)
);

membersRouter.post(
  "/:memberId/bundle-access",
  asyncHandler(requirePermission("members.update")),
  asyncHandler(grantBundleAccess)
);

membersRouter.get("/:memberId/orders", asyncHandler(requirePermission("members.view")), asyncHandler(getMemberOrders));
membersRouter.get(
  "/:memberId/certificates",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberCertificates)
);

membersRouter.get("/:memberId/detail-stats", asyncHandler(requirePermission("members.view")), asyncHandler(getMemberDetailStats));
membersRouter.get("/:memberId/cart-items", asyncHandler(requirePermission("members.view")), asyncHandler(getMemberCartItems));
membersRouter.get("/:memberId/coupon-redemptions", asyncHandler(requirePermission("members.view")), asyncHandler(getMemberCouponRedemptions));
membersRouter.get("/:memberId/refunds", asyncHandler(requirePermission("members.view")), asyncHandler(getMemberRefunds));

membersRouter.get(
  "/:memberId/course-analytics",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberCourseAnalyticsSummary)
);
membersRouter.get(
  "/:memberId/course-analytics/export",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberCourseAnalyticsExport)
);
membersRouter.get(
  "/:memberId/course-analytics/export.xlsx",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(downloadMemberCourseAnalyticsXlsx)
);
membersRouter.get(
  "/:memberId/quiz-analytics",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberQuizAnalytics)
);
membersRouter.get(
  "/:memberId/assignment-analytics",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberAssignmentAnalytics)
);
membersRouter.get(
  "/:memberId/course-analytics/:courseId",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getMemberCourseAnalyticsDetail)
);

export default membersRouter;
