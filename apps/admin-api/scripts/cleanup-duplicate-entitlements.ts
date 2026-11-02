import { db } from "../src/db/connection";
import { sql } from "kysely";

async function cleanupDuplicateEntitlements() {
  console.log("Starting cleanup of duplicate active entitlements...");

  // Find all (tenant_id, product_code) pairs that have more than 1 active entitlement
  const duplicates = await db
    .selectFrom("entitlements")
    .select([
      "tenant_id",
      "product_code",
      sql<number>`count(*)::int`.as("count"),
    ])
    .where("is_active", "=", true)
    .groupBy(["tenant_id", "product_code"])
    .having(sql<number>`count(*)`, ">", 1)
    .execute();

  if (duplicates.length === 0) {
    console.log("No duplicate active entitlements found. Exiting.");
    process.exit(0);
  }

  console.log(`Found ${duplicates.length} (tenant_id, product_code) pairs with duplicates.`);
  let totalArchived = 0;

  for (const dup of duplicates) {
    const tenantId = dup.tenant_id;
    const productCode = dup.product_code;

    // Fetch all active entitlements for this pair, newest first
    const rows = await db
      .selectFrom("entitlements")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("product_code", "=", productCode)
      .where("is_active", "=", true)
      .orderBy("created_at", "desc")
      .execute();

    // Keep the newest, archive the rest
    const [keep, ...toArchive] = rows;

    console.log(
      `\n  tenant=${tenantId} product=${productCode}: ` +
        `keeping ${keep.id} (created ${keep.created_at}), archiving ${toArchive.length} duplicate(s)`
    );

    for (const row of toArchive) {
      await db
        .updateTable("entitlements")
        .set({
          is_active: false,
          archived_at: new Date(),
          updated_at: new Date(),
        })
        .where("id", "=", row.id)
        .execute();
      totalArchived++;
    }
  }

  console.log(`\nCleanup complete. Archived ${totalArchived} duplicate entitlement(s).`);
  process.exit(0);
}

cleanupDuplicateEntitlements().catch((err) => {
  console.error("Error during cleanup:", err);
  process.exit(1);
});
