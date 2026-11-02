import { db } from "../db/connection";
import logger from "../utils/logger";

export interface CurvePoint {
  percentile: number;
  rank: number;
}

export interface RankPrediction {
  min: number;
  max: number;
  examName: string;
  year: number;
  totalCandidates: number;
}

function parseCurve(value: unknown): CurvePoint[] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as CurvePoint[]) : [];
}

/**
 * Linearly interpolate the predicted rank for a given percentile against a
 * (percentile, rank) curve. The curve is sorted by percentile ascending; rank
 * decreases as percentile increases (rank 1 is the best). Out-of-range
 * percentiles snap to the nearest endpoint.
 */
function interpolateRank(curve: CurvePoint[], percentile: number): number | null {
  if (curve.length === 0) return null;
  const sorted = [...curve].sort((a, b) => a.percentile - b.percentile);

  if (percentile <= sorted[0].percentile) return Math.round(sorted[0].rank);
  if (percentile >= sorted[sorted.length - 1].percentile) {
    return Math.round(sorted[sorted.length - 1].rank);
  }

  // Find the bracket
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (percentile >= a.percentile && percentile <= b.percentile) {
      const span = b.percentile - a.percentile;
      const t = span === 0 ? 0 : (percentile - a.percentile) / span;
      const r = a.rank + t * (b.rank - a.rank);
      return Math.round(r);
    }
  }
  return null;
}

class TestRankPredictorService {
  /**
   * Predict a rank range for a learner given their percentile, against the
   * curve attached to the test. Returns null if the test has no curve or the
   * curve isn't usable.
   *
   * The range is widened by ±15% around the interpolated point, a deliberately
   * conservative band so learners don't anchor on a single number.
   */
  async predictForTest(
    tenantId: string,
    testId: string,
    percentile: number
  ): Promise<RankPrediction | null> {
    if (!Number.isFinite(percentile)) return null;

    const test = await db
      .selectFrom("tests")
      .select(["target_rank_curve_id"])
      .where("tenant_id", "=", tenantId)
      .where("id", "=", testId)
      .executeTakeFirst();

    if (!test?.target_rank_curve_id) return null;

    const curveRow = await db
      .selectFrom("test_exam_rank_curves")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", test.target_rank_curve_id)
      .executeTakeFirst();

    if (!curveRow) return null;

    const points = parseCurve(curveRow.curve);
    if (points.length < 2) {
      logger.warn(
        `[rank-predictor] Curve ${curveRow.id} has fewer than 2 points; skipping`
      );
      return null;
    }

    const center = interpolateRank(points, percentile);
    if (center === null) return null;

    // ±15% band, but ensure min ≥ 1 and max respects total_candidates
    const widenPct = 0.15;
    let min = Math.max(1, Math.floor(center * (1 - widenPct)));
    let max = Math.min(
      Math.round(curveRow.total_candidates),
      Math.ceil(center * (1 + widenPct))
    );
    if (min > max) {
      const tmp = min;
      min = max;
      max = tmp;
    }

    return {
      min,
      max,
      examName: curveRow.exam_name,
      year: curveRow.year,
      totalCandidates: curveRow.total_candidates,
    };
  }
}

export default new TestRankPredictorService();
