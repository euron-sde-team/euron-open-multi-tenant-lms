import { derivePriceINR } from "./derive-price";
import { pickDefaultTemplate } from "./template-mapping";
import type {
  CourseMode,
  CourseTypeEnum,
  CreatorIntentProfile,
  GeneratedAcademyBundle,
  QuizAnswers,
} from "./types";

// Live classes are not part of this build, so every generated course is
// self-paced; cohort and mentorship intents become project-style courses.
function inferCourseMode(_courseType: QuizAnswers["course_type"]): CourseMode {
  return "SELF_PACED";
}

function inferCourseTypeEnum(
  courseType: QuizAnswers["course_type"],
): CourseTypeEnum {
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
      return "energetic";
    case "Business coaching":
      return "professional";
    case "Language":
    case "Other":
    default:
      return "casual";
  }
}

// Deterministic profile, used when Gemini is unavailable, and as the
// "preferred default" fed to Gemini so its inference stays anchored.
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

// Fold a Gemini-returned bundle into the deterministic profile, overriding
// template/theme/ai_hints with what Gemini chose.
export function applyBundleToProfile(
  base: CreatorIntentProfile,
  bundle: GeneratedAcademyBundle,
): CreatorIntentProfile {
  return {
    ...base,
    template_id: bundle.template_id,
    theme_id: bundle.theme_id,
    ai_hints: bundle.ai_hints,
    generation_source: "gemini",
  };
}
