import type {
  CourseAISectionKey,
  CourseFlavour,
  GeneratedCourseContent,
  ThumbnailContext,
} from "../services/course-ai.service";

export interface CourseAIJobData {
  tenantId: string;
  courseTitle: string;
  sections: CourseAISectionKey[];
  extraContext?: string;
  referenceDocument?: string;
  thumbnailContext?: ThumbnailContext;
  flavour?: CourseFlavour;
  targetAudience?: string;
  courseDuration?: string;
  difficultyLevel?: "beginner" | "intermediate" | "advanced" | "mixed";
  industry?: string;
  courseMetadata?: {
    subTitle?: string;
    description?: string;
    difficulty?: string;
    duration?: string;
    categoryNames?: string[];
    learningOutcomes?: string[];
  };
  // When set, the worker fetches the course's uploaded LMS curriculum
  // (sections/lessons/lectures) and grounds syllabus/offerings/FAQ generation
  // in the actual content instead of inventing it.
  lmsCourseId?: string;
  // Auto-apply mode (used by the onboarding wizard's provisioning flow only).
  // When `applyToDb` + `courseId` + `pageId` are all set, the worker persists
  // the AI result directly into the courses + course_sections/lessons/lectures
  // + course_faqs + tenant_pages.sections rows after generation completes.
  // so the wizard can be truly fire-and-forget. Manual "Generate all with AI"
  // never sets these (controller doesn't pass them through), so its behaviour
  // is unchanged.
  //
  // `courseMode` ("SELF_PACED" | "LIVE" | "HYBRID") is used to populate the
  // hero section's `mode` field when building tenant_pages.sections during
  // apply. Defaults to SELF_PACED inside the apply service if omitted.
  courseId?: string;
  pageId?: string;
  applyToDb?: boolean;
  courseMode?: string;
}

export type SectionStatus = "pending" | "processing" | "completed" | "failed";

export interface SectionProgress {
  status: SectionStatus;
  error?: string;
  result?: Partial<GeneratedCourseContent>;
}

export interface CourseAIJobProgress {
  status: "processing" | "completed" | "failed";
  currentSection?: CourseAISectionKey;
  sections: Partial<Record<CourseAISectionKey, SectionProgress>>;
  result: Partial<GeneratedCourseContent>;
  completedCount: number;
  totalCount: number;
  error?: string;
}
