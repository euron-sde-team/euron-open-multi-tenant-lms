import { ulid } from "ulid";
import { db } from "../db/connection";

export interface LeaderboardEntry {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  lessonsCompleted: number;
  totalLessons: number;
  score: number;
  rank: number;
}

export interface LeaderboardSnapshotPayload {
  topN: LeaderboardEntry[];
  totalParticipants: number;
  computedAt: string;
}

class BatchLeaderboardRepository {
  async getLatestSnapshot(tenantId: string, batchId: string) {
    return db
      .selectFrom("batch_leaderboard_snapshots")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .orderBy("computed_at", "desc")
      .executeTakeFirst();
  }

  async insertSnapshot(
    tenantId: string,
    batchId: string,
    payload: LeaderboardSnapshotPayload,
    participants: number
  ) {
    const id = ulid();
    const now = new Date();
    await db
      .insertInto("batch_leaderboard_snapshots")
      .values({
        id,
        tenant_id: tenantId,
        batch_id: batchId,
        computed_at: now,
        participants,
        payload: JSON.stringify(payload) as never,
        created_at: now,
      })
      .execute();
    return { id, computedAt: now.toISOString() };
  }

  /**
   * Prune snapshots older than the most recent 5, per batch.
   */
  async pruneOldSnapshots(tenantId: string, batchId: string, keep = 5) {
    const recent = await db
      .selectFrom("batch_leaderboard_snapshots")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .orderBy("computed_at", "desc")
      .limit(keep)
      .execute();
    const recentIds = recent.map((r) => r.id);
    if (recentIds.length === 0) return;

    await db
      .deleteFrom("batch_leaderboard_snapshots")
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .where("id", "not in", recentIds)
      .execute();
  }
}

const batchLeaderboardRepository = new BatchLeaderboardRepository();
export default batchLeaderboardRepository;
