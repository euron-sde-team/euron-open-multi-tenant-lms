/**
 * Repository for member lecture progress.
 * All queries are tenant-scoped and member-scoped.
 */

import { sql, type Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import { ulid } from "ulid";

export interface ProgressRow {
  id: string;
  tenant_id: string;
  tenant_member_id: string;
  course_id: string;
  lecture_id: string;
  watched_duration: number;
  last_position_seconds: number;
  total_watch_seconds: number;
  completed: boolean;
  last_watched_at: Date;
  created_at: Date;
  updated_at: Date;
}

type Trx = Transaction<DB>;

/** Get completed lecture counts per course for a member. Returns Map<courseId, completedCount>. */
export async function getCompletedCountsByCourses(
  tenantId: string,
  memberId: string,
  courseIds: string[]
): Promise<Map<string, number>> {
  if (courseIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("member_lecture_progress")
    .select(["course_id", db.fn.count("id").as("count")])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("course_id", "in", courseIds)
    .where("completed", "=", true)
    .groupBy("course_id")
    .execute();

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.course_id, Number(r.count));
  }
  return map;
}

/** Get completed assignment counts per course for a member. Returns Map<courseId, completedCount>. */
export async function getAssignmentCompletedCountsByCourses(
  tenantId: string,
  memberId: string,
  courseIds: string[]
): Promise<Map<string, number>> {
  if (courseIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("member_assignment_progress")
    .select(["course_id", db.fn.count("id").as("count")])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("course_id", "in", courseIds)
    .where("completed", "=", true)
    .groupBy("course_id")
    .execute();

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.course_id, Number(r.count));
  }
  return map;
}

/** Get completed quiz counts per course for a member. Returns Map<courseId, completedCount>. */
export async function getQuizCompletedCountsByCourses(
  tenantId: string,
  memberId: string,
  courseIds: string[]
): Promise<Map<string, number>> {
  if (courseIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("member_quiz_progress")
    .select(["course_id", db.fn.count("id").as("count")])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("course_id", "in", courseIds)
    .where("completed", "=", true)
    .groupBy("course_id")
    .execute();

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.course_id, Number(r.count));
  }
  return map;
}

/** Find all progress rows for a member in a course. */
export async function findByMemberAndCourse(
  tenantId: string,
  memberId: string,
  courseId: string
): Promise<ProgressRow[]> {
  const rows = await db
    .selectFrom("member_lecture_progress")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("course_id", "=", courseId)
    .execute();

  return rows.map(toProgressRow);
}

function toProgressRow(row: Record<string, unknown>): ProgressRow {
  const tw = row.total_watch_seconds;
  const total_watch_seconds =
    typeof tw === "bigint" ? Number(tw) :
    typeof tw === "string" ? parseInt(tw, 10) :
    Number(tw ?? 0);
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    tenant_member_id: row.tenant_member_id as string,
    course_id: row.course_id as string,
    lecture_id: row.lecture_id as string,
    watched_duration: Number(row.watched_duration ?? 0),
    last_position_seconds: Number(row.last_position_seconds ?? 0),
    total_watch_seconds,
    completed: Boolean(row.completed),
    last_watched_at: row.last_watched_at as Date,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

export interface UpsertProgressPayload {
  /** Mark complete/incomplete explicitly (overrides auto-complete logic). */
  completed?: boolean;
  /** High-water mark of position reached (used for completion %). Replaced via greatest(). */
  watchedDuration?: number;
  /** Resume position (where to seek to). Replaced unconditionally. */
  lastPosition?: number;
  /** Delta seconds of actual playback to add to total_watch_seconds (cumulative, uncapped). */
  totalWatchDelta?: number;
}

/** Upsert progress for a lecture. Creates or updates by unique (tenant_id, tenant_member_id, lecture_id). */
export async function upsertProgress(
  tenantId: string,
  memberId: string,
  courseId: string,
  lectureId: string,
  payload: UpsertProgressPayload,
  trx?: Trx
): Promise<ProgressRow> {
  const exec = trx ?? db;
  const now = new Date();
  const id = ulid();

  const watchedDuration = payload.watchedDuration ?? 0;
  const lastPosition = Math.max(0, Math.floor(payload.lastPosition ?? 0));
  const totalWatchDelta = Math.max(0, Math.floor(payload.totalWatchDelta ?? 0));
  const completed = payload.completed ?? false;

  const updateSet: Record<string, unknown> = {
    last_watched_at: now,
    updated_at: now,
  };
  if (payload.completed !== undefined) updateSet.completed = payload.completed;
  if (payload.watchedDuration !== undefined) {
    updateSet.watched_duration = sql`greatest(member_lecture_progress.watched_duration, ${payload.watchedDuration})`;
  }
  if (payload.lastPosition !== undefined) {
    updateSet.last_position_seconds = lastPosition;
  }
  if (payload.totalWatchDelta !== undefined && totalWatchDelta > 0) {
    updateSet.total_watch_seconds = sql<string>`member_lecture_progress.total_watch_seconds + ${totalWatchDelta}`;
  }

  const row = await exec
    .insertInto("member_lecture_progress")
    .values({
      id,
      tenant_id: tenantId,
      tenant_member_id: memberId,
      course_id: courseId,
      lecture_id: lectureId,
      watched_duration: watchedDuration,
      last_position_seconds: lastPosition,
      total_watch_seconds: String(totalWatchDelta),
      completed,
      last_watched_at: now,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.columns(["tenant_id", "tenant_member_id", "lecture_id"]).doUpdateSet(updateSet)
    )
    .returningAll()
    .executeTakeFirstOrThrow();

  return toProgressRow(row as unknown as Record<string, unknown>);
}

/** Read a single progress row (or undefined if none). Used after a heartbeat to compute completion. */
export async function findOne(
  tenantId: string,
  memberId: string,
  lectureId: string,
  trx?: Trx
): Promise<ProgressRow | undefined> {
  const exec = trx ?? db;
  const row = await exec
    .selectFrom("member_lecture_progress")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("lecture_id", "=", lectureId)
    .executeTakeFirst();
  return row ? toProgressRow(row as unknown as Record<string, unknown>) : undefined;
}

function pint(val: unknown): number {
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") return parseInt(val, 10) || 0;
  return Number(val ?? 0);
}

function pfloat(val: unknown): number {
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") return parseFloat(val) || 0;
  return Number(val ?? 0);
}

/** One row of the course's ordered curriculum lectures (with section title). */
export interface CourseLectureRow {
  lecture_id: string;
  title: string;
  section_title: string;
  duration_seconds: number | null;
}

/** Per-lecture cohort aggregate across all members with progress in the course. */
export interface LectureCohortAvgRow {
  lecture_id: string;
  avg_seconds: number;
  peers: number;
  completed_peers: number;
}

/**
 * Per-lecture cohort averages for a course, in a single grouped query.
 * `avg_seconds` is the mean of total_watch_seconds across members who have a
 * progress row for that lecture; `peers` is the distinct member count for the
 * lecture; `completed_peers` is how many of them completed it.
 */
export async function getCourseLectureCohortAverages(
  tenantId: string,
  courseId: string
): Promise<LectureCohortAvgRow[]> {
  const rows = await db
    .selectFrom("member_lecture_progress")
    .select([
      "lecture_id",
      sql<string>`avg(total_watch_seconds)`.as("avg_seconds"),
      sql<string>`count(distinct tenant_member_id)`.as("peers"),
      sql<string>`sum(case when completed then 1 else 0 end)`.as("completed_peers"),
    ])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .groupBy("lecture_id")
    .execute();

  return rows.map((r) => ({
    lecture_id: r.lecture_id,
    avg_seconds: pfloat(r.avg_seconds),
    peers: pint(r.peers),
    completed_peers: pint(r.completed_peers),
  }));
}

/**
 * Course-wide cohort totals: distinct members with any progress and the sum of
 * all their total_watch_seconds, used to derive the average per-peer time.
 */
export async function getCourseCohortTotals(
  tenantId: string,
  courseId: string
): Promise<{ peerCount: number; sumTotalSeconds: number }> {
  const row = await db
    .selectFrom("member_lecture_progress")
    .select([
      sql<string>`count(distinct tenant_member_id)`.as("peer_count"),
      sql<string>`coalesce(sum(total_watch_seconds), 0)`.as("sum_total_seconds"),
    ])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .executeTakeFirst();

  return {
    peerCount: pint(row?.peer_count),
    sumTotalSeconds: pint(row?.sum_total_seconds),
  };
}

/**
 * Average completion % across peers for the course: for each member with any
 * progress, completed lectures / total course lectures, averaged. Computed in
 * SQL against the curriculum lecture count.
 */
export async function getCourseAvgCompletionPercent(
  tenantId: string,
  courseId: string,
  totalVideos: number
): Promise<number> {
  if (totalVideos <= 0) return 0;

  const row = await db
    .selectFrom("member_lecture_progress")
    .select([
      sql<string>`count(distinct tenant_member_id)`.as("peer_count"),
      sql<string>`count(*) filter (where completed)`.as("completed_total"),
    ])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .executeTakeFirst();

  const peerCount = pint(row?.peer_count);
  const completedTotal = pint(row?.completed_total);
  if (peerCount <= 0) return 0;

  // avg over peers of (their completed / totalVideos) ==
  // (total completed across peers / peerCount) / totalVideos
  return Math.round((completedTotal / peerCount / totalVideos) * 100);
}

/** Ordered curriculum lectures for a course (section → lesson → nothing else). */
export async function getCourseLecturesOrdered(
  tenantId: string,
  courseId: string
): Promise<CourseLectureRow[]> {
  const rows = await db
    .selectFrom("lectures as l")
    .innerJoin("course_lessons as cl", "cl.id", "l.lesson_id")
    .innerJoin("course_sections as cs", "cs.id", "cl.section_id")
    .select([
      "l.id as lecture_id",
      "l.title as title",
      "l.duration as duration",
      "cs.title as section_title",
    ])
    .where("l.tenant_id", "=", tenantId)
    .where("l.course_id", "=", courseId)
    .where("cs.tenant_id", "=", tenantId)
    .where("cl.tenant_id", "=", tenantId)
    .orderBy("cs.sort_order", "asc")
    .orderBy("cl.sort_order", "asc")
    .execute();

  return rows.map((r) => {
    const dur = r.duration != null ? parseInt(String(r.duration), 10) : NaN;
    return {
      lecture_id: r.lecture_id,
      title: r.title,
      section_title: r.section_title,
      duration_seconds: Number.isFinite(dur) ? dur : null,
    };
  });
}

/** Idempotently flip completed=true. Returns true if the row was changed. */
export async function markCompletedIfNot(
  tenantId: string,
  memberId: string,
  lectureId: string,
  trx?: Trx
): Promise<boolean> {
  const exec = trx ?? db;
  const result = await exec
    .updateTable("member_lecture_progress")
    .set({ completed: true, updated_at: new Date() })
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("lecture_id", "=", lectureId)
    .where("completed", "=", false)
    .executeTakeFirst();
  return Number(result.numUpdatedRows ?? 0) > 0;
}

// ── Content-lesson completion (PDF/LINK/TEXT/IMAGE) ──
// Content lessons have no `lectures` row, so their completion lives in its own
// table, mirroring member_quiz_progress / member_assignment_progress. There is
// no watch-duration concept, completion is a single boolean flipped manually.

export interface LessonProgressRow {
  lesson_id: string;
  completed: boolean;
  completed_at: Date | null;
  updated_at: Date;
}

/** Upsert content-lesson completion keyed by (tenant, member, lesson). */
export async function upsertLessonProgress(
  tenantId: string,
  memberId: string,
  courseId: string,
  lessonId: string,
  completed: boolean,
  trx?: Trx
): Promise<LessonProgressRow> {
  const exec = trx ?? db;
  const now = new Date();
  const completedAt = completed ? now : null;
  const row = await exec
    .insertInto("member_lesson_progress")
    .values({
      id: ulid(),
      tenant_id: tenantId,
      tenant_member_id: memberId,
      course_id: courseId,
      lesson_id: lessonId,
      completed,
      completed_at: completedAt,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc
        .columns(["tenant_id", "tenant_member_id", "lesson_id"])
        .doUpdateSet({ completed, completed_at: completedAt, updated_at: now })
    )
    .returning(["lesson_id", "completed", "completed_at", "updated_at"])
    .executeTakeFirstOrThrow();
  return {
    lesson_id: row.lesson_id,
    completed: row.completed,
    completed_at: row.completed_at ?? null,
    updated_at: row.updated_at,
  };
}

/** All content-lesson completions for a member in a course. */
export async function findLessonProgressByMemberAndCourse(
  tenantId: string,
  memberId: string,
  courseId: string
): Promise<LessonProgressRow[]> {
  const rows = await db
    .selectFrom("member_lesson_progress")
    .select(["lesson_id", "completed", "completed_at", "updated_at"])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("course_id", "=", courseId)
    .execute();
  return rows.map((r) => ({
    lesson_id: r.lesson_id,
    completed: r.completed,
    completed_at: r.completed_at ?? null,
    updated_at: r.updated_at,
  }));
}
