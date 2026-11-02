// Mirror of packages/shared/src/creator-intent/derive-profile.ts.
import { derivePriceINR } from "./derive-price";
import { pickDefaultTemplate } from "./template-mapping";
import type {
  CourseMode,
  CourseTypeEnum,
  CreatorIntentProfile,
  QuizAnswers,
  TemplateId,
  ThemeId,
} from "./types";

function inferCourseMode(courseType: QuizAnswers["course_type"]): CourseMode {
  switch (courseType) {
    case "Live classes":
    case "Cohort programs":
    case "Mentorship":
      return "LIVE";
    case "Recorded courses":
    case "Test series":
      return "SELF_PACED";
    case "Community":
      return "HYBRID";
  }
}

function inferCourseTypeEnum(
  courseType: QuizAnswers["course_type"],
): CourseTypeEnum {
  if (courseType === "Live classes") return "WEBINAR";
  if (courseType === "Cohort programs" || courseType === "Mentorship") {
    return "PROJECT";
  }
  return "NORMAL";
}

function inferGrowthStage(
  stage: QuizAnswers["business_stage"],
): CreatorIntentProfile["ai_hints"]["growth_stage"] {
  switch (stage) {
    case "0–100":
      return "starter";
    case "100–1000":
      return "growing";
    case "1000–10000":
      return "scaling";
    case "10000+":
      return "established";
  }
}

function inferTone(
  creatorType: QuizAnswers["creator_type"],
): CreatorIntentProfile["ai_hints"]["tone"] {
  switch (creatorType) {
    case "Engineering / coding":
      return "professional";
    case "Competitive exams":
    case "School coaching":
      return "academic";
    case "Fitness":
    case "Music":
      return "energetic";
    case "Business coaching":
    case "Finance / Trading":
      return "professional";
    case "Language":
    case "Arts & Design":
    case "Cooking":
    case "Kids education":
    case "Other":
    default:
      return "casual";
  }
}

export function deriveCreatorIntentProfile(
  answers: QuizAnswers,
  orgName: string,
): CreatorIntentProfile {
  const pick = pickDefaultTemplate(answers, orgName);
  return {
    raw_quiz_answers: answers,
    org_name: orgName,
    template_id: pick.template_id,
    theme_id: pick.theme_id,
    category_slug: pick.category_slug,
    course_mode: inferCourseMode(answers.course_type),
    course_type_enum: inferCourseTypeEnum(answers.course_type),
    suggested_price_inr: derivePriceINR(
      answers.revenue_intent,
      answers.course_type,
    ),
    ai_hints: {
      audience_persona: `Learners at the ${inferGrowthStage(answers.business_stage)} stage looking for ${answers.course_type.toLowerCase()}`,
      tone: inferTone(answers.creator_type),
      growth_stage: inferGrowthStage(answers.business_stage),
      differentiators: [],
      content_pillars: [],
    },
    generation_source: "fallback",
  };
}

/**
 * Fold the model's template+theme pick into the deterministic profile so the
 * persisted snapshot reflects what was actually used.
 */
export function applyTemplatePickToProfile(
  base: CreatorIntentProfile,
  pick: { template_id: TemplateId; theme_id: ThemeId },
): CreatorIntentProfile {
  return {
    ...base,
    template_id: pick.template_id,
    theme_id: pick.theme_id,
    generation_source: "ai",
  };
}
