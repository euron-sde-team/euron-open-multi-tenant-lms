import { generateObject, generateText, jsonSchema } from "ai";
import sharp from "sharp";
import { ulid } from "ulid";
import { BadRequestError } from "../errors/bad-request.error";
import logger from "../utils/logger";
import tenantOrgContextCache, { type TenantOrgContext } from "./tenant-org-context.cache";
import tenantOrgS3Service from "./tenant-org.s3.service";
import {
  generateImage as generateAiImage,
  getTextModel,
  imageGenerationEnabled,
  isAiLive,
  recordUsage,
} from "../lib/ai/provider";


// ─── Types ───────────────────────────────────────────────────────────────────

export interface GenerateSectionParams {
  sectionType: string;
  prompt: string;
  businessContext?: string;
  tenantId?: string;
  pageLayout?: { type: string; order: number }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientSchema?: Record<string, any>;
  clientInstructions?: string;
}

export interface GeneratedSectionResult {
  sectionType: string;
  content: Record<string, unknown>;
  orgLogos?: {
    light: string | null;
    dark: string | null;
  };
}

export interface PlanPageParams {
  prompt: string;
  businessContext?: string;
  tenantId?: string;
  availableSections: { type: string; label: string; description: string }[];
}

export interface PlanPageResult {
  /** An enriched description of the business, used as context when writing each section. */
  enhancedSummary: string;
  /** Ordered blueprint of the page: which section types, in what order, and what each should contain. */
  sections: { type: string; brief: string }[];
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function sanitizeString(val: string): string {
  let result = val;
  // Decode literal escape sequences the model sometimes emits as raw text
  // instead of the real character: a unicode escape shows up verbatim (a plus
  // sign as backslash-u-002b, a percent as backslash-u-0025) and a line break
  // shows up as a literal backslash-n. Decode these first so the entity and
  // markdown passes below operate on the real characters.
  result = result.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  result = result.replace(/\\r\\n|\\n|\\r|\\t/g, " ");
  result = result.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
  result = result.replace(/<[^>]*>/g, "");
  result = result.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
  result = result.replace(/^#{1,6}\s+/gm, "");
  result = result.replace(/[ \t]+/g, " ").trim();
  return result;
}

function deepSanitize<T>(obj: T): T {
  if (typeof obj === "string") return sanitizeString(obj) as T;
  if (Array.isArray(obj)) return obj.map(deepSanitize) as T;
  if (obj !== null && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      sanitized[key] = deepSanitize(val);
    }
    return sanitized as T;
  }
  return obj;
}

// ─── Prompt Building ─────────────────────────────────────────────────────────

function buildOrgAwareSystemPrompt(orgContext: TenantOrgContext, businessPrompt: string, businessContext?: string): string {
  const parts: string[] = [];

  parts.push("You are a professional UX copywriter generating website content.");

  const orgLines: string[] = [`ORG: ${orgContext.tenantName}`];
  if (orgContext.tagline) orgLines.push(`Tagline: ${orgContext.tagline}`);
  if (orgContext.description) orgLines.push(`About: ${orgContext.description}`);
  if (orgContext.industry) orgLines.push(`Industry: ${orgContext.industry}`);
  if (orgContext.yearEstablished) orgLines.push(`Est: ${orgContext.yearEstablished}`);
  if (orgContext.founderName) orgLines.push(`Founder: ${orgContext.founderName}${orgContext.founderTitle ? ` (${orgContext.founderTitle})` : ""}`);
  if (orgContext.socialLinks?.website) orgLines.push(`Website: ${orgContext.socialLinks.website}`);
  if (orgContext.legalEntityName) orgLines.push(`Legal entity: ${orgContext.legalEntityName}`);
  if (orgContext.contactEmail) orgLines.push(`Email: ${orgContext.contactEmail}`);
  if (orgContext.phoneNumbers?.length) orgLines.push(`Phone: ${orgContext.phoneNumbers[0]}`);
  if (orgContext.address) {
    const a = orgContext.address;
    const addrParts = [a.line1, a.city, a.state, a.country].filter(Boolean);
    if (addrParts.length > 0) orgLines.push(`Address: ${addrParts.join(", ")}`);
  }
  parts.push(orgLines.join("\n"));

  parts.push(`BUSINESS DESCRIPTION: ${businessPrompt}`);
  if (businessContext) parts.push(`ADDITIONAL CONTEXT: ${businessContext}`);

  parts.push(`RULES:
- Always use "${orgContext.tenantName}", never invent a name
- ${orgContext.industry ? `Use ${orgContext.industry} vocabulary` : "Match industry vocabulary"}
- Keep copy concise, headlines ≤8 words, descriptions ≤2 sentences
OUTPUT: Plain text only. No HTML, markdown, or encoded entities.`);

  return parts.join("\n\n");
}

function buildPageLayoutPrompt(currentSection: string, pageLayout?: { type: string; order: number }[]): string {
  if (!pageLayout || pageLayout.length <= 1) return "";

  const layoutDesc = pageLayout
    .sort((a, b) => a.order - b.order)
    .map((s) => `${s.order + 1}. ${s.type}${s.type === currentSection ? " ← (this section)" : ""}`)
    .join("\n");

  return `PAGE LAYOUT (generate content that complements the other sections, avoid repeating headlines or ideas):\n${layoutDesc}`;
}

// ─── Service ─────────────────────────────────────────────────────────────────

class PageAIService {
  async generateSection(params: GenerateSectionParams): Promise<GeneratedSectionResult> {
    const { sectionType, prompt, businessContext, pageLayout, clientSchema, clientInstructions, tenantId } = params;

    if (!clientSchema) {
      throw new BadRequestError(`No schema provided for section type: ${sectionType}. Register it in the frontend section-ai-configs.`);
    }

    const orgContext = tenantId ? await tenantOrgContextCache.get(tenantId) : null;
    const orgLogos = orgContext
      ? { light: orgContext.logoLightUrl, dark: orgContext.logoDarkUrl }
      : undefined;

    try {
      // Build prompt
      let basePrompt: string;
      if (orgContext) {
        const systemPrompt = buildOrgAwareSystemPrompt(orgContext, prompt, businessContext);
        const layoutPrompt = buildPageLayoutPrompt(sectionType, pageLayout);
        basePrompt = [systemPrompt, layoutPrompt].filter(Boolean).join("\n\n");
      } else {
        let fallback = `You are a professional UX copywriter generating website content.\n\nBUSINESS DESCRIPTION: ${prompt}`;
        if (businessContext) fallback += `\n\nADDITIONAL CONTEXT: ${businessContext}`;
        fallback += `\n\nOUTPUT: Plain text only. No HTML, markdown, or encoded entities.`;
        const layoutPrompt = buildPageLayoutPrompt(sectionType, pageLayout);
        basePrompt = [fallback, layoutPrompt].filter(Boolean).join("\n\n");
      }

      const fullPrompt = [basePrompt, clientInstructions].filter(Boolean).join("\n\n");

      const { object, usage } = await generateObject({
        model: getTextModel("page"),
        schema: jsonSchema(clientSchema),
        prompt: fullPrompt,
        maxOutputTokens: 6000,
        temperature: 0.7,
      });
      // Metered only when the agent triggered this (no-op from the dashboard).
      recordUsage({ purpose: "page", kind: "text", usage });

      if (!object) {
        throw new BadRequestError("AI failed to generate content, empty response");
      }

      return {
        sectionType,
        content: deepSanitize(object as Record<string, unknown>),
        orgLogos,
      };
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Page AI generation failed", { error: errorMessage, sectionType });
      throw new BadRequestError(`Failed to generate ${sectionType} content: ${errorMessage}`);
    }
  }

  /**
   * Page architect: turn a (possibly terse) business/page description into an
   * ORDERED blueprint of sections chosen from the caller-supplied catalog, plus
   * an enriched summary used to write each section. This is what lets a single
   * prompt restructure the WHOLE page (not just refill existing sections).
   */
  /**
   * Research brief: asks the model for the facts it knows about the
   * business/topic so the page copy is specific. Returns a brief (empty string
   * on failure or in offline mode; generation continues without it). Kept
   * separate from the structured planner call.
   */
  private async researchBusiness(
    prompt: string,
    businessContext?: string,
    orgContext?: TenantOrgContext | null
  ): Promise<string> {
    if (!isAiLive()) return "";
    try {
      const name = orgContext?.tenantName ? ` for "${orgContext.tenantName}"` : "";
      const { text, usage } = await generateText({
        model: getTextModel("page"),
        temperature: 0.3,
        maxOutputTokens: 1500,
        prompt:
          `Write a concise factual brief about this business/page topic${name} that a copywriter will use to build an accurate landing page.\n` +
          `Include concrete specifics you are confident about: what it is, key programs/offerings, target audience, real numbers (dates, prices, scholarships, exam pattern, eligibility, stats), notable differentiators, and the right tone. Use 8-14 short bullet points. Do NOT invent facts; if unknown, omit.\n\n` +
          `TOPIC:\n${prompt}` +
          (businessContext ? `\n\nCONTEXT:\n${businessContext}` : ""),
      });
      recordUsage({ purpose: "page", kind: "text", usage });
      return sanitizeString(text || "").slice(0, 2500);
    } catch (error) {
      logger.warn("[page-ai] research step failed; continuing without grounding", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "";
    }
  }

  async planPage(params: PlanPageParams): Promise<PlanPageResult> {
    const { prompt, businessContext, tenantId, availableSections } = params;

    if (!availableSections?.length) {
      throw new BadRequestError("No section catalog provided to plan the page.");
    }

    const allowed = new Set(availableSections.map((s) => s.type));
    const catalog = availableSections
      .map((s) => `- ${s.type}: ${s.label}${s.description ? `, ${s.description}` : ""}`)
      .join("\n");

    let orgContext: TenantOrgContext | null = null;
    try {
      orgContext = tenantId ? await tenantOrgContextCache.get(tenantId) : null;
    } catch {
      // non-critical
    }
    const orgLine = orgContext
      ? `ORG: ${orgContext.tenantName}${orgContext.industry ? ` (${orgContext.industry})` : ""}${orgContext.tagline ? `, ${orgContext.tagline}` : ""}`
      : "";

    // Grounded market research first, real web facts so the page is accurate,
    // not hallucinated. Flows into both the structure and every section's copy.
    const research = await this.researchBusiness(prompt, businessContext, orgContext);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planSchema: Record<string, any> = {
      type: "object",
      properties: {
        enhancedSummary: {
          type: "string",
          description:
            "A rich 2-4 sentence description of the business/page, expanded from the user's prompt. Used to write every section's copy.",
        },
        sections: {
          type: "array",
          description: "The ordered list of sections that make up the page, top to bottom.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "A section type that EXACTLY matches one from the catalog.",
              },
              brief: {
                type: "string",
                description:
                  "One concise sentence describing what THIS section should contain for this specific page.",
              },
            },
            required: ["type", "brief"],
          },
        },
      },
      required: ["enhancedSummary", "sections"],
    };

    const system = [
      "You are an expert landing-page architect and conversion strategist.",
      "Given a business/page description and a CATALOG of available section types, design the BEST page for it: an ORDERED list of sections that tells a complete, persuasive, top-to-bottom story.",
      "RULES:",
      "- Begin with a hero section. End with a strong call-to-action (and a contact/footer-style section if one exists in the catalog).",
      "- Choose 6-14 sections. Cover everything the description implies, e.g. stats/counters, features/benefits, pricing or scholarship tiers, FAQ, testimonials, timeline, team/faculty, gallery, logos.",
      "- Use ONLY `type` values that appear EXACTLY in the catalog. Never invent or rename a type.",
      "- Order is meaningful. Avoid duplicate section types unless the page clearly benefits.",
      "- Even when the user's prompt is short or vague, infer a comprehensive, professional, conversion-optimized page.",
      "Also write `enhancedSummary`: an enriched, specific description of the business used to generate each section's copy. Ground it in the RESEARCH BRIEF facts below when present.",
      orgLine,
      research ? `RESEARCH BRIEF (verified web facts, use these specifics):\n${research}` : "",
      `CATALOG (choose types from here):\n${catalog}`,
    ]
      .filter(Boolean)
      .join("\n");

    const userPrompt = [
      `BUSINESS / PAGE DESCRIPTION:\n${prompt}`,
      businessContext ? `ADDITIONAL CONTEXT:\n${businessContext}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const { object, usage } = await generateObject({
        model: getTextModel("page"),
        schema: jsonSchema(planSchema),
        system,
        prompt: userPrompt,
        // Generous budget so the blueprint never truncates mid-JSON (which
        // surfaces as "could not parse the response"), even for long prompts.
        maxOutputTokens: 8000,
        temperature: 0.6,
      });
      recordUsage({ purpose: "page", kind: "text", usage });

      const raw = (object ?? {}) as {
        enhancedSummary?: string;
        sections?: { type?: string; brief?: string }[];
      };
      const sections = (raw.sections ?? [])
        .filter((s) => s && typeof s.type === "string" && allowed.has(s.type))
        .map((s) => ({ type: s.type as string, brief: sanitizeString(String(s.brief ?? "")) }))
        .slice(0, 16);

      if (sections.length === 0) {
        throw new BadRequestError(
          "AI could not design a page from this description. Try adding a bit more detail."
        );
      }

      // Carry the verified research facts into the summary so every per-section
      // generation writes grounded, specific copy (not generic/hallucinated).
      const plannerSummary = sanitizeString(String(raw.enhancedSummary ?? prompt));
      const enhancedSummary = research
        ? `${plannerSummary}\n\nVERIFIED FACTS TO USE:\n${research}`.slice(0, 3000)
        : plannerSummary;

      return { enhancedSummary, sections };
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Page AI plan failed", { error: msg });
      throw new BadRequestError(`Failed to plan the page: ${msg}`);
    }
  }

  private async optimizeImage(base64Data: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const inputBuffer = Buffer.from(base64Data, "base64");
    const optimized = await sharp(inputBuffer).rotate().webp({ quality: 85 }).toBuffer();
    return { buffer: optimized, mimeType: "image/webp" };
  }

  /**
   * Map section types to descriptive template context for better image generation.
   */
  private getSectionTemplateContext(sectionType: string): string {
    const map: Record<string, string> = {
      "hero-code-tech": "a coding, programming, and technology education platform",
      "hero-examprep": "an IIT JEE / NEET exam preparation platform",
      "hero-govtexam": "a government exam preparation platform (UPSC, SSC, Banking)",
      "hero-mindfulness": "a mindfulness, meditation, and wellness education platform",
      "hero": "a landing page hero section",
      "about": "an about section",
      "about-page": "a dedicated about page",
      "about-photography": "a photography portfolio about section",
      "about-astrology": "an astrology and spiritual services about section",
      "about-examprep": "an exam preparation about section",
      "about-govtexam": "a government exam preparation about section",
      "cta-corpupskill": "a corporate upskilling call-to-action section",
      "solutions-grid-corpupskill": "a corporate training solutions grid section",
      "hero-slider-corpupskill": "a corporate upskilling hero slider section",
    };
    return map[sectionType] || "a website section";
  }

  async generateImage(
    prompt: string,
    tenantId: string,
    aspectRatio?: string,
    sectionContext?: {
      sectionType?: string;
      headline?: string;
      description?: string;
      badge?: string;
    }
  ): Promise<{ url: string }> {
    if (!imageGenerationEnabled()) {
      throw new BadRequestError("AI image generation is not configured (set AI_IMAGE_MODEL).");
    }

    try {
      let orgContext: TenantOrgContext | null = null;
      try {
        orgContext = await tenantOrgContextCache.get(tenantId);
      } catch {
        // Non-critical
      }

      // Build prompt, user's description is the PRIMARY directive
      const promptParts: string[] = [];

      // 1. PRIMARY: User's image description drives the generation
      promptParts.push(`Generate an image based on this description: "${prompt}".`);

      // 2. SUPPLEMENTARY: Section & page context as hints (not the main instruction)
      const contextHints: string[] = [];
      if (sectionContext?.sectionType) {
        const templateCtx = this.getSectionTemplateContext(sectionContext.sectionType);
        contextHints.push(`This image is for ${templateCtx}`);
      }
      if (sectionContext?.headline) {
        contextHints.push(`The page headline is: "${sectionContext.headline}"`);
      }
      if (sectionContext?.description) {
        contextHints.push(`The page describes: "${sectionContext.description}"`);
      }
      if (sectionContext?.badge) {
        contextHints.push(`Brand badge: "${sectionContext.badge}"`);
      }
      if (contextHints.length > 0) {
        promptParts.push(`Context: ${contextHints.join(". ")}.`);
      }

      // 3. Brand / org context as a visual style hint
      if (orgContext) {
        const brandHints: string[] = [];
        if (orgContext.industry) brandHints.push(`${orgContext.industry} industry`);
        if (orgContext.tagline) brandHints.push(`brand personality: "${orgContext.tagline}"`);
        if (brandHints.length > 0) {
          promptParts.push(`Visual style hint: ${brandHints.join(", ")}.`);
        }
      }

      // 4. Quality and constraint instructions
      promptParts.push(
        "The image should look professional, premium, and authentic, not like generic stock photography.",
        "CRITICAL: Do NOT include any text, words, letters, numbers, watermarks, logos, or written content of any kind in the image."
      );

      const finalPrompt = promptParts.join("\n\n");
      const imageAspectRatio = aspectRatio || "1:1";

      logger.info("Generating page image", {
        promptLength: finalPrompt.length,
        aspectRatio: imageAspectRatio,
        hasSectionContext: !!sectionContext,
      });

      const image = await generateAiImage({
        purpose: "page",
        prompt: finalPrompt,
        aspectRatio: imageAspectRatio,
      });
      const imageData: string | null = image?.base64 ?? null;

      if (!imageData) {
        logger.error("No image data returned by the image model");
        throw new BadRequestError("AI did not generate an image. Try a more descriptive prompt.");
      }

      // Optimize with Sharp (WebP, quality 85)
      const { buffer: optimizedBuffer, mimeType: optimizedMimeType } = await this.optimizeImage(imageData);

      const s3Key = await tenantOrgS3Service.uploadFile(
        tenantId,
        `ai-generated-images/${ulid()}.webp`,
        optimizedBuffer,
        optimizedMimeType
      );

      return { url: tenantOrgS3Service.getPublicUrl(s3Key) };
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("AI image generation failed", { error: errorMessage });

      if (errorMessage.includes("SAFETY")) {
        throw new BadRequestError("Image generation was blocked by safety filters. Please try a different prompt.");
      }
      if (errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        throw new BadRequestError("AI image generation quota exceeded. Please try again later.");
      }
      throw new BadRequestError(`Image generation failed: ${errorMessage}`);
    }
  }
}

const pageAIService = new PageAIService();
export default pageAIService;
