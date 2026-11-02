/**
 * Watch tracker hook, drives lecture watch-session writes from the player.
 *
 * Wiring: connect `onProgress` and `onEnded` to the LMS template (which
 * already exposes them via `onVideoProgress` / `onVideoEnded` in
 * Classic/Modern/Minimal/Shorts LMS templates).
 *
 * Algorithm (designed for low write-load, see plan
 * `~/.claude/plans/clear-crispy-crayon.md` for the rationale):
 *   - We never count time blindly. We accumulate watched seconds based on
 *     wall-clock deltas between successive `onProgress` events that show
 *     "real" forward motion (player time advanced by < 1.5 s).
 *   - Wall-clock-driven heartbeat every 30 s of accumulated watched time.
 *   - First heartbeat is deferred until 10 s of watched time, so users who
 *     bounce within the first few seconds never hit the server.
 *   - Every 4th heartbeat (≈ every 2 minutes) flushes
 *     `member_lecture_progress` for resume position + completion.
 *   - On lecture change, unmount, or `pagehide`, we end the session via
 *     `fetch` with `keepalive:true` so it survives navigation.
 *   - Visibility hidden / blur pauses the accumulator.
 *
 * Idempotency: every heartbeat carries a stable `sessionId` (one per
 * `play → end` cycle), and the learner-api's heartbeat handler is upsert-
 * based, so retries cost nothing. `endWatchSession` is idempotent server-side.
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { sendHeartbeat, endWatchSession, endWatchSessionKeepalive } from "@/lib/api/progress";

const HEARTBEAT_INTERVAL_S = 30;
const FIRST_HEARTBEAT_DEFER_S = 10;
const PROGRESS_FLUSH_EVERY_N = 4; // every 4 heartbeats → ~2 minutes
const SEEK_DETECTION_THRESHOLD_S = 1.5;
const PROGRESS_STALE_MS = 2_500; // longer than this between onProgress = treat as paused
const FAILED_HEARTBEAT_QUEUE_MAX = 5;

interface UseWatchTrackerOptions {
  courseId: string | null | undefined;
  lectureId: string | null | undefined;
  /** When false, the hook is a no-op (e.g. user not authenticated). */
  enabled?: boolean;
  /**
   * Called when a heartbeat or end response indicates a lecture should be
   * marked completed. Use this to optimistically flip local UI state.
   *
   * `lectureId` is the lecture that response belongs to. It is NOT always the
   * one playing now: the end-of-video response arrives after autoplay has
   * already moved to the next lesson, so mark this id, never "the current".
   */
  onCompleted?: (lectureId: string) => void;
}

export interface WatchTracker {
  onProgress: (currentTime: number, duration: number) => void;
  onEnded: () => void;
}

interface SessionState {
  id: string;
  // Last reported player time, used to detect seeks vs natural advance.
  lastPlayerTime: number;
  // Accumulator for watched seconds since the last sent heartbeat.
  pendingDelta: number;
  // Cumulative watched seconds across the session (for diagnostics).
  totalThisSession: number;
  // Index of the next heartbeat (0 = none yet sent).
  heartbeatIndex: number;
  // Wall-clock timestamp of the last accepted onProgress tick.
  lastProgressAt: number;
  // The most recent player position to send up.
  currentPosition: number;
  // Most recent player-reported total duration (seconds). Sent to the server
  // as a fallback for the auto-complete check when the stored lecture duration
  // is missing/0, otherwise such a lecture can never reach the 90% threshold
  // and silently blocks sequential courses.
  lastDuration: number;
  // True the moment we *issue* the first heartbeat fetch, not when it
  // resolves. Used by teardown so a session whose start is still in flight
  // still gets a /watch/end call (instead of being abandoned and only
  // reaped 5 min later by the server-side stale sweeper).
  serverSessionAttempted: boolean;
  // True after the server has acknowledged at least one heartbeat. Used to
  // distinguish "start in flight" from "start confirmed".
  startedOnServer: boolean;
  // Most recent in-flight heartbeat promise, awaited by teardown so end
  // fires only after start has reached the server.
  inflightHeartbeat: Promise<void> | null;
  // Pending deltas if past heartbeats failed; sent piggybacked next time.
  failedDeltaQueue: number[];
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: time + random. Strong enough for our (tenant-scoped) use.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

function detectDeviceType(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  return "desktop";
}

function getApiBaseUrl(): string {
  return (
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
    "http://localhost:5096/api/v1"
  );
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("accessToken")
  );
}

function getTenantHost(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.host;
}

export function useWatchTracker(opts: UseWatchTrackerOptions): WatchTracker {
  const { courseId, lectureId, enabled = true, onCompleted } = opts;

  const sessionRef = useRef<SessionState | null>(null);
  const courseRef = useRef<string | null>(null);
  const lectureRef = useRef<string | null>(null);
  const onCompletedRef = useRef(onCompleted);

  // Keep onCompleted ref fresh without re-running effects.
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  /** Start a fresh session. */
  const startSession = useCallback(() => {
    sessionRef.current = {
      id: newSessionId(),
      lastPlayerTime: 0,
      pendingDelta: 0,
      totalThisSession: 0,
      heartbeatIndex: 0,
      lastProgressAt: Date.now(),
      currentPosition: 0,
      lastDuration: 0,
      serverSessionAttempted: false,
      startedOnServer: false,
      inflightHeartbeat: null,
      failedDeltaQueue: [],
    };
  }, []);

  /** Send a heartbeat and update local state. */
  const flushHeartbeat = useCallback(
    async (isProgressFlush: boolean) => {
      const session = sessionRef.current;
      const cId = courseRef.current;
      const lId = lectureRef.current;
      if (!session || !cId || !lId) return;
      // Coalesce queued failed deltas so they don't disappear.
      let delta = session.pendingDelta;
      if (session.failedDeltaQueue.length > 0) {
        delta += session.failedDeltaQueue.reduce((a, b) => a + b, 0);
      }
      if (delta <= 0 && !isProgressFlush && session.startedOnServer) return;

      const isSessionStart = !session.startedOnServer;
      const sentDelta = delta;
      // Reset accumulators optimistically, if the call fails we requeue.
      session.pendingDelta = 0;
      session.failedDeltaQueue = [];
      // Mark the session as "attempted" *before* awaiting. If a teardown
      // races the in-flight fetch, it can still issue /watch/end (the
      // server's endSession is idempotent and end fired after start always
      // closes correctly).
      session.serverSessionAttempted = true;

      // flushHeartbeat awaits its own promise at the bottom, so concurrent
      // overlapping heartbeats for the same session can't happen, any
      // teardown reading session.inflightHeartbeat will see this one until
      // the finally block clears it.
      const inflight = (async () => {
        try {
          const res = await sendHeartbeat(cId, lId, {
            sessionId: session.id,
            currentPosition: Math.round(session.currentPosition),
            deltaSeconds: Math.round(sentDelta),
            isSessionStart,
            isProgressFlush,
            deviceType: detectDeviceType(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            durationSeconds:
              session.lastDuration > 0 ? Math.round(session.lastDuration) : undefined,
          });
          session.startedOnServer = true;
          session.heartbeatIndex += 1;
          if (res?.completed) onCompletedRef.current?.(lId);
        } catch {
          // Requeue this heartbeat's delta; next attempt will retry it.
          if (sentDelta > 0) {
            if (session.failedDeltaQueue.length >= FAILED_HEARTBEAT_QUEUE_MAX) {
              session.failedDeltaQueue.shift();
            }
            session.failedDeltaQueue.push(sentDelta);
          }
        }
      })();
      session.inflightHeartbeat = inflight;
      try {
        await inflight;
      } finally {
        session.inflightHeartbeat = null;
      }
    },
    []
  );

  /** End the current session via fetch (explicit pause / unmount). */
  const flushEndViaFetch = useCallback(async () => {
    const session = sessionRef.current;
    const cId = courseRef.current;
    const lId = lectureRef.current;
    if (!session || !cId || !lId) return;
    if (!session.serverSessionAttempted) {
      // Bouncer, never even tried to start a server session, nothing to end.
      sessionRef.current = null;
      return;
    }
    const idToEnd = session.id;
    const positionToEnd = Math.round(session.currentPosition);
    const durationToEnd =
      session.lastDuration > 0 ? Math.round(session.lastDuration) : undefined;
    // Pull both the unflushed in-progress delta and any queued failed deltas
    // so the trailing tail (between last heartbeat and pause / unmount)
    // gets credited to total_watch_seconds.
    const pendingTail = Math.max(
      0,
      Math.round(
        session.pendingDelta +
          session.failedDeltaQueue.reduce((a, b) => a + b, 0)
      )
    );
    const inflight = session.inflightHeartbeat;
    sessionRef.current = null; // prevent races
    // Await in-flight start/heartbeat first, otherwise endSession can race
    // ahead of the start row creation and the session lingers open until
    // the 5-minute server sweeper.
    if (inflight) {
      try { await inflight; } catch { /* tolerated, end is idempotent */ }
    }
    try {
      const res = await endWatchSession(cId, lId, idToEnd, positionToEnd, pendingTail, durationToEnd);
      if (res?.completed) onCompletedRef.current?.(lId);
    } catch {
      // Fire-and-forget on best effort.
    }
  }, []);

  /** End the session via keepalive fetch (page unload). */
  const flushEndViaKeepalive = useCallback(() => {
    const session = sessionRef.current;
    const cId = courseRef.current;
    const lId = lectureRef.current;
    if (!session || !cId || !lId) return;
    if (!session.serverSessionAttempted && session.pendingDelta < FIRST_HEARTBEAT_DEFER_S) {
      // Bouncer, never created a server session; nothing to end.
      sessionRef.current = null;
      return;
    }
    const pendingTail = Math.max(
      0,
      Math.round(
        session.pendingDelta +
          session.failedDeltaQueue.reduce((a, b) => a + b, 0)
      )
    );
    // Note: in the unload path we cannot await the in-flight heartbeat. If
    // it has not reached the server yet, our keepalive end will arrive first
    // and report "missing" (no-op). The orphaned start arrives shortly after,
    // creates an open session, and is reaped by the 5-min sweeper. That tail
    // case is rare (requires unload during the ~100 ms when the start fetch
    // is in flight) and is bounded by the sweeper.
    endWatchSessionKeepalive(
      getApiBaseUrl(),
      cId,
      lId,
      session.id,
      getAuthToken(),
      getTenantHost(),
      Math.round(session.currentPosition),
      pendingTail,
      session.lastDuration > 0 ? Math.round(session.lastDuration) : undefined
    );
    sessionRef.current = null;
  }, []);

  // Track lecture changes, end the previous session, start a new one.
  useEffect(() => {
    if (!enabled || !courseId || !lectureId) return;
    const prevCourseId = courseRef.current;
    const prevLectureId = lectureRef.current;
    if (prevCourseId === courseId && prevLectureId === lectureId) return;

    // End the previous session if there was one.
    void flushEndViaFetch();
    courseRef.current = courseId;
    lectureRef.current = lectureId;
    startSession();
  }, [enabled, courseId, lectureId, startSession, flushEndViaFetch]);

  // pagehide / beforeunload → keepalive end
  useEffect(() => {
    if (!enabled) return;
    const handler = () => flushEndViaKeepalive();
    window.addEventListener("pagehide", handler);
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("pagehide", handler);
      window.removeEventListener("beforeunload", handler);
    };
  }, [enabled, flushEndViaKeepalive]);

  // Visibility change → on hidden, treat as a soft pause (we won't accumulate
  // because onProgress events stop arriving). Nothing else to do, the
  // staleness check in onProgress already handles this.
  // Component unmount → end session.
  useEffect(() => {
    if (!enabled) return;
    return () => {
      void flushEndViaFetch();
    };
  }, [enabled, flushEndViaFetch]);

  /** onProgress: accumulate watched seconds + maybe send a heartbeat. */
  const onProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (!enabled) return;
      if (!courseRef.current || !lectureRef.current) return;
      // A session ends when the video ends; playing it again (a replay, or
      // finishing a video that didn't count yet) must be tracked too, so start
      // a fresh one instead of dropping every event until the lecture changes.
      if (!sessionRef.current) startSession();
      const session = sessionRef.current;
      if (!session) return;

      // Remember the player-reported duration (finite, positive) so heartbeats
      // can carry it as a completion fallback when the stored lecture duration
      // is missing.
      if (Number.isFinite(duration) && duration > 0) {
        session.lastDuration = duration;
      }

      const now = Date.now();
      const playerDelta = currentTime - session.lastPlayerTime;
      const wallElapsedMs = now - session.lastProgressAt;
      session.lastPlayerTime = currentTime;
      session.lastProgressAt = now;
      session.currentPosition = currentTime;

      // Only count "real" forward motion. Seeks and gaps (tab hidden) are
      // ignored. We use the player's own delta as the credit, capped to
      // the wall-clock elapsed (no time travel).
      if (playerDelta > 0 && playerDelta < SEEK_DETECTION_THRESHOLD_S && wallElapsedMs < PROGRESS_STALE_MS) {
        const credit = Math.min(playerDelta, wallElapsedMs / 1000);
        session.pendingDelta += credit;
        session.totalThisSession += credit;
      }

      // Decide whether to send a heartbeat.
      if (!session.startedOnServer) {
        if (session.pendingDelta >= FIRST_HEARTBEAT_DEFER_S) {
          void flushHeartbeat(true); // session-start counts as a flush
        }
        return;
      }
      if (session.pendingDelta >= HEARTBEAT_INTERVAL_S) {
        const isFlush = session.heartbeatIndex % PROGRESS_FLUSH_EVERY_N === 0;
        void flushHeartbeat(isFlush);
      }
    },
    [enabled, flushHeartbeat, startSession]
  );

  /** onEnded: flush + close the session. */
  const onEnded = useCallback(() => {
    if (!enabled) return;
    void flushEndViaFetch();
  }, [enabled, flushEndViaFetch]);

  return { onProgress, onEnded };
}
