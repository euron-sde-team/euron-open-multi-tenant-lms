import { generateText, Output } from "ai";
import { z } from "zod";
import type { QuizAnswers } from "../lib/creator-intent/types";
import logger from "../utils/logger";
import { getTextModel, isAiLive } from "../lib/ai/provider";

// One-shot the AI model call that picks a domain-faithful course title for the
// onboarding wizard's auto-generated sample course. The course title is the
// only seed the downstream course-ai BullMQ worker needs, everything else
// (subtitle, learning outcomes, curriculum, FAQs, etc.) is produced by the
// existing courseAIService, which is shared with the manual "Generate all
// with AI" admin flow.
//
// Why a separate, tiny call instead of folding it into the worker job:
//  - the title is needed synchronously inside the provisioning trx (the
//    course slug derives from it),
//  - the worker is fire-and-forget, by the time it ran, the course shell
//    would already exist with whatever title we used, which would have to
//    be retroactively renamed (slug churn, page slug churn, broken URLs
//    if anything cached them).

const titleSchema = z.object({
  courseTitle: z
    .string()
    .min(8)
    .max(80)
    .describe(
      "A domain-faithful, marketable course title that reflects what the academy says it wants to launch. Avoid stuffing the org name in (the org name surfaces elsewhere). 4-10 words. Example: 'Spoken English Mastery for Working Professionals' (Language vertical), 'Python Programming Foundations' (Engineering / coding), 'Strength & Conditioning Foundations' (Fitness). NEVER prefix with 'Sample'."
    ),
});

export type GeneratedCourseTitle = z.infer<typeof titleSchema>;

// 20s, matches the template/theme pick timeout in academy-pick-ai.service.ts.
// Both calls run inside Promise.allSettled at provisioning time, so the
// effective wizard wait is max(template_latency, title_latency); raising the
// title ceiling to 20s costs nothing extra (template was already that high)
// and gives the AI more headroom on cold starts before falling back to the
// deterministic title.
const AI_TIMEOUT_MS = 20000;

/** The live model, or null in offline mode so the deterministic fallback is used. */
function getModel() {
  return isAiLive() ? getTextModel("course_title") : null;
}

interface GenerateCourseTitleInput {
  quiz_answers: QuizAnswers;
  org_name: string;
  /** Used when the AI call fails or is unavailable. */
  deterministic_fallback: string;
}

function buildPrompt(input: GenerateCourseTitleInput): string {
  return [
    `You are naming the FIRST course an Indian creator will offer on their new online academy.`,
    ``,
    `Organization name: "${input.org_name}"`,
    ``,
    `Quiz answers (JSON, what they teach, who their audience is):`,
    JSON.stringify(input.quiz_answers, null, 2),
    ``,
    `Output ONLY a single course title that:`,
    `- is faithful to the creator's actual domain (use the quiz "creator_type" + tools as the strongest signal),`,
    `- sounds like a real launch course a learner would buy, not a placeholder,`,
    `- is 4–10 words, no leading "Sample", no trailing "Course" filler unless natural,`,
    `- does NOT include the organization name (the org name is used as branding elsewhere),`,
    `- is in English unless the quiz suggests a regional language vertical.`,
  ].join("\n");
}

class CourseTitleAIService {
  /**
   * Generate a single domain-faithful course title from the onboarding quiz.
   *
   * Never throws, falls back to the supplied deterministic title on any
   * failure (missing API key, timeout, model error, schema violation). The
   * provisioning flow must always succeed end-to-end; a missing AI title is
   * never a reason to fail signup.
   */
  async generateCourseTitle(input: GenerateCourseTitleInput): Promise<{
    courseTitle: string;
    source: "ai" | "fallback";
    latency_ms: number;
  }> {
    const startedAt = Date.now();
    const model = getModel();
    if (!model) {
      logger.warn(
        "AI provider offline, using deterministic course title for onboarding sample course"
      );
      return {
        courseTitle: input.deterministic_fallback,
        source: "fallback",
        latency_ms: 0,
      };
    }

    try {
      const result = await Promise.race([
        generateText({
          model,
          output: Output.object({ schema: titleSchema }),
          prompt: buildPrompt(input),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("the AI model request timed out")),
            AI_TIMEOUT_MS
          )
        ),
      ]);

      const parsed = result.output as GeneratedCourseTitle;
      const cleaned = parsed.courseTitle.trim();
      if (!cleaned || cleaned.length < 8) {
        throw new Error("Generated title failed length check");
      }
      const latency = Date.now() - startedAt;
      logger.info(
        `the AI model course-title pick in ${latency}ms (title="${cleaned}")`
      );
      return { courseTitle: cleaned, source: "ai", latency_ms: latency };
    } catch (error) {
      const latency = Date.now() - startedAt;
      logger.warn(
        `the AI model course-title pick failed after ${latency}ms, falling back to deterministic title: ${error instanceof Error ? error.message : "unknown"}`
      );
      return {
        courseTitle: input.deterministic_fallback,
        source: "fallback",
        latency_ms: latency,
      };
    }
  }
}

export default new CourseTitleAIService();
