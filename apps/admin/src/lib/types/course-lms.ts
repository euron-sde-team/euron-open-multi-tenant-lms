import type { ContentPrice } from "@open-mtlms/shared";

/**
 * LMS Course (from /tenant/courses API - courses table)
 */
export interface LMSCourse {
  /** Bundles containing this course, drives the "Part of X" chip on cards. */
  bundles?: { id: string; title: string; slug: string }[];
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  /**
   * Landing page id (tenant_pages row with slug "courses/<slug>"), resolved
   * by the backend list endpoint; null when the page row is missing, absent
   * on single-fetch endpoints.
   */
  pageId?: string | null;
  subtitle: string | null;
  description: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  /** Multi-currency price book (returned on detail GETs). */
  prices?: ContentPrice[];
  purchaseMode: string;
  status: string;
  mode: string;
  difficulty: string;
  courseType: string;
  language: string[];
  thumbnailUrl: string | null;
  secondaryThumbnailUrl: string | null;
  previewUrl: string | null;
  thumbnailKey: string | null;
  secondaryThumbnailKey: string | null;
  previewKey: string | null;
  duration: string | null;
  learningOutcomes: string[];
  prerequisites: string[];
  sortOrder: number;
  lmsTemplateId: string | null;
  lmsSettings: unknown | null;
  categoryIds: string[];
  validityDays?: number | null;
  averageRating?: number;
  totalRatings?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LMSCoursesListResponse {
  courses: LMSCourse[];
  total: number;
  page: number;
  limit: number;
}

export interface CourseSection {
  id: string;
  tenant_id: string;
  course_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Lesson type stored on course_lessons.type (DB enum lesson_type).
 * LECTURE/QUIZ/ASSIGNMENT are the original types; PDF/LINK/TEXT/IMAGE are
 * standalone content lessons whose single body lives in one lesson_resources row.
 */
export type LessonType =
  | "LECTURE"
  | "QUIZ"
  | "ASSIGNMENT"
  | "PDF"
  | "LINK"
  | "TEXT"
  | "IMAGE";

/** Content lesson types, each owns exactly one lesson_resources row. */
export type ContentLessonType = "PDF" | "LINK" | "TEXT" | "IMAGE";

export interface CourseLesson {
  id: string;
  tenant_id: string;
  course_id: string;
  section_id: string;
  title: string;
  type: LessonType;
  sort_order: number;
  is_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lecture {
  id: string;
  tenant_id: string;
  course_id: string;
  lesson_id: string;
  title: string;
  video_key: string | null;
  video_provider: "YOUTUBE" | "EVS" | "HLS" | "MP4" | null;
  duration: string | null;
  resource_links: string[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  tenant_id: string;
  course_id: string;
  lesson_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface QuizOption {
  id: string;
  tenant_id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  /** Multi-blank DRAG_DROP: which blank ("___") this option answers (0-indexed). */
  blank_index: number | null;
  explanation: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  tenant_id: string;
  quiz_id: string;
  question: string;
  question_type?: "MCQ" | "DRAG_DROP";
  marks: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  options?: QuizOption[];
}

export interface Assignment {
  id: string;
  tenant_id: string;
  course_id: string;
  lesson_id: string;
  title: string;
  instructions: string | null;
  resource_links: string[];
  created_at: string;
  updated_at: string;
}

export interface CourseFaq {
  id: string;
  tenant_id: string;
  course_id: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CourseInstructorResponse {
  id: string;
  instructor_id: string;
  name: string;
  email: string | null;
  bio: string | null;
  expertise: string | null;
  profile_url: string | null;
  sort_order: number;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  github_url?: string | null;
  youtube_url?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
}

/** Section with lessons and their content (lecture/quiz/assignment) */
export interface LMSSectionWithLessons {
  id: string;
  tenant_id: string;
  course_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  lessons: Array<{
    lesson: CourseLesson;
    lecture: Lecture | null;
    quiz: Quiz | null;
    assignment: Assignment | null;
  }>;
}

export interface LMSCourseFullResponse {
  course: LMSCourse;
  sections: LMSSectionWithLessons[];
  faqs: CourseFaq[];
}
