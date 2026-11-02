import type { CourseMode, CourseType } from "../types/course";

// Re-export the existing canonical aliases under our own names so the
// creator-intent module is self-contained at a type level.
export type { CourseMode, CourseType };

// Quiz answers captured by the signup wizard.
export interface QuizAnswers {
  course_type:
    | "Recorded courses"
    | "Live classes"
    | "Cohort programs"
    | "Test series"
    | "Community"
    | "Mentorship";
  creator_type:
    | "Engineering / coding"
    | "School coaching"
    | "Competitive exams"
    | "Fitness"
    | "Business coaching"
    | "Language"
    | "Arts & Design"
    | "Music"
    | "Cooking"
    | "Kids education"
    | "Finance / Trading"
    | "Other";
  business_stage: "0–100" | "100–1000" | "1000–10000" | "10000+";
  revenue_intent: "Below ₹50k" | "₹50k–₹2L" | "₹2L–₹10L" | "₹10L+";
  current_tools: string[];
}

// Closed enum of homepage templates available in @open-mtlms/lms-templates.
// Keep in sync with packages/lms-templates/src/page-templates.ts ids.
export type TemplateId =
  | "basic"
  | "code-tech"
  | "photography"
  | "mindfulness"
  | "examprep"
  | "govtexam"
  | "astrology"
  | "corpupskill";

// Closed enum of theme preset ids in @open-mtlms/ui-config.
// Keep in sync with packages/ui-config/src/themes/palettes.ts.
export type ThemeId =
  | "sunset-orange"
  | "shadcn-midnight"
  | "coral-warm"
  | "golden-luxury"
  | "noir-gold"
  | "examprep-academic"
  | "govtexam-warm"
  | "photography-brutalist"
  | "astrology-cosmic"
  | "corpupskill-slate"
  | "default"
  | "mindfulness";

export type CategorySlug =
  | "coding"
  | "photography"
  | "mindfulness"
  | "examprep"
  | "govtexam"
  | "astrology"
  | "corpupskill"
  | "generic";

// Backed by canonical CourseMode + CourseType from @open-mtlms/shared/types/course.
// Re-exported above as `CourseMode` / `CourseType` for consumer convenience.
// We only ever produce a subset (no "SHORTS" course_type), but we keep the
// broad type for assignment compatibility with downstream APIs.
export type CourseTypeEnum = Exclude<CourseType, "SHORTS">;

export interface AiHints {
  audience_persona: string;
  tone: "professional" | "casual" | "energetic" | "academic";
  growth_stage: "starter" | "growing" | "scaling" | "established";
  differentiators: string[];
  content_pillars: string[];
}

// Persisted on tenant_users.creator_intent_profile (JSONB).
// Single artifact downstream consumers (provisioning, AI re-runs) read.
export interface CreatorIntentProfile {
  raw_quiz_answers: QuizAnswers;
  org_name: string;
  template_id: TemplateId;
  theme_id: ThemeId;
  category_slug: CategorySlug;
  course_mode: CourseMode;
  course_type_enum: CourseTypeEnum;
  suggested_price_inr: number;
  ai_hints: AiHints;
  generation_source: "gemini" | "fallback";
}

// What the Gemini API call returns (schema-pinned).
export interface GeneratedAcademyBundle {
  template_id: TemplateId;
  theme_id: ThemeId;
  ai_hints: AiHints;
  hero_headline: string;
  hero_subheading: string;
  sample_course_title: string;
  sample_course_description: string;
  sample_course_outcomes: string[];
  faqs: Array<{ question: string; answer: string }>;
  about_intro_paragraph: string;
}
