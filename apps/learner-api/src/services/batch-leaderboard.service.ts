import { db } from "../db/connection";
import { NotFoundError } from "../errors/not-found.error";
import batchesRepository from "../repositories/batches.repository";
import batchLeaderboardRepository, {
  type LeaderboardEntry,
  type LeaderboardSnapshotPayload,
} from "../repositories/batch-leaderboard.repository";

// Score = lesson completion percentage (0-100, two decimals).

const TOP_N = 50;

/** Snapshot is fresh enough if computed within the last 15 min. */
const SNAPSHOT_TTL_MS = 15 * 60 * 1000;

interface MemberStats {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  lessonsCompleted: number;
}

function computeScore(m: MemberStats, totalLessons: number): number {
  const lessonPct = totalLessons > 0 ? m.lessonsCompleted / totalLessons : 0;
  return Math.round(lessonPct * 10000) / 100;
}

function shortName(name: string): string {
  if (!name) return "Learner";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/**
 * Recompute the leaderboard snapshot for one batch.
 * Reads-only: no schema changes to courses/books. Joins the existing analytics tables.
 */
export async function computeAndStoreSnapshot(
  tenantId: string,
  batchId: string
): Promise<LeaderboardSnapshotPayload> {
  // 1. Resolve courses in the batch.
  const courseIds = (
    await db
      .selectFrom("batch_items")
      .select("course_id")
      .where("tenant_id", "=", tenantId)
      .where("batch_id", "=", batchId)
      .where("item_type", "=", "COURSE")
      .where("course_id", "is not", null)
      .execute()
  )
    .map((r) => r.course_id)
    .filter((c): c is string => !!c);

  // 3. Total lessons across batch courses.
  let totalLessons = 0;
  if (courseIds.length > 0) {
    const r = await db
      .selectFrom("lectures")
      .select(db.fn.count<number>("id").as("count"))
      .where("tenant_id", "=", tenantId)
      .where("course_id", "in", courseIds)
      .executeTakeFirst();
    totalLessons = Number(r?.count ?? 0);
  }

  // 4. Active members in this batch.
  const memberRows = await db
    .selectFrom("batch_enrollments")
    .innerJoin("tenant_members", "tenant_members.id", "batch_enrollments.tenant_member_id")
    .select([
      "batch_enrollments.tenant_member_id as member_id",
      "tenant_members.name as name",
      "tenant_members.avatar_url as avatar_url",
    ])
    .where("batch_enrollments.tenant_id", "=", tenantId)
    .where("batch_enrollments.batch_id", "=", batchId)
    .where("batch_enrollments.status", "=", "ACTIVE")
    .execute();

  if (memberRows.length === 0) {
    const empty: LeaderboardSnapshotPayload = {
      topN: [],
      totalParticipants: 0,
      computedAt: new Date().toISOString(),
    };
    await batchLeaderboardRepository.insertSnapshot(tenantId, batchId, empty, 0);
    await batchLeaderboardRepository.pruneOldSnapshots(tenantId, batchId);
    return empty;
  }

  const memberIds = memberRows.map((m) => m.member_id);

  // 6. Lessons completed per member (single query).
  const completionMap = new Map<string, number>();
  if (totalLessons > 0) {
    const rows = await db
      .selectFrom("member_lecture_progress")
      .innerJoin("lectures", "lectures.id", "member_lecture_progress.lecture_id")
      .select([
        "member_lecture_progress.tenant_member_id as member_id",
        db.fn.count<number>("member_lecture_progress.id").as("count"),
      ])
      .where("member_lecture_progress.tenant_id", "=", tenantId)
      .where("member_lecture_progress.tenant_member_id", "in", memberIds)
      .where("member_lecture_progress.completed", "=", true)
      .where("lectures.course_id", "in", courseIds)
      .groupBy("member_lecture_progress.tenant_member_id")
      .execute();
    for (const r of rows) {
      completionMap.set(r.member_id, Number(r.count ?? 0));
    }
  }

  // 7. Compose and rank.
  const stats: MemberStats[] = memberRows.map((m) => ({
    memberId: m.member_id,
    displayName: shortName(m.name),
    avatarUrl: m.avatar_url,
    lessonsCompleted: completionMap.get(m.member_id) ?? 0,
  }));

  const ranked = stats
    .map((s) => ({
      ...s,
      totalLessons,
      score: computeScore(s, totalLessons),
    }))
    .sort((a, b) => b.score - a.score);

  const topN: LeaderboardEntry[] = ranked.slice(0, TOP_N).map((r, i) => ({
    memberId: r.memberId,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    lessonsCompleted: r.lessonsCompleted,
    totalLessons: r.totalLessons,
    score: r.score,
    rank: i + 1,
  }));

  const payload: LeaderboardSnapshotPayload = {
    topN,
    totalParticipants: stats.length,
    computedAt: new Date().toISOString(),
  };

  await batchLeaderboardRepository.insertSnapshot(
    tenantId,
    batchId,
    payload,
    stats.length
  );
  await batchLeaderboardRepository.pruneOldSnapshots(tenantId, batchId);

  return payload;
}

export async function getLeaderboard(
  tenantId: string,
  slug: string,
  memberId: string | null
) {
  // 1. Resolve batch. The leaderboard is public, visitors get the top-N
  //    snapshot but no `me` row. Enrolled members get their own row located
  //    in the snapshot (or estimated when they're below the top-N cutoff).
  const batch = await batchesRepository.findPublishedBySlug(tenantId, slug);
  if (!batch) {
    throw new NotFoundError("Batch not found");
  }

  let isEnrolled = false;
  if (memberId) {
    const enrollment = await batchesRepository.findActiveEnrollment(
      tenantId,
      batch.id,
      memberId
    );
    isEnrolled = !!enrollment;
  }

  // 2. Read latest snapshot; recompute if stale or absent.
  const snapshot = await batchLeaderboardRepository.getLatestSnapshot(
    tenantId,
    batch.id
  );
  let payload: LeaderboardSnapshotPayload | null = null;
  const now = Date.now();
  if (snapshot) {
    const computedAt =
      snapshot.computed_at instanceof Date
        ? snapshot.computed_at.getTime()
        : new Date(snapshot.computed_at as unknown as string).getTime();
    if (now - computedAt < SNAPSHOT_TTL_MS) {
      payload = snapshot.payload as unknown as LeaderboardSnapshotPayload;
    }
  }
  if (!payload) {
    payload = await computeAndStoreSnapshot(tenantId, batch.id);
  }

  // 3. Locate caller's row only if they're authenticated AND enrolled.
  let myEntry: LeaderboardEntry | null = null;
  if (memberId && isEnrolled) {
    myEntry = payload.topN.find((e) => e.memberId === memberId) ?? null;
    if (!myEntry) {
      // Outside the top N, show a placeholder row at the bottom of the
      // ranking. We could compute their exact rank but for v1 the snapshot
      // count is good enough.
      myEntry = {
        memberId,
        displayName: "You",
        avatarUrl: null,
        lessonsCompleted: 0,
        totalLessons: 0,
        score: 0,
        rank: payload.totalParticipants,
      };
    }
  }

  return {
    batchId: batch.id,
    snapshot: payload,
    me: myEntry,
  };
}
