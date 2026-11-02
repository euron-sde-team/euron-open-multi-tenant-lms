/**
 * CLI Script: Sync permissions to ADMIN role
 *
 * Run: pnpm sync:admin-permissions
 * Or:  pnpm tsx scripts/sync-admin-permissions.ts
 *
 * Assigns all permissions to the ADMIN role, excluding:
 * - admin_roles.manage (prevents creating admin roles, including SUPERADMIN/ADMIN)
 *
 * Note: admin_users.manage is included - ADMIN users can create other admin users
 * but cannot assign SUPERADMIN or ADMIN roles (enforced in service layer)
 *
 * Safe to run multiple times - only assigns missing permissions.
 */

import { db, pool } from "./lib/db";
import logger from "../src/utils/logger";


// Permissions to exclude from ADMIN role
const EXCLUDED_PERMISSIONS = [
  "admin_roles.manage", // Prevents creating admin roles (including SUPERADMIN/ADMIN)
  // Note: admin_users.manage is included - ADMIN users can create other admin users
  // but cannot assign SUPERADMIN or ADMIN roles (enforced in service layer)
];

const ADMIN_ROLE_CODE = "ADMIN";

async function syncAdminPermissions(): Promise<void> {
  logger.info("Starting ADMIN permissions sync...");

  try {
    // Find ADMIN role
    logger.info(`Looking for ADMIN role (code: ${ADMIN_ROLE_CODE})...`);
    const adminRole = await db
      .selectFrom("admin_roles")
      .selectAll()
      .where("code", "=", ADMIN_ROLE_CODE)
      .executeTakeFirst();

    if (!adminRole) {
      logger.error(`ADMIN role not found! Please create the ADMIN role first.`);
      logger.error(`Expected role code: ${ADMIN_ROLE_CODE}`);
      process.exit(1);
    }

    logger.info(`Found ADMIN role: ${adminRole.name} (ID: ${adminRole.id})`);

    // Get all permissions from database
    logger.info("Fetching all permissions...");
    const allPermissions = await db
      .selectFrom("admin_permissions")
      .select(["id", "code", "name"])
      .execute();

    logger.info(`Total permissions: ${allPermissions.length}`);

    // Filter out excluded permissions
    const eligiblePermissions = allPermissions.filter(
      (perm) => !EXCLUDED_PERMISSIONS.includes(perm.code)
    );

    logger.info(
      `Excluded permissions: ${EXCLUDED_PERMISSIONS.length} (${EXCLUDED_PERMISSIONS.join(", ")})`
    );
    logger.info(`Eligible permissions: ${eligiblePermissions.length}`);

    // Get currently assigned permissions for ADMIN role
    logger.info("Fetching current ADMIN role permissions...");
    const currentPermissions = await db
      .selectFrom("admin_role_permissions")
      .innerJoin(
        "admin_permissions",
        "admin_permissions.id",
        "admin_role_permissions.permission_id"
      )
      .select(["admin_permissions.id", "admin_permissions.code"])
      .where("admin_role_permissions.role_id", "=", adminRole.id)
      .execute();

    const currentPermissionIds = new Set(
      currentPermissions.map((p) => p.id)
    );

    logger.info(`Current ADMIN permissions: ${currentPermissionIds.size}`);

    // Find missing permissions
    const missingPermissions = eligiblePermissions.filter(
      (perm) => !currentPermissionIds.has(perm.id)
    );

    logger.info(`Missing permissions: ${missingPermissions.length}`);

    if (missingPermissions.length === 0) {
      logger.info("═".repeat(50));
      logger.info("ADMIN role is already up to date!");
      logger.info("═".repeat(50));
      logger.info(`Total ADMIN permissions: ${currentPermissionIds.size}`);
      logger.info("═".repeat(50));
      return;
    }

    // Assign missing permissions
    logger.info(`Assigning ${missingPermissions.length} permissions to ADMIN role...`);
    let assigned = 0;
    let skipped = 0;

    for (const permission of missingPermissions) {
      try {
        await db
          .insertInto("admin_role_permissions")
          .values({
            role_id: adminRole.id,
            permission_id: permission.id,
            created_at: new Date(),
          })
          .execute();

        logger.info(`  ✓ ${permission.code}: ${permission.name}`);
        assigned++;
      } catch {
        // Handle duplicate key errors (shouldn't happen, but be safe)
        logger.warn(`  ⚠ Skipped ${permission.code} (may already be assigned)`);
        skipped++;
      }
    }

    // Get final count
    const finalPermissions = await db
      .selectFrom("admin_role_permissions")
      .where("role_id", "=", adminRole.id)
      .select("permission_id")
      .execute();

    logger.info("═".repeat(50));
    logger.info("ADMIN permissions sync completed!");
    logger.info("═".repeat(50));
    logger.info(`Added: ${assigned} permissions`);
    if (skipped > 0) {
      logger.info(`Skipped: ${skipped} permissions`);
    }
    logger.info(`Total ADMIN permissions: ${finalPermissions.length}`);
    logger.info("═".repeat(50));

    // Display excluded permissions for reference
    logger.info("\nExcluded Permissions (not assigned to ADMIN):");
    for (const excludedCode of EXCLUDED_PERMISSIONS) {
      const perm = allPermissions.find((p) => p.code === excludedCode);
      if (perm) {
        logger.info(`  - ${perm.code}: ${perm.name}`);
      }
    }

    // Display summary by category
    logger.info("\nADMIN Role Permissions Summary:");
    const allAssignedPermissions = await db
      .selectFrom("admin_role_permissions")
      .innerJoin(
        "admin_permissions",
        "admin_permissions.id",
        "admin_role_permissions.permission_id"
      )
      .select(["admin_permissions.code", "admin_permissions.name", "admin_permissions.category"])
      .where("admin_role_permissions.role_id", "=", adminRole.id)
      .orderBy("admin_permissions.category")
      .orderBy("admin_permissions.code")
      .execute();

    const permissionsByCategory = new Map<string, Array<{ code: string; name: string }>>();
    for (const perm of allAssignedPermissions) {
      const category = perm.category ?? "uncategorized";
      if (!permissionsByCategory.has(category)) {
        permissionsByCategory.set(category, []);
      }
      permissionsByCategory.get(category)!.push({
        code: perm.code,
        name: perm.name,
      });
    }

    for (const [category, perms] of Array.from(permissionsByCategory.entries()).sort()) {
      logger.info(`\n  ${category}:`);
      for (const perm of perms) {
        logger.info(`    - ${perm.code}: ${perm.name}`);
      }
    }

  } catch (error) {
    logger.error(`Error syncing ADMIN permissions: ${error}`);
    process.exit(1);
  } finally {
    await pool.end();
    logger.info("\nDatabase connection closed.");
  }
}

// Run the sync function
syncAdminPermissions();
