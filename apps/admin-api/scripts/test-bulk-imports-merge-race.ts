 
/**
 * Integration test for the race-safe merge guard on tenant_members.
 *
 * Setup: two concurrent imports both try to add the SAME phone to two
 * DIFFERENT email-only members. With the WHERE NOT EXISTS guard in
 * mergePhoneIntoMember, exactly one writer must win and the other must
 * report a race conflict.
 *
 * Prerequisites:
 *   - Migration applied: `npx prisma migrate dev --name add_tenant_bulk_imports`
 *   - DATABASE_URL points at a dev DB with at least one tenant row
 *
 * Run: pnpm test:matcher:race  (or set TEST_TENANT_ID=<id> first)
 */
import { ulid } from "ulid";

import { closeDBConnection, db } from "../src/db/connection";
import membersRepository from "../src/repositories/members.repository";

async function main(): Promise<void> {
  const tenantId =
    process.env.TEST_TENANT_ID ??
    (
      await db.selectFrom("tenants").select("id").limit(1).executeTakeFirstOrThrow()
    ).id;

  console.log(`Using tenant ${tenantId}`);

  // Create two fresh email-only members.
  const memberAId = await membersRepository.createMember({
    tenantId,
    name: "Race Test A",
    email: `race-a-${ulid()}@example.com`,
    phone: null,
    invitedBy: "race-test-script",
  });
  const memberBId = await membersRepository.createMember({
    tenantId,
    name: "Race Test B",
    email: `race-b-${ulid()}@example.com`,
    phone: null,
    invitedBy: "race-test-script",
  });
  console.log(`Created members A=${memberAId} B=${memberBId}`);

  const contestedPhone = `+1415555${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
  console.log(`Both workers will try to claim phone ${contestedPhone}`);

  // Two concurrent merges, same phone, different memberIds.
  const [winnerForA, winnerForB] = await Promise.all([
    membersRepository.mergePhoneIntoMember(tenantId, memberAId, contestedPhone),
    membersRepository.mergePhoneIntoMember(tenantId, memberBId, contestedPhone),
  ]);

  console.log(`Worker A returned ${winnerForA}, worker B returned ${winnerForB}`);
  const winners = [winnerForA, winnerForB].filter(Boolean).length;
  if (winners !== 1) {
    console.error(
      `FAIL: expected exactly 1 winner, got ${winners}. The race guard is broken.`,
    );
    process.exit(1);
  }
  console.log("OK: exactly one writer claimed the phone.");

  // Verify the DB: exactly one of the members has the phone.
  const aRow = await membersRepository.findByEmail(tenantId, "");
  const finalA = await db
    .selectFrom("tenant_members")
    .select(["id", "phone"])
    .where("tenant_id", "=", tenantId)
    .where("id", "in", [memberAId, memberBId])
    .execute();
  const withPhone = finalA.filter((m) => m.phone === contestedPhone);
  if (withPhone.length !== 1) {
    console.error(
      `FAIL: expected exactly 1 member to have the phone in DB; found ${withPhone.length}`,
    );
    process.exit(1);
  }
  console.log(`OK: phone is on member ${withPhone[0]?.id}`);

  // Cleanup
  await db.deleteFrom("tenant_members").where("id", "in", [memberAId, memberBId]).execute();
  console.log("Cleaned up test members.");

  // Suppress unused-var warning (aRow is a sanity-check fixture).
  void aRow;

  await closeDBConnection();
}

void main().catch(async (err) => {
  console.error(err);
  await closeDBConnection();
  process.exit(1);
});
