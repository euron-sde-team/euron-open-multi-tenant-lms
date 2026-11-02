/**
 * Shared helpers for test attempt grading and deterministic sampling.
 * Extracted from test-attempt.service.ts so the adaptive module engine and
 * result services grade with byte-identical logic.
 */

/**
 * Re-exported from shuffle.util so the test-attempt and adaptive engines shuffle
 * with the SAME well-distributed PRNG the quiz path uses. The previous local
 * copy here was a bare LCG whose low bits (the ones `% (i + 1)` reads for small
 * option arrays) barely change between similar seeds, with the attempt id as a
 * constant prefix, 4-option questions collapsed to a couple of orderings and the
 * first option landed last almost every time, so shuffling looked broken.
 * mulberry32 has good low-bit distribution and reaches every permutation.
 */
export { shuffleArray } from "./shuffle.util";

export function parseJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Pick `count` ids at random from `ids` (Fisher-Yates on a copy). Runtime
 * selection, the chosen subset is then frozen on the attempt row so resume
 * never reshuffles. Returns at most `ids.length` ids.
 */
export function pickRandomSubset(ids: string[], count: number): string[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, Math.min(count, out.length));
}

export function computeTimeRemaining(
  startedAtMs: number,
  totalSec: number,
  storedRemainingSec: number | null
): number {
  // If we have a stored remaining (e.g. just resumed after an explicit pause), trust it.
  // For continuous timer (no pause), compute from started_at.
  if (storedRemainingSec === null || storedRemainingSec === undefined) {
    const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
    return Math.max(0, totalSec - elapsedSec);
  }
  const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000);
  return Math.max(0, totalSec - elapsedSec);
}

/** Parse a numeric or fraction string ("3/4", "-1.5", ".75") to a number; null if invalid. */
export function parseNumericAnswer(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (s.includes("/")) {
    const [a, b] = s.split("/");
    const na = Number(a);
    const nb = Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) && nb !== 0 ? na / nb : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate a Digital-SAT student-produced-response (SPR / type-in) entry.
 * The answer grid accepts at most 6 characters for the whole answer, with the
 * negative sign counting as one of them. Allowed: optional leading '-', digits,
 * and at most one '.' (decimal) OR one '/' (fraction).
 */
export function validateSprInput(raw: unknown): boolean {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 6) return false;
  return /^-?(\d+(\.\d+)?|\.\d+|\d+\/\d+)$/.test(s);
}

/**
 * Match a submitted SPR value to the target. With an explicit tolerance, uses
 * it. Otherwise accepts the SAT rule: a non-terminating decimal may be
 * truncated OR rounded to fill the grid (e.g. 2/3 → .666 or .667).
 */
function matchesSpr(sub: number, target: number, tol: number): boolean {
  if (tol > 0) return Math.abs(sub - target) <= tol;
  if (Math.abs(sub - target) <= 1e-9) return true;
  const decimals = (String(sub).split(".")[1] || "").length;
  if (decimals >= 2) {
    const f = Math.pow(10, decimals);
    const trunc = Math.trunc(target * f) / f;
    const round = Math.round(target * f) / f;
    if (Math.abs(sub - trunc) <= 1e-9 || Math.abs(sub - round) <= 1e-9) return true;
  }
  return false;
}

export function gradeAnswer(
  questionType: string,
  correctAnswer: unknown,
  submitted: unknown,
  marks: number,
  negativeMarks: number
): { isCorrect: boolean; marksAwarded: number } {
  if (submitted === null || submitted === undefined) {
    return { isCorrect: false, marksAwarded: 0 };
  }

  const correct = parseJson(correctAnswer);

  switch (questionType) {
    case "MCQ_SINGLE":
    case "TRUE_FALSE": {
      const ok = String(submitted).trim() === String(correct).trim();
      return { isCorrect: ok, marksAwarded: ok ? marks : -negativeMarks };
    }
    case "DRAG_DROP": {
      // Multi-blank: correct_answer is an ordered array (one option id per
      // blank, in stem order) and the submitted answer must be an array of the
      // same length matching each blank. All-or-nothing grading.
      // Single-blank (legacy): both are scalars, plain string compare.
      if (Array.isArray(correct)) {
        const sub = Array.isArray(submitted) ? submitted : [];
        const ok =
          sub.length === correct.length &&
          correct.every(
            (c, i) => String(c).trim() === String(sub[i] ?? "").trim()
          );
        return { isCorrect: ok, marksAwarded: ok ? marks : -negativeMarks };
      }
      const ok = String(submitted).trim() === String(correct).trim();
      return { isCorrect: ok, marksAwarded: ok ? marks : -negativeMarks };
    }
    case "MCQ_MULTI": {
      const sub = Array.isArray(submitted) ? submitted.map(String).sort() : [];
      const cor = Array.isArray(correct) ? correct.map(String).sort() : [];
      const ok =
        sub.length === cor.length && sub.every((v, i) => v === cor[i]);
      return { isCorrect: ok, marksAwarded: ok ? marks : -negativeMarks };
    }
    case "FIB": {
      const subStr = String(submitted).trim().toLowerCase();
      const accepted = Array.isArray(correct)
        ? correct.map((c) => String(c).trim().toLowerCase())
        : [String(correct).trim().toLowerCase()];
      const ok = accepted.includes(subStr);
      return { isCorrect: ok, marksAwarded: ok ? marks : -negativeMarks };
    }
    case "NAT": {
      // Digital-SAT SPR (type-in). Reject entries that don't fit the answer
      // grid (≤6 chars incl. sign), an invalid entry is wrong but not penalised.
      if (typeof submitted === "string" && !validateSprInput(submitted)) {
        return { isCorrect: false, marksAwarded: 0 };
      }
      const subNum = parseNumericAnswer(submitted);
      if (subNum === null) {
        return { isCorrect: false, marksAwarded: -negativeMarks };
      }
      // correct can be: a number, a fraction string, { value, tolerance }, or an
      // array of accepted values.
      if (Array.isArray(correct)) {
        const ok = correct.some((c) => {
          const t = parseNumericAnswer(c);
          return t !== null && matchesSpr(subNum, t, 0);
        });
        return { isCorrect: ok, marksAwarded: ok ? marks : -negativeMarks };
      }
      let target: number | null;
      let tol = 0;
      if (typeof correct === "object" && correct !== null) {
        target = parseNumericAnswer((correct as { value?: unknown }).value);
        tol = Number((correct as { tolerance?: number }).tolerance ?? 0);
      } else {
        target = parseNumericAnswer(correct);
      }
      if (target === null) return { isCorrect: false, marksAwarded: 0 };
      const ok = matchesSpr(subNum, target, tol);
      return { isCorrect: ok, marksAwarded: ok ? marks : -negativeMarks };
    }
    default:
      return { isCorrect: false, marksAwarded: 0 };
  }
}
