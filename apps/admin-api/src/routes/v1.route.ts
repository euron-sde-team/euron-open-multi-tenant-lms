import { Router } from "express";
import { health, helloWorld } from "../controllers/health.controller";
import { asyncHandler } from "../utils/asynchandler";
import { requireActiveTenant } from "../middlewares/tenant-status.middleware";
import authConfigRouter from "./auth-config.route";
import plansRouter from "./plans.route";
import subscriptionsRouter from "./subscriptions.route";
import booksRouter from "./books.route";
import certificateTemplateRouter from "./certificate-template.route";
import certificateDesignerRouter from "./certificate-designer.route";
import certificateAssignmentsRouter from "./certificate-assignments.route";
import dashboardRouter from "./dashboard.route";
import membersRouter from "./members.route";
import memberFormRouter from "./member-form.route";
import bundlesRouter from "./bundles.route";
import batchesRouter from "./batches.route";
import categoriesRouter from "./categories.route";
import coursesRouter from "./courses.route";
import questionAssetsRouter from "./question-assets.route";
import entitlementsRouter from "./entitlements.route";
import instructorsRouter from "./instructors.route";
import onboardingRouter from "./onboarding.route";
import organizationRouter from "./organization.route";
import pagesRouter from "./pages.route";
import paymentRouter from "./payment.route";
import routesRouter from "./routes.route";
import sidebarRouter from "./sidebar.route";
import tenantAuthRouter from "./tenant-auth.route";
import tenantDomainRouter from "./tenant-domain.route";
import tenantFeaturesRouter from "./tenant-features.route";
import tenantUserRouter from "./tenant-user.route";
import tenantsRouter from "./tenants.route";
import uploadRouter from "./upload.route";
import assignmentsRouter from "./assignments.route";
import quizzesRouter from "./quizzes.route";
import submissionsRouter from "./submissions.route";
import mediaRouter from "./media.route";
import assetLibraryRouter from "./asset-library.route";
import questionLibraryRouter from "./question-library.route";
import testimonialsRouter from "./testimonials.route";
import tenantOrgRouter from "./tenant-org.route";
import invoiceRouter from "./invoice.route";
import emailSendingDomainRouter from "./email-sending-domain.route";
import emailSenderIdentityRouter from "./email-sender-identity.route";
import emailReputationRouter from "./email-reputation.route";
import emailSuppressionRouter from "./email-suppression.route";
import emailMessagesRouter from "./email-messages.route";
import couponsRouter from "./coupons.route";
import currencySettingsRouter from "./currency-settings.route";
import storefrontSettingsRouter from "./storefront-settings.route";
import siteHealthRouter from "./site-health.route";
import layoutRouter from "./layout.route";
import certificatesSettingsRouter from "./certificates-settings.route";
import enrolledCoursesSettingsRouter from "./enrolled-courses-settings.route";
import orderedProductsRouter from "./ordered-products.route";
import pageAIRouter from "./page-ai.route";
import tenantSubscriptionsRouter from "./tenant-subscriptions.route";
import teamRouter from "./team.route";
import auditRouter from "./tenant-audit.route";
import { auditLog } from "../middlewares/audit.middleware";
import testQuestionBanksRouter from "./test-question-banks.route";
import testQuestionsRouter from "./test-questions.route";
import testsRouter from "./tests.route";
import testSeriesRouter from "./test-series.route";
import testGradingRouter from "./test-grading.route";
import testTaxonomyRouter from "./test-taxonomy.route";
import testScholarshipsRouter from "./test-scholarships.route";
import testRankCurvesRouter from "./test-rank-curves.route";
import bulkImportsRouter from "./bulk-imports.route";
import bulkCertificateRouter from "./bulk-certificate.route";
import bulkEnrollRouter from "./bulk-enroll.route";

const v1Router: Router = Router();

// Health routes
v1Router.get("/", asyncHandler(helloWorld));
v1Router.get("/health", asyncHandler(health));

// Activity log. Mounted once, ABOVE every tenant route, so that adding a feature
// means adding a line to the action registry, not remembering to instrument it.
// It only observes: it never blocks a request, and it writes after the response
// has been sent. Unregistered routes and GETs pass straight through.
v1Router.use("/tenant", auditLog());

// Tenant auth routes (no tenant-status check, must always be accessible)
v1Router.use("/tenant/auth", tenantAuthRouter);

// Plans (for subscription purchase, accessible even when suspended/cancelled)
v1Router.use("/tenant/plans", plansRouter);

// Subscriptions (checkout, current, reactivation, accessible even when suspended/cancelled)
v1Router.use("/tenant/subscriptions", subscriptionsRouter);

// Organization routes (create org after signup)
v1Router.use("/tenant/organization", organizationRouter);
v1Router.use("/tenant/onboarding", onboardingRouter);

// Tenant org details (logos, contact, social, legal, accessible during onboarding)
v1Router.use("/tenant/org-details", tenantOrgRouter);

// Tenant user routes
v1Router.use("/tenant/users", tenantUserRouter);

// Tenant domain routes (for domain management)
v1Router.use("/tenant/domains", tenantDomainRouter);

// Page AI generation (must be before /tenant catch-all)
v1Router.use("/tenant/pages/ai", asyncHandler(requireActiveTenant), pageAIRouter);

// Tenant applications & features (resolved from entitlements – source of truth)
v1Router.use("/tenant", tenantFeaturesRouter);

// Tenant entitlements (plan usage, check capacity)
v1Router.use("/tenant/entitlements", entitlementsRouter);

// Payment (gateway connections and order exports, accessible when suspended)
v1Router.use("/tenant/payment", paymentRouter);

// Invoices (accessible even when suspended, billing records)
v1Router.use("/tenant/invoices", invoiceRouter);

// --- Tenant-status enforcement: routes below require ACTIVE tenant ---
// (SUSPENDED tenants can still read, CANCELLED are blocked from content routes)
v1Router.use("/tenant/instructors", asyncHandler(requireActiveTenant), instructorsRouter);
v1Router.use("/tenant/categories", asyncHandler(requireActiveTenant), categoriesRouter);
v1Router.use("/tenant/assignments", asyncHandler(requireActiveTenant), assignmentsRouter);
v1Router.use("/tenant/quizzes", asyncHandler(requireActiveTenant), quizzesRouter);
v1Router.use("/tenant/submissions", asyncHandler(requireActiveTenant), submissionsRouter);
v1Router.use("/tenant/courses", asyncHandler(requireActiveTenant), coursesRouter);
v1Router.use(
  "/tenant/question-assets",
  asyncHandler(requireActiveTenant),
  questionAssetsRouter
);
v1Router.use("/tenant/books", asyncHandler(requireActiveTenant), booksRouter);
v1Router.use("/tenant/bundles", asyncHandler(requireActiveTenant), bundlesRouter);
v1Router.use("/tenant/batches", asyncHandler(requireActiveTenant), batchesRouter);
v1Router.use("/tenant/test-question-banks", asyncHandler(requireActiveTenant), testQuestionBanksRouter);
v1Router.use("/tenant/test-questions", asyncHandler(requireActiveTenant), testQuestionsRouter);
v1Router.use("/tenant/test-taxonomy", asyncHandler(requireActiveTenant), testTaxonomyRouter);
v1Router.use("/tenant/tests", asyncHandler(requireActiveTenant), testsRouter);
v1Router.use("/tenant/test-series", asyncHandler(requireActiveTenant), testSeriesRouter);
v1Router.use("/tenant/test-grading", asyncHandler(requireActiveTenant), testGradingRouter);
v1Router.use(
  "/tenant/test-scholarships",
  asyncHandler(requireActiveTenant),
  testScholarshipsRouter
);
v1Router.use("/tenant/test-rank-curves", asyncHandler(requireActiveTenant), testRankCurvesRouter);
v1Router.use("/tenant/media", asyncHandler(requireActiveTenant), mediaRouter);
v1Router.use("/tenant/asset-library", asyncHandler(requireActiveTenant), assetLibraryRouter);
v1Router.use("/tenant/question-library", asyncHandler(requireActiveTenant), questionLibraryRouter);
v1Router.use("/tenant/auth-config", asyncHandler(requireActiveTenant), authConfigRouter);
v1Router.use("/tenant/sidebar", asyncHandler(requireActiveTenant), sidebarRouter);
v1Router.use("/tenant/dashboard", asyncHandler(requireActiveTenant), dashboardRouter);
v1Router.use("/tenant/members", asyncHandler(requireActiveTenant), membersRouter);
v1Router.use("/tenant/member-form", asyncHandler(requireActiveTenant), memberFormRouter);
v1Router.use("/tenant/bulk-imports", asyncHandler(requireActiveTenant), bulkImportsRouter);
v1Router.use("/tenant/members/bulk-enroll", asyncHandler(requireActiveTenant), bulkEnrollRouter);
v1Router.use("/tenant/testimonials", asyncHandler(requireActiveTenant), testimonialsRouter);
v1Router.use("/tenant/coupons", asyncHandler(requireActiveTenant), couponsRouter);
v1Router.use("/tenant/currency-settings", asyncHandler(requireActiveTenant), currencySettingsRouter);
v1Router.use("/tenant/storefront-settings", asyncHandler(requireActiveTenant), storefrontSettingsRouter);
v1Router.use("/tenant/site-health", asyncHandler(requireActiveTenant), siteHealthRouter);
v1Router.use("/tenant/layout", asyncHandler(requireActiveTenant), layoutRouter);
v1Router.use("/tenant/certificates-settings", asyncHandler(requireActiveTenant), certificatesSettingsRouter);
v1Router.use("/tenant/enrolled-courses-settings", asyncHandler(requireActiveTenant), enrolledCoursesSettingsRouter);
v1Router.use("/tenant/ordered-products", asyncHandler(requireActiveTenant), orderedProductsRouter);

// Email engine, per-tenant BYO sending domain. OPT-IN ONLY; reached from
// the tenant admin Settings -> Email Sending UI. Never invoked from signup,
// tenant-create, plan provisioning, or seed scripts.
v1Router.use(
  "/tenant/email-sending-domains",
  asyncHandler(requireActiveTenant),
  emailSendingDomainRouter,
);
// Email engine, sender identities (FROM addresses on a verified domain,
// with per-category defaults). Only reachable once a sending domain exists
// and is VERIFIED.
v1Router.use(
  "/tenant/email-sender-identities",
  asyncHandler(requireActiveTenant),
  emailSenderIdentityRouter,
);
// Email engine, reputation dashboard (current rates + status + history).
// Read-only from the tenant side; status changes are driven by the
// enforcer (auto) or the core-admin manual-override endpoint.
v1Router.use(
  "/tenant/email-reputation",
  asyncHandler(requireActiveTenant),
  emailReputationRouter,
);
// Email engine, suppressions (list + manual remove) and message log.
v1Router.use(
  "/tenant/email-suppressions",
  asyncHandler(requireActiveTenant),
  emailSuppressionRouter,
);
v1Router.use(
  "/tenant/email-messages",
  asyncHandler(requireActiveTenant),
  emailMessagesRouter,
);

v1Router.use("/tenant/user-subscriptions", asyncHandler(requireActiveTenant), tenantSubscriptionsRouter);
v1Router.use("/tenant/team", asyncHandler(requireActiveTenant), teamRouter);
v1Router.use("/tenant/audit-logs", asyncHandler(requireActiveTenant), auditRouter);

// Pages routes (for page builder).
//
// The activity log mounts HERE too, not only on /tenant: page writes change
// the tenant's PUBLIC site, and they were the one mutating surface outside
// the log, which is exactly where it hurt. When a live homepage was found
// replaced by template placeholder copy, "who changed this?" had no answer,
// because nothing here left a row. Public-facing changes need attribution
// more than any admin-screen edit, not less.
v1Router.use("/pages", auditLog());
v1Router.use("/pages", pagesRouter);

// Routes (available internal routes for Button Generation Engine)
v1Router.use("/routes", routesRouter);

// Tenants routes (for tenant lookup)
v1Router.use("/tenants", tenantsRouter);

// Upload routes (for file/image uploads)
v1Router.use("/upload", uploadRouter);

// Certificate templates (selection & publish for tenant)
v1Router.use("/tenant/certificate-templates", certificateTemplateRouter);

// Certificate designer (drag-drop custom templates: CRUD + assets + default)
v1Router.use("/tenant/certificate-designer", certificateDesignerRouter);

// Certificate assignments (per-offering-type design: Course vs Test Series)
v1Router.use("/tenant/certificate-assignments", certificateAssignmentsRouter);

// Bulk certificates (sheet upload → generate certificate records for recipients)
v1Router.use(
  "/tenant/certificates",
  asyncHandler(requireActiveTenant),
  bulkCertificateRouter,
);

export default v1Router;