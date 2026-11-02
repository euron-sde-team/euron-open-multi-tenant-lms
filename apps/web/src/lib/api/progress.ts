/**
 * Progress API client, get and update lecture progress.
 * Requires authentication and enrollment.
 */

import { apiGet, apiPost } from "./api-client";

export interface ProgressItem {
  lecture_id: string;
  completed: boolean;
  watched_duration: number;
  last_position_seconds: number;
  total_watch_seconds: number;
  last_watched_at: string;
}

export interface GetProgressResponse {
  progress: ProgressItem[];
}

export async function getProgress(
  courseId: string
): Promise<GetProgressResponse> {
  return apiGet<GetProgressResponse>(`/courses/${courseId}/progress`);
}

export async function markLectureComplete(
  courseId: string,
  lectureId: string,
  completed = true,
  watchedDuration?: number
): Promise<{ progress: ProgressItem }> {
  const body: { lecture_id: string; completed?: boolean; watched_duration?: number } = {
    lecture_id: lectureId,
    completed,
  };
  if (watchedDuration !== undefined && watchedDuration >= 0) {
    body.watched_duration = Math.round(watchedDuration);
  }
  return apiPost<{ progress: ProgressItem }>(
    `/courses/${courseId}/progress`,
    body
  );
}

/**
 * Mark a standalone content lesson (PDF/LINK/TEXT/IMAGE) complete. These have no
 * `lectureId`, so they use a lesson-scoped endpoint instead of the lecture
 * progress route. Server stores completion in member_lesson_progress.
 */
export async function markLessonComplete(
  courseId: string,
  lessonId: string,
  completed = true
): Promise<{ progress: ProgressItem }> {
  return apiPost<{ progress: ProgressItem }>(
    `/courses/${courseId}/lessons/${lessonId}/complete`,
    { completed }
  );
}

/** Get user course analytics */
export interface UserCourseAnalytics {
  totalTimeSpent: number;
  lessonTimeSpent?: Record<string, number>;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  quizScores?: Array<{
    quizTitle: string;
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  assignmentScores?: Array<{
    assignmentTitle: string;
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  currentStreak: number;
  lastActiveAt?: string;
  startedAt?: string;
  completedAt?: string;
  dailyActivity?: Array<{ date: string; count: number }>;
}

export async function getCourseAnalytics(
  courseId: string
): Promise<UserCourseAnalytics> {
  return apiGet<UserCourseAnalytics>(`/courses/${courseId}/analytics`);
}

/** Update watch progress (seconds). Call periodically while user watches. */
export async function updateProgress(
  courseId: string,
  lectureId: string,
  watchedDuration: number,
  lastPosition?: number
): Promise<{ progress: ProgressItem }> {
  const body: Record<string, unknown> = {
    lecture_id: lectureId,
    watched_duration: Math.round(watchedDuration),
  };
  if (typeof lastPosition === "number" && lastPosition >= 0) {
    body.last_position = Math.round(lastPosition);
  }
  return apiPost<{ progress: ProgressItem }>(
    `/courses/${courseId}/progress`,
    body
  );
}

// ─── Watch tracking (heartbeat + end) ───────────────────────────────────────

export interface HeartbeatPayload {
  sessionId: string;
  currentPosition: number;
  deltaSeconds: number;
  isSessionStart?: boolean;
  isProgressFlush?: boolean;
  deviceType?: string;
  userAgent?: string;
  /** Player-reported total duration (s). Server uses it as the auto-complete
   * denominator only when the stored lecture duration is missing/0. */
  durationSeconds?: number;
}

export interface HeartbeatResponse {
  sessionId: string;
  completed: boolean;
  watchedDuration: number;
  lastPosition: number;
}

/** Send a heartbeat for an active playback session. */
export async function sendHeartbeat(
  courseId: string,
  lectureId: string,
  payload: HeartbeatPayload
): Promise<HeartbeatResponse> {
  return apiPost<HeartbeatResponse>(
    `/courses/${courseId}/lectures/${lectureId}/watch/heartbeat`,
    payload
  );
}

/**
 * End a watch session via fetch (used on explicit pause / unmount). Server
 * flushes the final progress write idempotently.
 *
 * `pendingDeltaSeconds` is the time accumulated since the last heartbeat
 * that the client never got to flush. Server adds it to total_watch_seconds
 * before closing the session.
 */
export async function endWatchSession(
  courseId: string,
  lectureId: string,
  sessionId: string,
  currentPosition?: number,
  pendingDeltaSeconds?: number,
  durationSeconds?: number
): Promise<HeartbeatResponse> {
  const body: Record<string, unknown> = { sessionId };
  if (typeof currentPosition === "number" && currentPosition >= 0) {
    body.currentPosition = Math.round(currentPosition);
  }
  if (typeof pendingDeltaSeconds === "number" && pendingDeltaSeconds > 0) {
    body.pendingDeltaSeconds = Math.round(pendingDeltaSeconds);
  }
  if (typeof durationSeconds === "number" && durationSeconds > 0) {
    body.durationSeconds = Math.round(durationSeconds);
  }
  return apiPost<HeartbeatResponse>(
    `/courses/${courseId}/lectures/${lectureId}/watch/end`,
    body
  );
}

/**
 * End a watch session on tab close / beforeunload, survives unload via
 * `fetch` + `keepalive: true`. We use fetch (not navigator.sendBeacon)
 * because the learner-api requires an Authorization header that sendBeacon
 * can't set. Fire-and-forget: the response is intentionally not awaited.
 * the learner-api's endWatchSession is idempotent so it's safe if a
 * concurrent fetch happens.
 */
export function endWatchSessionKeepalive(
  apiBaseUrl: string,
  courseId: string,
  lectureId: string,
  sessionId: string,
  authToken: string | null,
  tenantHost: string | null,
  currentPosition?: number,
  pendingDeltaSeconds?: number,
  durationSeconds?: number
): void {
  if (typeof fetch === "undefined") return;
  const body: Record<string, unknown> = { sessionId };
  if (typeof currentPosition === "number" && currentPosition >= 0) {
    body.currentPosition = Math.round(currentPosition);
  }
  if (typeof pendingDeltaSeconds === "number" && pendingDeltaSeconds > 0) {
    body.pendingDeltaSeconds = Math.round(pendingDeltaSeconds);
  }
  if (typeof durationSeconds === "number" && durationSeconds > 0) {
    body.durationSeconds = Math.round(durationSeconds);
  }
  const url = `${apiBaseUrl.replace(/\/+$/, "")}/courses/${courseId}/lectures/${lectureId}/watch/end`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  if (tenantHost) headers["X-Tenant-Host"] = tenantHost;
  try {
    void fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Swallow, page is unloading, nothing to do.
  }
}
