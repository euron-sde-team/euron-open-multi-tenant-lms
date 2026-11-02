/**
 * CLI Script: Seed base admin permissions
 *
 * Run: pnpm seed:permissions
 * Or:  pnpm tsx scripts/seed-admin-permissions.ts
 *
 * Creates all the base permissions needed for admin RBAC.
 * Safe to run multiple times - skips existing permissions.
 */

import { ulid } from "ulid";
import { db, pool } from "./lib/db";
import logger from "../src/utils/logger";


// Base permissions to seed
const BASE_PERMISSIONS = [
  // Admin User Management
  {
    code: "admin_users.view",
    name: "View Admin Users",
    description: "View the list of admin users and their details",
    category: "admin_users",
  },
  {
    code: "admin_users.manage",
    name: "Manage Admin Users",
    description: "Create and edit admin users",
    category: "admin_users",
  },
  {
    code: "admin_users.delete",
    name: "Delete Admin Users",
    description: "Deactivate admin users (soft delete)",
    category: "admin_users",
  },

  // Admin Role Management
  {
    code: "admin_roles.view",
    name: "View Roles",
    description: "View the list of roles and their permissions",
    category: "admin_roles",
  },
  {
    code: "admin_roles.manage",
    name: "Manage Roles",
    description: "Create, edit, and delete roles",
    category: "admin_roles",
  },

  // Admin Permission Management
  {
    code: "admin_permissions.manage",
    name: "Manage Permissions",
    description: "View, create, edit, and delete permissions",
    category: "admin_permissions",
  },

  // Tenant Management
  {
    code: "tenants.view",
    name: "View Tenants",
    description: "View the list of tenants and their details",
    category: "tenants",
  },
  {
    code: "tenants.manage",
    name: "Manage Tenants",
    description: "Create, edit, and suspend tenants",
    category: "tenants",
  },
  {
    code: "tenants.delete",
    name: "Delete Tenants",
    description: "Permanently delete tenants (dangerous)",
    category: "tenants",
  },

  // Billing Management
  {
    code: "billing.view",
    name: "View Billing",
    description: "View billing information and invoices",
    category: "billing",
  },
  {
    code: "billing.manage",
    name: "Manage Billing",
    description: "Manage subscriptions, plans, and payment settings",
    category: "billing",
  },

  // Plan Management
  {
    code: "plans.view",
    name: "View Plans",
    description: "View available plans and their configurations",
    category: "plans",
  },
  {
    code: "plans.manage",
    name: "Manage Plans",
    description: "Create, edit, and retire plans",
    category: "plans",
  },

  // Application Management
  {
    code: "applications.view",
    name: "View Applications",
    description: "View applications in the platform",
    category: "applications",
  },
  {
    code: "applications.manage",
    name: "Manage Applications",
    description: "Create, edit, and configure applications",
    category: "applications",
  },

  // Feature & Product Management
  {
    code: "features.view",
    name: "View Features",
    description: "View features and products",
    category: "features",
  },
  {
    code: "features.manage",
    name: "Manage Features",
    description: "Create, edit, and configure features and products",
    category: "features",
  },

  // System Settings
  {
    code: "system.view_settings",
    name: "View System Settings",
    description: "View platform configuration settings",
    category: "system",
  },
  {
    code: "system.manage_settings",
    name: "Manage System Settings",
    description: "Modify platform configuration settings",
    category: "system",
  },
  {
    code: "system.view_logs",
    name: "View System Logs",
    description: "View audit logs and system events",
    category: "system",
  },

  // Tenant User Management
  {
    code: "tenant_users.view",
    name: "View Tenant Users",
    description: "View tenant users and their details",
    category: "tenant_users",
  },
  {
    code: "tenant_users.manage",
    name: "Manage Tenant Users",
    description: "Create, edit, and deactivate tenant users",
    category: "tenant_users",
  },

  // Subscription Management
  {
    code: "subscriptions.view",
    name: "View Subscriptions",
    description: "View tenant subscriptions and billing details",
    category: "subscriptions",
  },
  {
    code: "subscriptions.manage",
    name: "Manage Subscriptions",
    description: "Create, cancel, and upgrade subscriptions",
    category: "subscriptions",
  },

  // Entitlement Management
  {
    code: "entitlements.view",
    name: "View Entitlements",
    description: "View tenant entitlements and usage",
    category: "entitlements",
  },
  {
    code: "entitlements.manage",
    name: "Manage Entitlements",
    description: "Reset usage and manage entitlement lifecycle",
    category: "entitlements",
  },
  {
    code: "entitlements.override",
    name: "Override Entitlements",
    description: "Override entitlement limits (with audit)",
    category: "entitlements",
  },

  // Add-on Management
  {
    code: "addons.view",
    name: "View Add-ons",
    description: "View available add-ons and tenant add-ons",
    category: "addons",
  },
  {
    code: "addons.manage",
    name: "Manage Add-ons",
    description: "Grant and cancel tenant add-ons",
    category: "addons",
  },
  // ── Tenant members (cross-tenant staff directory) ──
  {
    code: "members.view",
    name: "View Tenant Members",
    description: "View the cross-tenant staff-member directory.",
    category: "members",
  },
];

async function seedPermissions(): Promise<void> {
  logger.info("Starting admin permissions seed process...");

  try {
    let created = 0;
    let skipped = 0;

    for (const permission of BASE_PERMISSIONS) {
      // Check if permission already exists
      const existing = await db
        .selectFrom("admin_permissions")
        .select("id")
        .where("code", "=", permission.code)
        .executeTakeFirst();

      if (existing) {
        logger.info(`Skipping existing permission: ${permission.code}`);
        skipped++;
        continue;
      }

      // Create permission
      await db
        .insertInto("admin_permissions")
        .values({
          id: ulid(),
          code: permission.code,
          name: permission.name,
          description: permission.description,
          category: permission.category,
          created_at: new Date(),
        })
        .execute();

      logger.info(`Created permission: ${permission.code}`);
      created++;
    }

    logger.info("═".repeat(50));
    logger.info("Admin permissions seed completed!");
    logger.info("═".repeat(50));
    logger.info(`Created: ${created} permissions`);
    logger.info(`Skipped: ${skipped} existing permissions`);
    logger.info(`Total:   ${BASE_PERMISSIONS.length} permissions`);
    logger.info("═".repeat(50));

    // Display permissions by category
    logger.info("\nPermissions by Category:");
    const categories = [...new Set(BASE_PERMISSIONS.map((p) => p.category))];
    for (const category of categories) {
      const perms = BASE_PERMISSIONS.filter((p) => p.category === category);
      logger.info(`\n  ${category}:`);
      for (const p of perms) {
        logger.info(`    - ${p.code}: ${p.name}`);
      }
    }

  } catch (error) {
    logger.error(`Error seeding permissions: ${error}`);
    process.exit(1);
  } finally {
    await pool.end();
    logger.info("\nDatabase connection closed.");
  }
}

// Run the seed function
seedPermissions();
