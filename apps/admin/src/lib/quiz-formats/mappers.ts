/**
 * Adapters between the canonical ParsedQuestion IR and the two destinations:
 * Test Series question banks (rich, all five types) and Course LMS quizzes
 * (multiple-choice only). Import maps IR -> destination payload; export maps a
 * stored row -> IR for serialization.
 */

import type { ImportQuestionPayload } from "../api/question-library";
import type {
  CreateQuestionPayload,
  TestQuestion,
  TestQuestionDifficulty,
  TestQuestionStatus,
} from "../api/test-series";
import type { QuizQuestion } from "../types/course-lms";

import { cleanRichText } from "./text";
import type { ParsedQuestion, ParsedType } from "./types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface TestSeriesImportDefaults {
  marks: number;
  negativeMarks: number;
  difficulty: TestQuestionDifficulty;
  status: TestQuestionStatus;
  subject: string;
  chapter: string;
  topic: string;
}

export const TEST_SERIES_SUPPORTED_TYPES: ReadonlySet<ParsedType> = new Set([
  "MCQ_SINGLE",
  "MCQ_MULTI",
  "TRUE_FALSE",
  "FIB",
  "NAT",
  "DRAG_DROP",
  "DESCRIPTIVE",
]);

export const COURSE_QUIZ_SUPPORTED_TYPES: ReadonlySet<ParsedType> = new Set([
  "MCQ_SINGLE",
  "MCQ_MULTI",
  "TRUE_FALSE",
]);

// ---- IR -> destination payloads (import) ----

export function toTestSeriesPayload(
  q: ParsedQuestion,
  d: TestSeriesImportDefaults
): Omit<CreateQuestionPayload, "question_bank_id"> {
  // Per-question metadata (CSV/Excel rows) wins over the dialog defaults.
  const base = {
    explanation: q.explanation?.trim() || null,
    marks: q.marks ?? d.marks,
    negative_marks: q.negativeMarks ?? d.negativeMarks,
    difficulty: q.difficulty ?? d.difficulty,
    subject: (q.subject ?? d.subject).trim() || null,
    chapter: (q.chapter ?? d.chapter).trim() || null,
    topic: (q.topic ?? d.topic).trim() || null,
    status: d.status,
    created_via: "IMPORT" as const,
  };

  // When the row carries a stem image, store the stem as an object that keeps
  // both the (possibly empty) text and the image URL, matching the shape the
  // question editor writes. Otherwise keep the plain-string stem.
  const stemImageUrl = q.stemImageUrl?.trim();
  const stem: unknown = stemImageUrl
    ? { text: q.stem ?? "", imageUrl: stemImageUrl, imageSize: "md" }
    : q.stem;

  if (q.type === "FIB") {
    const answers = (q.textAnswers ?? []).filter((a) => a.trim().length > 0);
    return {
      ...base,
      type: "FIB",
      stem,
      options: null,
      // The grader accepts a string or an array of accepted answers.
      correct_answer: answers.length > 1 ? answers : answers[0] ?? "",
    };
  }
  if (q.type === "NAT") {
    const n = q.numericAnswer ?? { value: 0, tolerance: 0 };
    return {
      ...base,
      type: "NAT",
      stem,
      options: null,
      correct_answer:
        n.tolerance > 0 ? { value: n.value, tolerance: n.tolerance } : n.value,
    };
  }
  if (q.type === "TRUE_FALSE") {
    const correct = q.options.find((o) => o.isCorrect);
    const isTrue = correct ? /true/i.test(correct.label) : true;
    return {
      ...base,
      type: "TRUE_FALSE",
      stem,
      options: [
        { id: "TRUE", label: "True" },
        { id: "FALSE", label: "False" },
      ],
      correct_answer: isTrue ? "TRUE" : "FALSE",
    };
  }
  if (q.type === "DESCRIPTIVE") {
    // Human-graded, no options or correct answer (backend nulls them).
    return {
      ...base,
      type: "DESCRIPTIVE",
      stem: q.stem,
    };
  }
  // MCQ_SINGLE / MCQ_MULTI / DRAG_DROP: ids assigned A, B, C... in parse order.
  const options = q.options.map((o, i) => {
    const id = LETTERS[i] ?? String(i);
    const url = o.imageUrl?.trim();
    return url
      ? { id, label: o.label, imageUrl: url, imageSize: "md" }
      : { id, label: o.label };
  });
  const correctIds = q.options
    .map((o, i) => (o.isCorrect ? LETTERS[i] ?? String(i) : null))
    .filter((x): x is string => x != null);
  if (q.type === "MCQ_MULTI") {
    return {
      ...base,
      type: "MCQ_MULTI",
      stem,
      options,
      correct_answer: correctIds,
    };
  }
  // DRAG_DROP has the same single-correct-option shape as MCQ_SINGLE; the stem
  // carries the "___" blank (validated upstream by the parser and the backend).
  return {
    ...base,
    type: q.type === "DRAG_DROP" ? "DRAG_DROP" : "MCQ_SINGLE",
    stem,
    options,
    correct_answer: correctIds[0] ?? "",
  };
}

export function toCourseQuizPayload(
  q: ParsedQuestion,
  marks: number
): ImportQuestionPayload {
  return {
    question: q.stem,
    marks,
    options: q.options.map((o, i) => ({
      option_text: o.label,
      is_correct: o.isCorrect,
      sort_order: i,
    })),
  };
}

// ---- destination row -> IR (export) ----

function stemToString(stem: unknown): string {
  if (typeof stem === "string") return stem;
  if (stem && typeof stem === "object") {
    const o = stem as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (typeof o.html === "string") return o.html.replace(/<[^>]+>/g, " ");
  }
  return "";
}

function optionArray(
  options: unknown
): Array<{ id: string; label: string; image?: string }> {
  if (!Array.isArray(options)) return [];
  return options.map((o, i) => {
    if (typeof o === "string") return { id: LETTERS[i] ?? String(i), label: o };
    if (o && typeof o === "object") {
      const obj = o as Record<string, unknown>;
      const img =
        typeof obj.imageUrl === "string" && obj.imageUrl.trim()
          ? obj.imageUrl.trim()
          : undefined;
      return {
        id: String(obj.id ?? LETTERS[i] ?? i),
        label: String(obj.label ?? obj.text ?? ""),
        image: img,
      };
    }
    return { id: LETTERS[i] ?? String(i), label: String(o) };
  });
}

/** Pull a stem image URL out of an object stem ({ text, imageUrl }); else none. */
function stemImageUrlFrom(stem: unknown): string | undefined {
  if (stem && typeof stem === "object") {
    const u = (stem as Record<string, unknown>).imageUrl;
    if (typeof u === "string" && u.trim()) return u.trim();
  }
  return undefined;
}

export function testQuestionToIR(row: TestQuestion): ParsedQuestion {
  const stem = cleanRichText(stemToString(row.stem));
  const stemImage = stemImageUrlFrom(row.stem);
  const explanation = row.explanation
    ? cleanRichText(row.explanation)
    : undefined;
  // Carry the row's own metadata so spreadsheet export is full fidelity.
  const marks = parseFloat(row.marks);
  const negativeMarks = parseFloat(row.negativeMarks);
  const meta = {
    marks: Number.isFinite(marks) ? marks : undefined,
    negativeMarks: Number.isFinite(negativeMarks) ? negativeMarks : undefined,
    difficulty: row.difficulty,
    subject: row.subject ?? undefined,
    chapter: row.chapter ?? undefined,
    topic: row.topic ?? undefined,
  };

  if (row.type === "FIB") {
    const raw = Array.isArray(row.correctAnswer)
      ? row.correctAnswer.map(String)
      : [
          typeof row.correctAnswer === "string"
            ? row.correctAnswer
            : String(row.correctAnswer ?? ""),
        ];
    const textAnswers = raw.map(cleanRichText).filter(Boolean);
    return {
      type: "FIB",
      stem,
      options: [],
      textAnswers,
      explanation,
      ...meta,
      stemImage,
      warnings: [],
    };
  }
  if (row.type === "NAT") {
    const ca = row.correctAnswer;
    let value = 0;
    let tolerance = 0;
    if (typeof ca === "number") {
      value = ca;
    } else if (ca && typeof ca === "object") {
      const o = ca as Record<string, unknown>;
      value = Number(o.value ?? 0);
      tolerance = Number(o.tolerance ?? 0);
    } else {
      value = Number(ca ?? 0);
    }
    return {
      type: "NAT",
      stem,
      options: [],
      numericAnswer: { value, tolerance },
      explanation,
      ...meta,
      stemImage,
      warnings: [],
    };
  }
  if (row.type === "TRUE_FALSE") {
    const ca = String(row.correctAnswer ?? "").toUpperCase();
    return {
      type: "TRUE_FALSE",
      stem,
      options: [
        { label: "True", isCorrect: ca === "TRUE" },
        { label: "False", isCorrect: ca === "FALSE" },
      ],
      explanation,
      ...meta,
      stemImage,
      warnings: [],
    };
  }
  if (row.type === "DESCRIPTIVE") {
    // Human-graded, no options and no stored correct answer. The AIKEN/GIFT
    // serializers skip it; the spreadsheet exporter writes the stem + metadata.
    return {
      type: "DESCRIPTIVE",
      stem,
      options: [],
      explanation,
      ...meta,
      warnings: [],
    };
  }
  const opts = optionArray(row.options);
  const correct =
    row.type === "MCQ_MULTI"
      ? new Set(
          (Array.isArray(row.correctAnswer) ? row.correctAnswer : []).map(String)
        )
      : new Set([String(row.correctAnswer ?? "")]);
  // DRAG_DROP keeps its real type in the IR: the spreadsheet format can
  // represent it, and the AIKEN/GIFT serializers skip it (counted as skipped).
  return {
    type: row.type,
    stem,
    options: opts.map((o) => ({
      label: cleanRichText(o.label),
      isCorrect: correct.has(o.id),
      ...(o.image ? { image: o.image } : {}),
    })),
    explanation,
    ...meta,
    stemImage,
    warnings: [],
  };
}

export function quizQuestionToIR(q: QuizQuestion): ParsedQuestion {
  const opts = (q.options ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const correctCount = opts.filter((o) => o.is_correct).length;
  return {
    type: correctCount > 1 ? "MCQ_MULTI" : "MCQ_SINGLE",
    stem: cleanRichText(q.question),
    options: opts.map((o) => ({
      label: cleanRichText(o.option_text),
      isCorrect: o.is_correct,
    })),
    warnings: [],
  };
}
