/**
 * The one place AI authoring talks to a model.
 *
 * AI_PROVIDER selects the backend:
 *   openai   any OpenAI-compatible chat completions API: OpenAI, Azure OpenAI,
 *            OpenRouter, Ollama, vLLM, LM Studio, Gemini's OpenAI endpoint...
 *            Configured by AI_BASE_URL, AI_API_KEY and AI_TEXT_MODEL.
 *   offline  no network. A deterministic local model that answers structured
 *            requests with data shaped by the requested JSON schema and plain
 *            requests with text built from the prompt, so every authoring flow
 *            works in a demo without a key.
 * The default is openai when AI_API_KEY is set, otherwise offline.
 *
 * Image generation (thumbnails, covers, page images) is optional: it runs only
 * when AI_PROVIDER=openai and AI_IMAGE_MODEL is set. Callers already tolerate a
 * missing image.
 *
 * Callers use the AI SDK as usual (generateText / generateObject / Output) and
 * take their model from getTextModel(); recordUsage() is the hook for metering.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { generateImage as sdkGenerateImage, type LanguageModel } from "ai";
import { MockLanguageModelV3 } from "ai/test";

import config from "../../config";
import logger from "../../utils/logger";
import { offlineJsonFromSchema, offlineText } from "./offline";

export type AiPurpose =
  | "course"
  | "course_title"
  | "book"
  | "batch"
  | "page"
  | "onboarding"
  | "quiz"
  | "assignment"
  | "test"
  | "test_series"
  | "question_import"
  | "site_health";

export type AiMode = "openai" | "offline";

export function aiMode(): AiMode {
  return config.AI_PROVIDER === "openai" && !!config.AI_API_KEY ? "openai" : "offline";
}

/** True when a real model answers (not the offline engine). */
export function isAiLive(): boolean {
  return aiMode() === "openai";
}

/** Authoring always works: the offline engine stands in when no key is set. */
export function isAiConfigured(): boolean {
  return true;
}

let openaiProvider: ReturnType<typeof createOpenAI> | null = null;
function openai(): ReturnType<typeof createOpenAI> {
  if (!openaiProvider) {
    openaiProvider = createOpenAI({
      baseURL: config.AI_BASE_URL,
      apiKey: config.AI_API_KEY,
      name: "openai-compatible",
    });
  }
  return openaiProvider;
}

/** Per-purpose model override: AI_MODEL_<PURPOSE>, e.g. AI_MODEL_PAGE. */
function modelIdFor(purpose: AiPurpose): string {
  return process.env[`AI_MODEL_${purpose.toUpperCase()}`] || config.AI_TEXT_MODEL;
}

const offlineModels = new Map<AiPurpose, LanguageModel>();

function offlineModel(purpose: AiPurpose): LanguageModel {
  const cached = offlineModels.get(purpose);
  if (cached) return cached;
  const model = new MockLanguageModelV3({
    provider: "offline",
    modelId: `offline-${purpose}`,
    doGenerate: async (options) => {
      const promptText = options.prompt
        .map((m) =>
          typeof m.content === "string"
            ? m.content
            : m.content
                .map((p) => ("text" in p && typeof p.text === "string" ? p.text : ""))
                .join("\n")
        )
        .join("\n");
      const format = options.responseFormat;
      const text =
        format?.type === "json"
          ? JSON.stringify(offlineJsonFromSchema(format.schema, promptText))
          : offlineText(promptText);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
  offlineModels.set(purpose, model);
  return model;
}

/** The language model for a purpose. */
export function getTextModel(purpose: AiPurpose): LanguageModel {
  if (aiMode() === "offline") return offlineModel(purpose);
  return openai().chat(modelIdFor(purpose));
}

/** The model id reported in logs and stored alongside generated content. */
export function getTextModelId(purpose: AiPurpose): string {
  return aiMode() === "offline" ? `offline-${purpose}` : modelIdFor(purpose);
}

// ─── Images ──────────────────────────────────────────────────────────────────

export function imageGenerationEnabled(): boolean {
  return aiMode() === "openai" && !!config.AI_IMAGE_MODEL;
}

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

const ASPECT_TO_SIZE: Record<string, `${number}x${number}`> = {
  "1:1": "1024x1024",
  "16:9": "1536x1024",
  "4:3": "1536x1024",
  "3:2": "1536x1024",
  "9:16": "1024x1536",
  "3:4": "1024x1536",
  "2:3": "1024x1536",
};

/**
 * Generates one image. Returns null when image generation is off or fails, so
 * callers can skip the image and keep the rest of the content.
 */
export async function generateImage(opts: {
  purpose: AiPurpose;
  prompt: string;
  aspectRatio?: string;
}): Promise<GeneratedImage | null> {
  if (!imageGenerationEnabled()) return null;
  try {
    const { image, usage } = await sdkGenerateImage({
      model: openai().image(config.AI_IMAGE_MODEL),
      prompt: opts.prompt,
      size: ASPECT_TO_SIZE[opts.aspectRatio ?? "16:9"] ?? "1536x1024",
    });
    recordUsage({ purpose: opts.purpose, kind: "image", model: config.AI_IMAGE_MODEL, usage });
    return { base64: image.base64, mimeType: image.mediaType || "image/png" };
  } catch (err) {
    logger.warn("[ai] image generation failed", {
      purpose: opts.purpose,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ─── Metering ────────────────────────────────────────────────────────────────

export interface AiUsageEvent {
  purpose: AiPurpose;
  kind: "text" | "image";
  model?: string;
  tenantId?: string;
  usage?: unknown;
}

/**
 * Metering hook. A no-op apart from a debug log; plug a ledger in here to
 * bill or cap AI spend per tenant.
 */
export function recordUsage(event: AiUsageEvent): void {
  logger.debug?.("[ai] usage", event);
}
