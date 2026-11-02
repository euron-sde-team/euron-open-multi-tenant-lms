import { generateText, Output } from "ai";
import { z } from "zod";
import {
  ALL_TEMPLATE_IDS,
  ALL_THEME_IDS,
  TEMPLATE_CATALOG,
  type QuizAnswers,
  type TemplateId,
  type ThemeId,
} from "../lib/creator-intent/types";
import logger from "../utils/logger";
import { getTextModel, isAiLive } from "../lib/ai/provider";

// the model's job in the auto-provisioning flow is purely the *picker*:
// given quiz answers and the org name, choose the best template + theme
// from the closed enum. Per-section content for every page is then
// produced downstream by the existing pageAIService.generateSection
// engine (the same one the rich /dashboard/pages onboarding wizard uses)
//, that's where the rich AI content actually comes from.
//
// We constrain the response with z.enum so the AI model physically cannot return
// a hallucinated id. Falls back to the deterministic default on any error.
const templatePickSchema = z.object({
  template_id: z
    .enum(ALL_TEMPLATE_IDS as [TemplateId, ...TemplateId[]])
    .describe(
      "Best homepage template for this academy. Pick from the closed enum.",
    ),
  theme_id: z
    .enum(ALL_THEME_IDS as [ThemeId, ...ThemeId[]])
    .describe("Theme preset paired with the template."),
  // No .max() here: a length cap on the SCHEMA rejects the whole answer, the
  // valid template pick included, whenever the explanation runs long, and the
  // lite model often writes ~300 characters. It is trimmed after parsing.
  rationale: z
    .string()
    .describe(
      "1-2 sentences explaining why this template+theme fits the quiz answers.",
    ),
});

export type TemplateThemePick = z.infer<typeof templatePickSchema>;

// Hard timeout, beyond this, we abandon the AI model and use the deterministic
// fallback. Provisioning must stay snappy or the build animation breaks the
// reveal moment.
const AI_TIMEOUT_MS = 20000;

/** The live model, or null in offline mode so the deterministic fallback is used. */
function getModel() {
  return isAiLive() ? getTextModel("onboarding") : null;
}

interface PickInput {
  quiz_answers: QuizAnswers;
  org_name: string;
  deterministic_default: { template_id: TemplateId; theme_id: ThemeId };
}

function buildPrompt(input: PickInput): string {
  // The catalog is the frontend's own template metadata (id, display name,
  // description and the theme each template is designed to pair with). Giving
  // the AI model the descriptions, not just bare ids, is what lets it pick the
  // right one of ~29 niche templates instead of guessing from the slug.
  const catalog = TEMPLATE_CATALOG.map(
    (t) =>
      `- ${t.id} (pairs with theme: ${t.recommendedThemeId}), ${t.name}: ${t.description}`,
  ).join("\n");

  return [
    `You are picking the best homepage template + theme for an Indian creator's learning academy.`,
    ``,
    `Quiz answers (JSON):`,
    JSON.stringify(input.quiz_answers, null, 2),
    ``,
    `Organization name: "${input.org_name}"`,
    ``,
    `Available templates, pick the ONE whose description best fits the creator's niche, category, organization name and current tools:`,
    catalog,
    ``,
    `Available theme ids: ${ALL_THEME_IDS.join(", ")}`,
    ``,
    `Deterministic baseline (a safe default, override it whenever a template above is a clearly better niche match):`,
    `  template_id: ${input.deterministic_default.template_id}`,
    `  theme_id: ${input.deterministic_default.theme_id}`,
    ``,
    `Rules:`,
    `- template_id MUST be exactly one id from the "Available templates" list above (${ALL_TEMPLATE_IDS.length} options).`,
    `- Prefer the MOST SPECIFIC niche match. Examples: quantitative / algorithmic / derivatives trading → quant-finance (dark) or quant-institute (light, career/bootcamp-focused); general stock-market or trading academy → finance-markets; investing / personal finance → finance; cooking, baking or food → cooking; music, audio or performance → music; kids, school or tutoring → kids; arts, crafts or painting → arts-crafts; coding / software / bootcamp → code-tech.`,
    `- For theme_id, use the picked template's paired theme shown in parentheses, UNLESS the organization name or answers strongly imply a different mood.`,
    `- When multiple variants of the same niche fit equally well, choose the base one (e.g. cooking over cooking-studio, music over music-vibe, finance over finance-clean, arts-crafts over arts-gallery).`,
    `- theme_id MUST be one of the Available theme ids.`,
    `- Keep the rationale concise (≤ 2 sentences).`,
  ].join("\n");
}

class AcademyPickAIService {
  /**
   * Pick the best (template_id, theme_id) for an academy from quiz answers.
   *
   * This is the SOLE the AI model call in the auto-provisioning flow, content
   * for every page section is generated separately by pageAIService
   * (the same engine the rich AI page wizard uses). Keeping this call
   * tightly scoped means it's fast, cheap, and never produces content
   * that will be discarded.
   *
   * Never throws, provisioning continues with the deterministic default
   * if the AI model is unavailable.
   */
  async pickTemplateAndTheme(
    input: PickInput,
  ): Promise<{
    pick: TemplateThemePick;
    source: "ai" | "fallback";
    latency_ms: number;
  }> {
    const startedAt = Date.now();
    const model = getModel();
    if (!model) {
      logger.warn(
        "AI provider offline, using deterministic template/theme pick for academy provisioning",
      );
      return {
        pick: {
          template_id: input.deterministic_default.template_id,
          theme_id: input.deterministic_default.theme_id,
          rationale: "Deterministic default (AI provider offline).",
        },
        source: "fallback",
        latency_ms: 0,
      };
    }

    try {
      const result = await Promise.race([
        generateText({
          model,
          output: Output.object({ schema: templatePickSchema }),
          prompt: buildPrompt(input),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("the AI model request timed out")),
            AI_TIMEOUT_MS,
          ),
        ),
      ]);
      const raw = result.output as TemplateThemePick;
      const pick = { ...raw, rationale: raw.rationale.slice(0, 280) };
      const latency = Date.now() - startedAt;
      logger.info(
        `the AI model template pick in ${latency}ms (template=${pick.template_id}, theme=${pick.theme_id})`,
      );
      return { pick, source: "ai", latency_ms: latency };
    } catch (error) {
      const latency = Date.now() - startedAt;
      logger.warn(
        `the AI model template pick failed after ${latency}ms, falling back to deterministic default: ${error instanceof Error ? error.message : "unknown"}`,
      );
      return {
        pick: {
          template_id: input.deterministic_default.template_id,
          theme_id: input.deterministic_default.theme_id,
          rationale: "Deterministic default (the AI model call failed).",
        },
        source: "fallback",
        latency_ms: latency,
      };
    }
  }
}

export default new AcademyPickAIService();
