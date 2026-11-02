import { BadRequestError } from "../../errors/bad-request.error";
import type { QuizAnswers } from "./types";

const COURSE_TYPES = new Set<QuizAnswers["course_type"]>([
  "Recorded courses",
  "Live classes",
  "Cohort programs",
  "Test series",
  "Community",
  "Mentorship",
]);

const CREATOR_TYPES = new Set<QuizAnswers["creator_type"]>([
  "Engineering / coding",
  "School coaching",
  "Competitive exams",
  "Fitness",
  "Business coaching",
  "Language",
  "Arts & Design",
  "Music",
  "Cooking",
  "Kids education",
  "Finance / Trading",
  "Other",
]);

const BUSINESS_STAGES = new Set<QuizAnswers["business_stage"]>([
  "0–100",
  "100–1000",
  "1000–10000",
  "10000+",
]);

const REVENUE_INTENTS = new Set<QuizAnswers["revenue_intent"]>([
  "Below ₹50k",
  "₹50k–₹2L",
  "₹2L–₹10L",
  "₹10L+",
]);

/**
 * Reverse the HTML-entity escaping applied by the global express-xss-sanitizer
 * middleware. It rewrites HTML-significant characters in every request body
 * string (e.g. "Arts & Design" -> "Arts &amp; Design"), which would otherwise
 * make an allowlisted quiz option fail its exact-match check. These fields are
 * strict enums validated below, so decoding is safe, anything not in the
 * allowlist is still rejected.
 */
function decodeSanitizedEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Strictly validate the quiz_answers payload sent by the wizard. The
 * provisioning pipeline reads enum-typed fields directly (e.g.
 * `answers.course_type.toLowerCase()`), so a stale frontend or partially
 * filled payload would crash with a 500 instead of a controlled 400.
 *
 * Returns the parsed value on success; throws BadRequestError otherwise.
 */
export function validateQuizAnswers(value: unknown): QuizAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestError("quiz_answers must be an object");
  }

  const v = value as Record<string, unknown>;

  const courseType =
    typeof v.course_type === "string" ? decodeSanitizedEntities(v.course_type) : v.course_type;
  const creatorType =
    typeof v.creator_type === "string" ? decodeSanitizedEntities(v.creator_type) : v.creator_type;
  const businessStage =
    typeof v.business_stage === "string" ? decodeSanitizedEntities(v.business_stage) : v.business_stage;
  const revenueIntent =
    typeof v.revenue_intent === "string" ? decodeSanitizedEntities(v.revenue_intent) : v.revenue_intent;

  if (typeof courseType !== "string" || !COURSE_TYPES.has(courseType as QuizAnswers["course_type"])) {
    throw new BadRequestError("quiz_answers.course_type is invalid");
  }
  if (typeof creatorType !== "string" || !CREATOR_TYPES.has(creatorType as QuizAnswers["creator_type"])) {
    throw new BadRequestError("quiz_answers.creator_type is invalid");
  }
  if (typeof businessStage !== "string" || !BUSINESS_STAGES.has(businessStage as QuizAnswers["business_stage"])) {
    throw new BadRequestError("quiz_answers.business_stage is invalid");
  }
  if (typeof revenueIntent !== "string" || !REVENUE_INTENTS.has(revenueIntent as QuizAnswers["revenue_intent"])) {
    throw new BadRequestError("quiz_answers.revenue_intent is invalid");
  }
  if (!Array.isArray(v.current_tools) || v.current_tools.some((t) => typeof t !== "string")) {
    throw new BadRequestError("quiz_answers.current_tools must be an array of strings");
  }

  return {
    course_type: courseType as QuizAnswers["course_type"],
    creator_type: creatorType as QuizAnswers["creator_type"],
    business_stage: businessStage as QuizAnswers["business_stage"],
    revenue_intent: revenueIntent as QuizAnswers["revenue_intent"],
    current_tools: v.current_tools as string[],
  };
}

/**
 * IANA timezone identifier validator. Uses the platform Intl API so we
 * don't ship a static list. Returns the trimmed value or undefined.
 */
export function validateTimezone(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new BadRequestError("timezone must be a string");
  }
  const trimmed = value.trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return trimmed;
  } catch {
    throw new BadRequestError(`timezone is not a valid IANA identifier: ${trimmed}`);
  }
}
