import mammoth from "mammoth";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";

import { BadRequestError } from "../errors/bad-request.error";
import { QuizImportValidationError } from "../errors/quiz-import-validation.error";

/** Max size accepted for an uploaded questions .docx (10 MB). */
export const DOCX_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Max questions accepted per import (matches the JSON bulk-import cap). */
export const DOCX_IMPORT_MAX_QUESTIONS = 500;

const VALID_TYPES = new Set([
  "MCQ_SINGLE",
  "MCQ_MULTI",
  "TRUE_FALSE",
  "FIB",
  "NAT",
  "DRAG_DROP",
]);

const TYPE_ALIASES: Record<string, string> = {
  MCQ: "MCQ_SINGLE",
  MCQ_SINGLE: "MCQ_SINGLE",
  SINGLE: "MCQ_SINGLE",
  MCQ_MULTI: "MCQ_MULTI",
  MULTI: "MCQ_MULTI",
  MULTIPLE: "MCQ_MULTI",
  TRUE_FALSE: "TRUE_FALSE",
  TF: "TRUE_FALSE",
  TRUEFALSE: "TRUE_FALSE",
  FIB: "FIB",
  FILL: "FIB",
  NAT: "NAT",
  NUMERIC: "NAT",
  SPR: "NAT",
  DRAG_DROP: "DRAG_DROP",
  DRAGDROP: "DRAG_DROP",
  DRAG: "DRAG_DROP",
  DND: "DRAG_DROP",
  DRAG_AND_DROP: "DRAG_DROP",
};

/** A blank is a run of 2+ underscores ("___"). Matches the editor + player. */
const BLANK_RE = /_{2,}/g;

/** The exact shape consumed by testQuestionsService.bulkCreate(). */
export interface DocxQuestionItem {
  type: string;
  stem: string;
  options: Array<{ id: string; label: string }> | null;
  correct_answer: unknown;
  explanation: string | null;
  difficulty?: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  marks?: number;
  negative_marks?: number;
  created_via: string;
}

interface Line {
  html: string;
  text: string;
}

const MARKER_RE =
  /^(Answer|Type|Difficulty|Subject|Topic|Chapter|Explanation|Marks|NegativeMark|NegativeMarks|Passage)\s*[:.]\s*(.*)$/i;
const OPTION_RE = /^([A-Za-z])\s*[).．]\s+(.*)$/;
const QUESTION_RE = /^(?:Q|Question)\s*\d*\s*[:.)]\s*(.*)$/i;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove a leading label (e.g. "Q:" or "A)") from a paragraph's HTML while
 * preserving any leading formatting tags, so bold/italic on the content survive.
 */
function stripLeadingLabelHtml(html: string, labelText: string): string {
  // Drop the matching leading plain-text label, tolerating wrapping tags.
  const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^(\\s*(?:<[^>]+>\\s*)*)\\s*${escaped}`, "i");
  return html.replace(re, "$1").trim();
}

/** Break mammoth HTML into block-level paragraph lines (text + inner HTML). */
function htmlToLines(html: string): Line[] {
  const lines: Line[] = [];
  const blockRe = /<(p|li|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const inner = m[2] ?? "";
    const text = stripTags(inner);
    if (text.length === 0) continue;
    lines.push({ html: inner.trim(), text });
  }
  return lines;
}

/** Group lines into question blocks. A block starts at a "Q:"/"Question:" line. */
function groupBlocks(lines: Line[]): Line[][] {
  const blocks: Line[][] = [];
  let current: Line[] | null = null;
  for (const ln of lines) {
    if (QUESTION_RE.test(ln.text)) {
      if (current) blocks.push(current);
      current = [ln];
    } else if (current) {
      current.push(ln);
    }
    // Lines before the first Q: marker are ignored (title/instructions).
  }
  if (current) blocks.push(current);
  return blocks;
}

function parseNumberOrFraction(s: string): number | string | null {
  const t = s.trim();
  if (/^-?\d+\/\d+$/.test(t)) return t; // keep fractions verbatim (grader handles)
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

interface BlockResult {
  item?: DocxQuestionItem;
  error?: string;
}

function parseBlock(block: Line[], index: number): BlockResult {
  const label = `Question ${index + 1}`;
  const qMatch = block[0].text.match(QUESTION_RE);
  const stemParts: string[] = [];
  const firstStem = stripLeadingLabelHtml(
    block[0].html,
    block[0].text.slice(0, block[0].text.length - (qMatch?.[1]?.length ?? 0))
  );
  if (firstStem) stemParts.push(firstStem);

  const options: Array<{ id: string; label: string }> = [];
  const meta: Record<string, string> = {};
  let sawOptionOrMeta = false;

  for (let i = 1; i < block.length; i++) {
    const ln = block[i];
    const markerM = ln.text.match(MARKER_RE);
    if (markerM) {
      meta[markerM[1].toLowerCase().replace(/\s+/g, "")] = markerM[2].trim();
      sawOptionOrMeta = true;
      continue;
    }
    const optM = ln.text.match(OPTION_RE);
    if (optM) {
      const id = optM[1].toUpperCase();
      const optLabelHtml = stripLeadingLabelHtml(
        ln.html,
        ln.text.slice(0, ln.text.length - optM[2].length)
      );
      options.push({ id, label: optLabelHtml || optM[2] });
      sawOptionOrMeta = true;
      continue;
    }
    // Pre-options, pre-meta free text continues the stem (multi-line stems).
    if (!sawOptionOrMeta) stemParts.push(ln.html);
  }

  const stem = stemParts.join("<br/>").trim();
  if (!stem) return { error: `${label}: question text (Q:) is empty.` };

  // Resolve type: explicit > inferred.
  let type = "";
  if (meta.type) {
    type =
      TYPE_ALIASES[meta.type.toUpperCase().replace(/[\s-]+/g, "_")] ??
      meta.type.toUpperCase();
  }
  const answerRaw = (meta.answer ?? "").trim();

  if (!type) {
    if (options.length >= 2) {
      type = answerRaw.includes(",") ? "MCQ_MULTI" : "MCQ_SINGLE";
    } else if (parseNumberOrFraction(answerRaw) !== null) {
      type = "NAT";
    } else {
      type = "FIB";
    }
  }
  if (!VALID_TYPES.has(type)) {
    return { error: `${label}: unsupported Type "${meta.type}".` };
  }
  if (!answerRaw && type !== "TRUE_FALSE") {
    return { error: `${label}: missing "Answer:".` };
  }

  // Difficulty / metadata
  const difficulty = meta.difficulty
    ? meta.difficulty.toUpperCase()
    : undefined;
  if (difficulty && !["EASY", "MEDIUM", "HARD"].includes(difficulty)) {
    return { error: `${label}: Difficulty must be EASY, MEDIUM, or HARD.` };
  }
  const marks = meta.marks ? Number(meta.marks) : undefined;
  const negative_marks =
    meta.negativemark !== undefined
      ? Number(meta.negativemark)
      : meta.negativemarks !== undefined
        ? Number(meta.negativemarks)
        : undefined;
  const explanation = meta.explanation ? stripTags(meta.explanation) : null;
  const passage = meta.passage ? meta.passage.trim() : null;
  const fullStem = passage ? `${passage}<br/><br/>${stem}` : stem;

  const base: Omit<DocxQuestionItem, "options" | "correct_answer"> = {
    type,
    stem: fullStem,
    explanation,
    difficulty,
    subject: meta.subject ?? null,
    chapter: meta.chapter ?? null,
    topic: meta.topic ?? null,
    marks: marks !== undefined && Number.isFinite(marks) ? marks : undefined,
    negative_marks:
      negative_marks !== undefined && Number.isFinite(negative_marks)
        ? negative_marks
        : undefined,
    created_via: "IMPORT",
  };

  // Type-specific option + correct_answer shaping (matches the AI/manual shape).
  if (type === "MCQ_SINGLE" || type === "MCQ_MULTI") {
    if (options.length < 2)
      return { error: `${label}: at least 2 options (A) B) …) are required.` };
    const ids = new Set(options.map((o) => o.id));
    const picks = answerRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    for (const p of picks) {
      if (!ids.has(p))
        return { error: `${label}: Answer "${p}" is not one of the options.` };
    }
    if (type === "MCQ_SINGLE" && picks.length !== 1)
      return { error: `${label}: MCQ_SINGLE needs exactly one answer letter.` };
    return {
      item: {
        ...base,
        options,
        correct_answer: type === "MCQ_SINGLE" ? picks[0] : picks,
      },
    };
  }

  if (type === "DRAG_DROP") {
    if (options.length < 2)
      return { error: `${label}: at least 2 options (A) B) …) are required for drag-and-drop.` };
    // Each "___" in the stem is a drop slot; the Answer maps one option letter
    // to each blank, in stem order (e.g. "Answer: A, C" → blank1=A, blank2=C).
    const blanks = (stripTags(fullStem).match(BLANK_RE) || []).length;
    if (blanks < 1)
      return { error: `${label}: drag-and-drop stem must contain "___" (a blank marker).` };
    const ids = new Set(options.map((o) => o.id));
    const picks = answerRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    for (const p of picks) {
      if (!ids.has(p))
        return { error: `${label}: Answer "${p}" is not one of the options.` };
    }
    if (picks.length !== blanks)
      return {
        error: `${label}: drag-and-drop needs one Answer letter per blank, in order. Found ${blanks} blank(s) but ${picks.length} answer(s).`,
      };
    // Single blank → plain string (legacy shape); multiple → ordered array,
    // one option id per blank. Mirrors the editor + grading (all-or-nothing).
    return {
      item: {
        ...base,
        options,
        correct_answer: blanks === 1 ? picks[0] : picks,
      },
    };
  }

  if (type === "TRUE_FALSE") {
    const opts = options.length >= 2
      ? options
      : [
          { id: "TRUE", label: "True" },
          { id: "FALSE", label: "False" },
        ];
    const ans = answerRaw.toUpperCase();
    const norm = ans === "T" ? "TRUE" : ans === "F" ? "FALSE" : ans;
    if (!opts.some((o) => o.id === norm))
      return { error: `${label}: TRUE_FALSE answer must be TRUE or FALSE.` };
    return { item: { ...base, options: opts, correct_answer: norm } };
  }

  if (type === "NAT") {
    const v = parseNumberOrFraction(answerRaw);
    if (v === null)
      return { error: `${label}: NAT answer must be a number or fraction (e.g. 0.75 or 3/4).` };
    return { item: { ...base, options: null, correct_answer: v } };
  }

  // FIB
  return { item: { ...base, options: null, correct_answer: answerRaw } };
}

/**
 * Parse an uploaded .docx of questions in the platform template format into the
 * shape consumed by testQuestionsService.bulkCreate(). Formatting (bold/italic)
 * in the stem and option labels is preserved as inline HTML; type-in math LaTeX
 * should be written inline as `$...$`. Rejects the whole file if any block is
 * invalid (so partial/garbled imports never land silently).
 */
export async function parseQuestionsDocx(
  buffer: Buffer
): Promise<DocxQuestionItem[]> {
  if (buffer.byteLength > DOCX_IMPORT_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `File exceeds the ${DOCX_IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MB limit.`
    );
  }
  let html: string;
  try {
    // Bold/italic are preserved by default; underline + strikethrough are not,
    // so map them explicitly, the PWSAT meeting requires underlines (e.g. in
    // English passages) to survive the upload.
    const result = await mammoth.convertToHtml(
      { buffer },
      { styleMap: ["u => u", "strike => s"] }
    );
    html = result.value || "";
  } catch {
    throw new BadRequestError(
      "Could not read the .docx file. Make sure it is a valid Word document."
    );
  }

  const lines = htmlToLines(html);
  const blocks = groupBlocks(lines);
  if (blocks.length === 0) {
    throw new BadRequestError(
      "No questions found. Each question must start with a line beginning \"Q:\", download the template for the exact format."
    );
  }
  if (blocks.length > DOCX_IMPORT_MAX_QUESTIONS) {
    throw new BadRequestError(
      `File has ${blocks.length} questions. Maximum is ${DOCX_IMPORT_MAX_QUESTIONS}; split the file and retry.`
    );
  }

  const items: DocxQuestionItem[] = [];
  const errors: string[] = [];
  blocks.forEach((block, i) => {
    const { item, error } = parseBlock(block, i);
    if (error) errors.push(error);
    else if (item) items.push(item);
  });

  if (errors.length > 0) {
    throw new QuizImportValidationError(
      `The document has ${errors.length} question(s) with problems. Fix them and re-upload.`,
      errors
    );
  }
  return items;
}

/** Build the downloadable .docx template (instructions + 3 worked examples). */
export async function generateQuestionsDocxTemplate(): Promise<Buffer> {
  const p = (text: string, opts?: { bold?: boolean; italics?: boolean }) =>
    new Paragraph({
      children: [new TextRun({ text, bold: opts?.bold, italics: opts?.italics })],
    });
  const blank = () => new Paragraph({ children: [] });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "Question Import Template",
            heading: HeadingLevel.HEADING_1,
          }),
          p(
            "Write one question per block. Start every question with a line that begins \"Q:\". " +
              "Lines starting A) B) C) D) are options. Mark the answer with \"Answer:\". " +
              "Bold/italic formatting and inline math written as $...$ are preserved."
          ),
          p(
            "Optional lines (any order, after the options): Type, Difficulty, Subject, Topic, " +
              "Chapter, Marks, NegativeMark, Explanation, Passage."
          ),
          p(
            "Type is auto-detected (MCQ_SINGLE if options + one answer; MCQ_MULTI if Answer lists " +
              "several letters; NAT if no options + numeric/fraction answer; FIB if no options + text). " +
              "Set Type explicitly to override. Leave a blank line between questions."
          ),
          p(
            "Drag & drop (DRAG_DROP): set Type: DRAG_DROP, write \"___\" (3+ underscores) in the stem " +
              "for each blank, list the draggable choices as options A) B) C) …, and in Answer give one " +
              "option letter per blank in order (e.g. Answer: A, C means blank 1 = A, blank 2 = C)."
          ),
          blank(),
          new Paragraph({ text: "Examples", heading: HeadingLevel.HEADING_2 }),
          blank(),
          p("Q: Which of the following is a prime number?"),
          p("A) 21"),
          p("B) 27"),
          p("C) 23"),
          p("D) 33"),
          p("Answer: C"),
          p("Type: MCQ_SINGLE"),
          p("Difficulty: EASY"),
          p("Subject: Math"),
          p("Explanation: 23 has no divisors other than 1 and itself."),
          blank(),
          p("Q: If x/4 = 3, what is the value of x? (type-in)"),
          p("Type: NAT"),
          p("Answer: 12"),
          p("Difficulty: MEDIUM"),
          p("Subject: Math"),
          blank(),
          p("Q: Select all values that satisfy 2 < n < 6."),
          p("A) 1"),
          p("B) 3"),
          p("C) 5"),
          p("D) 7"),
          p("Answer: B, C"),
          p("Type: MCQ_MULTI"),
          p("Explanation: 3 and 5 are the integers strictly between 2 and 6."),
          blank(),
          p("Q: The capital of ___ is ___."),
          p("A) France"),
          p("B) Paris"),
          p("C) Berlin"),
          p("Type: DRAG_DROP"),
          p("Answer: A, B"),
          p("Explanation: Blank 1 = France, blank 2 = Paris."),
          blank(),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
