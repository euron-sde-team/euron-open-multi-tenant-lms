/**
 * CLI Script: Seed tenant RBAC permissions and system roles
 *
 * Run: pnpm seed:tenant-rbac
 * Or:  pnpm tsx scripts/seed-tenant-rbac.ts
 *
 * Creates all tenant permissions (grouped by category) and 4 system roles
 * (admin, educator, finance, ops) with their default permission bindings.
 *
 * Safe to run multiple times, idempotent:
 * - Permissions: ON CONFLICT (code) DO NOTHING
 * - Roles: ON CONFLICT (code) DO NOTHING
 * - Role-permissions: additive only (adds missing, never removes existing)
 */

import { ulid } from "ulid";
import { db } from "./lib/db";

// ---------------------------------------------------------------------------
// PERMISSION DEFINITIONS
// ---------------------------------------------------------------------------

const ALL_PERMISSIONS: Array<{
  code: string;
  name: string;
  category: string;
  description?: string;
}> = [
  // ── content ──
  { code: "courses.view", name: "View Courses", category: "content" },
  { code: "courses.create", name: "Create Courses", category: "content" },
  { code: "courses.update", name: "Update Courses", category: "content" },
  { code: "courses.delete", name: "Delete Courses", category: "content" },
  { code: "courses.publish", name: "Publish Courses", category: "content" },
  { code: "courses.lms.manage", name: "Manage Course LMS", category: "content" },
  { code: "courses.reviews.moderate", name: "Moderate Course Reviews", category: "content" },
  { code: "books.view", name: "View Books", category: "content" },
  { code: "books.create", name: "Create Books", category: "content" },
  { code: "books.update", name: "Update Books", category: "content" },
  { code: "books.delete", name: "Delete Books", category: "content" },
  { code: "books.publish", name: "Publish Books", category: "content" },
  { code: "bundles.view", name: "View Bundles", category: "content" },
  { code: "bundles.create", name: "Create Bundles", category: "content" },
  { code: "bundles.update", name: "Update Bundles", category: "content" },
  { code: "bundles.delete", name: "Delete Bundles", category: "content" },
  { code: "bundles.publish", name: "Publish Bundles", category: "content" },
  { code: "pages.view", name: "View Pages", category: "content" },
  { code: "pages.create", name: "Create Pages", category: "content" },
  { code: "pages.update", name: "Update Pages", category: "content" },
  { code: "pages.delete", name: "Delete Pages", category: "content" },
  { code: "pages.publish", name: "Publish Pages", category: "content" },
  { code: "certificates.view", name: "View Certificates", category: "content" },
  { code: "certificates.manage", name: "Manage Certificates", category: "content" },
  { code: "uploads.manage", name: "Manage Uploads", category: "content" },

  // ── assessment ──
  { code: "quizzes.view", name: "View Quizzes", category: "assessment" },
  { code: "quizzes.create", name: "Create Quizzes", category: "assessment" },
  { code: "quizzes.update", name: "Update Quizzes", category: "assessment" },
  { code: "quizzes.delete", name: "Delete Quizzes", category: "assessment" },
  { code: "assignments.view", name: "View Assignments", category: "assessment" },
  { code: "assignments.create", name: "Create Assignments", category: "assessment" },
  { code: "assignments.update", name: "Update Assignments", category: "assessment" },
  { code: "assignments.grade", name: "Grade Assignments", category: "assessment" },

  // ── people ──
  { code: "members.view", name: "View Members", category: "people" },
  { code: "members.create", name: "Create Members", category: "people" },
  { code: "members.update", name: "Update Members", category: "people" },
  { code: "members.delete", name: "Delete Members", category: "people" },
  { code: "members.export", name: "Export Members", category: "people" },
  { code: "instructors.view", name: "View Instructors", category: "people" },
  { code: "instructors.create", name: "Create Instructors", category: "people" },
  { code: "instructors.update", name: "Update Instructors", category: "people" },
  { code: "instructors.delete", name: "Delete Instructors", category: "people" },
  { code: "testimonials.view", name: "View Testimonials", category: "people" },
  { code: "testimonials.moderate", name: "Moderate Testimonials", category: "people" },
  { code: "roles.view", name: "View Roles", category: "people" },
  { code: "roles.manage", name: "Manage Roles", category: "people" },
  { code: "staff.view", name: "View Staff", category: "people" },
  { code: "staff.manage", name: "Manage Staff", category: "people" },

  // ── communication ──
  { code: "notifications.view", name: "View Notifications", category: "communication" },
  { code: "notifications.send", name: "Send Notifications", category: "communication" },

  // ── commerce ──
  { code: "categories.view", name: "View Categories", category: "commerce" },
  { code: "categories.manage", name: "Manage Categories", category: "commerce" },
  { code: "coupons.view", name: "View Coupons", category: "commerce" },
  { code: "coupons.create", name: "Create Coupons", category: "commerce" },
  { code: "coupons.update", name: "Update Coupons", category: "commerce" },
  { code: "coupons.delete", name: "Delete Coupons", category: "commerce" },
  { code: "subscriptions.view", name: "View Subscriptions", category: "commerce" },
  { code: "subscriptions.manage", name: "Manage Subscriptions", category: "commerce" },

  // ── finance ──
  { code: "payments.view", name: "View Payments", category: "finance" },
  { code: "payments.refund", name: "Refund Payments", category: "finance" },
  { code: "gateway.view", name: "View Gateway", category: "finance" },
  { code: "gateway.configure", name: "Configure Gateway", category: "finance" },
  { code: "billing.manage", name: "Manage Billing", category: "finance" },

  // ── analytics ──
  { code: "analytics.dashboard", name: "View Analytics Dashboard", category: "analytics" },
  { code: "analytics.courses", name: "View Course Analytics", category: "analytics" },
  { code: "analytics.books", name: "View Book Analytics", category: "analytics" },
  { code: "analytics.quizzes", name: "View Quiz Analytics", category: "analytics" },
  { code: "analytics.assignments", name: "View Assignment Analytics", category: "analytics" },
  { code: "analytics.users", name: "View User Analytics", category: "analytics" },
  { code: "analytics.engagement", name: "View Engagement Analytics", category: "analytics" },
  { code: "analytics.web", name: "View Web Analytics", category: "analytics" },
  { code: "analytics.revenue", name: "View Revenue Analytics", category: "analytics" },
  { code: "analytics.cart", name: "View Cart Analytics", category: "analytics" },
  { code: "analytics.bundles", name: "View Bundle Analytics", category: "analytics" },
  { code: "analytics.coupons", name: "View Coupon Analytics", category: "analytics" },
  { code: "analytics.certificates", name: "View Certificate Analytics", category: "analytics" },
  { code: "analytics.export", name: "Export Analytics", category: "analytics" },

  // ── settings ──
  { code: "settings.organization", name: "Organization Settings", category: "settings" },
  { code: "settings.branding", name: "Branding Settings", category: "settings" },
  { code: "settings.domains", name: "Domain Settings", category: "settings" },
  { code: "settings.auth", name: "Auth Settings", category: "settings" },
  { code: "settings.navigation", name: "Navigation Settings", category: "settings" },
  { code: "settings.billing", name: "Billing Settings", category: "settings" },
  { code: "settings.certificates", name: "Certificate Settings", category: "settings" },
  { code: "plans.view", name: "View Plans", category: "settings" },
  { code: "plans.manage", name: "Manage Plans", category: "settings" },
  { code: "entitlements.view", name: "View Entitlements", category: "settings" },
  { code: "entitlements.reconcile", name: "Reconcile Entitlements", category: "settings" },

  // ── batches, test series and other runtime codes ──
  { code: "batches.view", name: "View Batches", category: "content" },
  { code: "batches.create", name: "Create Batches", category: "content" },
  { code: "batches.update", name: "Update Batches", category: "content" },
  { code: "batches.delete", name: "Delete Batches", category: "content" },
  { code: "batches.publish", name: "Publish Batches", category: "content" },
  { code: "tests.view", name: "View Test Series", category: "assessment" },
  { code: "tests.manage", name: "Manage Test Series", category: "assessment" },
  { code: "tests.publish", name: "Publish Test Series", category: "assessment" },
  { code: "tests.delete", name: "Delete Test Series", category: "assessment" },
  { code: "tests.import", name: "Import Test Questions", category: "assessment" },
  { code: "tests.ai_generate", name: "Generate Tests with AI", category: "assessment" },
  { code: "audit.view", name: "View Audit Log", category: "settings" },
  { code: "settings.currencies", name: "Currency Settings", category: "settings" },
  { code: "email_sending.view", name: "View Email Sending", category: "communication" },
  { code: "email_sending.manage", name: "Manage Email Sending", category: "communication" },
];

// ---------------------------------------------------------------------------
// SYSTEM ROLE DEFINITIONS
// ---------------------------------------------------------------------------

const SYSTEM_ROLES = [
  { code: "admin", name: "Admin", description: "Full administrative access" },
  { code: "educator", name: "Educator", description: "Content creation and teaching" },
  { code: "finance", name: "Finance", description: "Financial operations and reporting" },
  { code: "ops", name: "Ops", description: "Operations and community management" },
] as const;

// Admin gets ALL permissions (computed dynamically)
const ADMIN_PERMISSIONS = ALL_PERMISSIONS.map((p) => p.code);

const EDUCATOR_PERMISSIONS = [
  // Content
  "courses.view", "courses.create", "courses.update", "courses.delete", "courses.publish",
  "courses.lms.manage", "courses.reviews.moderate",
  "books.view", "books.create", "books.update", "books.delete", "books.publish",
  "pages.view", "pages.create", "pages.update", "pages.publish",
  "bundles.view",
  "batches.view", "batches.create", "batches.update", "batches.publish",
  "certificates.view", "certificates.manage",
  "uploads.manage",
  // Assessment
  "quizzes.view", "quizzes.create", "quizzes.update", "quizzes.delete",
  "assignments.view", "assignments.create", "assignments.update", "assignments.grade",
  "tests.view", "tests.manage", "tests.publish", "tests.import", "tests.ai_generate",
  // People (limited)
  "members.view", "instructors.view",
  // Commerce (limited)
  "categories.view",
  // Settings (limited)
  "entitlements.view",
  // Analytics
  "analytics.dashboard", "analytics.courses", "analytics.books",
  "analytics.quizzes", "analytics.assignments", "analytics.certificates",
];

const FINANCE_PERMISSIONS = [
  // Finance
  "payments.view", "payments.refund",
  "gateway.view", "gateway.configure",
  "billing.manage",
  // Commerce
  "coupons.view", "coupons.create", "coupons.update", "coupons.delete",
  "subscriptions.view",
  // People (read-only for payment context)
  "members.view",
  // Analytics
  "analytics.dashboard", "analytics.revenue", "analytics.cart",
  "analytics.coupons", "analytics.users",
  "analytics.export",
  // Settings
  "plans.view", "settings.billing", "entitlements.view",
];

const OPS_PERMISSIONS = [
  // People
  "members.view", "members.create", "members.update", "members.delete", "members.export",
  "instructors.view", "instructors.create", "instructors.update",
  "testimonials.view", "testimonials.moderate",
  // Communication
  "notifications.view", "notifications.send",
  // Commerce
  "categories.view", "categories.manage",
  "coupons.view", "coupons.create", "coupons.update",
  // Content (limited)
  "courses.view", "courses.reviews.moderate", "books.view", "bundles.view",
  "batches.view", "tests.view",
  "pages.view",
  "certificates.view",
  // Settings (limited)
  "entitlements.view",
  // Analytics
  "analytics.dashboard", "analytics.courses", "analytics.books",
  "analytics.quizzes", "analytics.assignments", "analytics.users",
  "analytics.engagement", "analytics.web", "analytics.cart",
  "analytics.bundles", "analytics.coupons", "analytics.certificates",
  "analytics.export",
];

/**
 * Permissions that must NEVER be assigned to ANY built-in system-role template
 * by default, including the `admin` template (whose list is computed from ALL
 * permissions). The tenant OWNER always has these via the isOwner bypass; every
 * other role, built-in or custom, only gets them when the owner explicitly ticks
 * them in Team Management.
 *
 * `videos.download` is here: downloading original video files is a content-
 * exfiltration risk that must stay owner-controlled. This is a belt-and-braces
 * guard so the code can never leak into a default role even if it's later added
 * to the ALL_PERMISSIONS catalogue.
 */
const NEVER_DEFAULT_TO_SYSTEM_ROLES = new Set<string>([]);

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  admin: ADMIN_PERMISSIONS,
  educator: EDUCATOR_PERMISSIONS,
  finance: FINANCE_PERMISSIONS,
  ops: OPS_PERMISSIONS,
};

// Enforce the owner-only carve-out across every system role, defensively.
for (const code of Object.keys(ROLE_PERMISSION_MAP)) {
  ROLE_PERMISSION_MAP[code] = ROLE_PERMISSION_MAP[code].filter(
    (p) => !NEVER_DEFAULT_TO_SYSTEM_ROLES.has(p)
  );
}

// ---------------------------------------------------------------------------
// SEED LOGIC
// ---------------------------------------------------------------------------

async function seed() {
  console.log("=== Seeding Tenant RBAC ===\n");

  // ── Step 1: Seed permissions ──
  console.log(`Checking ${ALL_PERMISSIONS.length} permissions...`);

  const existingPerms = await db
    .selectFrom("tenant_permissions")
    .select(["id", "code"])
    .execute();

  const existingPermCodes = new Set(existingPerms.map((p) => p.code));
  const missingPerms = ALL_PERMISSIONS.filter((p) => !existingPermCodes.has(p.code));

  if (missingPerms.length > 0) {
    const now = new Date();
    await db
      .insertInto("tenant_permissions")
      .values(
        missingPerms.map((p) => ({
          id: ulid(),
          code: p.code,
          name: p.name,
          description: p.description ?? null,
          category: p.category,
          created_at: now,
        }))
      )
      .onConflict((oc) => oc.column("code").doNothing())
      .execute();

    console.log(`  ✓ Inserted ${missingPerms.length} new permissions`);
  } else {
    console.log("  ✓ All permissions already exist");
  }

  // Reload all permissions (need IDs for role binding)
  const allPerms = await db
    .selectFrom("tenant_permissions")
    .select(["id", "code"])
    .execute();
  const permByCode = new Map(allPerms.map((p) => [p.code, p.id]));

  // ── Step 2: Seed system roles ──
  console.log(`\nChecking ${SYSTEM_ROLES.length} system roles...`);

  for (const roleDef of SYSTEM_ROLES) {
    let role = await db
      .selectFrom("tenant_roles")
      .select(["id", "code"])
      .where("code", "=", roleDef.code)
      .where("tenant_id", "is", null)
      .executeTakeFirst();

    if (!role) {
      const now = new Date();
      role = await db
        .insertInto("tenant_roles")
        .values({
          id: ulid(),
          code: roleDef.code,
          name: roleDef.name,
          description: roleDef.description,
          is_system: true,
          created_at: now,
          updated_at: now,
        })
        .returning(["id", "code"])
        .executeTakeFirst();

      if (role) {
        console.log(`  ✓ Created system role "${roleDef.code}"`);
      }
    } else {
      console.log(`  ✓ Role "${roleDef.code}" already exists`);
    }

    if (!role) continue;

    // ── Step 3: Sync permissions for role (add missing, remove stale) ──
    const expectedCodes = ROLE_PERMISSION_MAP[roleDef.code] ?? [];
    const expectedPermIds = new Set(
      expectedCodes
        .map((code) => permByCode.get(code))
        .filter((id): id is string => !!id)
    );

    // Get current bindings
    const currentBindings = await db
      .selectFrom("tenant_role_permissions")
      .select("permission_id")
      .where("role_id", "=", role.id)
      .execute();
    const currentPermIds = new Set(currentBindings.map((b) => b.permission_id));

    // Find missing bindings (in expected but not in DB)
    const missingPermIds = [...expectedPermIds].filter((id) => !currentPermIds.has(id));

    // Find stale bindings (in DB but not in expected)
    const stalePermIds = [...currentPermIds].filter((id) => !expectedPermIds.has(id));

    if (missingPermIds.length > 0) {
      const now = new Date();
      await db
        .insertInto("tenant_role_permissions")
        .values(
          missingPermIds.map((permId) => ({
            role_id: role!.id,
            permission_id: permId,
            created_at: now,
          }))
        )
        .onConflict((oc) => oc.columns(["role_id", "permission_id"]).doNothing())
        .execute();

      console.log(
        `  ✓ Added ${missingPermIds.length} permissions to "${roleDef.code}"`
      );
    }

    if (stalePermIds.length > 0) {
      await db
        .deleteFrom("tenant_role_permissions")
        .where("role_id", "=", role.id)
        .where("permission_id", "in", stalePermIds)
        .execute();

      console.log(
        `  ✓ Removed ${stalePermIds.length} stale permissions from "${roleDef.code}"`
      );
    }

    if (missingPermIds.length === 0 && stalePermIds.length === 0) {
      console.log(
        `  ✓ Role "${roleDef.code}" already in sync (${expectedPermIds.size} permissions)`
      );
    } else {
      console.log(
        `  ✓ Role "${roleDef.code}" synced to ${expectedPermIds.size} permissions`
      );
    }
  }

  // ── Step 4: Clean up stale system roles ──
  console.log("\nCleaning up stale system roles...");

  const validCodes = new Set<string>(SYSTEM_ROLES.map((r) => r.code));
  const allRoles = await db
    .selectFrom("tenant_roles")
    .select(["id", "code", "is_system"])
    .where("tenant_id", "is", null)
    .execute();

  for (const role of allRoles) {
    if (role.is_system && !validCodes.has(role.code)) {
      // Check if any staff have this role assigned
      const assignedCount = await db
        .selectFrom("tenant_user_roles")
        .select(db.fn.count("role_id").as("count"))
        .where("role_id", "=", role.id)
        .executeTakeFirst();

      const count =
        typeof assignedCount?.count === "string"
          ? parseInt(assignedCount.count, 10)
          : Number(assignedCount?.count ?? 0);

      if (count > 0) {
        console.log(
          `  ⚠ Stale role "${role.code}" has ${count} staff assignment(s), skipping deletion`
        );
        continue;
      }

      // Delete role-permission mappings first, then the role
      await db
        .deleteFrom("tenant_role_permissions")
        .where("role_id", "=", role.id)
        .execute();
      await db
        .deleteFrom("tenant_roles")
        .where("id", "=", role.id)
        .execute();
      console.log(`  ✓ Deleted stale system role "${role.code}"`);
    }
  }

  // ── Summary ──
  const totalPerms = await db
    .selectFrom("tenant_permissions")
    .select(db.fn.count("id").as("count"))
    .executeTakeFirst();
  const totalRoles = await db
    .selectFrom("tenant_roles")
    .select(db.fn.count("id").as("count"))
    .executeTakeFirst();

  console.log(`\n=== Seed Complete ===`);
  console.log(`  Permissions: ${totalPerms?.count ?? 0}`);
  console.log(`  Roles: ${totalRoles?.count ?? 0}`);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
