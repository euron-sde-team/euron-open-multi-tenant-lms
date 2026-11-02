import type { QuizAnswers } from "@open-mtlms/shared";

import {
  defaultBusinessInfo,
  type BusinessInfo,
} from "@/components/pages/onboarding-wizard/types";

const INDUSTRY_BY_CREATOR_TYPE: Record<QuizAnswers["creator_type"], string> = {
  "Engineering / coding": "Engineering / coding education",
  "School coaching": "School-level academic coaching",
  "Competitive exams": "Competitive exam preparation",
  Fitness: "Fitness & wellness",
  "Business coaching": "Business & professional coaching",
  Language: "Language learning",
  "Arts & Design": "Arts, crafts & creative skills",
  Music: "Music & audio production",
  Cooking: "Cooking & culinary skills",
  "Kids education": "Kids learning & school tutoring",
  "Finance / Trading": "Finance, trading & investing",
  Other: "Online education",
};

const TONE_BY_CREATOR_TYPE: Record<
  QuizAnswers["creator_type"],
  string
> = {
  "Engineering / coding":
    "practical and project-driven, with a focus on shipping real-world software skills",
  "School coaching":
    "supportive and structured, aligned with school curricula and exam patterns",
  "Competitive exams":
    "rigorous and discipline-led, focused on consistent practice and rank improvement",
  Fitness:
    "energetic and habit-building, focused on sustainable transformation",
  "Business coaching":
    "outcome-driven and grounded in lived business experience",
  Language:
    "conversational and immersion-focused, balancing fluency with accuracy",
  "Arts & Design":
    "hands-on and expressive, focused on building real creative skill and portfolio-worthy work",
  Music:
    "energetic and performance-focused, balancing technique with creative expression",
  Cooking:
    "warm and practical, focused on repeatable techniques and confidence in the kitchen",
  "Kids education":
    "friendly and encouraging, designed to keep young learners engaged and progressing",
  "Finance / Trading":
    "rigorous and results-driven, grounded in real market experience and risk discipline",
  Other:
    "structured and learner-first, designed for measurable progress",
};

function describeAudience(stage: QuizAnswers["business_stage"]): string {
  switch (stage) {
    case "0–100":
      return "early adopters and motivated first learners";
    case "100–1000":
      return "a growing community of learners across India";
    case "1000–10000":
      return "thousands of active learners spanning multiple cohorts";
    case "10000+":
      return "a large established learner base with proven outcomes";
  }
}

/**
 * Synthesize a BusinessInfo bundle from quiz answers + signup metadata.
 * Fed to the per-section AI engine, the same shape the existing
 * /dashboard/pages onboarding wizard hands to pageAIService.generateSection.
 */
export function buildBusinessInfoFromQuiz(input: {
  orgName: string;
  signupName: string | null;
  signupEmail: string;
  quizAnswers: QuizAnswers;
}): BusinessInfo {
  const { orgName, signupName, signupEmail, quizAnswers } = input;
  const tone = TONE_BY_CREATOR_TYPE[quizAnswers.creator_type];
  const audience = describeAudience(quizAnswers.business_stage);
  const industry = INDUSTRY_BY_CREATOR_TYPE[quizAnswers.creator_type];

  const tagline = `${quizAnswers.course_type} for ${quizAnswers.creator_type.toLowerCase()} learners.`;

  const description = [
    `${orgName} is an online learning academy specialising in ${industry.toLowerCase()}.`,
    `Format: ${quizAnswers.course_type.toLowerCase()}.`,
    `We serve ${audience}.`,
    `Our teaching style is ${tone}.`,
  ].join(" ");

  return {
    ...defaultBusinessInfo,
    name: orgName,
    tagline,
    description,
    contactEmail: signupEmail,
    supportEmail: signupEmail,
    founderName: signupName ?? "",
    founderTitle: signupName ? "Founder & Lead Instructor" : "",
    founderBio: signupName
      ? `${signupName} founded ${orgName} to help learners achieve real, measurable outcomes through ${quizAnswers.course_type.toLowerCase()}.`
      : "",
    legalEntityName: orgName,
    yearEstablished: String(new Date().getUTCFullYear()),
    industry,
  };
}
