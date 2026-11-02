import { generateObject, generateText } from "ai";
import type { LanguageModel } from "ai";
import sharp from "sharp";
import { z } from "zod";

import { BadRequestError } from "../errors/bad-request.error";
import {
  generateImage,
  getTextModel as getProviderTextModel,
  imageGenerationEnabled,
  recordUsage,
} from "../lib/ai/provider";

async function getTextModel(): Promise<LanguageModel> {
  return getProviderTextModel("test_series");
}

const TitleSchema = z.object({
  title: z
    .string()
    .min(4)
    .max(80)
    .describe(
      "A concise, descriptive title for a test series (4-80 characters). No emojis."
    ),
});

class TestSeriesAIService {
  /**
   * Generate a short title for a test series. The admin's topic/category is
   * used as bias; the LLM produces a single string.
   */
  async generateTitle(args: {
    topic?: string | null;
    category?: string | null;
  }): Promise<string> {
    const model = await getTextModel();
    const hints = [
      args.topic ? `Topic: ${args.topic}` : null,
      args.category ? `Category/exam: ${args.category}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const prompt = [
      "You are naming a TEST SERIES (a curated bundle of mock tests for exam preparation).",
      "Produce a single concise title, 4 to 80 characters, plain text, no emojis, no quotes.",
      "Prefer clarity over cleverness. Mention the exam name when given.",
      hints || "No additional hints provided.",
    ].join("\n\n");

    const { object, usage } = await generateObject({
      model,
      schema: TitleSchema,
      prompt,
      maxOutputTokens: 200,
      temperature: 0.6,
    });
    // Metered only when the agent triggered this (no-op from the dashboard).
    recordUsage({ purpose: "test_series", kind: "text", usage });
    return object.title.trim();
  }

  /**
   * Generate a 2-4 sentence description for a test series. Returns plain
   * text, no markdown.
   */
  async generateDescription(args: {
    title: string;
    category?: string | null;
    extraContext?: string | null;
  }): Promise<string> {
    const model = await getTextModel();
    const prompt = [
      "Write a marketing description for a TEST SERIES (curated mock tests for exam preparation).",
      "Audience: students preparing for the exam. Tone: confident and practical.",
      "Length: 2 to 4 sentences. Plain text. No markdown, no emojis, no headings.",
      `Title: ${args.title}`,
      args.category ? `Category/exam: ${args.category}` : "",
      args.extraContext ? `Extra context: ${args.extraContext}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { text, usage } = await generateText({
      model,
      prompt,
      maxOutputTokens: 400,
      temperature: 0.7,
    });
    recordUsage({ purpose: "test_series", kind: "text", usage });
    return text.trim();
  }

  /**
   * Generate a 16:9 cover banner for a test series. Returns a webp data URL
   * ready to be uploaded via the existing upload service. Uses the AI
   * provider image model, mirroring the course thumbnail pipeline.
   */
  async generateCover(args: {
    title: string;
    category?: string | null;
    description?: string | null;
  }): Promise<string> {
    if (!imageGenerationEnabled()) {
      throw new BadRequestError(
        "AI cover generation is not configured (set AI_IMAGE_MODEL)."
      );
    }

    // Prompt mirrors the (working) course-thumbnail pipeline: the TITLE is the
    // ONLY text rendered, with strict text-integrity guards. The category and
    // description are used as VISUAL THEME hints only and must NOT be drawn as
    // text, feeding extra text strings is what caused garbled/duplicated
    // lettering in the generated banner.
    const prompt = `Create a professional 16:9 LANDSCAPE banner image for an online TEST SERIES catalog card and detail hero. The design must FILL THE ENTIRE CANVAS with NO borders, NO margins, and NO empty white/gray space around the edges.

Text to incorporate (this is the ONLY text allowed in the image):
- Title: "${args.title}" (display prominently as the hero element, large, bold, high-contrast, cleanly legible typography)

Visual theme (use ONLY to inspire the artwork, do NOT render any of this as text):
- Exam-preparation motifs: question papers, answer sheets, clocks, charts, OMR bubble sheets, study desks, upward-growth / rocket-to-success imagery.${args.category ? `\n- Subject/exam focus: ${args.category}.` : ""}${args.description ? `\n- Mood/context: ${args.description}.` : ""}

Design requirements:
1. Layout: title on the LEFT ~60%, a clear focal illustration/subject on the RIGHT ~40%.
2. Colors: vibrant, bright, and saturated, confident, achievement-oriented (deep blues, greens, purples with bright glowing accents). Well-lit, high energy. Do NOT make it dark, dull, washed-out, faded, or low-contrast.
3. The image must have a clear, crisp, well-defined subject and composition: NOT a blurry, foggy, or murky gradient.
4. Quality: modern, premium, publication-ready, layered gradients, subtle depth, professional graphic-design polish.

CRITICAL: TEXT INTEGRITY:
- The ONLY text rendered in the image is the Title above. Render it spelled EXACTLY and correctly, never truncated, garbled, or misspelled. Double-check the spelling before rendering.
- Do NOT render the subject, description, mood, instructor names, dates, organizations, numbers, or any other words/metadata as text anywhere in the image.`;

    const image = await generateImage({ purpose: "test_series", prompt, aspectRatio: "16:9" });
    const base64 = image?.base64;
    if (!base64) {
      throw new BadRequestError("Image generator returned no image data.");
    }

    const inputBuffer = Buffer.from(base64, "base64");
    const optimized = await sharp(inputBuffer).rotate().webp({ quality: 85 }).toBuffer();
    return `data:image/webp;base64,${optimized.toString("base64")}`;
  }
}

export default new TestSeriesAIService();
