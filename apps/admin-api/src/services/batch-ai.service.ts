/**
 * Batch AI generation service.
 *
 * Mirrors `book-ai.service.ts`: per-section text generation via the AI
 * provider (src/lib/ai/provider.ts) + optional thumbnail generation + sharp optimisation.
 * Sections supported:
 *  - subtitle           (one-liner shown under the title)
 *  - description        (2-3 paragraph marketing copy)
 *  - learningOutcomes   (4-6 bullet points)
 *  - webThumbnail       (16:9 desktop image, base64 data URL)
 *  - mobileThumbnail    (3:4 portrait image, base64 data URL)
 *
 * Returns a `GeneratedBatchContent` partial, the worker stitches multiple
 * section calls into a single result and the modal applies them to the batch
 * via existing API endpoints.
 */

import sharp from "sharp";

import { generateText } from "ai";

import { BadRequestError } from "../errors/bad-request.error";
import {
  generateImage,
  getTextModel,
  imageGenerationEnabled,
  recordUsage,
} from "../lib/ai/provider";
import logger from "../utils/logger";

export type BatchAISectionKey =
  | "subtitle"
  | "description"
  | "learningOutcomes"
  | "webThumbnail"
  | "mobileThumbnail";

export const ALL_BATCH_AI_SECTION_KEYS: BatchAISectionKey[] = [
  "subtitle",
  "description",
  "learningOutcomes",
  "webThumbnail",
  "mobileThumbnail",
];

export interface BatchThumbnailContext {
  startDate?: string;
  organizationName?: string;
  instructorNames?: string[];
  language?: string;
  durationLabel?: string;
}

export interface GenerateBatchContentParams {
  batchTitle: string;
  sections: BatchAISectionKey[];
  extraContext?: string;
  referenceDocument?: string;
  thumbnailContext?: BatchThumbnailContext;
}

export interface GeneratedBatchContent {
  subtitle?: string;
  description?: string;
  learningOutcomes?: string[];
  webThumbnailDataUrl?: string;
  mobileThumbnailDataUrl?: string;
}

class BatchAIService {
  async generateContent(
    params: GenerateBatchContentParams
  ): Promise<GeneratedBatchContent> {
    const {
      batchTitle,
      sections,
      extraContext,
      referenceDocument,
      thumbnailContext,
    } = params;

    if (!batchTitle?.trim()) {
      throw new BadRequestError("Batch title is required");
    }
    const validSections = sections.filter((s) =>
      ALL_BATCH_AI_SECTION_KEYS.includes(s)
    );
    if (validSections.length === 0) {
      throw new BadRequestError("At least one valid section is required");
    }

    const totalStart = Date.now();
    logger.info(
      `[BatchAI] Starting generation for "${batchTitle}", sections: [${validSections.join(", ")}]`
    );

    const result: GeneratedBatchContent = {};
    const promises: Promise<void>[] = [];

    if (validSections.includes("subtitle")) {
      promises.push(
        this.generateSubtitle(batchTitle, extraContext, referenceDocument).then(
          (s) => {
            result.subtitle = s;
          }
        )
      );
    }
    if (validSections.includes("description")) {
      promises.push(
        this.generateDescription(batchTitle, extraContext, referenceDocument).then(
          (d) => {
            result.description = d;
          }
        )
      );
    }
    if (validSections.includes("learningOutcomes")) {
      promises.push(
        this.generateLearningOutcomes(
          batchTitle,
          extraContext,
          referenceDocument
        ).then((outcomes) => {
          result.learningOutcomes = outcomes;
        })
      );
    }
    if (validSections.includes("webThumbnail") && imageGenerationEnabled()) {
      promises.push(
        this.generateThumbnail(batchTitle, "web", thumbnailContext, extraContext).then(
          (url) => {
            result.webThumbnailDataUrl = url;
          }
        )
      );
    }
    if (validSections.includes("mobileThumbnail") && imageGenerationEnabled()) {
      promises.push(
        this.generateThumbnail(
          batchTitle,
          "mobile",
          thumbnailContext,
          extraContext
        ).then((url) => {
          result.mobileThumbnailDataUrl = url;
        })
      );
    }

    try {
      await Promise.all(promises);
      logger.info(
        `[BatchAI] Completed generation for "${batchTitle}" in ${Date.now() - totalStart}ms`
      );
      return result;
    } catch (error) {
      logger.error(
        `[BatchAI] Error generating content after ${Date.now() - totalStart}ms:`,
        error
      );
      if (error instanceof BadRequestError) throw error;
      throw new BadRequestError(
        `Failed to generate batch content: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // ─── Text generation helpers ───────────────────────────────────────────

  private async callTextModel(prompt: string): Promise<string> {
    const { text, usage } = await generateText({
      model: getTextModel("batch"),
      prompt,
      temperature: 0.7,
      maxOutputTokens: 4096,
      maxRetries: 2,
    });
    if (!text?.trim()) {
      throw new BadRequestError("AI did not produce any output. Please try again.");
    }
    recordUsage({ purpose: "batch", kind: "text", usage });
    return text.trim();
  }

  private contextSuffix(extra?: string, refDoc?: string): string {
    const refDocSection = refDoc
      ? `\n\n=== REFERENCE DOCUMENT ===\n${refDoc.slice(0, 30000)}\n=== END REFERENCE DOCUMENT ===`
      : "";
    const adminInstructions = extra
      ? `\nADMINISTRATOR INSTRUCTIONS:\n${extra.slice(0, 5000)}`
      : "";
    return `${refDocSection}${adminInstructions}`;
  }

  private async generateSubtitle(
    batchTitle: string,
    extra?: string,
    refDoc?: string
  ): Promise<string> {
    const prompt = `Write a single-sentence subtitle (8–14 words) for a cohort-based learning batch titled "${batchTitle}".${this.contextSuffix(extra, refDoc)}

RULES:
- Output ONLY the subtitle. No preamble, no quotes, no markdown.
- Keep it concrete and audience-focused: who's it for, what they'll achieve.
- No emojis.`;
    const text = await this.callTextModel(prompt);
    return text.replace(/^["']|["']$/g, "").trim();
  }

  private async generateDescription(
    batchTitle: string,
    extra?: string,
    refDoc?: string
  ): Promise<string> {
    const prompt = `Write a comprehensive marketing description (4–6 paragraphs, 400–700 words total) for a cohort-based learning batch titled "${batchTitle}".${this.contextSuffix(extra, refDoc)}

RULES:
- Start DIRECTLY with the description. No "Okay", no preamble.
- Plain professional prose. No headings, no bullets, no markdown.
- Cover thoroughly: who it's for, what learners will master, the curriculum highlights, why a live cohort format helps, the outcomes they can expect, and any standout aspects of the batch.
- Use the administrator instructions and reference document above (if provided) to weave in specifics, do NOT ignore them and do NOT paste them verbatim.
- Avoid superlatives like "amazing" or "ultimate". Keep claims concrete.`;
    return this.callTextModel(prompt);
  }

  private async generateLearningOutcomes(
    batchTitle: string,
    extra?: string,
    refDoc?: string
  ): Promise<string[]> {
    const prompt = `List 5–6 specific learning outcomes for a cohort-based learning batch titled "${batchTitle}".${this.contextSuffix(extra, refDoc)}

RULES:
- Each outcome on its own line.
- Each outcome starts with a verb (Build, Master, Design, Implement, Ship, Apply, Diagnose, etc.).
- Each outcome is concrete and observable, something a learner can demonstrate.
- 8–14 words per outcome.
- Do NOT number the lines, do NOT use bullets, just plain text, one per line.
- Do NOT add preamble or trailing commentary.`;
    const raw = await this.callTextModel(prompt);
    return raw
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\d.\s)]+/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 6);
  }

  // ─── Thumbnail generation ──────────────────────────────────────────────

  private async generateThumbnail(
    batchTitle: string,
    slot: "web" | "mobile",
    ctx?: BatchThumbnailContext,
    extra?: string
  ): Promise<string> {
    const aspect = slot === "web" ? "16:9" : "3:4";
    const orgLine = ctx?.organizationName
      ? `\n- Include "${ctx.organizationName}" subtly as a small badge or footer.`
      : "";
    const startLine = ctx?.startDate
      ? `\n- Highlight the cohort start date "${ctx.startDate}" as a small accent label.`
      : "";
    const instructorsLine = ctx?.instructorNames?.length
      ? `\n- Mention the lead instructor(s): ${ctx.instructorNames.slice(0, 2).join(", ")}.`
      : "";
    const langLine = ctx?.language ? `\n- Language: ${ctx.language}.` : "";
    const extraLine = extra
      ? `\nAdditional context (do not paste verbatim, just use as design hint): ${extra.slice(0, 1000)}`
      : "";

    const prompt = `Design a polished promotional cover image for a cohort-based learning batch.

Batch Title: "${batchTitle}"
Layout: ${aspect} aspect ratio (${slot === "web" ? "wide landscape" : "tall portrait for phones"}).${orgLine}${startLine}${instructorsLine}${langLine}${extraLine}

Design Requirements:
1. Display the batch title "${batchTitle}" prominently with high contrast and clean typography.
2. Use a modern, premium aesthetic, gradient backgrounds, soft glows, depth, glassmorphism allowed.
3. Add subtle visual elements that hint at the subject matter (icons, shapes, abstract patterns), never photographs of people.
4. The composition must be balanced and readable at thumbnail size.
5. ZERO spelling errors. Only render words that are explicitly listed above.
6. No watermarks, no stock-photo logos, no fake URLs.

CRITICAL: TEXT INTEGRITY:
- ONLY render text that is explicitly provided in this brief.
- If a piece of text isn't listed, do NOT invent author names, publishers, dates, or taglines.`;

    const start = Date.now();
    logger.info(`[BatchAI] Generating ${slot} thumbnail for "${batchTitle}"`);

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const image = await generateImage({ purpose: "batch", prompt, aspectRatio: aspect });
        const base64Data = image?.base64;
        if (!base64Data) {
          throw new BadRequestError(
            "AI did not generate a thumbnail. Please try again."
          );
        }
        const inputBuffer = Buffer.from(base64Data, "base64");
        const optimized = await sharp(inputBuffer)
          .rotate()
          .webp({ quality: 85 })
          .toBuffer();
        logger.info(
          `[BatchAI] ${slot} thumbnail generated in ${Date.now() - start}ms`
        );
        return `data:image/webp;base64,${optimized.toString("base64")}`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        const isQuotaError =
          /resource\s*exhaust|rate\s*limit|quota|429/i.test(message);
        logger.error(
          `[BatchAI] Error generating ${slot} thumbnail (attempt ${attempt}/${maxAttempts}) after ${Date.now() - start}ms: ${message}`
        );
        if (isQuotaError && attempt < maxAttempts) {
          const delayMs = 1000 * Math.pow(3, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        if (error instanceof BadRequestError) throw error;
        if (isQuotaError) {
          throw new BadRequestError(
            "AI quota is currently exhausted. Please try again in a few minutes."
          );
        }
        throw new BadRequestError(
          `Failed to generate batch ${slot} thumbnail: ${message}`
        );
      }
    }
    throw new BadRequestError(
      "AI quota is currently exhausted. Please try again in a few minutes."
    );
  }
}

const batchAIService = new BatchAIService();
export default batchAIService;
