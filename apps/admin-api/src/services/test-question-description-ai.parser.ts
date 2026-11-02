import { generateObject, jsonSchema } from "ai";

import logger from "../utils/logger";
import { getTextModel } from "../lib/ai/provider";


/**
 * Result of asking the model for a question's reference "description", the
 * background context/passage/scenario a student needs to understand the
 * problem. `has_context` guards against fabrication: the model is told to set
 * it false (and leave the text empty) whenever the question is self-contained,
 * so we never invent context that isn't really there.
 */
const DESC_SCHEMA = jsonSchema<{ has_context: boolean; description: string }>({
  type: "object",
  properties: {
    has_context: {
      type: "boolean",
      description:
        "true ONLY when the question genuinely carries a passage, scenario, real-world setup, or figure the student must read to answer; false for self-contained direct questions",
    },
    description: {
      type: "string",
      description:
        "the contextual note in 1-3 sentences; MUST be empty when has_context is false",
    },
  },
  required: ["has_context", "description"],
});

const DESC_SYSTEM = [
  "You write a short reference CONTEXT note for an existing exam question, the background scenario, a faithful summary of the passage, or a description of the figure that a student needs in order to understand what the problem is asking.",
  "",
  "STRICT RULES, accuracy over completeness:",
  "- Use ONLY information that is actually present in the question stem. NEVER invent numbers, names, facts, passages, or context that are not in the stem.",
  "- Do NOT reveal, hint at, or compute the answer, and do NOT include any solution steps or method.",
  "- Do NOT simply restate the question sentence and do NOT list the answer options.",
  "- If the question is fully self-contained (a direct computation, a single self-explanatory sentence, or a definition recall), set has_context=false and return an EMPTY description. Most pure-math questions have no separate context.",
  "- Preserve any mathematics exactly as LaTeX wrapped in $...$.",
  "- Keep it to at most 3 short sentences. Plain, neutral wording.",
].join("\n");

/**
 * Generate a reference description for a single question. Best-effort: returns
 * an empty string when the question is self-contained OR on any AI error, so a
 * batch run never aborts on one question.
 */
export async function generateQuestionDescription(
  stemText: string,
  optionLabels: string[]
): Promise<string> {
  const trimmed = stemText.trim();
  if (!trimmed) return "";
  try {
    const { object } = await generateObject({
      model: getTextModel("question_import"),
      schema: DESC_SCHEMA,
      system: DESC_SYSTEM,
      prompt: [
        "QUESTION STEM:",
        trimmed.slice(0, 8000),
        "",
        "ANSWER OPTIONS (for your understanding only, do not repeat them):",
        optionLabels.join("\n").slice(0, 2000) || "(none)",
      ].join("\n"),
      temperature: 0.2,
      maxOutputTokens: 600,
    });
    if (!object?.has_context) return "";
    return (object.description || "").trim();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[seed-descriptions] generate failed", { error: msg });
    return "";
  }
}
