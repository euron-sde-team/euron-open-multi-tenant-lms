import { Router } from "express";
import { getBookBySlug, listPublishedBooks, getBookContent, getBookSample } from "../controllers/book.controller";
import * as bundleController from "../controllers/bundle.controller";
import {
  listPublishedCourses,
  getCourseBySlug,
  getCourseReviews,
  createCourseReview,
  getCourseAccessStatus,
} from "../controllers/course.controller";
import {
  getProgress,
  markLectureComplete,
  markLessonComplete,
  getCourseAnalytics,
  getCourseVideoAnalytics,
} from "../controllers/progress.controller";
import {
  heartbeat as watchHeartbeat,
  endSession as watchEndSession,
} from "../controllers/watch-session.controller";
import { getLecturePlayback } from "../controllers/lecture-playback.controller";
import {
  generateCertificate,
  getCertificateStatus,
  verifyCertificate,
  proxyCertificateLogo,
} from "../controllers/certificate.controller";
import * as categoriesController from "../controllers/categories.controller";
import { getSidebarConfig } from "../controllers/sidebar.controller";
import { getTemplate } from "../controllers/template.controller";
import { getTenantInfo } from "../controllers/tenant-info.controller";
import { getTaxConfig } from "../controllers/tax-config.controller";
import { health, helloWorld } from "../controllers/health.controller";
import { authenticateUser, optionalAuth } from "../middlewares/auth.middleware";
import { tenantResolverMiddleware } from "../middlewares/tenant-resolver.middleware";
import { asyncHandler } from "../utils/asynchandler";
import { db } from "../db/connection";
import authRouter from "./auth.route";
import bookmarkRouter from "./bookmark.route";
import cartRouter from "./cart.route";
import currencyContextRouter from "./currency-context.route";
import checkoutRouter from "./checkout.route";
import coursePreviewRouter from "./course-preview.route";
import tenantPageRouter from "./tenant-page.route";
import memberFormRouter from "./member-form.route";
import batchRouter from "./batch.route";
import assignmentsRouter from "./assignments.route";
import quizzesRouter from "./quizzes.route";
import profileRouter from "./profile.route";
import testimonialRouter from "./testimonials.route";
import instructorRouter from "./instructor.route";
import invoiceRouter from "./invoice.route";
import memberAnalyticsRouter from "./member-analytics.route";
import memberCertificateRouter from "./member-certificate.route";
import paymentHistoryRouter from "./payment-history.route";
import memberNotificationRouter from "./member-notification.route";
import searchRouter from "./search.route";
import userSubscriptionsRouter from "./user-subscriptions.route";
import testSeriesCatalogRouter from "./test-series-catalog.route";
import testAttemptsRouter from "./test-attempts.route";
import testPerformanceRouter from "./test-performance.route";
import engagementRouter from "./engagement.route";
import emailUnsubscribeRouter from "./email-unsubscribe.route";

const v1Router: Router = Router();

// Health check routes (no tenant required)
v1Router.get("/", asyncHandler(helloWorld));
v1Router.get("/health", asyncHandler(health));

// Email engine, public unsubscribe verify/confirm. NO tenant resolver and
// NO auth middleware: the unsubscribe JWT IS the auth boundary (token
// encodes tenantId, email, messageId, category). Called server-side by the
// web app at /u/[token] route handler for both RFC 8058 one-click POSTs and
// browser confirmation flows.
v1Router.use("/email/unsubscribe", emailUnsubscribeRouter);

// Auth routes (tenant-scoped)
v1Router.use("/auth", asyncHandler(tenantResolverMiddleware), authRouter);

// Profile (public profile by userId)
v1Router.use("/profile", asyncHandler(tenantResolverMiddleware), profileRouter);

// Cart (tenant + auth)
v1Router.use("/cart", asyncHandler(tenantResolverMiddleware), cartRouter);

// Currency context (tenant; auth optional for resolution, required for preference)
v1Router.use("/currency-context", asyncHandler(tenantResolverMiddleware), currencyContextRouter);

// Bookmarks (tenant + auth)
v1Router.use("/bookmarks", asyncHandler(tenantResolverMiddleware), bookmarkRouter);

// Checkout (tenant + auth)
v1Router.use("/checkout", asyncHandler(tenantResolverMiddleware), checkoutRouter);

// Tenant info (public, just tenant resolution)
v1Router.get("/tenant/info", asyncHandler(tenantResolverMiddleware), asyncHandler(getTenantInfo));

// Tax config (public, tenant-scoped)
v1Router.get("/tenant/tax-config", asyncHandler(tenantResolverMiddleware), asyncHandler(getTaxConfig));

// Tenant-scoped routes (require tenant resolution)
v1Router.get("/template", asyncHandler(tenantResolverMiddleware), asyncHandler(getTemplate));

// Org social links (public, no auth)
v1Router.get("/org/social-links", asyncHandler(tenantResolverMiddleware), asyncHandler(async (req, res) => {
  const tenant = req.tenant;
  if (!tenant) {
    res.status(404).json({ success: false, message: "Tenant not found" });
    return;
  }
  const row = await db
    .selectFrom("tenant_org_details")
    .select("social_links")
    .where("tenant_id", "=", tenant.id)
    .executeTakeFirst();
  const links = row?.social_links ?? null;
  res.json({ success: true, data: links });
}));
v1Router.get("/sidebar", asyncHandler(tenantResolverMiddleware), asyncHandler(getSidebarConfig));
v1Router.use("/pages", asyncHandler(tenantResolverMiddleware), tenantPageRouter);
// Free course samples. Public on purpose: a prospective student has to be able
// to watch one before signing up, which is the entire point of the feature.
v1Router.use(
  "/course-previews",
  asyncHandler(tenantResolverMiddleware),
  coursePreviewRouter
);

// Public course endpoints (optionalAuth enriches response with has_access for logged-in users)
v1Router.get("/courses", asyncHandler(tenantResolverMiddleware), asyncHandler(optionalAuth), asyncHandler(listPublishedCourses));
v1Router.get("/courses/by-slug/:slug", asyncHandler(tenantResolverMiddleware), asyncHandler(optionalAuth), asyncHandler(getCourseBySlug));

// Public book endpoints (optionalAuth enriches response with has_access for logged-in users)
v1Router.get("/books", asyncHandler(tenantResolverMiddleware), asyncHandler(optionalAuth), asyncHandler(listPublishedBooks));
v1Router.get("/books/:slug", asyncHandler(tenantResolverMiddleware), asyncHandler(optionalAuth), asyncHandler(getBookBySlug));
// Public sample preview endpoint, no auth, controlled by sample_enabled flag
v1Router.get("/books/:slug/sample", asyncHandler(tenantResolverMiddleware), asyncHandler(getBookSample));
// Secure book content streaming endpoint, requires auth + book access
v1Router.get("/books/:slug/content", asyncHandler(tenantResolverMiddleware), asyncHandler(authenticateUser), asyncHandler(getBookContent));

// Public bundle endpoints (optionalAuth enriches response with has_access for logged-in users)
v1Router.get("/bundles", asyncHandler(tenantResolverMiddleware), asyncHandler(optionalAuth), asyncHandler(bundleController.listPublishedBundles));
v1Router.get("/bundles/:slug", asyncHandler(tenantResolverMiddleware), asyncHandler(optionalAuth), asyncHandler(bundleController.getBundleBySlug));

// Batches (cohorts), public list/detail + enrolled-only views
v1Router.use(batchRouter);

// Test series catalog (public + me/enrollments) and attempts (auth required)
v1Router.use("/test-series", asyncHandler(tenantResolverMiddleware), testSeriesCatalogRouter);
v1Router.use("/test-attempts", asyncHandler(tenantResolverMiddleware), testAttemptsRouter);
v1Router.use("/test-performance", asyncHandler(tenantResolverMiddleware), testPerformanceRouter);
v1Router.use("/engagement", asyncHandler(tenantResolverMiddleware), engagementRouter);

// Public search (tenant-scoped, optional auth for future access enrichment)
v1Router.use("/search", asyncHandler(tenantResolverMiddleware), searchRouter);

// Public instructors (no auth, just tenant resolution), for search results and course pages
v1Router.use("/instructors", asyncHandler(tenantResolverMiddleware), instructorRouter);

// Public categories (no auth, just tenant resolution), for categories listing page
v1Router.get("/categories", asyncHandler(tenantResolverMiddleware), asyncHandler(categoriesController.listCategories));
v1Router.get("/categories/:slug", asyncHandler(tenantResolverMiddleware), asyncHandler(categoriesController.getCategoryBySlug));

// Public certificate verification (no auth, just tenant resolution)
v1Router.get(
  "/certificates/verify/:certificateNumber",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(verifyCertificate)
);

// Public certificate logo proxy (no auth, no tenant, stateless fetch helper
// for PDF export. Allowlist-protected in the service layer.)
v1Router.get(
  "/certificates/logo-proxy",
  asyncHandler(proxyCertificateLogo)
);

// Course reviews (list public; create requires auth)
v1Router.get(
  "/courses/:courseId/reviews",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(getCourseReviews)
);
v1Router.post(
  "/courses/:courseId/reviews",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(createCourseReview)
);

// Course progress (auth + enrollment required)
v1Router.get(
  "/courses/:courseId/progress",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(getProgress)
);

// Course analytics for current user (auth + enrollment required)
v1Router.get(
  "/courses/:courseId/analytics",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(getCourseAnalytics)
);

// Per-video analytics + cohort comparison (auth + enrollment required)
v1Router.get(
  "/courses/:courseId/video-analytics",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(getCourseVideoAnalytics)
);

// Assignments (auth + enrollment required, checked in service)
v1Router.use(
  "/assignments",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  assignmentsRouter
);

// Quizzes (auth + enrollment required, checked in service)
v1Router.use(
  "/quizzes",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  quizzesRouter
);
v1Router.post(
  "/courses/:courseId/progress",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(markLectureComplete)
);

// Content-lesson completion (PDF/LINK/TEXT/IMAGE), no lectures row, separate
// from the lecture progress path. Auth + enrollment enforced in service.
v1Router.post(
  "/courses/:courseId/lessons/:lessonId/complete",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(markLessonComplete)
);

// Lecture watch tracking, heartbeat + session-end. Auth + enrollment enforced in service.
v1Router.post(
  "/courses/:courseId/lectures/:lectureId/watch/heartbeat",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(watchHeartbeat)
);

v1Router.post(
  "/courses/:courseId/lectures/:lectureId/watch/end",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(watchEndSession)
);

// Lecture playback: EVS session or external URL, after the enrollment check.
v1Router.post(
  "/courses/:courseId/lectures/:lectureId/playback",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(getLecturePlayback)
);

// Lightweight access re-check for the LMS player (on lecture change /
// tab focus). Returns { has_access, reason } without re-fetching the
// curriculum.
v1Router.get(
  "/courses/:courseId/access-status",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(getCourseAccessStatus)
);

// Course certificates (auth + enrollment required)
v1Router.post(
  "/courses/:courseId/certificate",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(generateCertificate)
);
v1Router.get(
  "/courses/:courseId/certificate/status",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(getCertificateStatus)
);

v1Router.use("/member-form", asyncHandler(tenantResolverMiddleware), asyncHandler(authenticateUser), memberFormRouter);

// Testimonials (public listing, submission requires auth)
v1Router.use("/testimonials", asyncHandler(tenantResolverMiddleware), testimonialRouter);

// Invoices (tenant + auth)
v1Router.use("/invoices", asyncHandler(tenantResolverMiddleware), asyncHandler(authenticateUser), invoiceRouter);

// Payment history, unified view of all payments (orders + subscription charges)
v1Router.use("/payment-history", asyncHandler(tenantResolverMiddleware), asyncHandler(authenticateUser), paymentHistoryRouter);

// Member analytics (tenant + auth)
v1Router.use("/member/analytics", asyncHandler(tenantResolverMiddleware), asyncHandler(authenticateUser), memberAnalyticsRouter);

// Member certificates (tenant + auth)
v1Router.use("/member/certificates", asyncHandler(tenantResolverMiddleware), asyncHandler(authenticateUser), memberCertificateRouter);

// Member notifications (tenant + auth)
v1Router.use("/notifications", asyncHandler(tenantResolverMiddleware), asyncHandler(authenticateUser), memberNotificationRouter);

// User subscriptions (public plan listing + authenticated subscription management)
v1Router.use("/subscriptions", asyncHandler(tenantResolverMiddleware), userSubscriptionsRouter);


export default v1Router;