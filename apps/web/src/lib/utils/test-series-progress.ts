import type { SeriesDetail, SeriesDetailTest } from "@/lib/api/test-series";

/**
 * Per-test gating + CTA derivation. Centralises the rules so the dashboard
 * card and detail page stay consistent.
 *
 * Sequential rule: a test is locked unless every test before it (by
 * orderIndex) has a SUBMITTED or AUTO_SUBMITTED attempt for this learner.
 * Free-preview tests bypass the lock so creators can offer a sample test
 * out of order.
 *
 * CTA rule:
 *   - locked              -> "Locked"
 *   - IN_PROGRESS attempt -> "Continue"
 *   - SUBMITTED + allow   -> "Re-attempt" (+ a separate "View result" link via resultHref)
 *   - SUBMITTED + !allow  -> "View result"
 *   - no attempt          -> "Start"
 *
 * resultHref is populated whenever there is a submitted attempt, so callers can
 * always offer a way to see past marks, even when the primary CTA is
 * "Re-attempt" (which otherwise hides the result page).
 */
export type TestCTA =
  | { kind: "locked"; label: "Locked" }
  | { kind: "scheduled"; label: string }
  | { kind: "closed"; label: "Closed" }
  | { kind: "start"; label: "Start"; href: string }
  | { kind: "continue"; label: "Continue"; href: string }
  | { kind: "reattempt"; label: "Re-attempt"; href: string }
  | { kind: "result"; label: "View result & analytics"; href: string };

export interface TestSchedule {
  /** availableFrom is in the future, the test hasn't opened yet. */
  notYetOpen: boolean;
  /** availableUntil has passed, no new attempts allowed. */
  closed: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
}

export interface ResolvedTest {
  test: SeriesDetailTest;
  isLocked: boolean;
  cta: TestCTA;
  schedule: TestSchedule;
  /** Link to the last submitted attempt's result, or null if none. */
  resultHref: string | null;
}

export function resolveSeriesTests(
  series: Pick<SeriesDetail, "slug" | "accessMode" | "tests" | "hasAccess">
): ResolvedTest[] {
  const sorted = [...series.tests].sort((a, b) => a.orderIndex - b.orderIndex);
  const isSequential = series.accessMode === "SEQUENTIAL";

  return sorted.map((t, idx) => {
    const cannotAccess = !series.hasAccess && !t.isFreePreview;

    let isLocked = cannotAccess;
    if (!isLocked && isSequential && !t.isFreePreview) {
      const prior = sorted.slice(0, idx);
      const allPriorDone = prior.every(
        (p) =>
          p.lastAttemptStatus === "SUBMITTED" ||
          p.lastAttemptStatus === "AUTO_SUBMITTED" ||
          p.isFreePreview
      );
      isLocked = !allPriorDone;
    }

    // Scheduling window. Only gates STARTING / RE-ATTEMPTING, an in-progress
    // attempt can still be continued and a submitted attempt's result viewed.
    const now = Date.now();
    const fromMs = t.availableFrom ? Date.parse(t.availableFrom) : NaN;
    const untilMs = t.availableUntil ? Date.parse(t.availableUntil) : NaN;
    const notYetOpen = !isNaN(fromMs) && now < fromMs;
    const closed = !isNaN(untilMs) && now > untilMs;
    const schedule: TestSchedule = {
      notYetOpen,
      closed,
      availableFrom: t.availableFrom ?? null,
      availableUntil: t.availableUntil ?? null,
    };

    const base = `/test-series/${series.slug}/${t.id}`;
    const submittedAttemptId =
      (t.lastAttemptStatus === "SUBMITTED" ||
        t.lastAttemptStatus === "AUTO_SUBMITTED") &&
      t.lastAttemptId
        ? t.lastAttemptId
        : null;
    const resultHref = submittedAttemptId
      ? `${base}/result/${submittedAttemptId}`
      : null;
    let cta: TestCTA;
    if (isLocked) {
      cta = { kind: "locked", label: "Locked" };
    } else if (
      (t.lastAttemptStatus === "IN_PROGRESS" || t.lastAttemptStatus === "ON_BREAK") &&
      t.lastAttemptId
    ) {
      // ON_BREAK is a live attempt paused on the inter-section break, it must
      // resume (Continue), never show "Start" (which would fail as a re-attempt).
      cta = {
        kind: "continue",
        label: "Continue",
        href: `${base}/attempt/${t.lastAttemptId}`,
      };
    } else if (
      (t.lastAttemptStatus === "SUBMITTED" ||
        t.lastAttemptStatus === "AUTO_SUBMITTED") &&
      t.lastAttemptId
    ) {
      if (t.allowReattempt && !notYetOpen && !closed) {
        cta = { kind: "reattempt", label: "Re-attempt", href: `${base}/instructions` };
      } else {
        cta = {
          kind: "result",
          label: "View result & analytics",
          href: `${base}/result/${t.lastAttemptId}`,
        };
      }
    } else if (notYetOpen) {
      cta = {
        kind: "scheduled",
        label: `Opens ${new Date(fromMs).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}`,
      };
    } else if (closed) {
      cta = { kind: "closed", label: "Closed" };
    } else {
      cta = { kind: "start", label: "Start", href: `${base}/instructions` };
    }

    return { test: t, isLocked, cta, schedule, resultHref };
  });
}
