import type { QuizFormat } from "./types";

/**
 * Best-effort format sniffing for the "Auto" option in the import dialog.
 * GIFT is recognised by its `{ ... }` answer block or a `::title::` prefix;
 * AIKEN by an `ANSWER: X` line. Returns null when neither signature is present.
 */
export function detectFormat(text: string): QuizFormat | null {
  const t = text.trim();
  if (!t) return null;
  const hasBraceAnswer = /\{[^}]*\}/.test(t.replace(/\\[{}]/g, ""));
  if (/(^|\n)\s*::/.test(t) || hasBraceAnswer) return "GIFT";
  if (/^\s*ANSWER\s*:\s*[A-Za-z]\s*$/im.test(t)) return "AIKEN";
  return null;
}
