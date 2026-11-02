import { db } from "../src/db/connection";
import { sql } from "kysely";

async function cleanupDuplicateSubscriptions() {
  console.log("Starting cleanup of duplicate subscriptions...");

  // 1. Find external_subscription_ids that have more than 1 subscription
  const duplicates = await db
    .selectFrom("subscriptions")
    .select([
      "external_subscription_id",
      sql<number>`count(*)`.as("count"),
    ])
    .where("external_subscription_id", "is not", null)
    .groupBy("external_subscription_id")
    .having(sql<number>`count(*)`, ">", 1)
    .execute();

  if (duplicates.length === 0) {
    console.log("No duplicate subscriptions found. Exiting.");
    process.exit(0);
  }

  console.log(`Found ${duplicates.length} external_subscription_ids with duplicates.`);

  for (const dup of duplicates) {
    const externalId = dup.external_subscription_id!;
    console.log(`\nProcessing duplicates for external ID: ${externalId}`);

    // 2. Fetch all subscriptions for this external ID, ordered by created_at ASC
    const subs = await db
      .selectFrom("subscriptions")
      .selectAll()
      .where("external_subscription_id", "=", externalId)
      .orderBy("created_at", "asc")
      .execute();

    // Keep the first one (oldest), delete the rest
    const [keep, ...toDelete] = subs;

    console.log(`Keeping subscription ID: ${keep.id} (created at: ${keep.created_at})`);
    
    for (const subToDelete of toDelete) {
      console.log(`Deleting duplicate subscription ID: ${subToDelete.id} (created at: ${subToDelete.created_at})`);

      await db.transaction().execute(async (trx) => {
        // Reassign tenant_applications to the kept subscription
        await trx
          .updateTable("tenant_applications")
          .set({ source_subscription_id: keep.id })
          .where("source_subscription_id", "=", subToDelete.id)
          .execute();

        // Reassign subscription_events to the kept subscription
        await trx
          .updateTable("subscription_events")
          .set({ subscription_id: keep.id })
          .where("subscription_id", "=", subToDelete.id)
          .execute();

        // Delete the duplicate subscription
        await trx
          .deleteFrom("subscriptions")
          .where("id", "=", subToDelete.id)
          .execute();
      });
      
      console.log(`Successfully deleted ${subToDelete.id} and reassigned related records.`);
    }
  }

  console.log("\nCleanup complete.");
  process.exit(0);
}

cleanupDuplicateSubscriptions().catch((err) => {
  console.error("Error during cleanup:", err);
  process.exit(1);
});
