/**
 * CSV / Excel ("sheet") format for Test Series question banks.
 *
 * The dialog normalizes every spreadsheet input to CSV text (xlsx files are
 * converted via SheetJS `sheet_to_csv` in the upload handler), so this module
 * only ever deals with CSV strings and stays dependency-free: a small RFC4180
 * parser handles quoted fields, escaped quotes and CRLF line breaks.
 *
 * Unlike AIKEN/GIFT, sheet rows can represent ALL six test series question
 * types (including DRAG_DROP) and carry per-question metadata (marks,
 * negative marks, difficulty, subject, chapter, topic) that overrides the
 * dialog-level import defaults.
 */

import type {
  ParseError,
  ParseResult,
  ParsedQuestion,
  ParsedType,
  SerializeResult,
} from "./types";

/** Canonical column order, shared by the parser, samples and serializer. */
export const SHEET_COLUMNS = [
  "Question",
  "Type",
  "Option1",
  "Option2",
  "Option3",
  "Option4",
  "Option5",
  "Option6",
  "CorrectAnswer",
  "Tolerance",
  "Marks",
  "NegativeMarks",
  "Difficulty",
  "Subject",
  "Chapter",
  "Topic",
  "Explanation",
  "QuestionImage",
  "Option1Image",
  "Option2Image",
  "Option3Image",
  "Option4Image",
  "Option5Image",
  "Option6Image",
] as const;

const MAX_OPTIONS = 6;

/** lowercase + strip spaces/underscores/hyphens, e.g. "Negative Marks" -> "negativemarks" */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]+/g, "");
}

const HEADER_ALIASES: Record<string, string> = {
  correctoptions: "correctanswer",
  correctoption: "correctanswer",
  correctanswers: "correctanswer",
  answer: "correctanswer",
  questiontype: "type",
  positivemarks: "marks",
  positivemark: "marks",
  mark: "marks",
  negativemark: "negativemarks",
  negative: "negativemarks",
  negativemarking: "negativemarks",
  level: "difficulty",
  answerexplanation: "explanation",
  stemimage: "questionimage",
  questionimageurl: "questionimage",
  image: "questionimage",
  opt1image: "option1image",
  opt2image: "option2image",
  opt3image: "option3image",
  opt4image: "option4image",
  opt5image: "option5image",
  opt6image: "option6image",
};

const TYPE_ALIASES: Record<string, ParsedType> = {
  MCQ_SINGLE: "MCQ_SINGLE",
  MCQ: "MCQ_SINGLE",
  SINGLE: "MCQ_SINGLE",
  MCQ_MULTI: "MCQ_MULTI",
  MSQ: "MCQ_MULTI",
  MULTI: "MCQ_MULTI",
  MULTIPLE_CHOICE: "MCQ_MULTI",
  TRUE_FALSE: "TRUE_FALSE",
  TF: "TRUE_FALSE",
  TRUEFALSE: "TRUE_FALSE",
  FIB: "FIB",
  FILL: "FIB",
  FILL_BLANK: "FIB",
  FILL_IN_THE_BLANK: "FIB",
  NAT: "NAT",
  NUMERIC: "NAT",
  NUMERICAL: "NAT",
  DRAG_DROP: "DRAG_DROP",
  DRAGDROP: "DRAG_DROP",
  DRAG_AND_DROP: "DRAG_DROP",
  DESCRIPTIVE: "DESCRIPTIVE",
  DESC: "DESCRIPTIVE",
  SUBJECTIVE: "DESCRIPTIVE",
  LONG_ANSWER: "DESCRIPTIVE",
};

const OPTION_TYPES: ReadonlySet<ParsedType> = new Set([
  "MCQ_SINGLE",
  "MCQ_MULTI",
  "DRAG_DROP",
]);

/** Minimal RFC4180 CSV parser: quoted fields, "" escapes, CRLF/LF rows. */
function parseCsvRows(text: string): string[][] {
  // Strip a UTF-8 BOM (Excel prepends one when saving "CSV UTF-8").
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function isCommentRow(row: string[]): boolean {
  return (row[0] ?? "").trim().startsWith("#");
}

function isEmptyRow(row: string[]): boolean {
  return row.every((c) => c.trim() === "");
}

/**
 * Heuristic for AUTO format detection (tried only after AIKEN/GIFT detection
 * fails): the first meaningful line looks like our header row. Runs on every
 * keystroke, so only the head of the text is inspected.
 */
export function looksLikeSheet(text: string): boolean {
  const rows = parseCsvRows(text.slice(0, 4000));
  const header = rows.find((r) => !isEmptyRow(r) && !isCommentRow(r));
  if (!header) return false;
  const cells = header.map((c) => {
    const n = normalizeHeader(c.trim());
    return HEADER_ALIASES[n] ?? n;
  });
  return (
    cells.includes("question") &&
    (cells.includes("correctanswer") || cells.includes("type"))
  );
}

/** Parse 1-based, comma-separated option indices ("1,3"). Null on garbage. */
function parseIndices(value: string, optionCount: number): number[] | null {
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const idx = parseInt(p, 10);
    if (idx < 1 || idx > optionCount) return null;
    if (!out.includes(idx)) out.push(idx);
  }
  return out;
}

export function parseSheet(text: string): ParseResult {
  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];

  const allRows = parseCsvRows(text);
  const meaningful: Array<{ row: string[]; line: number }> = [];
  allRows.forEach((row, i) => {
    if (!isEmptyRow(row) && !isCommentRow(row)) {
      meaningful.push({ row, line: i + 1 });
    }
  });
  if (meaningful.length === 0) return { questions, errors };

  // ---- header ----
  const headerRow = meaningful[0].row;
  const colIndex: Record<string, number> = {};
  let headerError: string | null = null;
  headerRow.forEach((raw, i) => {
    const n = normalizeHeader(raw.trim());
    if (!n) return;
    const canonical = HEADER_ALIASES[n] ?? n;
    if (colIndex[canonical] !== undefined) {
      headerError = `Duplicate column "${raw.trim()}" (resolves to ${canonical})`;
    }
    colIndex[canonical] = i;
  });
  if (!headerError) {
    if (colIndex.question === undefined) {
      headerError = 'Missing required column "Question"';
    } else if (colIndex.correctanswer === undefined) {
      headerError = 'Missing required column "CorrectAnswer"';
    }
  }
  if (headerError) {
    errors.push({
      index: 0,
      block: headerRow.join(", "),
      message: headerError,
    });
    return { questions, errors };
  }

  // ---- data rows ----
  meaningful.slice(1).forEach(({ row, line }, dataIdx) => {
    const cell = (canonical: string): string => {
      const i = colIndex[canonical];
      if (i === undefined) return "";
      return (row[i] ?? "").trim();
    };
    const fail = (message: string, block?: string) => {
      errors.push({
        index: dataIdx,
        block: block ?? cell("question") ?? row.join(", "),
        message: `Row ${line}: ${message}`,
      });
    };

    const stem = cell("question");
    const stemImage = cell("questionimage");
    if (!stem && !stemImage) {
      fail("Question text or a QuestionImage is required", row.join(", "));
      return;
    }

    const rawType = cell("type");
    const typeKey = rawType
      ? rawType.toUpperCase().replace(/[\s-]+/g, "_")
      : "MCQ_SINGLE";
    const type = TYPE_ALIASES[typeKey];
    if (!type) {
      fail(`Unknown question type "${rawType}"`);
      return;
    }

    // A drag & drop stem marks its blank with "___". Only enforced when the
    // stem carries text (an image-only stem has no place for the marker).
    if (type === "DRAG_DROP" && stem && !stem.includes("___")) {
      fail('Drag & drop stems must contain "___" (three underscores)');
      return;
    }

    // An option is present when it has a label OR an image, so image-only
    // options (empty label + an OptionNImage) count and keep their position.
    const optionEntries: Array<{ label: string; image: string }> = [];
    for (let i = 1; i <= MAX_OPTIONS; i++) {
      const label = cell(`option${i}`);
      const image = cell(`option${i}image`);
      if (label || image) optionEntries.push({ label, image });
    }

    const warnings: string[] = [];
    const correctRaw = cell("correctanswer");
    if (!correctRaw) {
      fail("CorrectAnswer is required");
      return;
    }

    const q: ParsedQuestion = {
      type,
      stem,
      options: [],
      warnings,
    };
    if (stemImage) q.stemImage = stemImage;

    if (OPTION_TYPES.has(type)) {
      if (optionEntries.length < 2) {
        fail("At least 2 options are required");
        return;
      }
      const indices = parseIndices(correctRaw, optionEntries.length);
      if (!indices) {
        fail(
          `CorrectAnswer must be 1-based option numbers between 1 and ${optionEntries.length} (e.g. "2" or "1,3")`
        );
        return;
      }
      if (type !== "MCQ_MULTI" && indices.length !== 1) {
        fail("Exactly one correct option is required for this type");
        return;
      }
      const correctSet = new Set(indices);
      q.options = optionEntries.map((e, i) => ({
        label: e.label,
        isCorrect: correctSet.has(i + 1),
        ...(e.image ? { image: e.image } : {}),
      }));
    } else if (type === "TRUE_FALSE") {
      const v = correctRaw.toUpperCase();
      const isTrue = v === "TRUE" || v === "T";
      const isFalse = v === "FALSE" || v === "F";
      if (!isTrue && !isFalse) {
        fail("CorrectAnswer must be TRUE or FALSE");
        return;
      }
      q.options = [
        { label: "True", isCorrect: isTrue },
        { label: "False", isCorrect: isFalse },
      ];
    } else if (type === "FIB") {
      const answers = correctRaw
        .split("|")
        .map((a) => a.trim())
        .filter(Boolean);
      if (answers.length === 0) {
        fail("CorrectAnswer must contain at least one accepted answer");
        return;
      }
      q.textAnswers = answers;
    } else if (type === "DESCRIPTIVE") {
      // Human-graded, no options and no correct answer to validate.
    } else {
      // NAT
      const value = parseFloat(correctRaw);
      if (!Number.isFinite(value)) {
        fail("CorrectAnswer must be a number for numerical questions");
        return;
      }
      const tolRaw = cell("tolerance");
      let tolerance = 0;
      if (tolRaw) {
        const t = parseFloat(tolRaw);
        if (Number.isFinite(t) && t >= 0) {
          tolerance = t;
        } else {
          warnings.push(`Ignored invalid tolerance "${tolRaw}"`);
        }
      }
      q.numericAnswer = { value, tolerance };
    }

    // ---- per-row metadata overrides (invalid values warn + fall back) ----
    const marksRaw = cell("marks");
    if (marksRaw) {
      const m = parseFloat(marksRaw);
      if (Number.isFinite(m) && m > 0) q.marks = m;
      else warnings.push(`Ignored invalid marks "${marksRaw}"`);
    }
    const negRaw = cell("negativemarks");
    if (negRaw) {
      const n = parseFloat(negRaw);
      if (Number.isFinite(n) && n >= 0) q.negativeMarks = n;
      else warnings.push(`Ignored invalid negative marks "${negRaw}"`);
    }
    const diffRaw = cell("difficulty");
    if (diffRaw) {
      const d = diffRaw.toUpperCase();
      if (d === "EASY" || d === "MEDIUM" || d === "HARD") q.difficulty = d;
      else warnings.push(`Ignored invalid difficulty "${diffRaw}"`);
    }
    const subject = cell("subject");
    if (subject) q.subject = subject;
    const chapter = cell("chapter");
    if (chapter) q.chapter = chapter;
    const topic = cell("topic");
    if (topic) q.topic = topic;
    const explanation = cell("explanation");
    if (explanation) q.explanation = explanation;

    questions.push(q);
  });

  return { questions, errors };
}

// ---------------------------------------------------------------------------
// Serialization (export) + samples
// ---------------------------------------------------------------------------

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsv(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

function questionToCells(q: ParsedQuestion): string[] | null {
  // The sheet caps at 6 option columns (matches the question editor's cap).
  if (q.options.length > MAX_OPTIONS) return null;

  const optionCells = Array.from({ length: MAX_OPTIONS }, (_, i) =>
    q.type === "TRUE_FALSE" ? "" : q.options[i]?.label ?? ""
  );
  const optionImageCells = Array.from({ length: MAX_OPTIONS }, (_, i) =>
    q.type === "TRUE_FALSE" ? "" : q.options[i]?.image ?? ""
  );

  let correct = "";
  let tolerance = "";
  if (q.type === "TRUE_FALSE") {
    const t = q.options.find((o) => o.isCorrect);
    correct = t && /false/i.test(t.label) ? "FALSE" : "TRUE";
  } else if (q.type === "FIB") {
    correct = (q.textAnswers ?? []).join("|");
  } else if (q.type === "NAT") {
    correct = String(q.numericAnswer?.value ?? 0);
    const tol = q.numericAnswer?.tolerance ?? 0;
    tolerance = tol > 0 ? String(tol) : "";
  } else {
    correct = q.options
      .map((o, i) => (o.isCorrect ? String(i + 1) : null))
      .filter((x): x is string => x !== null)
      .join(",");
  }

  return [
    q.stem,
    q.type,
    ...optionCells,
    correct,
    tolerance,
    q.marks !== undefined ? String(q.marks) : "",
    q.negativeMarks !== undefined ? String(q.negativeMarks) : "",
    q.difficulty ?? "",
    q.subject ?? "",
    q.chapter ?? "",
    q.topic ?? "",
    q.explanation ?? "",
    q.stemImage ?? "",
    ...optionImageCells,
  ];
}

/** Full-fidelity CSV export: every type (incl. DRAG_DROP) + metadata. */
export function serializeSheetCsv(questions: ParsedQuestion[]): SerializeResult {
  const lines: string[] = [rowToCsv([...SHEET_COLUMNS])];
  let skipped = 0;
  for (const q of questions) {
    const cells = questionToCells(q);
    if (cells === null) {
      skipped += 1;
      continue;
    }
    lines.push(rowToCsv(cells));
  }
  return { content: lines.join("\n") + "\n", skipped };
}

const SAMPLE_COMMENTS = [
  "# Lines starting with # are comments and are skipped on import.",
  "# Type: MCQ_SINGLE | MCQ_MULTI | TRUE_FALSE | FIB | NAT | DRAG_DROP",
  "# CorrectAnswer: option numbers like 2 or 1,3 | TRUE/FALSE | text answer (use | between accepted FIB answers) | a number for NAT",
  "# DRAG_DROP stems must contain ___ (three underscores) to mark the blank.",
  "# QuestionImage / Option1Image..Option6Image: an image filename (e.g. q1.png), then upload the matching files in the import dialog, or paste a full https URL. Leave blank for text only questions.",
];

const SAMPLE_QUESTIONS: ParsedQuestion[] = [
  {
    type: "MCQ_SINGLE",
    stem: "What is the capital of France?",
    options: [
      { label: "London", isCorrect: false },
      { label: "Paris", isCorrect: true },
      { label: "Berlin", isCorrect: false },
      { label: "Madrid", isCorrect: false },
    ],
    marks: 4,
    negativeMarks: 1,
    difficulty: "EASY",
    subject: "Geography",
    chapter: "Europe",
    topic: "Capitals",
    explanation: "Paris has been the capital since 987 AD.",
    warnings: [],
  },
  {
    type: "MCQ_MULTI",
    stem: "Which of these are prime numbers?",
    options: [
      { label: "2", isCorrect: true },
      { label: "4", isCorrect: false },
      { label: "7", isCorrect: true },
      { label: "9", isCorrect: false },
    ],
    marks: 4,
    negativeMarks: 1,
    difficulty: "MEDIUM",
    subject: "Maths",
    chapter: "Numbers",
    topic: "Primes",
    explanation: "2 and 7 are prime.",
    warnings: [],
  },
  {
    type: "TRUE_FALSE",
    stem: "The Sun rises in the east.",
    options: [
      { label: "True", isCorrect: true },
      { label: "False", isCorrect: false },
    ],
    marks: 2,
    negativeMarks: 0.5,
    difficulty: "EASY",
    subject: "Science",
    chapter: "Astronomy",
    explanation: "Earth rotates west to east.",
    warnings: [],
  },
  {
    type: "FIB",
    stem: "The chemical symbol for gold is ____.",
    options: [],
    textAnswers: ["Au", "AU"],
    marks: 3,
    negativeMarks: 0,
    difficulty: "MEDIUM",
    subject: "Chemistry",
    chapter: "Elements",
    topic: "Symbols",
    explanation: "From the Latin aurum.",
    warnings: [],
  },
  {
    type: "NAT",
    stem: "What is 15% of 200?",
    options: [],
    numericAnswer: { value: 30, tolerance: 0.5 },
    marks: 4,
    negativeMarks: 1,
    difficulty: "EASY",
    subject: "Maths",
    chapter: "Percentages",
    explanation: "15/100 x 200 = 30.",
    warnings: [],
  },
  {
    type: "DRAG_DROP",
    stem: "HTML is a ___ language.",
    options: [
      { label: "markup", isCorrect: true },
      { label: "programming", isCorrect: false },
      { label: "query", isCorrect: false },
      { label: "styling", isCorrect: false },
    ],
    marks: 4,
    negativeMarks: 1,
    difficulty: "EASY",
    subject: "Computer Science",
    chapter: "Web",
    topic: "HTML",
    explanation: "Drag the correct word into the blank.",
    warnings: [],
  },
];

/**
 * Sample rows as an array-of-arrays (comment rows are single-cell rows).
 * Feeds both the CSV string (generateSampleCsv) and the xlsx sample download.
 */
export function generateSampleRows(): string[][] {
  return [
    ...SAMPLE_COMMENTS.map((c) => [c]),
    [...SHEET_COLUMNS],
    ...SAMPLE_QUESTIONS.map((q) => questionToCells(q) as string[]),
  ];
}

export function generateSampleCsv(): string {
  const lines = [
    ...SAMPLE_COMMENTS,
    rowToCsv([...SHEET_COLUMNS]),
    ...SAMPLE_QUESTIONS.map((q) => rowToCsv(questionToCells(q) as string[])),
  ];
  return lines.join("\n") + "\n";
}
