/**
 * Percentile resolution for test results (adaptive and standard).
 *
 * Two strategies, in priority order:
 *  1. lookupPercentile: a fixed, admin-authored score-to-percentile norm table
 *     (SAT-style concordance). Stable and meaningful from the very first attempt.
 *  2. peerPercentile: a fallback that ranks a score against OTHER submitted
 *     attempts of the same test. Suppressed (returns null) below MIN_COHORT so
 *     early takers never see a misleading 0th percentile.
 *
 * The two policy knobs live here on purpose: the interpolation/tie rules and the
 * cold-start threshold decide every percentile the platform reports. Adjust the
 * bodies below to change that policy without touching the finalize pipeline.
 */

export interface NormPoint {
  score: number;
  percentile: number;
}

/** Minimum number of OTHER attempts before a peer-relative percentile is shown. */
export const MIN_COHORT = 10;

/** Clamp to a sane percentile: finite, within [0, 100], one decimal place. */
function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

/**
 * Map a score to a percentile using ascending {score, percentile} breakpoints.
 * Linear interpolation between breakpoints; clamped to the table's ends and to
 * [0, 100]. Returns null when the table is empty.
 */
export function lookupPercentile(points: NormPoint[], score: number): number | null {
  if (!Array.isArray(points) || points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.score - b.score);
  if (score <= sorted[0].score) return clampPct(sorted[0].percentile);
  const last = sorted[sorted.length - 1];
  if (score >= last.score) return clampPct(last.percentile);
  for (let i = 1; i < sorted.length; i++) {
    const lo = sorted[i - 1];
    const hi = sorted[i];
    if (score <= hi.score) {
      const span = hi.score - lo.score;
      const t = span === 0 ? 0 : (score - lo.score) / span;
      return clampPct(lo.percentile + t * (hi.percentile - lo.percentile));
    }
  }
  return clampPct(last.percentile);
}

/**
 * Peer-relative percentile against OTHER attempts' scores, using the ties-aware
 * midpoint definition: (below + 0.5 * equal) / n * 100. Returns null when there
 * are fewer than minCohort other attempts (cold-start guard) so the first takers
 * never see a meaningless value.
 */
export function peerPercentile(
  otherScores: number[],
  myScore: number,
  minCohort: number = MIN_COHORT
): number | null {
  if (otherScores.length < minCohort) return null;
  let below = 0;
  let equal = 0;
  for (const s of otherScores) {
    if (s < myScore) below += 1;
    else if (s === myScore) equal += 1;
  }
  return clampPct(((below + 0.5 * equal) / otherScores.length) * 100);
}
