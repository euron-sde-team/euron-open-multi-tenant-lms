/**
 * Canonical intermediate representation (IR) for quiz questions imported from
 * or exported to text interchange formats (AIKEN, GIFT).
 *
 * Every parser produces ParsedQuestion[]; every serializer consumes it; and the
 * two destinations (Test Series question banks, Course LMS quizzes) map to and
 * from this one shape. This keeps format support and destination support
 * independent: adding a format or a destination is a single new adapter, never
 * a combinatorial change.
 */

export type ParsedType =
  | "MCQ_SINGLE"
  | "MCQ_MULTI"
  | "TRUE_FALSE"
  | "FIB"
  | "NAT"
  | "DRAG_DROP"
  | "DESCRIPTIVE";

export type QuizFormat = "AIKEN" | "GIFT";

export interface ParsedOption {
  label: string;
  isCorrect: boolean;
  /**
   * Optional option image: a filename (matched to an uploaded file during
   * import) or a full https URL. Resolved to `imageUrl` before import.
   */
  image?: string;
  /** Resolved public URL for the option image (set after upload). */
  imageUrl?: string;
}

export interface ParsedQuestion {
  type: ParsedType;
  /** Plain text stem (format markers stripped, escapes resolved). */
  stem: string;
  /** MCQ / True-False options. Empty for FIB and NAT. */
  options: ParsedOption[];
  /** FIB: accepted answers, first is canonical. */
  textAnswers?: string[];
  /** NAT: numeric answer with absolute tolerance (0 means exact). */
  numericAnswer?: { value: number; tolerance: number };
  /** Maps to Test Series `explanation` (GIFT general feedback). */
  explanation?: string;
  /** GIFT ::title:: if present (informational only). */
  title?: string;
  /**
   * Per-question metadata overrides (CSV/Excel rows carry their own values).
   * When present they take precedence over the dialog-level import defaults.
   */
  marks?: number;
  negativeMarks?: number;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  subject?: string;
  chapter?: string;
  topic?: string;
  /**
   * Optional stem image: a filename (matched to an uploaded file during import)
   * or a full https URL. Resolved to `stemImageUrl` before import.
   */
  stemImage?: string;
  /** Resolved public URL for the stem image (set after upload). */
  stemImageUrl?: string;
  /** Non-fatal notes surfaced in the preview (e.g. dropped alt answers). */
  warnings: string[];
}

export interface ParseError {
  /** 0-based index of the source block this error came from. */
  index: number;
  /** The raw text block that failed, for display. */
  block: string;
  message: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: ParseError[];
}

export interface SerializeResult {
  content: string;
  /** Count of questions that could not be represented in the target format. */
  skipped: number;
}
