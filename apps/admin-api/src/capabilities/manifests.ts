/**
 * The capability manifests, every feature declares, in plain English, what a
 * person can DO, and which permission codes that grants.
 *
 * ADDING A FEATURE? Add a manifest block here (or, better, in your feature's own
 * folder and import it below). The CI check in `validate.ts` will fail the build
 * if a route enforces a code that no capability grants, which is how the old
 * "25 enforced-but-ungrantable permissions" bug becomes impossible to repeat.
 *
 * RULES FOR WRITING A CAPABILITY
 *   - The label is a SENTENCE, starting "Can …". Never a noun, never a code.
 *   - The description says the CONSEQUENCE, not the mechanism.
 *   - Fewer, broader capabilities beat many narrow ones. If an admin would never
 *     grant A without B, they are ONE capability.
 *   - Anything irreversible / money / personal data / learner-visible gets a
 *     `danger` flag so it's surfaced, not buried.
 */
import type { FeatureCapabilities } from "./types";

// ---------------------------------------------------------------------------
// Courses & Content
// ---------------------------------------------------------------------------

const COURSES: FeatureCapabilities = {
  area: "COURSES_AND_CONTENT",
  feature: "Courses",
  addedIn: "2025-01",
  capabilities: [
    {
      id: "courses.view",
      label: "Can view courses",
      description: "See the course list and open a course.",
      // pages.view is REQUIRED to open a course: every course/LMS editor first
      // fetches the course's landing page (tenant_pages) via GET /tenant/pages/:id.
      // Without it, opening any course fails with "Failed to load course".
      grants: ["courses.view", "categories.view", "pages.view"],
    },
    {
      id: "courses.author",
      label: "Can create and edit courses",
      description:
        "Build courses, lessons, quizzes and assignments. Does not publish them.",
      grants: [
        "courses.create",
        "courses.update",
        "courses.lms.manage",
        // A course's landing page is created/edited in lockstep with the course
        // itself; saving course edits writes the page (PUT /tenant/pages/:id).
        // Without pages.create/update the editor loads but can't save.
        "pages.view",
        "pages.create",
        "pages.update",
        "uploads.manage",
        "categories.manage",
        "quizzes.view",
        "quizzes.create",
        "quizzes.update",
        "assignments.view",
        "assignments.create",
        "assignments.update",
      ],
    },
    {
      id: "courses.publish",
      label: "Can publish courses",
      description: "Make a course live. Learners can see it immediately.",
      grants: ["courses.publish"],
      danger: "PUBLIC",
    },
    {
      id: "courses.delete",
      label: "Can delete courses",
      description: "Permanently remove a course and its content.",
      grants: ["courses.delete", "quizzes.delete"],
      danger: "DESTRUCTIVE",
    },
    {
      id: "courses.grade",
      label: "Can grade assignments",
      description: "Review and mark learner submissions.",
      grants: ["assignments.grade"],
    },
  ],
};

const BOOKS_AND_BUNDLES: FeatureCapabilities = {
  area: "COURSES_AND_CONTENT",
  feature: "Books & Bundles",
  addedIn: "2025-01",
  capabilities: [
    {
      id: "books.manage",
      label: "Can create and manage books",
      description: "Add and edit books, and publish them to learners.",
      grants: [
        "books.view",
        "books.create",
        "books.update",
        "books.publish",
      ],
      danger: "PUBLIC",
    },
    {
      id: "books.delete",
      label: "Can delete books",
      description: "Permanently remove a book.",
      grants: ["books.delete"],
      danger: "DESTRUCTIVE",
    },
    {
      id: "bundles.manage",
      label: "Can create and manage bundles",
      description: "Group courses and books into a bundle and publish it.",
      grants: [
        "bundles.view",
        "bundles.create",
        "bundles.update",
        "bundles.publish",
      ],
      danger: "PUBLIC",
    },
    {
      id: "bundles.delete",
      label: "Can delete bundles",
      description: "Permanently remove a bundle.",
      grants: ["bundles.delete"],
      danger: "DESTRUCTIVE",
    },
  ],
};

const TESTS: FeatureCapabilities = {
  area: "COURSES_AND_CONTENT",
  feature: "Test Series",
  addedIn: "2026-01",
  capabilities: [
    {
      id: "tests.manage",
      label: "Can create and manage test series",
      description:
        "Build mock tests and question banks, including generating questions with AI.",
      grants: [
        "tests.view",
        "tests.manage",
        "tests.import",
        "tests.ai_generate",
      ],
    },
    {
      id: "tests.publish",
      label: "Can publish test series",
      description: "Release a test series. Learners can take it immediately.",
      grants: ["tests.publish"],
      danger: "PUBLIC",
    },
    {
      id: "tests.delete",
      label: "Can delete test series",
      description: "Permanently remove a test series and its questions.",
      grants: ["tests.delete"],
      danger: "DESTRUCTIVE",
    },
  ],
};

const LIVE_TEACHING: FeatureCapabilities = {
  area: "COURSES_AND_CONTENT",
  feature: "Batches",
  addedIn: "2025-01",
  capabilities: [
    {
      id: "batches.manage",
      label: "Can manage batches",
      description: "Create batches, set their schedule and publish them.",
      grants: [
        "batches.view",
        "batches.create",
        "batches.update",
        "batches.publish",
      ],
      danger: "PUBLIC",
    },
    {
      id: "batches.delete",
      label: "Can delete batches",
      description: "Permanently remove a batch.",
      grants: ["batches.delete"],
      danger: "DESTRUCTIVE",
    },
  ],
};

const OTHER_CONTENT: FeatureCapabilities = {
  area: "COURSES_AND_CONTENT",
  feature: "Pages",
  addedIn: "2025-01",
  capabilities: [
    {
      id: "pages.manage",
      label: "Can edit website pages",
      description:
        "Build and publish landing pages. Changes are live on the site.",
      grants: ["pages.view", "pages.create", "pages.update", "pages.publish"],
      danger: "PUBLIC",
    },
    {
      id: "pages.delete",
      label: "Can delete website pages",
      description: "Permanently remove a page from the site.",
      grants: ["pages.delete"],
      danger: "DESTRUCTIVE",
    },
    {
      id: "instructors.manage",
      label: "Can manage instructor profiles",
      description: "Add and edit the instructors shown on your site.",
      grants: [
        "instructors.view",
        "instructors.create",
        "instructors.update",
        "instructors.delete",
      ],
      danger: "DESTRUCTIVE",
    },
    {
      id: "certificates.manage",
      label: "Can manage certificates",
      description:
        "Design certificates, control learner access, and bulk-issue and email certificates to learners.",
      grants: ["certificates.view", "certificates.manage"],
      // Emails go out to learners' inboxes, learner-visible outbound action.
      danger: "PUBLIC",
    },
  ],
};

// ---------------------------------------------------------------------------
// Learners
// ---------------------------------------------------------------------------

const LEARNERS: FeatureCapabilities = {
  area: "LEARNERS",
  feature: "Learners",
  addedIn: "2025-01",
  capabilities: [
    {
      id: "members.view",
      label: "Can view learners and their progress",
      description:
        "See who is enrolled and how far they've got. Does not include contact details.",
      grants: ["members.view"],
    },
    {
      id: "members.contact",
      label: "Can see learner contact details",
      description: "View learner email addresses and phone numbers.",
      grants: ["members.create", "members.update"],
      danger: "PERSONAL_DATA",
    },
    {
      id: "members.export",
      label: "Can export learner data",
      description: "Download learner records as a file.",
      grants: ["members.export"],
      danger: "PERSONAL_DATA",
    },
    {
      id: "members.delete",
      label: "Can remove learners",
      description: "Permanently delete a learner and their progress.",
      grants: ["members.delete"],
      danger: "DESTRUCTIVE",
    },
  ],
};

// ---------------------------------------------------------------------------
// Sales & Payments
// ---------------------------------------------------------------------------

const SALES: FeatureCapabilities = {
  area: "SALES_AND_PAYMENTS",
  feature: "Sales & Payments",
  addedIn: "2025-01",
  capabilities: [
    {
      id: "sales.view",
      label: "Can view sales and revenue",
      description: "See orders, revenue and payment history.",
      grants: [
        "revenue.view",
        "payments.view",
        "invoices.view",
        "gateway.view",
        "subscriptions.view",
      ],
    },
    {
      id: "sales.export",
      label: "Can export revenue reports",
      description: "Download sales and revenue data.",
      grants: ["revenue.export"],
    },
    {
      id: "coupons.manage",
      label: "Can create discount coupons",
      description: "Create, edit and delete discount codes.",
      grants: [
        "coupons.view",
        "coupons.create",
        "coupons.update",
        "coupons.delete",
      ],
      danger: "DESTRUCTIVE",
    },
    {
      id: "payments.refund",
      label: "Can issue refunds",
      description: "Return money to a learner. This cannot be undone.",
      grants: ["payments.refund"],
      danger: "FINANCIAL",
    },
    {
      id: "subscriptions.manage",
      label: "Can manage subscription plans",
      description:
        "Create and edit the plans you sell, and cancel, pause or resume individual learners' subscriptions.",
      grants: ["subscriptions.manage", "plans.view", "plans.manage"],
      danger: "FINANCIAL",
    },
    {
      id: "gateway.configure",
      label: "Can change payment gateway settings",
      description:
        "Change where your money is paid. Only the account owner can do this.",
      grants: ["gateway.configure"],
      danger: "FINANCIAL",
      ownerOnly: true,
    },
    {
      id: "billing.manage",
      label: "Can change billing and the plan",
      description:
        "Upgrade, downgrade or cancel your subscription. Only the account owner can do this.",
      grants: ["billing.manage", "settings.billing"],
      danger: "FINANCIAL",
      ownerOnly: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

const MARKETING: FeatureCapabilities = {
  area: "MARKETING",
  feature: "Marketing",
  addedIn: "2025-01",
  capabilities: [
    {
      id: "email_sending.manage",
      label: "Can configure email sending",
      description:
        "Set up sending domains and sender addresses, and manage bounces.",
      grants: ["email_sending.view", "email_sending.manage"],
    },
    {
      id: "testimonials.moderate",
      label: "Can moderate testimonials",
      description: "Approve or hide learner testimonials shown on your site.",
      grants: ["testimonials.view", "testimonials.moderate"],
      danger: "PUBLIC",
    },
  ],
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const REPORTS: FeatureCapabilities = {
  area: "REPORTS",
  feature: "Reports",
  addedIn: "2025-01",
  capabilities: [
    {
      // THE HOME PAGE. Every staff member lands here after signing in, so this
      // must not be something you have to remember to tick: `analytics.dashboard`
      // used to be bundled inside "content reports", which meant any role that
      // didn't opt into reports hit "Failed to load dashboard: Insufficient
      // permissions" on their very first screen. It is its own capability now,
      // listed first, and the UI ticks it by default for every new role.
      id: "dashboard.view",
      label: "Can see the dashboard",
      description:
        "The home page after signing in: an overview of learners, sales and activity. Almost everyone needs this.",
      grants: ["analytics.dashboard"],
      defaultOn: true,
    },
    {
      id: "analytics.content",
      label: "Can view content reports",
      description:
        "See how courses, books, bundles and quizzes are performing.",
      // analytics.dashboard intentionally lives ONLY on dashboard.view (the
      // defaultOn baseline card), granting it here too meant un-ticking
      // "content reports" could silently strip a role's dashboard access.
      grants: [
        "analytics.courses",
        "analytics.books",
        "analytics.bundles",
        "analytics.quizzes",
        "analytics.assignments",
        "analytics.certificates",
      ],
    },
    {
      id: "analytics.learners",
      label: "Can view learner reports",
      description: "See engagement and activity reports.",
      grants: [
        "analytics.users",
        "analytics.engagement",
        "analytics.web",
      ],
    },
    {
      id: "analytics.revenue",
      label: "Can view revenue reports",
      description: "See revenue, cart and coupon performance.",
      grants: ["analytics.revenue", "analytics.cart", "analytics.coupons"],
    },
    {
      id: "analytics.export",
      label: "Can export reports",
      description: "Download report data as a file.",
      grants: ["analytics.export"],
    },
  ],
};

// ---------------------------------------------------------------------------
// AI Tools
// ---------------------------------------------------------------------------

const AI_TOOLS: FeatureCapabilities = {
  area: "AI_TOOLS",
  feature: "AI Tools",
  addedIn: "2025-09",
  capabilities: [
    {
      id: "ai.use",
      label: "Can use AI tools",
      description:
        "Generate courses, books, tests and pages with AI.",
      grants: [
        "ai.content_gen.use",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Settings & Team
// ---------------------------------------------------------------------------

const SETTINGS: FeatureCapabilities = {
  area: "SETTINGS_AND_TEAM",
  feature: "Settings & Team",
  addedIn: "2025-01",
  capabilities: [
    {
      id: "settings.organisation",
      label: "Can change organisation settings",
      description:
        "Edit your school's name, logo, branding and contact details.",
      grants: ["settings.organization"],
    },
    {
      id: "settings.site",
      label: "Can change site settings",
      description: "Configure navigation, domains and currencies.",
      grants: [
        "settings.navigation",
        "settings.domains",
        "settings.currencies",
      ],
    },
    {
      id: "settings.auth",
      label: "Can change how people sign in",
      description:
        "Change sign-in methods and the Google login connection, who is allowed to log in. Only the account owner can do this.",
      grants: ["settings.auth"],
      // "Who can get in" is an authentication-boundary decision (enable/disable
      // sign-in methods, swap the Google OAuth client id). It belongs with the
      // owner, not any staffer who can edit navigation/domains. Also listed in
      // OWNER_ONLY_PERMISSIONS as a second backstop.
      ownerOnly: true,
    },
    {
      id: "settings.entitlements",
      label: "Can view plan usage",
      description: "See what your plan includes and how much you've used.",
      grants: ["entitlements.view", "entitlements.reconcile"],
    },
    {
      id: "staff.view",
      label: "Can view the team",
      description: "See who is on the team and what role they have.",
      grants: ["staff.view", "roles.view"],
    },
    {
      id: "audit.view",
      label: "Can see the activity log",
      description:
        "See every action taken in the dashboard, and by whom, including attempts that were blocked.",
      grants: ["audit.view"],
      // The log records who did what, including who changed whose access. Handing
      // it to the wrong person hands them the map of everything worth tampering with.
      danger: "PERSONAL_DATA",
    },
    {
      id: "staff.manage",
      label: "Can manage the team and their access",
      description:
        "Invite people, remove them, and decide what they can do. Only the account owner can do this.",
      grants: ["staff.manage", "roles.manage"],
      ownerOnly: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * Every feature's manifest. Adding a feature = adding one entry here.
 * `validate.ts` checks this covers every code the routes enforce.
 */
export const FEATURE_MANIFESTS: FeatureCapabilities[] = [
  COURSES,
  BOOKS_AND_BUNDLES,
  TESTS,
  LIVE_TEACHING,
  OTHER_CONTENT,
  LEARNERS,
  SALES,
  MARKETING,
  REPORTS,
  AI_TOOLS,
  SETTINGS,
];
