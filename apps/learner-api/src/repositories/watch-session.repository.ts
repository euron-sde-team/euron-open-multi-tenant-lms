/**
 * Repository for lecture watch sessions and per-lecture progress watch counters.
 * One row per playback session in lecture_watch_sessions; one row per
 * (member, lecture) in member_lecture_progress.
 *
 * Identity guard:
 *   - upsertSession's ON CONFLICT path only updates when the existing row's
 *     (tenant_id, tenant_member_id, course_id, lecture_id) all match the
 *     incoming row. Mismatch returns status="mismatch" so the caller can
 *     reject (prevents sessionId reuse across lectures or members).
 *   - endSession's UPDATE filters on the same identity tuple so a leaked
 *     sessionId can't be used to close someone else's active session.
 *
 * All queries are tenant-scoped.
 */

import { sql, type Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB } from "../db/types";

export interface WatchSessionUpsertParams {
  sessionId: string;
  tenantId: string;
  memberId: string;
  courseId: string;
  lectureId: string;
  currentPosition: number;
  deltaSeconds: number;
  isSessionStart: boolean;
  deviceType?: string | null;
  userAgent?: string | null;
}

export interface WatchSessionRow {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  lecture_id: string;
  started_at: Date;
  last_heartbeat_at: Date;
  ended_at: Date | null;
  start_position: number;
  end_position: number;
  seconds_watched: number;
}

type Trx = Transaction<DB>;

export type UpsertSessionStatus = "inserted_or_updated" | "mismatch";

/**
 * Upsert a watch session row by ULID.
 * - On insert: stamps started_at + start_position; seconds_watched = delta.
 * - On conflict, the DO UPDATE only fires when the existing row's
 *   (tenant_id, tenant_member_id, course_id, lecture_id) all match the
 *   incoming row. If any differ, the UPDATE is skipped, RETURNING comes back
 *   empty, and the caller is told "mismatch" so it can reject the request.
 *
 * This prevents a malicious or buggy client from reusing a sessionId on a
 * different lecture/member, which would split-brain analytics (session row
 * accumulating on lecture A while progress moves on lecture B).
 */
export async function upsertSession(
  params: WatchSessionUpsertParams,
  trx?: Trx
): Promise<UpsertSessionStatus> {
  const exec = trx ?? db;
  const now = new Date();
  const delta = Math.max(0, Math.floor(params.deltaSeconds));
  const position = Math.max(0, Math.floor(params.currentPosition));

  // Raw SQL because Kysely's onConflict.where() doesn't compose cleanly with
  // EXCLUDED references. Using INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE,
  // which Postgres evaluates against the existing row + EXCLUDED proposed row.
  // RETURNING id is empty iff the conflict happened AND the WHERE rejected the
  // update, which is exactly the identity-mismatch signal we want.
  const result = await sql<{ id: string }>`
    INSERT INTO lecture_watch_sessions (
      id, tenant_id, tenant_member_id, course_id, lecture_id,
      started_at, last_heartbeat_at, start_position, end_position,
      seconds_watched, device_type, user_agent, created_at
    )
    VALUES (
      ${params.sessionId}, ${params.tenantId}, ${params.memberId}, ${params.courseId}, ${params.lectureId},
      ${now}, ${now}, ${position}, ${position},
      ${delta}, ${params.deviceType ?? null}, ${params.userAgent ?? null}, ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      last_heartbeat_at = EXCLUDED.last_heartbeat_at,
      end_position      = EXCLUDED.end_position,
      seconds_watched   = lecture_watch_sessions.seconds_watched + EXCLUDED.seconds_watched
    WHERE lecture_watch_sessions.tenant_id        = EXCLUDED.tenant_id
      AND lecture_watch_sessions.tenant_member_id = EXCLUDED.tenant_member_id
      AND lecture_watch_sessions.course_id        = EXCLUDED.course_id
      AND lecture_watch_sessions.lecture_id       = EXCLUDED.lecture_id
    RETURNING id
  `.execute(exec);

  return result.rows.length > 0 ? "inserted_or_updated" : "mismatch";
}

export type EndSessionStatus =
  | { status: "closed"; session: WatchSessionRow }
  | { status: "already_ended"; session: WatchSessionRow }
  | { status: "missing" }
  | { status: "mismatch" };

export interface EndSessionGuard {
  memberId: string;
  courseId: string;
  lectureId: string;
}

/**
 * Idempotently close a session. The UPDATE filters on the full identity
 * tuple, a leaked sessionId is useless without the matching member/course/
 * lecture. If no row was updated, we look the row up to distinguish
 * "already ended", "missing", or "mismatch", so the caller can react
 * (idempotent end vs forbidden vs no-op).
 */
export async function endSession(
  tenantId: string,
  sessionId: string,
  guard: EndSessionGuard,
  trx?: Trx
): Promise<EndSessionStatus> {
  const exec = trx ?? db;
  const now = new Date();
  const closed = await exec
    .updateTable("lecture_watch_sessions")
    .set({ ended_at: now, last_heartbeat_at: now })
    .where("id", "=", sessionId)
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", guard.memberId)
    .where("course_id", "=", guard.courseId)
    .where("lecture_id", "=", guard.lectureId)
    .where("ended_at", "is", null)
    .returningAll()
    .executeTakeFirst();
  if (closed) return { status: "closed", session: rowToWatchSession(closed) };

  const existing = await exec
    .selectFrom("lecture_watch_sessions")
    .selectAll()
    .where("id", "=", sessionId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!existing) return { status: "missing" };
  if (
    existing.tenant_member_id !== guard.memberId ||
    existing.course_id !== guard.courseId ||
    existing.lecture_id !== guard.lectureId
  ) {
    return { status: "mismatch" };
  }
  // Identity matches but UPDATE skipped, must already be ended.
  return { status: "already_ended", session: rowToWatchSession(existing) };
}

/** Find a session by id (tenant-scoped). */
export async function findSession(
  tenantId: string,
  sessionId: string,
  trx?: Trx
): Promise<WatchSessionRow | undefined> {
  const exec = trx ?? db;
  const row = await exec
    .selectFrom("lecture_watch_sessions")
    .selectAll()
    .where("id", "=", sessionId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  return row ? rowToWatchSession(row) : undefined;
}

/**
 * Sweep stale sessions across all tenants. Closes any session whose last
 * heartbeat is more than `staleAfterMs` ago and which has no ended_at set.
 * Hits the partial index (tenant_id, last_heartbeat_at) WHERE ended_at IS NULL.
 * Returns the number of rows closed.
 */
export async function sweepStaleSessions(staleAfterMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - staleAfterMs);
  const result = await db
    .updateTable("lecture_watch_sessions")
    .set((eb) => ({
      ended_at: eb.ref("last_heartbeat_at"),
    }))
    .where("ended_at", "is", null)
    .where("last_heartbeat_at", "<", cutoff)
    .executeTakeFirst();
  return Number(result.numUpdatedRows ?? 0);
}

/** Delete sessions older than `cutoffDays` (rolled-up data already retained). */
export async function archiveOldSessions(cutoffDays: number, batchSize: number): Promise<number> {
  const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000);
  // PostgreSQL doesn't support LIMIT on DELETE directly; use a CTE.
  const deleted = await sql<{ id: string }>`
    WITH victims AS (
      SELECT id FROM lecture_watch_sessions
      WHERE last_heartbeat_at < ${cutoff}
      LIMIT ${batchSize}
    )
    DELETE FROM lecture_watch_sessions s
    USING victims v
    WHERE s.id = v.id
    RETURNING s.id
  `.execute(db);
  return deleted.rows.length;
}

function rowToWatchSession(row: {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  lecture_id: string;
  started_at: Date;
  last_heartbeat_at: Date;
  ended_at: Date | null;
  start_position: number;
  end_position: number;
  seconds_watched: bigint | string | number | null;
}): WatchSessionRow {
  const sw = row.seconds_watched;
  const seconds_watched =
    typeof sw === "bigint" ? Number(sw) :
    typeof sw === "string" ? parseInt(sw, 10) :
    Number(sw ?? 0);
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    tenant_member_id: row.tenant_member_id,
    course_id: row.course_id,
    lecture_id: row.lecture_id,
    started_at: row.started_at,
    last_heartbeat_at: row.last_heartbeat_at,
    ended_at: row.ended_at,
    start_position: row.start_position,
    end_position: row.end_position,
    seconds_watched,
  };
}
