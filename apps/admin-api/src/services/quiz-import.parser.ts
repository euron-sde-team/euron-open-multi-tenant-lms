import Papa from "papaparse";

import { BadRequestError } from "../errors/bad-request.error";
import { QuizImportValidationError } from "../errors/quiz-import-validation.error";

/** Maximum size accepted for an uploaded quiz questions CSV (5 MB). */
export const QUIZ_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Maximum questions accepted per import. */
export const QUIZ_IMPORT_MAX_ROWS = 500;

const MAX_OPTIONS = 6;

/** Canonical column order, also used for the downloadable sample. */
const QUIZ_IMPORT_COLUMNS = [
  "Question",
  "Type",
  "Option1",
  "Option2",
  "Option3",
  "Option4",
  "Option5",
  "Option6",
  "CorrectOptions",
  "Marks",
  "Explanation",
] as const;

const ACCEPTED_HEADERS = new Set(
  QUIZ_IMPORT_COLUMNS.map((c) => c.toLowerCase())
);
const REQUIRED_HEADERS = ["question", "option1", "option2", "correctoptions"];

/**
 * Column aliases so files exported from other systems (e.g. the client
 * template with Subject/Chapter/PositiveMark columns) import without manual
 * rework. Keys are fully normalized (lowercase, separators stripped).
 * Columns that are neither canonical nor aliased are silently ignored.
 */
const HEADER_ALIASES: Record<string, string> = {
  questiontype: "type",
  correctoption: "correctoptions",
  correctanswers: "correctoptions",
  positivemark: "marks",
  mark: "marks",
  answerexplanation: "explanation",
};

/** Question type values from other systems mapped onto ours. */
const TYPE_ALIASES: Record<string, "MCQ" | "DRAG_DROP"> = {
  MCQ: "MCQ",
  MULTI_CHOICE: "MCQ",
  MULTIPLE_CHOICE: "MCQ",
  MCQ_SINGLE: "MCQ",
  MCQ_MULTI: "MCQ",
  DRAG_DROP: "DRAG_DROP",
  DRAG_AND_DROP: "DRAG_DROP",
};

export interface ParsedQuestionRow {
  rowNumber: number;
  question: string;
  questionType: "MCQ" | "DRAG_DROP";
  marks: number;
  options: Array<{
    text: string;
    isCorrect: boolean;
    explanation: string | null;
  }>;
}

function normalizeHeader(header: string): string {
  const stripped = header.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return HEADER_ALIASES[stripped] ?? stripped;
}

function valueOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

function assertHeaderShape(headers: string[]): void {
  const seen = new Set<string>();
  for (const raw of headers) {
    const h = normalizeHeader(raw);
    // Unknown columns (Subject, Chapter, NegativeMark, Criteria…, etc.) are
    // ignored so client exports import as-is, only OUR columns are read.
    if (!ACCEPTED_HEADERS.has(h)) continue;
    if (seen.has(h)) {
      throw new BadRequestError(
        `Duplicate column "${h}" in file header (after alias mapping).`
      );
    }
    seen.add(h);
  }
  for (const required of REQUIRED_HEADERS) {
    if (!seen.has(required)) {
      throw new BadRequestError(`File must contain a \`${required}\` column.`);
    }
  }
}

/**
 * Parse and validate a quiz questions CSV in the platform format:
 * `Question,Type,Option1..Option6,CorrectOptions,Marks,Explanation`.
 *
 * Every row is validated; if ANY row is invalid the whole file is rejected
 * with a QuizImportValidationError carrying per-row error messages.
 */
export function parseQuestionsCsv(buffer: Buffer): ParsedQuestionRow[] {
  if (buffer.byteLength > QUIZ_IMPORT_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `File exceeds the ${QUIZ_IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MB limit.`
    );
  }
  const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new BadRequestError(
      `CSV parse error on row ${first?.row ?? "?"}: ${first?.message ?? "unknown"}`
    );
  }
  assertHeaderShape(parsed.meta.fields ?? []);

  const rowErrors: string[] = [];
  const out: ParsedQuestionRow[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const r = parsed.data[i];
    if (!r) continue;
    const rowNumber = i + 2; // row 1 is the header

    // Skip comment rows and rows that are entirely blank.
    const question = valueOrNull(r["question"]);
    if (question && question.startsWith("#")) continue;
    const hasAnyValue = Object.values(r).some((v) => valueOrNull(v) !== null);
    if (!hasAnyValue) continue;

    if (!question) {
      rowErrors.push(`Row ${rowNumber}: Question is required.`);
      continue;
    }

    // Type (optional, default MCQ), accepts other systems' names too
    const typeRaw = valueOrNull(r["type"]);
    const questionType =
      TYPE_ALIASES[(typeRaw ?? "MCQ").toUpperCase().replace(/[\s-]+/g, "_")];
    if (!questionType) {
      rowErrors.push(
        `Row ${rowNumber}: Type must be MCQ or DRAG_DROP (got "${typeRaw}").`
      );
      continue;
    }
    if (questionType === "DRAG_DROP" && !question.includes("___")) {
      rowErrors.push(
        `Row ${rowNumber}: DRAG_DROP questions must contain "___" (three underscores) marking the blank in the Question text.`
      );
      continue;
    }

    // Options: must be filled contiguously starting at Option1.
    const optionTexts: string[] = [];
    let gapAt: number | null = null;
    let invalidGap = false;
    for (let k = 1; k <= MAX_OPTIONS; k++) {
      const v = valueOrNull(r[`option${k}`]);
      if (v === null) {
        if (gapAt === null) gapAt = k;
      } else if (gapAt !== null) {
        rowErrors.push(
          `Row ${rowNumber}: Option${gapAt} is blank but Option${k} has a value. Fill options in order without gaps.`
        );
        invalidGap = true;
        break;
      } else {
        optionTexts.push(v);
      }
    }
    if (invalidGap) continue;
    if (optionTexts.length < 2) {
      rowErrors.push(`Row ${rowNumber}: at least 2 options are required.`);
      continue;
    }

    // CorrectOptions: 1-based indices, comma-separated (e.g. "1" or "1,3").
    const correctRaw = valueOrNull(r["correctoptions"]);
    if (!correctRaw) {
      rowErrors.push(`Row ${rowNumber}: CorrectOptions is required.`);
      continue;
    }
    const correctIndices = correctRaw.split(",").map((s) => s.trim());
    const correctSet = new Set<number>();
    let invalidCorrect = false;
    for (const idxRaw of correctIndices) {
      if (!/^\d+$/.test(idxRaw)) {
        rowErrors.push(
          `Row ${rowNumber}: CorrectOptions must be comma-separated option numbers (got "${correctRaw}").`
        );
        invalidCorrect = true;
        break;
      }
      const idx = parseInt(idxRaw, 10);
      if (idx < 1 || idx > optionTexts.length) {
        rowErrors.push(
          `Row ${rowNumber}: CorrectOptions index ${idx} is out of range (this row has ${optionTexts.length} options).`
        );
        invalidCorrect = true;
        break;
      }
      if (correctSet.has(idx)) {
        rowErrors.push(
          `Row ${rowNumber}: CorrectOptions contains duplicate index ${idx}.`
        );
        invalidCorrect = true;
        break;
      }
      correctSet.add(idx);
    }
    if (invalidCorrect) continue;
    if (correctSet.size === 0) {
      rowErrors.push(`Row ${rowNumber}: at least one correct option is required.`);
      continue;
    }

    // Marks (optional, default 1)
    const marksRaw = valueOrNull(r["marks"]);
    let marks = 1;
    if (marksRaw !== null) {
      if (!/^\d+$/.test(marksRaw) || parseInt(marksRaw, 10) < 1) {
        rowErrors.push(
          `Row ${rowNumber}: Marks must be a positive integer (got "${marksRaw}").`
        );
        continue;
      }
      marks = parseInt(marksRaw, 10);
    }

    // Explanation (optional), stored on the first correct option.
    const explanation = valueOrNull(r["explanation"]);
    const firstCorrect = Math.min(...correctSet);

    out.push({
      rowNumber,
      question,
      questionType,
      marks,
      options: optionTexts.map((optionText, idx) => ({
        text: optionText,
        isCorrect: correctSet.has(idx + 1),
        explanation: explanation && idx + 1 === firstCorrect ? explanation : null,
      })),
    });
  }

  if (rowErrors.length > 0) {
    throw new QuizImportValidationError(
      `CSV file has ${rowErrors.length} invalid row(s). Fix them and re-upload.`,
      rowErrors
    );
  }
  if (out.length === 0) {
    throw new BadRequestError("CSV file contains no question rows.");
  }
  if (out.length > QUIZ_IMPORT_MAX_ROWS) {
    throw new BadRequestError(
      `File has ${out.length} questions. Maximum is ${QUIZ_IMPORT_MAX_ROWS}; split the file and retry.`
    );
  }
  return out;
}

/** Generate the downloadable CSV sample (header + 3 example rows). */
export function generateQuestionsCsvSample(): Buffer {
  const rows = [
    {
      Question: "What does HTTP stand for?",
      Type: "MCQ",
      Option1: "HyperText Transfer Protocol",
      Option2: "High Transfer Text Protocol",
      Option3: "Hyperlink Text Process",
      Option4: "Home Tool Transfer Protocol",
      Option5: "",
      Option6: "",
      CorrectOptions: "1",
      Marks: "1",
      Explanation: "HTTP stands for HyperText Transfer Protocol.",
    },
    {
      Question: "Which of these are JavaScript frameworks?",
      Type: "MCQ",
      Option1: "React",
      Option2: "Laravel",
      Option3: "Vue",
      Option4: "Django",
      Option5: "",
      Option6: "",
      CorrectOptions: "1,3",
      Marks: "2",
      Explanation: "React and Vue are JavaScript frameworks.",
    },
    {
      Question: "The capital of France is ___.",
      Type: "DRAG_DROP",
      Option1: "Paris",
      Option2: "London",
      Option3: "Berlin",
      Option4: "Madrid",
      Option5: "",
      Option6: "",
      CorrectOptions: "1",
      Marks: "1",
      Explanation: "Paris is the capital of France.",
    },
  ];
  const csv = Papa.unparse(rows, {
    columns: [...QUIZ_IMPORT_COLUMNS],
    newline: "\n",
  });
  return Buffer.from(csv + "\n", "utf-8");
}
