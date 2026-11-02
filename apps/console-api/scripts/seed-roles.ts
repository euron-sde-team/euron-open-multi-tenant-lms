/**
 * CLI Script: Seed the full admin role matrix (least-privilege)
 *
 * Run: pnpm seed:roles
 * Or:  pnpm tsx scripts/seed-roles.ts
 *
 * Idempotent + reconciling: each managed role is upserted and its permission
 * set is made to EXACTLY match the matrix below (missing ones added, extras
 * removed). Run `pnpm seed:permissions` first so all permission codes exist.
 *
 * Roles:
 *   SUPERADMIN: everything (also bypasses checks in middleware)
 *   ADMIN:      broad operations; NOT role/permission governance, deletes,
 *               or platform settings
 *   OPS:        tenants, entitlements, catalog
 *   FINANCE:    billing and subscriptions
 */

import { ulid } from "ulid";
import { db, pool } from "./lib/db";
import logger from "../src/utils/logger";


const ALL = "*" as const;

interface RoleDef {
  code: string;
  name: string;
  is_system: boolean;
  description: string;
  permissions: string[] | typeof ALL;
}

// Curated permission sets per role. Reconciled to exactly these.
const OPS_PERMS = [
  "tenants.view",
  "tenants.manage",
  "tenant_users.view",
  "tenant_users.manage",
  "members.view",
  "entitlements.view",
  "entitlements.manage",
  "entitlements.override",
  "applications.view",
  "applications.manage",
  "features.view",
  "features.manage",
  "plans.view",
  "plans.manage",
  "addons.view",
  "addons.manage",
  "subscriptions.view",
  "billing.view",
  "system.view_settings",
  "system.view_logs",
];

const FINANCE_PERMS = [
  "billing.view",
  "billing.manage",
  "subscriptions.view",
  "subscriptions.manage",
  "tenants.view",
  "plans.view",
  "addons.view",
  "entitlements.view",
];

// Dangerous/governance perms an ADMIN must NOT hold (reserved for SUPERADMIN).
const ADMIN_EXCLUDES = new Set([
  "admin_roles.manage",
  "admin_permissions.manage",
  "admin_users.delete",
  "tenants.delete",
  "system.manage_settings",
]);

const ROLES: RoleDef[] = [
  {
    code: "SUPERADMIN",
    name: "Super Administrator",
    is_system: true,
    description:
      "Full, unrestricted access to every feature and setting. The only role that can manage roles/permissions, delete tenants or admins, and change platform settings.",
    permissions: ALL,
  },
  {
    code: "ADMIN",
    name: "Administrator",
    is_system: true,
    description:
      "Broad day-to-day administration across tenants, billing and catalog. CAN: manage tenants, subscriptions, entitlements, plans, products, admin users. CANNOT: create/edit roles and permissions, delete tenants, delete admins, or change core platform settings.",
    permissions: ALL, // narrowed below by ADMIN_EXCLUDES
  },
  {
    code: "OPS",
    name: "Operations",
    is_system: false,
    description:
      "Runs tenant operations. CAN: view/manage tenants and their staff, entitlements (incl. override), applications/features/plans/add-ons; view system settings and logs. CANNOT: manage billing, admin users/roles, delete tenants, or change platform settings.",
    permissions: OPS_PERMS,
  },
  {
    code: "FINANCE",
    name: "Finance",
    is_system: false,
    description:
      "Owns billing. CAN: view/manage billing providers and subscriptions; read-only tenant/plan/entitlement context. CANNOT: manage tenants/catalog, admin users/roles, or platform settings.",
    permissions: FINANCE_PERMS,
  },
];

async function seed(): Promise<void> {
  logger.info("Seeding admin role matrix...");
  try {
    const allPerms = await db
      .selectFrom("admin_permissions")
      .select(["id", "code"])
      .execute();
    const idByCode = new Map(allPerms.map((p) => [p.code, p.id]));
    const allCodes = allPerms.map((p) => p.code);

    for (const def of ROLES) {
      // Resolve desired codes
      let desiredCodes: string[];
      if (def.permissions === ALL) {
        desiredCodes =
          def.code === "ADMIN"
            ? allCodes.filter((c) => !ADMIN_EXCLUDES.has(c))
            : allCodes;
      } else {
        desiredCodes = def.permissions;
      }
      const missingCatalog = desiredCodes.filter((c) => !idByCode.has(c));
      if (missingCatalog.length) {
        throw new Error(
          `Role ${def.code} references unseeded permissions: ${missingCatalog.join(", ")} ; run 'pnpm seed:permissions' first.`
        );
      }
      const desiredIds = new Set(desiredCodes.map((c) => idByCode.get(c)!));

      // Upsert role
      let role = await db
        .selectFrom("admin_roles")
        .selectAll()
        .where("code", "=", def.code)
        .executeTakeFirst();
      if (!role) {
        role = await db
          .insertInto("admin_roles")
          .values({
            id: ulid(),
            code: def.code,
            name: def.name,
            description: def.description,
            is_system: def.is_system,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        logger.info(`+ created role ${def.code}`);
      } else {
        await db
          .updateTable("admin_roles")
          .set({ name: def.name, description: def.description, updated_at: new Date() })
          .where("id", "=", role.id)
          .execute();
      }

      // Reconcile role_permissions to exactly desiredIds
      const current = await db
        .selectFrom("admin_role_permissions")
        .select(["permission_id"])
        .where("role_id", "=", role.id)
        .execute();
      const currentIds = new Set(current.map((r) => r.permission_id));

      const toAdd = [...desiredIds].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));

      for (const pid of toAdd) {
        await db
          .insertInto("admin_role_permissions")
          .values({ role_id: role.id, permission_id: pid, created_at: new Date() })
          .execute();
      }
      if (toRemove.length) {
        await db
          .deleteFrom("admin_role_permissions")
          .where("role_id", "=", role.id)
          .where("permission_id", "in", toRemove)
          .execute();
      }
      logger.info(
        `  ${def.code}: ${desiredIds.size} perms (+${toAdd.length} / -${toRemove.length})`
      );
    }

    logger.info("═".repeat(50));
    logger.info("Role matrix seeded.");
    logger.info("═".repeat(50));
  } catch (error) {
    logger.error(`Error seeding roles: ${error}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
