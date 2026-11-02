import { generateObject, jsonSchema } from "ai";

import logger from "../utils/logger";
import { getTextModel } from "../lib/ai/provider";


/**
 * Result of asking the model to italicize work titles in a question stem.
 * `changed` is true ONLY when at least one genuine title was wrapped; `stem`
 * is the rewritten text (identical to the input when nothing qualified).
 */
const ITALICS_SCHEMA = jsonSchema<{ changed: boolean; stem: string }>({
  type: "object",
  properties: {
    changed: {
      type: "boolean",
      description:
        "true ONLY if you wrapped at least one genuine long-work title in *asterisks*; false if the stem has no such title",
    },
    stem: {
      type: "string",
      description:
        "the stem text, byte-for-byte identical to the input EXCEPT that long-work titles are wrapped in single *asterisks*",
    },
  },
  required: ["changed", "stem"],
});

const ITALICS_SYSTEM = [
  "You apply SAT Reading & Writing typography to a question stem: the titles of LONG / standalone works are shown in italics, marked here with single *asterisks* (Markdown italic).",
  "",
  "ITALICIZE (wrap in *...*) ONLY the titles of: books, novels, plays, epic/long poems, newspapers, magazines, journals, films, TV series, albums, operas, paintings/sculptures, and named ships. Example: *Pride and Prejudice*, *The New York Times*, *Hamlet*.",
  "",
  "NEVER italicize:",
  "- Author names, people's names, or character names (e.g. Jane Austen, Hamlet-the-character, but the PLAY Hamlet is italic).",
  "- Titles of SHORT works that take quotation marks (poems, articles, short stories, songs, essays), leave their existing quotes as-is, do not italicize.",
  "- Organizations, places, brands, species, events, or ordinary words for emphasis.",
  "",
  "STRICT OUTPUT RULES:",
  "- Return the stem with EXACTLY the same words, spelling, punctuation, spacing, and line breaks. The ONLY permitted change is adding the * * around qualifying titles.",
  "- Preserve any mathematics EXACTLY as it appears (e.g. $...$ spans), never touch it.",
  "- Do NOT add, remove, rephrase, summarize, translate, or correct anything.",
  "- If a title is ALREADY wrapped in *...*, leave it (do not double-wrap).",
  "- If there is NO qualifying long-work title, set changed=false and return the stem unchanged.",
  "- Be conservative: when unsure whether something is a long-work title, do NOT italicize it.",
].join("\n");

/**
 * Italicize long-work titles in a single stem. Best-effort: returns the
 * original text with changed=false on any AI error or when nothing qualifies,
 * so a batch run never aborts on one question. Also guards against the model
 * mangling the text by rejecting a rewrite whose letters/digits don't match
 * the input once asterisks and spaces are ignored.
 */
export async function italicizeStemTitles(
  stemText: string
): Promise<{ changed: boolean; stem: string }> {
  const trimmed = (stemText ?? "").trim();
  if (!trimmed) return { changed: false, stem: stemText };
  try {
    const { object } = await generateObject({
      model: getTextModel("question_import"),
      schema: ITALICS_SCHEMA,
      system: ITALICS_SYSTEM,
      prompt: ["QUESTION STEM:", trimmed.slice(0, 8000)].join("\n"),
      temperature: 0,
      maxOutputTokens: 2000,
    });
    const out = (object?.stem ?? "").trim();
    if (!object?.changed || !out) return { changed: false, stem: stemText };
    // Integrity guard: the rewrite must be the same text plus only '*' chars.
    // Compare alphanumerics so we never silently accept a hallucinated rewrite.
    const norm = (s: string) => s.replace(/[*\s]/g, "").toLowerCase();
    if (norm(out) !== norm(trimmed)) {
      logger.warn("[italicize-titles] rewrite changed non-title text; skipping");
      return { changed: false, stem: stemText };
    }
    return { changed: true, stem: out };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[italicize-titles] generate failed", { error: msg });
    return { changed: false, stem: stemText };
  }
}
