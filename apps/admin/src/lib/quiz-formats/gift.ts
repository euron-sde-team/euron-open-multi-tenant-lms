/**
 * GIFT (Moodle) format parser + serializer.
 *
 * GIFT packs the answer into a `{ ... }` block embedded in the question text:
 *
 *   ::Capital:: What is the capital of France? { ~London =Paris ~Berlin }
 *   Is the earth flat? {FALSE}
 *   2 + 2 = {#4:0}
 *   The sky is {=blue =azure}        // short answer (fill in the blank)
 *   Pick two primary colors {~%50%Red ~Green ~%50%Blue}   // multiple answer
 *
 * Supported here: multiple choice (single / multiple), true-false, short answer
 * (mapped to FIB), and numerical (mapped to NAT). Matching and essay questions
 * are reported as unsupported and skipped. Per-answer feedback is dropped;
 * general feedback (####) maps to the question explanation.
 */

import { cleanRichText } from "./text";
import type {
  ParsedQuestion,
  ParseError,
  ParseResult,
  SerializeResult,
} from "./types";

const FORMAT_TAG_RE = /^\s*\[(?:html|markdown|moodle|plain)\]\s*/i;

// GIFT uses backslash as the escape character. Resolve every `\X` to a literal
// X in a single left-to-right pass (so `\\n` stays a literal backslash + n),
// with the one special case `\n` meaning a line break. This restores the `=`
// and `:` that Moodle escapes inside HTML attributes (dir\="ltr", text-align\:).
function unescapeGift(s: string): string {
  return s.replace(/\\([\s\S])/g, (_, ch) => (ch === "n" ? "\n" : ch));
}

function escapeGift(s: string): string {
  return s.replace(/([=~#{}:\\])/g, "\\$1");
}

/** Index of the first unescaped occurrence of `ch` at or after `from`. */
function findUnescaped(s: string, ch: string, from = 0): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === ch) return i;
  }
  return -1;
}

function cleanText(raw: string): string {
  // Strip the optional [html]/[markdown]/... format tag, resolve GIFT escapes
  // (Moodle escapes the `=` and `:` inside HTML attributes), then convert any
  // resulting HTML to readable plain text with entities decoded.
  const noTag = raw.replace(FORMAT_TAG_RE, "");
  const unescaped = unescapeGift(noTag);
  return cleanRichText(unescaped);
}

interface AnswerToken {
  sign: "=" | "~";
  weight: number | null;
  text: string;
}

function tokenizeAnswers(s: string): AnswerToken[] {
  const markers: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === "=" || s[i] === "~") markers.push(i);
  }
  const tokens: AnswerToken[] = [];
  for (let m = 0; m < markers.length; m++) {
    const start = markers[m];
    const end = m + 1 < markers.length ? markers[m + 1] : s.length;
    const sign = s[start] as "=" | "~";
    let rest = s.slice(start + 1, end);
    let weight: number | null = null;
    const wMatch = rest.match(/^%(-?\d+(?:\.\d+)?)%/);
    if (wMatch) {
      weight = parseFloat(wMatch[1]);
      rest = rest.slice(wMatch[0].length);
    }
    // Drop per-answer feedback (text after an unescaped #).
    const fb = findUnescaped(rest, "#");
    if (fb !== -1) rest = rest.slice(0, fb);
    tokens.push({ sign, weight, text: rest });
  }
  return tokens;
}

function parseNumeric(inner: string): { value: number; tolerance: number } | null {
  let body = inner.trim().replace(/^#/, "").trim();
  body = body.replace(/^=/, "").trim();
  const firstWs = body.search(/\s/);
  const spec = firstWs === -1 ? body : body.slice(0, firstWs);
  const range = spec.match(/^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/);
  if (range) {
    const lo = parseFloat(range[1]);
    const hi = parseFloat(range[2]);
    return { value: (lo + hi) / 2, tolerance: Math.abs(hi - lo) / 2 };
  }
  const tol = spec.match(/^(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?)$/);
  if (tol) {
    return { value: parseFloat(tol[1]), tolerance: Math.abs(parseFloat(tol[2])) };
  }
  const v = parseFloat(spec);
  if (Number.isFinite(v)) return { value: v, tolerance: 0 };
  return null;
}

function stripTitle(block: string): { title?: string; body: string } {
  if (!block.startsWith("::")) return { body: block };
  let i = 2;
  while (i < block.length) {
    if (block[i] === "\\") {
      i += 2;
      continue;
    }
    if (block[i] === ":" && block[i + 1] === ":") {
      return { title: block.slice(2, i).trim(), body: block.slice(i + 2) };
    }
    i++;
  }
  return { body: block };
}

function parseGiftBlock(block: string): ParsedQuestion {
  const { title, body } = stripTitle(block);

  const open = findUnescaped(body, "{");
  if (open === -1) {
    throw new Error("No answer block { } found");
  }
  const close = findUnescaped(body, "}", open + 1);
  if (close === -1) {
    throw new Error("Unclosed answer block { }");
  }

  const stem = cleanText(`${body.slice(0, open)} ${body.slice(close + 1)}`);
  if (!stem) throw new Error("Missing question text");

  const innerRaw = body.slice(open + 1, close);
  const inner = innerRaw.trim();

  if (inner === "") {
    throw new Error("Essay questions are not supported");
  }

  // Split off general feedback (####...) before tokenizing answers.
  let answerBody = inner;
  let explanation: string | undefined;
  const gfIdx = inner.indexOf("####");
  if (gfIdx !== -1) {
    answerBody = inner.slice(0, gfIdx);
    const gf = cleanText(inner.slice(gfIdx + 4));
    if (gf) explanation = gf;
  }

  const base = { title, explanation, warnings: [] as string[] };

  // True / False
  const tf = answerBody.trim().match(/^(TRUE|FALSE|T|F)\b/i);
  if (tf && !answerBody.includes("=") && !answerBody.includes("~")) {
    const isTrue = /^t/i.test(tf[1]);
    return {
      ...base,
      type: "TRUE_FALSE",
      stem,
      options: [
        { label: "True", isCorrect: isTrue },
        { label: "False", isCorrect: !isTrue },
      ],
    };
  }

  // Numerical
  if (answerBody.trim().startsWith("#")) {
    const num = parseNumeric(answerBody);
    if (!num) throw new Error("Could not read numerical answer");
    return { ...base, type: "NAT", stem, options: [], numericAnswer: num };
  }

  const tokens = tokenizeAnswers(answerBody);
  if (tokens.length === 0) {
    throw new Error("No answers found in { }");
  }

  const hasTilde = tokens.some((t) => t.sign === "~");

  // Only `=` answers (no `~`): either a matching question or short answer.
  if (!hasTilde) {
    // Matching uses `=key -> value`; test series has no matching type.
    if (/->/.test(answerBody)) {
      throw new Error("Matching questions are not supported");
    }
    const answers = tokens.map((t) => cleanText(t.text)).filter(Boolean);
    if (answers.length === 0) throw new Error("Short answer has no accepted answer");
    const warnings = answers.length > 1
      ? [`${answers.length - 1} alternative answer(s) kept only as the canonical answer`]
      : [];
    return {
      ...base,
      warnings,
      type: "FIB",
      stem,
      options: [],
      textAnswers: answers,
    };
  }

  // Multiple choice (single or multiple).
  const options = tokens.map((t) => ({
    label: cleanText(t.text),
    isCorrect: t.sign === "=" || (t.weight != null && t.weight > 0),
  }));
  if (options.length < 2) {
    throw new Error("Multiple choice needs at least 2 options");
  }
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount === 0) {
    throw new Error("No correct option marked");
  }
  return {
    ...base,
    type: correctCount > 1 ? "MCQ_MULTI" : "MCQ_SINGLE",
    stem,
    options,
  };
}

export function parseGift(text: string): ParseResult {
  const withoutComments = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");

  const blocks = withoutComments
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions: ParsedQuestion[] = [];
  const errors: ParseError[] = [];
  blocks.forEach((block, index) => {
    // $CATEGORY: directives organise a Moodle bank; they are not questions.
    if (/^\s*\$CATEGORY:/i.test(block)) return;
    try {
      questions.push(parseGiftBlock(block));
    } catch (e) {
      errors.push({
        index,
        block,
        message: e instanceof Error ? e.message : "Could not parse block",
      });
    }
  });
  return { questions, errors };
}

function giftBlock(q: ParsedQuestion): string | null {
  // GIFT has no drag-and-drop notation: serializing it as an MCQ block would
  // silently lose the blank semantics, so skip it (CSV export is the
  // full-fidelity path).
  if (q.type === "DRAG_DROP") return null;
  // Descriptive answers are human-graded: GIFT has no representation for them.
  if (q.type === "DESCRIPTIVE") return null;

  const stem = escapeGift(q.stem.replace(/\s*\n\s*/g, " "));
  const fb = q.explanation ? `\n\t####${escapeGift(q.explanation)}` : "";

  if (q.type === "TRUE_FALSE") {
    const correct = q.options.find((o) => o.isCorrect);
    const isTrue = correct ? /true/i.test(correct.label) : true;
    return `${stem} {${isTrue ? "TRUE" : "FALSE"}${fb}}`;
  }
  if (q.type === "NAT") {
    if (!q.numericAnswer) return null;
    const { value, tolerance } = q.numericAnswer;
    return `${stem} {#${value}:${tolerance}${fb}}`;
  }
  if (q.type === "FIB") {
    const answers = (q.textAnswers ?? []).filter(Boolean);
    if (answers.length === 0) return null;
    return `${stem} {${answers.map((a) => `=${escapeGift(a)}`).join(" ")}${fb}}`;
  }
  // MCQ_SINGLE / MCQ_MULTI
  if (q.options.length < 2) return null;
  const correctCount = q.options.filter((o) => o.isCorrect).length;
  if (correctCount === 0) return null;
  const lines = q.options.map((o) => {
    const t = escapeGift(o.label.replace(/\s*\n\s*/g, " "));
    if (q.type === "MCQ_MULTI") {
      const pct = Math.round(100 / correctCount);
      return o.isCorrect ? `\t~%${pct}%${t}` : `\t~${t}`;
    }
    return o.isCorrect ? `\t=${t}` : `\t~${t}`;
  });
  return `${stem} {\n${lines.join("\n")}${fb}\n}`;
}

export function serializeGift(questions: ParsedQuestion[]): SerializeResult {
  const blocks: string[] = [];
  let skipped = 0;
  for (const q of questions) {
    const block = giftBlock(q);
    if (block === null) {
      skipped += 1;
      continue;
    }
    blocks.push(block);
  }
  return { content: blocks.join("\n\n") + (blocks.length ? "\n" : ""), skipped };
}
