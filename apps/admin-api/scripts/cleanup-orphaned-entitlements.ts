/**
 * One-time cleanup: Archive active PLAN-sourced entitlements for tenants
 * that have no active subscription (ACTIVE, TRIALING, or PAST_DUE).
 *
 * Run from admin-api: npx tsx scripts/cleanup-orphaned-entitlements.ts
 */
import { db } from "../src/db/connection";

const ACTIVE_SUBSCRIPTION_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

async function cleanupOrphanedEntitlements() {
  console.log("Starting cleanup of orphaned PLAN entitlements...");

  // 1. Find tenant_ids that have at least one active subscription
  const tenantsWithActiveSub = await db
    .selectFrom("subscriptions")
    .select("tenant_id")
    .where("status", "in", ACTIVE_SUBSCRIPTION_STATUSES)
    .distinct()
    .execute();

  const activeTenantIds = new Set(tenantsWithActiveSub.map((r) => r.tenant_id));

  // 2. Find active PLAN-sourced entitlements
  const orphanedEntitlements = await db
    .selectFrom("entitlements")
    .select(["id", "tenant_id", "product_code", "application_code", "feature_key"])
    .where("is_active", "=", true)
    .where("source", "=", "PLAN")
    .execute();

  // 3. Filter to those whose tenant has NO active subscription
  const toArchive = orphanedEntitlements.filter(
    (e) => !activeTenantIds.has(e.tenant_id)
  );

  if (toArchive.length === 0) {
    console.log("No orphaned PLAN entitlements found. Exiting.");
    process.exit(0);
  }

  // Group by tenant for logging
  const byTenant = new Map<string, typeof toArchive>();
  for (const e of toArchive) {
    const list = byTenant.get(e.tenant_id) ?? [];
    list.push(e);
    byTenant.set(e.tenant_id, list);
  }

  console.log(
    `Found ${toArchive.length} orphaned entitlement(s) across ${byTenant.size} tenant(s).`
  );

  for (const [tenantId, ents] of byTenant) {
    console.log(`\n  Tenant ${tenantId}: archiving ${ents.length} entitlement(s)`);
    for (const e of ents) {
      console.log(`    - ${e.product_code} (${e.application_code}/${e.feature_key})`);
    }
  }

  const ids = toArchive.map((e) => e.id);
  await db
    .updateTable("entitlements")
    .set({
      is_active: false,
      archived_at: new Date(),
      updated_at: new Date(),
    })
    .where("id", "in", ids)
    .execute();

  console.log(`\nCleanup complete. Archived ${ids.length} entitlement(s).`);
  process.exit(0);
}

cleanupOrphanedEntitlements().catch((err) => {
  console.error("Error during cleanup:", err);
  process.exit(1);
});
