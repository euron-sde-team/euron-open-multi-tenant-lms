/**
 * Aligning a drag-and-drop answer back onto the blanks in its stem.
 *
 * Reviewing one of these used to mean reading "Blank 1, Blank 2, Blank 3" as a
 * list under the question and counting underscores to work out which was which.
 * Putting each answer back where it was dropped removes that step, but only if
 * the answer can be aligned to a blank with certainty, which is what this
 * decides.
 *
 * Shared because the learner's result page and the staff attempt review must
 * agree: two implementations of "which answer went in which blank" is two
 * chances to disagree about whether someone got it right.
 */

/** The marker the attempt UI splits a stem on: two or more underscores. */
export const DRAG_DROP_BLANK_REGEX = /_{2,}/g;

/** Plain text of a stem, whatever shape it was stored in. */
export function getStemPlainText(stem: unknown): string | null {
  if (typeof stem === "string") return stem;
  if (stem && typeof stem === "object") {
    const o = stem as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    // Strip tags so blanks can still be located inside an HTML stem.
    if (typeof o.html === "string") return o.html.replace(/<[^>]+>/g, "");
  }
  return null;
}

/** Diagram attached to a stem, if any. */
export function getStemImageUrl(stem: unknown): string | null {
  if (stem && typeof stem === "object") {
    const url = (stem as Record<string, unknown>).imageUrl;
    if (typeof url === "string" && url.length > 0) return url;
  }
  return null;
}

export interface DragDropBlank {
  /** Text sitting before this blank. */
  before: string;
  /** What the learner dropped in, already resolved to a readable label. */
  given: string | null;
  /** What belonged there, resolved to a readable label. */
  expected: string | null;
  correct: boolean;
}

export interface DragDropAlignment {
  blanks: DragDropBlank[];
  /** Text after the final blank. */
  tail: string;
}

/**
 * Line the answers up with the blanks, or return null when that cannot be done
 * safely.
 *
 * Null means the stem's blank count does not match the answer count, which
 * happens when a stem is edited after an attempt was submitted. Guessing an
 * alignment there would show a learner the wrong answer against the wrong
 * blank and mark it wrong, so callers fall back to a positional list that
 * claims nothing.
 *
 * A single-blank question whose answer is stored as a bare value rather than a
 * one-element array is handled, since that is how the bank actually stores
 * them.
 */
export function alignDragDropAnswers(
  stem: unknown,
  givenIds: unknown,
  correctIds: unknown,
  optionLabels: Record<string, string>
): DragDropAlignment | null {
  const text = getStemPlainText(stem);
  if (text === null) return null;

  const segments = text.split(DRAG_DROP_BLANK_REGEX);
  const blankCount = segments.length - 1;
  if (blankCount < 1) return null;

  // A single-blank question stores its answer as a bare value rather than a
  // one-element array, so requiring an array silently excluded half the
  // drag-and-drop questions in the bank from the filled-in view.
  const toSlots = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return blankCount === 1 ? [value] : [];
  };

  const correct = toSlots(correctIds);
  if (correct.length === 0) return null;
  if (blankCount !== correct.length) return null;

  const given = toSlots(givenIds);
  const label = (id: unknown): string | null => {
    if (id === null || id === undefined) return null;
    const key = String(id).trim();
    if (key === "") return null;
    return optionLabels[key] ?? key;
  };

  const blanks: DragDropBlank[] = correct.map((expectedId, i) => {
    const givenId = given[i];
    const givenLabel = label(givenId);
    return {
      before: segments[i] ?? "",
      given: givenLabel,
      expected: label(expectedId),
      correct: givenLabel !== null && String(givenId).trim() === String(expectedId).trim(),
    };
  });

  return { blanks, tail: segments[segments.length - 1] ?? "" };
}
