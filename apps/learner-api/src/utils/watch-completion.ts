/**
 * Video completion math for the watch-session path, kept pure so it can be
 * checked without a database.
 *
 * Positions arrive from the player, so the stored `lectures.duration` was never
 * a security boundary: one crafted heartbeat could always claim the end. What
 * the stored length does do is decide whether an honest learner can finish, and
 * it can be wrong, a lecture's video swapped for a shorter one keeps the old
 * length, and a hand-entered length can simply be off. A stored length longer
 * than the real video makes the required watch % unreachable, the lesson never
 * completes, and in a sequential course everything after it stays locked.
 */

// Upper bound on a player-reported duration we'll trust: 24h. Guards against a
// bogus value inflating the completion denominator.
export const MAX_CLIENT_DURATION_SECONDS = 24 * 60 * 60;

// A player-reported duration only overrides a stored one when it looks like a
// real video length. Players can report odd values while metadata loads, and a
// tiny denominator would complete a lecture on its first heartbeat.
export const MIN_CLIENT_OVERRIDE_SECONDS = 10;

// Players stop a moment short of the stored length and positions are floored
// to whole seconds, so a 100% requirement is otherwise unreachable.
export const COMPLETION_SLACK_SECONDS = 2;

function clientSeconds(clientDuration?: number): number {
  const c = Math.floor(Number(clientDuration) || 0);
  return c > 0 && c <= MAX_CLIENT_DURATION_SECONDS ? c : 0;
}

/**
 * Length that completion is measured against: the shorter of the stored length
 * and the length of the video the player is actually playing, else whichever of
 * the two is known. 0 when neither is usable (completion can't trigger).
 */
export function completionDuration(
  storedDuration: number,
  clientDuration?: number
): number {
  const stored = Number.isFinite(storedDuration) && storedDuration > 0 ? storedDuration : 0;
  const client = clientSeconds(clientDuration);
  if (stored > 0) {
    return client >= MIN_CLIENT_OVERRIDE_SECONDS && client < stored ? client : stored;
  }
  return client;
}

/**
 * Upper bound for a reported position: the longer of the two lengths. A video
 * longer than its stored length must not have its later heartbeats refused, or
 * its resume point stops being saved partway through.
 */
export function positionLimit(storedDuration: number, clientDuration?: number): number {
  const stored = Number.isFinite(storedDuration) && storedDuration > 0 ? storedDuration : 0;
  return Math.max(stored, clientSeconds(clientDuration));
}

/** Whether the watched high-water mark meets the required fraction of `duration`. */
export function hasWatchedEnough(
  watchedSeconds: number,
  duration: number,
  requiredFraction: number
): boolean {
  if (!(duration > 0)) return false;
  const slack = Math.min(COMPLETION_SLACK_SECONDS, duration * 0.05);
  return watchedSeconds + slack >= duration * requiredFraction;
}
