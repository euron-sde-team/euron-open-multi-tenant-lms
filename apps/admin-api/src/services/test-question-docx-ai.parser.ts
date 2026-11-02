import { generateObject, jsonSchema } from "ai";
import JSZip from "jszip";

import { BadRequestError } from "../errors/bad-request.error";
import logger from "../utils/logger";
import uploadService from "./upload.service";
import { getTextModel, isAiLive } from "../lib/ai/provider";


export const DOCX_AI_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const DOCX_AI_MAX_QUESTIONS = 200;
export const DOCX_AI_MAX_FIGURES = 200;

const VALID_TYPES = new Set(["MCQ_SINGLE", "NAT"]);

/** Matches a figure marker the AI is asked to preserve, e.g. "[FIGURE-3]". */
const FIGURE_MARKER = /\[FIGURE-(\d+)\]/gi;

/** docx media extension → image mime (only types the uploader accepts). */
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** The shape consumed by testQuestionsService.bulkCreate(). */
export interface AiDocxQuestionItem {
  type: "MCQ_SINGLE" | "NAT";
  stem: string | { text: string; imageUrl: string; imageSize: string };
  options: Array<{ id: string; label: string }> | null;
  correct_answer: unknown;
  explanation: string | null;
  subject: string;
  difficulty: string;
  created_via: string;
}

interface GenQuestion {
  stem: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  type: string;
  difficulty?: string;
}

/** A figure pulled out of the docx, keyed by the [FIGURE-N] marker index. */
interface ExtractedFigure {
  index: number; // the N in [FIGURE-N]
  buffer: Buffer;
  mime: string;
}

interface ExtractedDocx {
  text: string;
  figures: ExtractedFigure[];
}

/**
 * Extract the document text in reading order, including Office-Math (OMML)
 * runs (`<m:t>`, which mammoth drops), and replace every embedded image with
 * a `[FIGURE-N]` marker at its position so the AI can keep it attached to the
 * right question. Returns the marker text plus the decoded image buffers.
 */
async function extractDocxContent(buffer: Buffer): Promise<ExtractedDocx> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new BadRequestError("Could not read the .docx file (not a valid Word document).");
  }
  let xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new BadRequestError("The .docx file has no readable document content.");

  // rId → media target (e.g. rId7 → media/image1.png)
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
  const relTargets = new Map<string, string>();
  if (relsXml) {
    const relRe = /<Relationship\b[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
    let rm: RegExpExecArray | null;
    while ((rm = relRe.exec(relsXml))) relTargets.set(rm[1], rm[2]);
  }

  // Walk the image-bearing blocks in document order, replacing each with a
  // [FIGURE-N] marker and recording the relationship id it points to. We strip
  // whole AlternateContent blocks first so a DrawingML image and its VML
  // fallback aren't counted twice.
  const figureRels: Array<{ index: number; rId: string }> = [];
  let figIndex = 0;
  const blockRe =
    /<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>|<w:drawing\b[\s\S]*?<\/w:drawing>|<w:pict\b[\s\S]*?<\/w:pict>|<w:object\b[\s\S]*?<\/w:object>/g;
  xml = xml.replace(blockRe, (block) => {
    const rIdMatch = block.match(/r:embed="(rId\d+)"|r:id="(rId\d+)"/);
    const rId = rIdMatch ? rIdMatch[1] || rIdMatch[2] : null;
    if (!rId || !relTargets.has(rId)) return " "; // image we can't resolve, drop
    figIndex += 1;
    figureRels.push({ index: figIndex, rId });
    return ` [FIGURE-${figIndex}] `;
  });

  const text = xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\b[^>]*\/?>/g, " ")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "") // strip all tags; w:t + m:t text survives in order
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Load each referenced image's bytes (skip formats the uploader rejects).
  const figures: ExtractedFigure[] = [];
  for (const { index, rId } of figureRels.slice(0, DOCX_AI_MAX_FIGURES)) {
    const target = relTargets.get(rId);
    if (!target) continue;
    const ext = (target.split(".").pop() || "").toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) continue; // emf/wmf/etc., not a web image, skip
    const path = target.startsWith("/") ? target.slice(1) : `word/${target}`;
    const file = zip.file(path) || zip.file(path.replace(/^word\//, ""));
    if (!file) continue;
    try {
      const buf = await file.async("nodebuffer");
      if (buf.length > 0) figures.push({ index, buffer: buf, mime });
    } catch {
      // unreadable media entry, skip, the marker just gets stripped later
    }
  }

  return { text, figures };
}

/**
 * Upload each extracted figure to S3 and return a map of marker index → URL.
 * Failures are swallowed per-image so a bad upload never breaks the import.
 */
async function uploadFigures(
  figures: ExtractedFigure[],
  folder: string
): Promise<Map<number, string>> {
  const urls = new Map<number, string>();
  for (const fig of figures) {
    try {
      const ext = fig.mime === "image/png" ? "png" : fig.mime === "image/gif" ? "gif" : "jpg";
      const { url } = await uploadService.uploadFile(
        fig.buffer,
        `figure-${fig.index}.${ext}`,
        fig.mime,
        folder
      );
      urls.set(fig.index, url);
    } catch (err) {
      logger.warn("[docx-ai] figure upload failed", {
        index: fig.index,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return urls;
}

const SCHEMA = jsonSchema<{ questions: GenQuestion[] }>({
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stem: { type: "string", description: "The full question text, math in $...$ LaTeX. Keep any [FIGURE-N] marker that belongs to this question." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "The 4 answer choices (LaTeX where needed). Empty for NAT.",
          },
          correct_answer: {
            type: "string",
            description: "For MCQ: the option LETTER A/B/C/D. For NAT: the numeric value as a string.",
          },
          explanation: { type: "string", description: "Worked solution in $...$ LaTeX." },
          type: { type: "string", description: "MCQ_SINGLE or NAT." },
          difficulty: { type: "string", description: "EASY, MEDIUM, or HARD." },
        },
        required: ["stem", "correct_answer", "type"],
      },
    },
  },
  required: ["questions"],
});

const SYSTEM_PROMPT = [
  "You convert a Digital SAT question document into structured questions for an online test platform.",
  "RULES, preserve fidelity, do NOT change the questions:",
  "- Keep each question's wording EXACTLY as written. Do not paraphrase, add, or drop content.",
  "- Convert ALL mathematics to LaTeX wrapped in $...$, e.g. $4x^2-5x-21$, $\\frac{300}{D}$, $\\sqrt{2}$, $30^\\circ$, $\\frac{\\pi}{2}$. Never leave flattened math like 'x 2' or '300 D'.",
  "- The document text may contain figure markers like [FIGURE-1], [FIGURE-2]. Each marks an image (a graph, diagram, or table). KEEP the marker VERBATIM inside the stem of the question it belongs to, at the place it appears. Do NOT invent, renumber, or move markers, and never put one in a question it doesn't belong to.",
  "- type = 'MCQ_SINGLE' when the question lists choices (A)(B)(C)(D); type = 'NAT' for student-produced numeric answers with no choices.",
  "- options = the four choice texts in order (LaTeX where needed). For NAT use an empty array.",
  "- correct_answer = the option LETTER (A/B/C/D) for MCQ, or the numeric value (as a string) for NAT, infer it from the solution/answer key in the document if present.",
  "- explanation = the worked solution from the document (in $...$ LaTeX). Empty string if none is given.",
  "- difficulty = your best estimate: EASY / MEDIUM / HARD.",
  "- Return EVERY question found, in document order. Ignore headers/footers/answer-key tables that aren't questions.",
].join("\n");

function toItems(
  qs: GenQuestion[],
  figureUrls: Map<number, string>
): AiDocxQuestionItem[] {
  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  const out: AiDocxQuestionItem[] = [];
  for (const q of qs) {
    const type = String(q.type || "").toUpperCase() === "NAT" ? "NAT" : "MCQ_SINGLE";
    if (!VALID_TYPES.has(type)) continue;
    let stemText = String(q.stem || "").trim();
    if (!stemText) continue;

    // Pull the first resolvable figure marker out of the stem (if any), then
    // strip ALL markers from the visible text so no "[FIGURE-N]" leaks through.
    let stemImageUrl: string | null = null;
    const markerMatch = stemText.match(/\[FIGURE-(\d+)\]/i);
    if (markerMatch) {
      const url = figureUrls.get(parseInt(markerMatch[1], 10));
      if (url) stemImageUrl = url;
    }
    stemText = stemText.replace(FIGURE_MARKER, "").replace(/[ \t]{2,}/g, " ").trim();
    if (!stemText && !stemImageUrl) continue;

    const stem = stemImageUrl
      ? { text: stemText, imageUrl: stemImageUrl, imageSize: "lg" }
      : stemText;

    const difficulty = ["EASY", "MEDIUM", "HARD"].includes(String(q.difficulty || "").toUpperCase())
      ? String(q.difficulty).toUpperCase()
      : "MEDIUM";

    if (type === "MCQ_SINGLE") {
      const opts = (q.options ?? []).filter((o) => String(o ?? "").trim().length > 0);
      if (opts.length < 2) continue; // not a usable MCQ
      const options = opts.map((label, i) => ({
        id: LETTERS[i],
        label: String(label).replace(FIGURE_MARKER, "").trim(),
      }));
      // correct_answer may be a letter ("B") or the choice text; normalise to a letter id.
      const raw = String(q.correct_answer ?? "").trim();
      let answer = raw.toUpperCase().replace(/[^A-F]/g, "").slice(0, 1);
      if (!answer || !options.some((o) => o.id === answer)) {
        const byText = options.find((o) => o.label.toLowerCase() === raw.toLowerCase());
        answer = byText?.id ?? options[0].id;
      }
      out.push({
        type,
        stem,
        options,
        correct_answer: answer,
        explanation: q.explanation ? String(q.explanation).trim() : null,
        subject: "Math",
        difficulty,
        created_via: "AI",
      });
    } else {
      const num = Number(String(q.correct_answer ?? "").replace(/[^0-9.\-/]/g, ""));
      out.push({
        type,
        stem,
        options: null,
        correct_answer: Number.isFinite(num) ? num : String(q.correct_answer ?? ""),
        explanation: q.explanation ? String(q.explanation).trim() : null,
        subject: "Math",
        difficulty,
        created_via: "AI",
      });
    }
  }
  return out;
}

/** Structure extracted text (+ optional figure URLs) into questions via the AI model. */
async function structureWithAI(
  text: string,
  figureUrls: Map<number, string>
): Promise<AiDocxQuestionItem[]> {
  try {
    const { object } = await generateObject({
      model: getTextModel("question_import"),
      schema: SCHEMA,
      system: SYSTEM_PROMPT,
      prompt: `Parse this document into questions:\n\n${text.slice(0, 60000)}`,
      temperature: 0.1,
      maxOutputTokens: 30000,
    });
    const items = toItems(object?.questions ?? [], figureUrls).slice(
      0,
      DOCX_AI_MAX_QUESTIONS
    );
    if (items.length === 0) {
      throw new BadRequestError("No questions could be extracted from this document.");
    }
    return items;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("[import-ai] parse failed", { error: msg });
    throw new BadRequestError(`AI import failed: ${msg}`);
  }
}

/**
 * AI-powered Word import for ARBITRARY question documents (not the fixed
 * template): extracts the document text + math + embedded figures, has the AI model
 * structure it into questions with LaTeX math, then re-attaches each figure to
 * the question whose stem kept its [FIGURE-N] marker.
 */
export async function parseQuestionsDocxAI(
  buffer: Buffer,
  opts: { tenantId?: string } = {}
): Promise<AiDocxQuestionItem[]> {
  // Parsing a real document needs a real model; the offline engine would
  // invent questions.
  if (!isAiLive()) {
    throw new BadRequestError("AI import needs an AI provider (set AI_API_KEY).");
  }
  if (buffer.byteLength > DOCX_AI_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `File exceeds the ${DOCX_AI_MAX_FILE_BYTES / (1024 * 1024)} MB limit.`
    );
  }

  const { text, figures } = await extractDocxContent(buffer);
  if (text.length < 20) {
    throw new BadRequestError("The document has no readable question text.");
  }

  // Upload figures up front so toItems() can map markers → URLs. A failed
  // upload simply yields no URL for that marker (the marker is stripped).
  const folder = opts.tenantId
    ? `test-questions/${opts.tenantId}`
    : "test-questions";
  const figureUrls =
    figures.length > 0 ? await uploadFigures(figures, folder) : new Map<number, string>();

  return structureWithAI(text, figureUrls);
}

/**
 * AI import for ANY supported question file: Word (.docx, with figures), PDF,
 * Excel (.xlsx), or CSV. Detects the format from the filename/mime, extracts
 * readable text, then runs the same the AI model structuring pipeline.
 */
export async function parseQuestionsFileAI(
  buffer: Buffer,
  opts: { tenantId?: string; filename?: string; mimetype?: string } = {}
): Promise<AiDocxQuestionItem[]> {
  // Parsing a real document needs a real model; the offline engine would
  // invent questions.
  if (!isAiLive()) {
    throw new BadRequestError("AI import needs an AI provider (set AI_API_KEY).");
  }
  if (buffer.byteLength > DOCX_AI_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `File exceeds the ${DOCX_AI_MAX_FILE_BYTES / (1024 * 1024)} MB limit.`
    );
  }

  const name = (opts.filename ?? "").toLowerCase();
  const mime = (opts.mimetype ?? "").toLowerCase();
  const isDocx =
    name.endsWith(".docx") || mime.includes("wordprocessingml");
  const isPdf = name.endsWith(".pdf") || mime.includes("pdf");
  const isXlsx =
    name.endsWith(".xlsx") || name.endsWith(".xls") || mime.includes("spreadsheet");
  const isCsv = name.endsWith(".csv") || mime.includes("csv");

  // Word keeps the figure pipeline; the others are text-only.
  if (isDocx) return parseQuestionsDocxAI(buffer, { tenantId: opts.tenantId });

  let text = "";
  if (isPdf) text = await extractPdfText(buffer);
  else if (isXlsx) text = await extractXlsxText(buffer);
  else if (isCsv) text = extractCsvText(buffer);
  else
    throw new BadRequestError(
      "Unsupported file. Upload a Word (.docx), PDF, Excel (.xlsx) or CSV file."
    );

  if (text.trim().length < 20) {
    throw new BadRequestError("The file has no readable question text.");
  }
  return structureWithAI(text, new Map<number, string>());
}

/** Extract text from a PDF (best-effort, page text only). */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const mod = await import("pdf-parse");
    const PDFParse = (mod as { PDFParse?: new (o: { data: Uint8Array }) => { getText: () => Promise<{ text: string }> } }).PDFParse;
    if (PDFParse) {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const res = await parser.getText();
      return cleanText(res.text ?? "");
    }
    // Fallback: callable default export (older pdf-parse API).
    const fn = (mod as unknown as { default?: (b: Buffer) => Promise<{ text: string }> }).default;
    if (fn) return cleanText((await fn(buffer)).text ?? "");
    throw new Error("pdf-parse unavailable");
  } catch (err) {
    logger.error("[import-ai] pdf extract failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new BadRequestError("Could not read text from this PDF.");
  }
}

/** Flatten an Excel workbook to readable text (one line per row). */
async function extractXlsxText(buffer: Buffer): Promise<string> {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const lines: string[] = [];
  wb.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.text ?? String(cell.value ?? "");
        if (v) cells.push(v.trim());
      });
      if (cells.length) lines.push(cells.join(" | "));
    });
  });
  return cleanText(lines.join("\n"));
}

/** Flatten a CSV to readable text (one line per row). */
function extractCsvText(buffer: Buffer): string {
  return cleanText(
    buffer
      .toString("utf8")
      .split(/\r?\n/)
      .map((l) => l.split(",").map((c) => c.trim()).filter(Boolean).join(" | "))
      .filter(Boolean)
      .join("\n")
  );
}

function cleanText(s: string): string {
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
