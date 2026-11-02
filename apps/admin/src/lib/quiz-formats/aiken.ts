/**
 * AIKEN format parser + serializer.
 *
 * AIKEN is a deliberately simple, single-answer multiple-choice format:
 *
 *   What is the capital of France?
 *   A. London
 *   B) Paris
 *   C. Berlin
 *   ANSWER: B
 *
 * Rules:
 * - Questions are separated by one or more blank lines.
 * - Option lines start with a letter then `.` or `)` then the option text.
 * - The answer line is `ANSWER: X` (case-insensitive) with a single letter.
 * - Only single-correct MCQ is expressible. Two options labelled true/false are
 *   detected and emitted as TRUE_FALSE.
 */

import { cleanRichText } from "./text";
import type {
  ParsedQuestion,
  ParseError,
  ParseResult,
  SerializeResult,
} from "./types";

const OPTION_RE = /^([A-Za-z])[.)]\s+(.*)$/;
const ANSWER_RE = /^ANSWER\s*:\s*([A-Za-z])\s*$/i;

function splitBlocks(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

function isTrueFalsePair(labels: string[]): boolean {
  if (labels.length !== 2) return false;
  const norm = labels.map((l) => l.trim().toLowerCase());
  return (
    (norm[0] === "true" && norm[1] === "false") ||
    (norm[0] === "false" && norm[1] === "true")
  );
}

export function parseAiken(text: string): ParseResult {
  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];

  splitBlocks(text).forEach((block, index) => {
    const lines = block.split("\n").map((l) => l.trim());
    const stemLines: string[] = [];
    const optionLetters: string[] = [];
    const optionLabels: string[] = [];
    let answerLetter: string | null = null;

    for (const line of lines) {
      if (!line) continue;
      const answerMatch = line.match(ANSWER_RE);
      if (answerMatch) {
        answerLetter = answerMatch[1].toUpperCase();
        continue;
      }
      const optionMatch = line.match(OPTION_RE);
      if (optionMatch) {
        optionLetters.push(optionMatch[1].toUpperCase());
        optionLabels.push(optionMatch[2].trim());
        continue;
      }
      if (optionLabels.length === 0) {
        stemLines.push(line);
      } else {
        // Continuation of the previous option (wrapped line).
        optionLabels[optionLabels.length - 1] += ` ${line}`;
      }
    }

    const stem = cleanRichText(stemLines.join(" "));
    if (!stem) {
      errors.push({ index, block, message: "Missing question text" });
      return;
    }
    if (optionLabels.length < 2) {
      errors.push({ index, block, message: "Needs at least 2 options" });
      return;
    }
    if (!answerLetter) {
      errors.push({ index, block, message: "Missing ANSWER: line" });
      return;
    }
    const answerIdx = optionLetters.indexOf(answerLetter);
    if (answerIdx === -1) {
      errors.push({
        index,
        block,
        message: `ANSWER refers to option "${answerLetter}" which does not exist`,
      });
      return;
    }

    const type = isTrueFalsePair(optionLabels) ? "TRUE_FALSE" : "MCQ_SINGLE";
    questions.push({
      type,
      stem,
      options: optionLabels.map((label, i) => ({
        label: cleanRichText(label),
        isCorrect: i === answerIdx,
      })),
      warnings: [],
    });
  });

  return { questions, errors };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Serialize back to AIKEN. Only MCQ_SINGLE and TRUE_FALSE can be represented;
 * other types are skipped and counted so the caller can warn the user.
 */
export function serializeAiken(questions: ParsedQuestion[]): SerializeResult {
  const blocks: string[] = [];
  let skipped = 0;

  for (const q of questions) {
    if (q.type !== "MCQ_SINGLE" && q.type !== "TRUE_FALSE") {
      skipped += 1;
      continue;
    }
    const correctIdx = q.options.findIndex((o) => o.isCorrect);
    if (correctIdx === -1 || q.options.length < 2) {
      skipped += 1;
      continue;
    }
    const lines = [q.stem.replace(/\s*\n\s*/g, " ")];
    q.options.forEach((o, i) => {
      lines.push(`${LETTERS[i] ?? i}. ${o.label.replace(/\s*\n\s*/g, " ")}`);
    });
    lines.push(`ANSWER: ${LETTERS[correctIdx] ?? correctIdx}`);
    blocks.push(lines.join("\n"));
  }

  return { content: blocks.join("\n\n") + (blocks.length ? "\n" : ""), skipped };
}
