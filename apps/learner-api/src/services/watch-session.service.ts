/**
 * Watch session service, orchestrates per-heartbeat writes to
 * lecture_watch_sessions and member_lecture_progress.
 *
 * Performance / write-load notes (see plan: clear-crispy-crayon.md):
 *   - Heartbeat interval client-side: 30 s.
 *   - Session row written every heartbeat.
 *   - Progress row's total_watch_seconds counter advances on every heartbeat;
 *     resume position + completion check fire on session start, every
 *     isProgressFlush=true heartbeat (every ~120 s), and on session end.
 *   - Sanity caps: deltaSeconds ∈ [0, MAX_DELTA_SECONDS]; currentPosition
 *     not allowed to exceed the longer known length * 1.05.
 *   - Enrollment is checked on every write, no cache (see ensureEnrolledForWrite).
 *   - Auto-complete: when watched_duration reaches the course's required watch
 *     fraction (default 0.9) of the completion length, see utils/watch-completion.
 */

import { db } from "../db/connection";
import { ConflictError } from "../errors/conflict.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { BadRequestError } from "../errors/bad-request.error";
import courseService from "./course.service";
import certificateService from "./certificate.service";
import * as progressRepo from "../repositories/progress.repository";
import * as watchSessionRepo from "../repositories/watch-session.repository";
import logger from "../utils/logger";
import {
  completionDuration,
  hasWatchedEnough,
  positionLimit,
} from "../utils/watch-completion";

const MAX_DELTA_SECONDS = 90;
const POSITION_OVERFLOW_TOLERANCE = 1.05;
const AUTO_COMPLETE_THRESHOLD = 0.9;

export interface HeartbeatPayload {
  sessionId: string;
  currentPosition: number;
  deltaSeconds: number;
  isSessionStart?: boolean;
  isProgressFlush?: boolean;
  deviceType?: string | null;
  userAgent?: string | null;
  /**
   * Player-reported total duration (seconds) of the video actually playing.
   * Used when the stored `lectures.duration` is missing/0, or longer than the
   * real video (a swapped video keeps its old length), either way the lecture
   * could never reach the auto-complete threshold, silently blocking
   * sequential courses. See utils/watch-completion `completionDuration`.
   */
  durationSeconds?: number;
}

export interface HeartbeatResult {
  sessionId: string;
  completed: boolean;
  watchedDuration: number;
  lastPosition: number;
}

interface LectureMeta {
  id: string;
  duration: number;
}

/**
 * Resolve lecture metadata + verify it belongs to the course.
 * Throws NotFoundError if not found.
 */
async function resolveLecture(
  tenantId: string,
  courseId: string,
  lectureId: string
): Promise<LectureMeta> {
  const lecture = await db
    .selectFrom("lectures")
    .select(["id", "duration"])
    .where("tenant_id", "=", tenantId)
    .where("course_id", "=", courseId)
    .where("id", "=", lectureId)
    .executeTakeFirst();
  if (!lecture) throw new NotFoundError("Lecture not found in this course");
  return {
    id: lecture.id,
    duration: Number(lecture.duration ?? 0),
  };
}

/**
 * Per-course required-watch fraction, read from
 * `courses.lms_settings.requiredWatchPercent` (1-100). Falls back to the
 * platform default (0.9) when unset or invalid. Read on the flush cadence /
 * session end only (not every heartbeat), so the extra lookup is cheap.
 */
async function resolveRequiredWatchFraction(
  tenantId: string,
  courseId: string
): Promise<number> {
  const row = await db
    .selectFrom("courses")
    .select(["lms_settings"])
    .where("tenant_id", "=", tenantId)
    .where("id", "=", courseId)
    .executeTakeFirst();
  const settings = (row?.lms_settings ?? null) as {
    requiredWatchPercent?: unknown;
  } | null;
  const pct = Number(settings?.requiredWatchPercent);
  if (Number.isFinite(pct) && pct > 0 && pct <= 100) return pct / 100;
  return AUTO_COMPLETE_THRESHOLD;
}

/**
 * Fire-and-forget course-certificate auto-issue, invoked after a lecture just
 * flipped to complete. This is the ONLY completion hook for courses whose final
 * item is a video, the video path commits completion here and never touches
 * progress.service, so certificate issuance would otherwise never trigger.
 * The service short-circuits when the course isn't fully complete or a cert
 * already exists, and swallows expected errors; we guard here so a stray
 * rejection can't surface as an unhandled rejection on the heartbeat path.
 */
function maybeIssueCourseCertificate(
  tenantId: string,
  courseId: string,
  memberId: string
): void {
  void certificateService
    .maybeIssueCourseCertificateOnCompletion(tenantId, courseId, memberId)
    .catch((err) => {
      logger.warn(`[watch-session] cert auto-issue failed: ${String(err)}`);
    });
}

/**
 * Enrollment check on every write. We deliberately do NOT cache this on the
 * heartbeat hot path: a TTL cache would let a revoked user keep mutating
 * watch-session and progress rows for the duration of the TTL window. The
 * underlying `courseService.ensureEnrolled` is a single indexed lookup
 * (enrollments by tenant_id+course_id+tenant_member_id+status), so the cost
 * at heartbeat scale (~33 lookups/sec at 1k concurrent learners) is fine.
 *
 * If/when we want a cache here, it must be revocation-aware (explicit
 * invalidation on enrollment cancel + subscription cancel), not blind TTL.
 */
async function ensureEnrolledForWrite(
  tenantId: string,
  courseId: string,
  memberId: string
): Promise<void> {
  await courseService.ensureEnrolled(tenantId, courseId, memberId);
}

/**
 * Compute new high-water-mark watched_duration after this heartbeat.
 * Bounded by lectureDuration when known.
 */
function clampWatched(currentPosition: number, lectureDuration: number): number {
  if (lectureDuration > 0) {
    return Math.min(Math.floor(currentPosition), Math.floor(lectureDuration));
  }
  return Math.floor(currentPosition);
}

/**
 * Validate + normalize a heartbeat payload. Throws BadRequestError on
 * obviously bogus values (negatives, oversized deltas, position > limit*1.05).
 * `maxPosition` is the longer of the stored and player-reported lengths.
 */
function normalizeHeartbeat(p: HeartbeatPayload, maxPosition: number): HeartbeatPayload {
  if (!p.sessionId || typeof p.sessionId !== "string") {
    throw new BadRequestError("sessionId is required");
  }
  if (p.sessionId.length < 16 || p.sessionId.length > 64) {
    throw new BadRequestError("sessionId is invalid");
  }
  const delta = Math.max(0, Math.min(MAX_DELTA_SECONDS, Math.floor(Number(p.deltaSeconds) || 0)));
  const position = Math.max(0, Math.floor(Number(p.currentPosition) || 0));
  if (maxPosition > 0 && position > maxPosition * POSITION_OVERFLOW_TOLERANCE) {
    throw new BadRequestError("currentPosition exceeds lecture duration");
  }
  return {
    ...p,
    deltaSeconds: delta,
    currentPosition: position,
    deviceType: p.deviceType?.toString().slice(0, 32) ?? null,
    userAgent: p.userAgent?.toString().slice(0, 255) ?? null,
  };
}

/**
 * Record a heartbeat from the player. Returns updated state for client UI.
 * Single transaction: always writes session row; conditionally writes progress.
 */
async function recordHeartbeat(
  tenantId: string,
  memberId: string,
  courseId: string,
  lectureId: string,
  raw: HeartbeatPayload
): Promise<HeartbeatResult> {
  const lecture = await resolveLecture(tenantId, courseId, lectureId);
  await ensureEnrolledForWrite(tenantId, courseId, memberId);
  // Completion length: the shorter of the stored and player-reported lengths
  // (else whichever is known), so a missing or stale stored length can't make
  // the lecture impossible to finish. Positions are validated against the
  // longer of the two so a longer real video keeps saving its resume point.
  const effDuration = completionDuration(lecture.duration, raw.durationSeconds);
  const p = normalizeHeartbeat(raw, positionLimit(lecture.duration, raw.durationSeconds));

  const shouldFlushProgress = Boolean(p.isSessionStart || p.isProgressFlush);

  // Resolve the required-watch threshold BEFORE opening the transaction. It reads
  // the courses row on its own pool connection; doing it inside the tx callback
  // holds the tx connection while it waits for a second one and can deadlock the
  // pool under load. Guarded so it still only runs on the flush cadence.
  const requiredFraction =
    shouldFlushProgress && effDuration > 0
      ? await resolveRequiredWatchFraction(tenantId, courseId)
      : AUTO_COMPLETE_THRESHOLD;

  const result = await db.transaction().execute(async (trx) => {
    const upsertStatus = await watchSessionRepo.upsertSession(
      {
        sessionId: p.sessionId,
        tenantId,
        memberId,
        courseId,
        lectureId,
        currentPosition: p.currentPosition,
        deltaSeconds: p.deltaSeconds,
        isSessionStart: Boolean(p.isSessionStart),
        deviceType: p.deviceType ?? null,
        userAgent: p.userAgent ?? null,
      },
      trx
    );
    if (upsertStatus === "mismatch") {
      throw new ConflictError(
        "sessionId already exists for a different member/course/lecture"
      );
    }

    // total_watch_seconds advances on EVERY heartbeat (cheap integer add on
    // the same row) so non-flush deltas and the trailing tail before close
    // aren't lost. resume position + completion check still gate on the
    // 4×-slower flush cadence, those need the SELECT-after-UPDATE round trip.
    const flushPayload = shouldFlushProgress
      ? {
          watchedDuration: clampWatched(p.currentPosition, effDuration),
          lastPosition: p.currentPosition,
          totalWatchDelta: p.deltaSeconds,
        }
      : { totalWatchDelta: p.deltaSeconds };

    const row = await progressRepo.upsertProgress(
      tenantId,
      memberId,
      courseId,
      lectureId,
      flushPayload,
      trx
    );

    let completed = row.completed;
    let flipped = false;
    // Complete against the EFFECTIVE duration (DB duration, or the client-reported
    // one when the stored duration is missing/0) so lectures with no stored
    // duration still auto-complete, using the course's required-watch fraction.
    if (shouldFlushProgress && !completed) {
      if (hasWatchedEnough(row.watched_duration, effDuration, requiredFraction)) {
        flipped = await progressRepo.markCompletedIfNot(tenantId, memberId, lectureId, trx);
        if (flipped) completed = true;
      }
    }

    return {
      watchedDuration: row.watched_duration,
      completed,
      flipped,
      lastPosition: shouldFlushProgress ? row.last_position_seconds : p.currentPosition,
    };
  });

  // A lecture just flipped to complete, the only moment course completion can
  // transition. Videos finish here (bypassing progress.service), so this is the
  // sole place the course-certificate hook can fire for video-terminated courses.
  // Fire-and-forget: never block or fail the heartbeat response on cert issuance.
  if (result.flipped) {
    void maybeIssueCourseCertificate(tenantId, courseId, memberId);
  }

  return {
    sessionId: p.sessionId,
    completed: result.completed,
    watchedDuration: result.watchedDuration,
    lastPosition: result.lastPosition,
  };
}

/**
 * End a watch session. Closes the session row and flushes a final progress
 * upsert from the session's recorded state. Idempotent.
 */
async function endWatchSession(
  tenantId: string,
  memberId: string,
  courseId: string,
  lectureId: string,
  sessionId: string,
  currentPositionFromClient?: number,
  pendingDeltaSecondsFromClient?: number,
  durationSecondsFromClient?: number
): Promise<HeartbeatResult> {
  const lecture = await resolveLecture(tenantId, courseId, lectureId);
  await ensureEnrolledForWrite(tenantId, courseId, memberId);
  // Same completion length and position limit as the heartbeat path.
  const effDuration = completionDuration(lecture.duration, durationSecondsFromClient);
  const maxPosition = positionLimit(lecture.duration, durationSecondsFromClient);
  // The trailing tail (time between the last heartbeat and tab-close / pause)
  // hasn't been written anywhere yet. Accept a final delta so total_watch_seconds
  // doesn't undercount short and tail playback. Capped to MAX_DELTA_SECONDS.
  const tailDelta = Math.max(
    0,
    Math.min(MAX_DELTA_SECONDS, Math.floor(Number(pendingDeltaSecondsFromClient) || 0))
  );

  // Resolve BEFORE opening the transaction, see recordHeartbeat for why a bare
  // db read inside the tx callback risks a pool deadlock.
  const requiredFraction =
    effDuration > 0
      ? await resolveRequiredWatchFraction(tenantId, courseId)
      : AUTO_COMPLETE_THRESHOLD;

  const result = await db.transaction().execute(async (trx) => {
    const endResult = await watchSessionRepo.endSession(
      tenantId,
      sessionId,
      { memberId, courseId, lectureId },
      trx
    );

    if (endResult.status === "missing") {
      // Session was never started or doesn't exist for this tenant.
      // Treat as a no-op end; do not throw, the unload path may have lost
      // state and is just being defensive.
      logger.warn(
        `[watch-session] endWatchSession called with unknown sessionId=${sessionId} tenant=${tenantId}`
      );
      const existing = await progressRepo.findOne(tenantId, memberId, lectureId, trx);
      return {
        watchedDuration: existing?.watched_duration ?? 0,
        completed: existing?.completed ?? false,
        flipped: false,
        lastPosition: existing?.last_position_seconds ?? 0,
      };
    }

    if (endResult.status === "mismatch") {
      throw new ForbiddenError(
        "Session does not belong to the current member/course/lecture"
      );
    }

    const session = endResult.session;
    const finalPosition = clampPosition(
      currentPositionFromClient ?? session.end_position,
      maxPosition
    );
    const watched = clampWatched(finalPosition, effDuration);

    const row = await progressRepo.upsertProgress(
      tenantId,
      memberId,
      courseId,
      lectureId,
      {
        watchedDuration: watched,
        lastPosition: finalPosition,
        totalWatchDelta: tailDelta,
      },
      trx
    );

    let completed = row.completed;
    let flipped = false;
    // Same effective-duration + required-fraction logic as the heartbeat path.
    if (!completed) {
      if (hasWatchedEnough(row.watched_duration, effDuration, requiredFraction)) {
        flipped = await progressRepo.markCompletedIfNot(tenantId, memberId, lectureId, trx);
        if (flipped) completed = true;
      }
    }

    return {
      watchedDuration: row.watched_duration,
      completed,
      flipped,
      lastPosition: row.last_position_seconds,
    };
  });

  // See recordHeartbeat: fire the course-certificate hook only on the completion
  // transition, after commit, fire-and-forget.
  if (result.flipped) {
    void maybeIssueCourseCertificate(tenantId, courseId, memberId);
  }

  return {
    sessionId,
    completed: result.completed,
    watchedDuration: result.watchedDuration,
    lastPosition: result.lastPosition,
  };
}

function clampPosition(position: number, lectureDuration: number): number {
  const p = Math.max(0, Math.floor(Number(position) || 0));
  if (lectureDuration > 0) return Math.min(p, Math.floor(lectureDuration));
  return p;
}

const watchSessionService = {
  recordHeartbeat,
  endWatchSession,
};

export default watchSessionService;
