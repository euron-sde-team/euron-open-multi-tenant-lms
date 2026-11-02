// Mirrors learner-api src/utils/shuffle.util.ts EXACTLY: staff
// reviews must reproduce the order the learner was served. Change both together.

/** Deterministic string hash (xmur3) → 32-bit seed for the PRNG below. */
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/**
 * mulberry32 PRNG. Unlike a bare LCG (whose low bits, the ones `% (i + 1)`
 * reads, barely change between similar seeds), this has good low-bit
 * distribution, so a Fisher-Yates seeded by it reaches every permutation
 * roughly uniformly. Similar attempt-id seeds no longer collapse to the same
 * couple of orders.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle seeded by a string.
 *
 * The same (arr, seed) pair always produces the same order. This is what keeps
 * a quiz/test attempt stable across reloads: seed by the attempt id and the
 * learner sees one consistent order for the whole attempt, while a fresh
 * attempt (new id) reshuffles. Grading is unaffected because answers are keyed
 * by option id, never by position.
 */
export function shuffleArray<T>(arr: T[], seed: string): T[] {
  const out = [...arr];
  const rng = mulberry32(hashSeed(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The order a STANDARD test attempt served its questions in, flattened across
 * sections: sections in their given order, each section's questions in
 * `sectionQuestions` order, restricted to the served subset, then shuffled
 * with seed (attemptId + sectionId) when the test shuffles questions.
 *
 * Must stay identical to how test-attempt.service builds `sections[].questionIds`
 * for the player, so a review lists the questions in the order the learner saw
 * them. A question attached to two sections is listed once, at its first spot.
 */
export function servedQuestionOrder(params: {
  attemptId: string;
  sections: Array<{ id: string }>;
  sectionQuestions: Array<{ section_id: string; question_id: string }>;
  isServed: (questionId: string) => boolean;
  shuffleQuestions: boolean;
}): string[] {
  const bySection = new Map<string, string[]>();
  for (const sq of params.sectionQuestions) {
    if (!params.isServed(sq.question_id)) continue;
    const list = bySection.get(sq.section_id) ?? [];
    list.push(sq.question_id);
    bySection.set(sq.section_id, list);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of params.sections) {
    let ids = bySection.get(s.id) ?? [];
    if (params.shuffleQuestions) ids = shuffleArray(ids, params.attemptId + s.id);
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
