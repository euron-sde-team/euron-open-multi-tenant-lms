import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { getTextModel, getTextModelId } from "../lib/ai/provider";
import logger from "../utils/logger";

/** Question generation model from the AI provider (src/lib/ai/provider.ts). */
async function getTestAiModel(): Promise<{ model: LanguageModel; modelId: string }> {
  return { model: getTextModel("test"), modelId: getTextModelId("test") };
}

// Schema enforces a publishable question shape, the LLM must populate all fields
const QuestionSchema = z.object({
  type: z.enum(["MCQ_SINGLE", "MCQ_MULTI", "TRUE_FALSE", "FIB", "NAT"]),
  stem: z.string().min(10).describe(
    "The question text. ALWAYS wrap LaTeX in $...$ for inline math (e.g. $\\frac{dv}{dt}$, $\\pi r^2$). Never use bare curly braces like { \\frac{a}{b} }, that does not render. Plain prose without math needs no delimiters. Min 10 chars."
  ),
  options: z
    .array(
      z.object({
        id: z.string().describe("A short option id like 'A', 'B', 'C', 'D'"),
        label: z.string().min(1).describe("The option text"),
      })
    )
    .nullable()
    .describe(
      "For MCQ_SINGLE/MCQ_MULTI/TRUE_FALSE: array of options. For FIB/NAT: null."
    ),
  correct_answer: z
    .union([z.string(), z.array(z.string()), z.number()])
    .describe(
      "For MCQ_SINGLE/TF: the correct option id (string). For MCQ_MULTI: array of correct option ids. For FIB: the correct text answer. For NAT: the correct number."
    ),
  explanation: z.string().describe("A clear explanation, 2-4 sentences."),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  suggested_subject: z.string().nullable(),
  suggested_chapter: z.string().nullable(),
  suggested_topic: z.string().nullable(),
  confidence: z
    .enum(["HIGH", "MEDIUM", "LOW"])
    .describe("Your confidence in this question's correctness and clarity."),
});

const QuestionListSchema = z.object({
  questions: z.array(QuestionSchema),
});

export type GeneratedQuestion = z.infer<typeof QuestionSchema>;

export interface GenerationConfig {
  /** Number of questions to generate from this chunk */
  count: number;
  /** Allowed question types */
  types: Array<"MCQ_SINGLE" | "MCQ_MULTI" | "TRUE_FALSE" | "FIB" | "NAT">;
  /** Difficulty mix as percentages summing to 100 */
  difficultyMix: { easy: number; medium: number; hard: number };
  /** Tags hints from the user */
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  /** Output language */
  language: "en" | "hi";
}

function buildPrompt(text: string, config: GenerationConfig): string {
  const difficultyDesc =
    `${config.difficultyMix.easy}% easy, ` +
    `${config.difficultyMix.medium}% medium, ` +
    `${config.difficultyMix.hard}% hard`;
  const tagHints = [
    config.subject ? `Subject: ${config.subject}` : null,
    config.chapter ? `Chapter: ${config.chapter}` : null,
    config.topic ? `Topic: ${config.topic}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const langInstruction =
    config.language === "hi"
      ? "Generate questions in Hindi (Devanagari script)."
      : "Generate questions in English.";

  return [
    "You are an expert exam-question setter. From the source material below, generate test questions of high pedagogical quality.",
    langInstruction,
    "",
    `Generate exactly ${config.count} questions.`,
    `Use only these question types: ${config.types.join(", ")}.`,
    `Aim for this difficulty mix: ${difficultyDesc}.`,
    tagHints ? `Tag hints (use these or refine):\n${tagHints}` : "",
    "",
    "Rules:",
    "- For MCQ_SINGLE: 4 plausible options, exactly one correct. correct_answer must be the option id.",
    "- For MCQ_MULTI: 4-5 options with 2 or more correct. correct_answer is an array of option ids.",
    "- For TRUE_FALSE: exactly 2 options with ids 'TRUE' and 'FALSE'. correct_answer is one of those.",
    "- For FIB (fill in the blank): options is null. correct_answer is the canonical answer string.",
    "- For NAT (numerical answer): options is null. correct_answer is a number.",
    "- Do not generate questions that depend on a figure/diagram unless the description is self-contained.",
    "- Avoid trivia. Prefer conceptual / application-based questions.",
    "- Each explanation must justify why the correct answer is correct.",
    "- Set confidence based on how unambiguous the answer is in the source.",
    "",
    "Source material:",
    "---",
    text,
    "---",
  ]
    .filter(Boolean)
    .join("\n");
}

class TestAIService {
  /**
   * Generate `config.count` questions from the given source text.
   * Throws if no AI provider is configured (see getTestAiModel for resolution order).
   */
  async generateQuestions(
    sourceText: string,
    config: GenerationConfig
  ): Promise<GeneratedQuestion[]> {
    const { model, modelId } = await getTestAiModel();
    const prompt = buildPrompt(sourceText, config);

    logger.info(
      `[test-ai] Generating ${config.count} questions with ${modelId} (lang=${config.language}, types=${config.types.join(",")})`
    );

    const { object } = await generateObject({
      model,
      schema: QuestionListSchema,
      prompt,
      // Constrain output length, questions are not huge, but explanations can be
      maxOutputTokens: 8000,
      temperature: 0.4,
    });

    // Filter out malformed entries that slipped past the schema (e.g. MCQ with no
    // options, or correct_answer not in options). The schema is permissive on
    // these cross-field checks; we sanity-check here.
    const valid: GeneratedQuestion[] = [];
    for (const q of object.questions) {
      const ok = this.isStructurallyValid(q);
      if (ok) valid.push(q);
      else
        logger.warn(
          `[test-ai] Discarded structurally invalid question: ${q.stem.slice(0, 60)}`
        );
    }

    logger.info(
      `[test-ai] Generated ${valid.length}/${object.questions.length} valid questions`
    );
    return valid;
  }

  /**
   * Cross-field validation that Zod can't easily express:
   * - MCQ types require options[] of length ≥2 with the correct_answer referencing
   *   one (or multiple, for MCQ_MULTI) of the option ids.
   * - FIB requires correct_answer to be a non-empty string.
   * - NAT requires correct_answer to be a number.
   */
  isStructurallyValid(q: GeneratedQuestion): boolean {
    if (q.type === "MCQ_SINGLE" || q.type === "TRUE_FALSE") {
      if (!q.options || q.options.length < 2) return false;
      if (typeof q.correct_answer !== "string") return false;
      return q.options.some((o) => o.id === q.correct_answer);
    }
    if (q.type === "MCQ_MULTI") {
      if (!q.options || q.options.length < 2) return false;
      if (!Array.isArray(q.correct_answer)) return false;
      if (q.correct_answer.length === 0) return false;
      const ids = new Set(q.options.map((o) => o.id));
      return q.correct_answer.every((c) => ids.has(c));
    }
    if (q.type === "FIB") {
      return (
        typeof q.correct_answer === "string" && q.correct_answer.trim().length > 0
      );
    }
    if (q.type === "NAT") {
      return typeof q.correct_answer === "number" && Number.isFinite(q.correct_answer);
    }
    return false;
  }
}

export default new TestAIService();
