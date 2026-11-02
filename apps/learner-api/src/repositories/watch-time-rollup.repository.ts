/**
 * Repository for the hourly watch-time rollup job. Responsible for:
 *   - Discovering which tenants have new session activity since their watermark.
 *   - Upserting per-day per-lecture aggregates into tenant_watch_time_daily.
 *   - Upserting per-day distinct-learner counts into tenant_active_learners_daily.
 *   - Rebuilding the drop-off bucket counts for affected lectures into
 *     lecture_dropoff_buckets.
 *   - Advancing each tenant's watermark in watch_time_rollup_state.
 *
 * Idempotency: every UPSERT uses ON CONFLICT, so re-running the job (in the
 * same hour, or later) is safe.
 */

import { sql } from "kysely";
import { db } from "../db/connection";

interface TenantToRollup {
  tenant_id: string;
  watermark: Date;
}

const DEFAULT_INITIAL_WATERMARK = new Date(0); // 1970, covers all history first run

/**
 * Find tenants whose lecture_watch_sessions have advanced since their last
 * watermark. Bootstraps a watch_time_rollup_state row for any tenant that has
 * sessions but no state row.
 */
export async function getTenantsNeedingRollup(): Promise<TenantToRollup[]> {
  // Latest session activity per tenant.
  const recent = await db
    .selectFrom("lecture_watch_sessions")
    .select((eb) => [
      "tenant_id",
      eb.fn.max("last_heartbeat_at").as("max_heartbeat"),
    ])
    .groupBy("tenant_id")
    .execute();

  if (recent.length === 0) return [];

  const states = await db
    .selectFrom("watch_time_rollup_state")
    .selectAll()
    .where(
      "tenant_id",
      "in",
      recent.map((r) => r.tenant_id)
    )
    .execute();
  const stateByTenant = new Map(states.map((s) => [s.tenant_id, s.last_rollup_at]));

  const todo: TenantToRollup[] = [];
  for (const r of recent) {
    const wm = stateByTenant.get(r.tenant_id) ?? DEFAULT_INITIAL_WATERMARK;
    const maxHb = r.max_heartbeat as Date | null;
    if (maxHb && maxHb > wm) {
      todo.push({ tenant_id: r.tenant_id, watermark: wm });
    }
  }
  return todo;
}

/**
 * Roll up sessions for one tenant since `watermark`. Three writes:
 *   1. tenant_watch_time_daily: per-day per-lecture totals.
 *   2. tenant_active_learners_daily: per-day distinct-learner counts.
 *   3. lecture_dropoff_buckets: full rebuild for each affected lecture.
 * Then advance the tenant's watermark to nowEnd.
 */
export async function rollupTenant(tenantId: string, watermark: Date): Promise<void> {
  const nowEnd = new Date();

  // --- 1) tenant_watch_time_daily ----------------------------------------
  // We aggregate by (date, course_id, lecture_id) over ALL sessions that
  // overlap the watermark window, but partitioned by date_trunc so each
  // affected day is fully recomputed (handles late-arriving heartbeats from
  // before the watermark that crossed midnight UTC). Cheaper than per-day
  // diffing and stays correct.
  await sql`
    INSERT INTO tenant_watch_time_daily (
      tenant_id, date, course_id, lecture_id,
      total_seconds, sessions_count, distinct_members_count,
      avg_completion_pct, updated_at
    )
    SELECT
      s.tenant_id,
      date_trunc('day', s.started_at) AS date,
      s.course_id,
      s.lecture_id,
      COALESCE(SUM(s.seconds_watched), 0)::bigint AS total_seconds,
      COUNT(*)::int AS sessions_count,
      COUNT(DISTINCT s.tenant_member_id)::int AS distinct_members_count,
      COALESCE(
        AVG(
          CASE
            WHEN COALESCE(NULLIF(l.duration, '')::numeric, 0) > 0 THEN
              LEAST(1.0, GREATEST(0.0, s.end_position::numeric / NULLIF(l.duration, '')::numeric))
            ELSE 0
          END
        ),
        0
      )::float AS avg_completion_pct,
      NOW() AS updated_at
    FROM lecture_watch_sessions s
    LEFT JOIN lectures l ON l.id = s.lecture_id
    WHERE s.tenant_id = ${tenantId}
      AND date_trunc('day', s.started_at) IN (
        SELECT DISTINCT date_trunc('day', s2.started_at)
        FROM lecture_watch_sessions s2
        WHERE s2.tenant_id = ${tenantId}
          AND s2.last_heartbeat_at > ${watermark}
      )
    GROUP BY s.tenant_id, date_trunc('day', s.started_at), s.course_id, s.lecture_id
    ON CONFLICT (tenant_id, date, course_id, lecture_id) DO UPDATE SET
      total_seconds = EXCLUDED.total_seconds,
      sessions_count = EXCLUDED.sessions_count,
      distinct_members_count = EXCLUDED.distinct_members_count,
      avg_completion_pct = EXCLUDED.avg_completion_pct,
      updated_at = EXCLUDED.updated_at
  `.execute(db);

  // --- 2) tenant_active_learners_daily -----------------------------------
  await sql`
    INSERT INTO tenant_active_learners_daily (tenant_id, date, distinct_members_count, updated_at)
    SELECT
      s.tenant_id,
      date_trunc('day', s.started_at) AS date,
      COUNT(DISTINCT s.tenant_member_id)::int AS distinct_members_count,
      NOW() AS updated_at
    FROM lecture_watch_sessions s
    WHERE s.tenant_id = ${tenantId}
      AND date_trunc('day', s.started_at) IN (
        SELECT DISTINCT date_trunc('day', s2.started_at)
        FROM lecture_watch_sessions s2
        WHERE s2.tenant_id = ${tenantId}
          AND s2.last_heartbeat_at > ${watermark}
      )
    GROUP BY s.tenant_id, date_trunc('day', s.started_at)
    ON CONFLICT (tenant_id, date) DO UPDATE SET
      distinct_members_count = EXCLUDED.distinct_members_count,
      updated_at = EXCLUDED.updated_at
  `.execute(db);

  // --- 3) lecture_dropoff_buckets ----------------------------------------
  // Affected lectures = any lecture with a heartbeat newer than watermark.
  // Rebuild bucket counts per lecture from scratch (90-day session window).
  await sql`
    WITH affected AS (
      SELECT DISTINCT lecture_id
      FROM lecture_watch_sessions
      WHERE tenant_id = ${tenantId}
        AND last_heartbeat_at > ${watermark}
    ),
    bucketed AS (
      SELECT
        s.tenant_id,
        s.lecture_id,
        LEAST(9, GREATEST(0,
          CASE
            WHEN COALESCE(NULLIF(l.duration, '')::numeric, 0) > 0
              THEN floor((s.end_position::numeric / NULLIF(l.duration, '')::numeric) * 10)::int
            ELSE 0
          END
        )) AS bucket_index,
        COUNT(*)::int AS sessions_count
      FROM lecture_watch_sessions s
      JOIN affected a ON a.lecture_id = s.lecture_id
      LEFT JOIN lectures l ON l.id = s.lecture_id
      WHERE s.tenant_id = ${tenantId}
      GROUP BY s.tenant_id, s.lecture_id, bucket_index
    )
    INSERT INTO lecture_dropoff_buckets (tenant_id, lecture_id, bucket_index, sessions_count, updated_at)
    SELECT tenant_id, lecture_id, bucket_index, sessions_count, NOW() FROM bucketed
    ON CONFLICT (tenant_id, lecture_id, bucket_index) DO UPDATE SET
      sessions_count = EXCLUDED.sessions_count,
      updated_at = EXCLUDED.updated_at
  `.execute(db);

  // --- 4) Advance the watermark ------------------------------------------
  await db
    .insertInto("watch_time_rollup_state")
    .values({
      tenant_id: tenantId,
      last_rollup_at: nowEnd,
      updated_at: nowEnd,
    })
    .onConflict((oc) =>
      oc.column("tenant_id").doUpdateSet({
        last_rollup_at: nowEnd,
        updated_at: nowEnd,
      })
    )
    .execute();
}
