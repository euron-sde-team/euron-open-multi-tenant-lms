import sharp from "sharp";

import { BadRequestError } from "../errors/bad-request.error";
import logger from "../utils/logger";
import { generateText } from "ai";

import {
  generateImage,
  getTextModel,
  imageGenerationEnabled,
  recordUsage,
} from "../lib/ai/provider";

export type BookAISectionKey = "description" | "thumbnail";

export const ALL_BOOK_AI_SECTION_KEYS: BookAISectionKey[] = ["description", "thumbnail"];

export interface BookThumbnailContext {
  authorName?: string;
  organizationName?: string;
  language?: string;
}

export interface GenerateBookContentParams {
  bookTitle: string;
  sections: BookAISectionKey[];
  epubUrl?: string;
  extraContext?: string;
  referenceDocument?: string;
  thumbnailContext?: BookThumbnailContext;
}

export interface GeneratedBookContent {
  description?: string;
  thumbnailDataUrl?: string;
}

class BookAIService {
  async generateContent(params: GenerateBookContentParams): Promise<GeneratedBookContent> {
    const { bookTitle, sections, extraContext, referenceDocument, thumbnailContext } = params;

    if (!bookTitle?.trim()) {
      throw new BadRequestError("Book title is required");
    }

    const validSections = sections.filter((s) => ALL_BOOK_AI_SECTION_KEYS.includes(s));
    if (validSections.length === 0) {
      throw new BadRequestError("At least one valid section is required");
    }

    const hasDescription = validSections.includes("description");
    const hasThumbnail = validSections.includes("thumbnail");

    const totalStart = Date.now();
    logger.info(`[BookAI] Starting generation for "${bookTitle}", sections: [${validSections.join(", ")}]`);

    const result: GeneratedBookContent = {};

    try {
      const promises: Promise<void>[] = [];

      if (hasDescription) {
        promises.push(
          this.generateDescription(bookTitle, extraContext, referenceDocument).then((desc) => {
            result.description = desc;
          })
        );
      }

      // Covers need an image model (AI_IMAGE_MODEL); without one the cover is skipped.
      if (hasThumbnail && imageGenerationEnabled()) {
        promises.push(
          this.generateThumbnail(bookTitle, thumbnailContext, extraContext, referenceDocument).then((dataUrl) => {
            result.thumbnailDataUrl = dataUrl;
          })
        );
      }

      await Promise.all(promises);

      logger.info(`[BookAI] Completed generation for "${bookTitle}" in ${Date.now() - totalStart}ms`);
      return result;
    } catch (error) {
      logger.error(`[BookAI] Error generating content after ${Date.now() - totalStart}ms:`, error);
      if (error instanceof BadRequestError) throw error;
      throw new BadRequestError(
        `Failed to generate book content: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // ─── Generate Description ──────────────────────────────────────────────

  private async generateDescription(
    bookTitle: string,
    extraContext?: string,
    referenceDocument?: string
  ): Promise<string> {
    const refDocSection = referenceDocument
      ? `\n\n=== REFERENCE DOCUMENT ===
${referenceDocument.slice(0, 30000)}
=== END REFERENCE DOCUMENT ===

REFERENCE DOCUMENT INSTRUCTIONS:
1. Extract key topics, themes, structure, and subject matter from the document above.
2. Align the description with the document's actual content, do not invent topics not present in the document.
3. Use domain-specific vocabulary, terminology, and concepts found in the document.
4. If the document contains a table of contents or chapter list, use it to understand the book's scope and structure.
5. Identify the target audience and depth level from the document's content.
6. Do NOT quote the document verbatim, synthesize and summarize in your own words.`
      : "";

    const adminInstructions = extraContext
      ? `\nADMINISTRATOR INSTRUCTIONS:\n${extraContext.slice(0, 5000)}`
      : "";

    const prompt = `Write a concise, professional summary of the book "${bookTitle}".${refDocSection}${adminInstructions}

RULES:
- Start DIRECTLY with the summary. No preamble, no "Okay", no introductory phrases.
- Write 2-3 short paragraphs (200-300 words total).
- Cover what the book is about, its key themes, and what readers will gain.
- Use plain, professional language suitable for a bookstore listing.
- Do NOT use numbered lists, section headers, or bullet points, write flowing paragraphs.`;

    const start = Date.now();
    logger.info(`[BookAI] Generating description for "${bookTitle}"`);

    const { text, usage } = await generateText({
      model: getTextModel("book"),
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1024,
    });
    if (!text?.trim()) {
      throw new BadRequestError("AI did not generate a description. Please try again.");
    }
    recordUsage({ purpose: "book", kind: "text", usage });

    logger.info(`[BookAI] Description generated in ${Date.now() - start}ms`);
    return text;
  }

  // ─── Generate Thumbnail ────────────────────────────────────────────────

  private async generateThumbnail(
    bookTitle: string,
    thumbnailContext?: BookThumbnailContext,
    extraContext?: string,
    referenceDocument?: string
  ): Promise<string> {
    const authorName = thumbnailContext?.authorName || "";
    const organizationName = thumbnailContext?.organizationName || "";
    const language = thumbnailContext?.language || "";

    const refDocHint = referenceDocument
      ? `\nBook Subject & Themes (from reference document): ${referenceDocument.slice(0, 2000)}`
      : "";
    const contextHint = extraContext
      ? `\nAdditional Context: ${extraContext.slice(0, 2000)}`
      : "";

    const prompt = `Create a professional, visually stunning book cover image.

Book Title: "${bookTitle}"
${authorName ? `Author: "${authorName}"` : ""}
${language ? `Language: ${language}` : ""}${refDocHint}${contextHint}

Design Requirements:
1. FULL-BLEED PORTRAIT image (2:3 aspect ratio), like a real book cover.
2. Display the book title "${bookTitle}" prominently in large, bold, high-contrast text.
${authorName ? `3. Display author name "${authorName}" below the title in smaller text.` : "3. Do NOT add any author name or tagline, only the book title as text."}
${organizationName ? `4. Include "${organizationName}" as publisher text at the bottom.` : ""}
5. Use a modern, eye-catching gradient background with visual elements related to the book topic.
6. Include abstract illustrations, patterns, or icons related to the subject matter.
7. Use layered gradients, glassmorphism, and depth effects for a premium feel.
8. Keep the design CLEAN, only the title${authorName ? ", author," : ""} and visual elements. No excessive clutter.
9. TEXT ACCURACY: Every word must be spelled correctly with ZERO errors.
10. This should look like a real published book cover, premium, polished, publication-ready.

CRITICAL: TEXT INTEGRITY:
- ONLY render text that is EXPLICITLY provided above. Do NOT invent or add any author names, publisher names, taglines, or text not listed above.
- If no author is provided, do NOT display any author name, use only the book title and visual elements.
- If no organization/publisher is provided, do NOT add any publisher or brand text.`;

    const start = Date.now();
    logger.info(`[BookAI] Generating thumbnail for "${bookTitle}"`);

    try {
      const image = await generateImage({ purpose: "book", prompt, aspectRatio: "3:4" });
      const base64Data = image?.base64;
      if (!base64Data) {
        throw new BadRequestError("AI did not generate a thumbnail. Please try again.");
      }

      // Optimize with Sharp
      const inputBuffer = Buffer.from(base64Data, "base64");
      const optimized = await sharp(inputBuffer)
        .rotate()
        .webp({ quality: 85 })
        .toBuffer();

      logger.info(`[BookAI] Thumbnail generated in ${Date.now() - start}ms`);
      return `data:image/webp;base64,${optimized.toString("base64")}`;
    } catch (error) {
      logger.error(`[BookAI] Error generating thumbnail after ${Date.now() - start}ms:`, error);
      if (error instanceof BadRequestError) throw error;
      throw new BadRequestError(
        `Failed to generate book cover: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

const bookAIService = new BookAIService();
export default bookAIService;
