export * from "./types";
export { parseAiken, serializeAiken } from "./aiken";
export { parseGift, serializeGift } from "./gift";
export { detectFormat } from "./detect";
export { downloadTextFile, toFileSlug } from "./download";
export {
  SHEET_COLUMNS,
  parseSheet,
  looksLikeSheet,
  serializeSheetCsv,
  generateSampleCsv,
  generateSampleRows,
} from "./sheet";
export * from "./mappers";

import { parseAiken, serializeAiken } from "./aiken";
import { parseGift, serializeGift } from "./gift";
import type {
  ParsedQuestion,
  ParseResult,
  QuizFormat,
  SerializeResult,
} from "./types";

/** Parse raw text with the chosen format. */
export function parseQuestions(text: string, format: QuizFormat): ParseResult {
  return format === "AIKEN" ? parseAiken(text) : parseGift(text);
}

/** Serialize IR questions to the chosen format. */
export function serializeQuestions(
  questions: ParsedQuestion[],
  format: QuizFormat
): SerializeResult {
  return format === "AIKEN" ? serializeAiken(questions) : serializeGift(questions);
}
