/**
 * Pure parsers for the unknown-typed `stem` / `options` / `correctAnswer`
 * fields on a test question. Shared by the test builder and the random-pick
 * review list so both render questions identically.
 */

export function stemParts(stem: unknown): { text: string; imageUrl: string | null } {
  if (typeof stem === "string") return { text: stem, imageUrl: null };
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    return {
      text: typeof o.text === "string" ? o.text : "",
      imageUrl:
        typeof o.imageUrl === "string" && o.imageUrl.length > 0 ? o.imageUrl : null,
    };
  }
  return { text: "", imageUrl: null };
}

/** Normalise the unknown-typed `options` into `{ id, label, imageUrl }[]`. */
export function optionParts(
  options: unknown
): { id: string; label: string; imageUrl: string | null }[] {
  if (!Array.isArray(options)) return [];
  return options.map((o, idx) => {
    const fallbackId = String.fromCharCode(65 + idx);
    if (typeof o === "string") return { id: fallbackId, label: o, imageUrl: null };
    if (typeof o === "object" && o !== null) {
      const obj = o as Record<string, unknown>;
      return {
        id: String(obj.id ?? fallbackId),
        label: String(obj.label ?? obj.text ?? ""),
        imageUrl:
          typeof obj.imageUrl === "string" && obj.imageUrl.length > 0
            ? obj.imageUrl
            : null,
      };
    }
    return { id: fallbackId, label: String(o), imageUrl: null };
  });
}

/** Set of correct option ids (uppercased) for MCQ-style questions. */
export function correctIdSet(correctAnswer: unknown): Set<string> {
  const out = new Set<string>();
  const add = (v: unknown) => {
    const s = String(v ?? "").trim().toUpperCase();
    if (s) out.add(s);
  };
  if (Array.isArray(correctAnswer)) correctAnswer.forEach(add);
  else if (correctAnswer != null && typeof correctAnswer !== "object")
    add(correctAnswer);
  else if (typeof correctAnswer === "object" && correctAnswer !== null) {
    const o = correctAnswer as Record<string, unknown>;
    if (Array.isArray(o.ids)) o.ids.forEach(add);
    else if (o.id != null) add(o.id);
    else if (o.value != null) add(o.value);
  }
  return out;
}

/** Human-readable answer for NAT / non-MCQ questions. */
export function plainAnswer(correctAnswer: unknown): string {
  if (correctAnswer == null) return "-";
  if (typeof correctAnswer === "object") {
    const o = correctAnswer as Record<string, unknown>;
    if (o.value != null) return String(o.value);
    return JSON.stringify(correctAnswer);
  }
  return String(correctAnswer);
}

/** Best-effort "correct answer" label for the compact review list. */
export function answerSummary(options: unknown, correctAnswer: unknown): string {
  const opts = optionParts(options);
  if (opts.length > 0) {
    const correct = correctIdSet(correctAnswer);
    const labels = opts
      .filter((o) => correct.has(o.id.toUpperCase()))
      .map((o) => o.label || o.id);
    if (labels.length > 0) return labels.join(", ");
  }
  return plainAnswer(correctAnswer);
}
