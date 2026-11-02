import { sql } from "kysely";
import { ulid } from "ulid";
import { db } from "../db/connection";

/**
 * Overlap-controlled random selection.
 *
 * Picks `count` question ids from `poolIds`, favouring the questions that have
 * been served to other learners the FEWEST times (tracked in
 * `question_serve_stats`). Ties are broken randomly. Because each new attempt
 * draws from the least-used questions, two learners drawing N from a large bank
 * land on largely disjoint sets, overlap stays well under ~20-25% as long as
 * the pool is meaningfully larger than `count`. The picked questions then have
 * their served_count incremented so the next learner spreads further.
 *
 * When `count >= pool size` every question is returned (no spreading possible).
 */
export async function pickLeastServed(
  tenantId: string,
  ownerType: "QUIZ" | "TEST",
  ownerId: string,
  poolIds: string[],
  count: number
): Promise<string[]> {
  if (poolIds.length === 0 || count <= 0) return [];
  if (count >= poolIds.length) return [...poolIds];

  const rows = await db
    .selectFrom("question_serve_stats")
    .select(["question_id", "served_count"])
    .where("tenant_id", "=", tenantId)
    .where("owner_type", "=", ownerType)
    .where("owner_id", "=", ownerId)
    .where("question_id", "in", poolIds)
    .execute();
  const countById = new Map<string, number>();
  for (const r of rows) {
    countById.set(r.question_id, Number(r.served_count ?? 0));
  }

  // Shuffle first (random tiebreak), then stable-sort by served_count ascending.
  const shuffled = [...poolIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  shuffled.sort((a, b) => (countById.get(a) ?? 0) - (countById.get(b) ?? 0));
  const picked = shuffled.slice(0, count);

  // Record usage so the next learner draws different questions.
  const now = new Date();
  for (const qid of picked) {
    await db
      .insertInto("question_serve_stats")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        owner_type: ownerType,
        owner_id: ownerId,
        question_id: qid,
        served_count: 1,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc
          .columns(["tenant_id", "owner_type", "owner_id", "question_id"])
          .doUpdateSet({
            served_count: sql`question_serve_stats.served_count + 1`,
            updated_at: now,
          })
      )
      .execute();
  }

  return picked;
}
