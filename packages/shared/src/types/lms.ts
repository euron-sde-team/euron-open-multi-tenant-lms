/**
 * LMS (Learning Management System) Types
 * 
 * These types define the data structures for the course player/learning experience.
 * Used by both admin (content management) and web (learner) applications.
 */

import type { CourseLecture, CourseSectionData, CourseFormData } from "./course";

// ============================================================================
// Video Provider Types
// ============================================================================

export type VideoProvider = "youtube" | "evs" | "hls" | "mp4";

export interface LMSVideoConfig {
  /** Video provider: YouTube, an EVS (video system) id, or an external HLS / MP4 URL */
  provider: VideoProvider;
  /** YouTube video id, EVS video id, or the external HLS / MP4 URL */
  videoId: string;
  /** Start time in seconds (YouTube) */
  startTime?: number;
  /**
   * Furthest point (seconds) the learner has already reached in this video. In
   * a sequential course forward seeking is allowed up to here, so coming back
   * to a video never forces re-watching what was already watched.
   */
  furthestWatched?: number;
  /** Video duration in seconds */
  duration?: number;
  /** Video thumbnail URL */
  thumbnail?: string;
  // ── Resolved playback (provider === "evs" | "hls" | "mp4") ─────────────────
  /** HLS manifest URL: the tokenized EVS session manifest, or an external .m3u8. */
  hlsUrl?: string;
  /** Direct MP4 URL (provider === "mp4"). */
  mp4Url?: string;
  /** Poster image URL. */
  posterUrl?: string;
  /** Scrub-thumbnail WebVTT URL. */
  thumbnailsVttUrl?: string;
  /** Watermark text overlaid by the player (viewer email/phone). */
  watermarkText?: string;
}

// ============================================================================
// Resource Types
// ============================================================================

export type LMSResourceType = "pdf" | "link" | "article" | "text" | "github";

export interface LMSResource {
  id: string;
  /** Resource type */
  type: LMSResourceType;
  /** Resource title */
  title: string;
  /** Optional description */
  description?: string;
  /** URL for pdf, link, github types */
  url?: string;
  /** Content for text/article types (markdown supported) */
  content?: string;
  /** File size in bytes (for downloadable resources) */
  fileSize?: number;
  /** MIME type (for files) */
  mimeType?: string;
  /** Whether resource can be downloaded */
  downloadable: boolean;
  /** Display order */
  order: number;
  /** Created timestamp */
  createdAt?: string;
}

// ============================================================================
// Rating Types
// ============================================================================

export interface LMSRating {
  id: string;
  /** User who submitted the rating */
  userId: string;
  userName: string;
  userAvatar?: string;
  /** Rating value (1-5 stars) */
  rating: number;
  /** Optional review text */
  review?: string;
  /** Timestamps */
  createdAt: string;
  updatedAt?: string;
}

export interface LMSRatingSummary {
  /** Average rating (1-5) */
  averageRating: number;
  /** Total number of ratings */
  totalRatings: number;
  /** Distribution of ratings by star count */
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

// ============================================================================
// Progress Types
// ============================================================================

export interface LMSLessonProgress {
  /** Lesson ID */
  lessonId: string;
  /** Whether lesson is completed */
  completed: boolean;
  /** Completion timestamp */
  completedAt?: string;
  /** Video watch time in seconds */
  watchedSeconds?: number;
  /** Total video duration in seconds */
  totalSeconds?: number;
  /** Last watched position in seconds */
  lastPosition?: number;
}

export interface LMSCourseProgress {
  /** Course ID */
  courseId: string;
  /** User ID */
  userId?: string;
  /** Total lessons in course */
  totalLessons: number;
  /** Number of completed lessons */
  completedLessons: number;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Per-lesson progress data */
  lessonProgress: LMSLessonProgress[];
  /** When user started the course */
  startedAt?: string;
  /** Last access timestamp */
  lastAccessedAt?: string;
  /** Completion timestamp */
  completedAt?: string;
}

// ============================================================================
// Extended Lesson & Section Types
// ============================================================================

export interface LMSLesson extends CourseLecture {
  /** Video configuration */
  video?: LMSVideoConfig;
  /** Resources attached to this lesson */
  resources: LMSResource[];
  /** Whether lesson is available as free preview */
  isFreePreview?: boolean;
  /** Estimated time in minutes */
  estimatedTime?: number;
  /**
   * Lesson type. Lowercase values are the editor's internal aliases
   * (video = LECTURE). Uppercase values mirror the DB `lesson_type` enum.
   * PDF/LINK/TEXT/IMAGE are standalone content lessons, each owns exactly one
   * lesson_resources row that holds its single body.
   */
  lessonType?:
    | "video"
    | "text"
    | "quiz"
    | "assignment"
    | "LECTURE"
    | "ASSIGNMENT"
    | "QUIZ"
    | "PDF"
    | "LINK"
    | "TEXT"
    | "IMAGE";
  /** Lecture ID (for linking to live sessions) */
  lectureId?: string;
  /** Assignment ID (for LESSON-scope assignments) */
  assignmentId?: string;
  /** Quiz ID (for QUIZ lessons) */
  quizId?: string;
  /** Quiz data (for QUIZ lessons) */
  quiz?: {
    id: string;
    title: string;
    instructions: string | null;
    max_score: number;
    pass_percentage: number;
    due_date: string | null;
    question_count?: number;
    questions?: Array<{
      id: string;
      question?: string;
      text?: string;
      marks: number;
      options: Array<{
        id: string;
        option_text?: string;
        text?: string;
        is_correct?: boolean;
      }>;
    }>;
    attempt?: {
      id: string;
      status: string;
      score: number;
      total_marks: number;
      started_at: string;
      completed_at: string | null;
    } | null;
  };
  /** Assignment data (for ASSIGNMENT lessons: PDF URL, instructions, etc.) */
  assignment?: {
    id: string;
    title: string;
    instructions: string | null;
    content_type: string;
    max_score: number;
    due_date: string | null;
    pdf_url: string | null;
  };
  /**
   * Content body for standalone content lessons (PDF/LINK/TEXT/IMAGE).
   * These lessons own exactly one lesson_resources row, surfaced here so the
   * template can render it in the main lesson area (where the video/quiz/
   * assignment normally render) instead of a side "Resources" tab.
   */
  content?: {
    type: "PDF" | "LINK" | "TEXT" | "IMAGE";
    /** URL for PDF / LINK / IMAGE */
    url?: string | null;
    /** Sanitized rich text for TEXT */
    content?: string | null;
    /** Whether a download button is offered (PDF / IMAGE) */
    downloadable?: boolean;
    /** Resource title */
    title?: string | null;
  };
}

export interface LMSSection extends Omit<CourseSectionData, "subtopics" | "modules"> {
  /** Lessons in this section */
  lessons: LMSLesson[];
  /** Resources shared across all lessons in section */
  resources: LMSResource[];
  /** Whether section is locked (requires purchase/prior completion) */
  isLocked?: boolean;
  /** Section description */
  description?: string;
}

// ============================================================================
// LMS Settings Types
// ============================================================================

export interface LMSSettings {
  /** Enable course ratings */
  enableRatings: boolean;
  /** Enable progress tracking (controls per-lesson mark-complete AND the top progress bar) */
  enableProgress: boolean;
  /** Enable certificate on completion */
  enableCertificate: boolean;
  /** Auto-play next lesson on completion */
  autoPlayNext: boolean;
  /** Require sequential completion (lock each lesson/quiz/assignment until the previous one is marked complete; first is always unlocked) */
  requireSequential: boolean;
  /** Percent of a video a learner must watch before it auto-completes (1-100). Defaults to 90 when unset. */
  requiredWatchPercent?: number;
}

// ============================================================================
// LMS Course Data Types
// ============================================================================

export interface LMSCourseData {
  /** Base course information */
  course: CourseFormData;
  /** LMS-enhanced sections with lessons */
  sections: LMSSection[];
  /** Selected LMS template */
  templateId: LMSTemplateId;
  /** LMS settings */
  settings: LMSSettings;
}

// ============================================================================
// LMS Template Types
// ============================================================================

export type LMSTemplateId = "classic" | "modern" | "minimal";

export interface LMSTemplateConfig {
  id: LMSTemplateId;
  name: string;
  description: string;
  thumbnail?: string;
  features: string[];
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_LMS_SETTINGS: LMSSettings = {
  enableRatings: true,
  enableProgress: true,
  enableCertificate: true,
  autoPlayNext: true,
  requireSequential: false,
  requiredWatchPercent: 90,
};

export const LMS_TEMPLATE_CONFIGS: LMSTemplateConfig[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Traditional LMS layout with fixed sidebar navigation and tabbed content",
    features: [
      "Fixed left sidebar",
      "Tabbed content sections",
      "Progress bar in sidebar",
      "Collapsible on mobile",
    ],
  },
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary design with floating sidebar and theater mode video",
    features: [
      "Floating toggleable sidebar",
      "Theater mode video player",
      "Card-based resources",
      "Inline rating widget",
    ],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean, distraction-free layout focused on content consumption",
    features: [
      "Hidden sidebar (hamburger)",
      "Full-width video player",
      "Vertical scrolling sections",
      "Bottom navigation",
    ],
  },
];

export const LMS_RESOURCE_TYPE_LABELS: Record<LMSResourceType, string> = {
  pdf: "PDF Document",
  link: "External Link",
  article: "Article",
  text: "Text Content",
  github: "GitHub Repository",
};

export const LMS_RESOURCE_TYPE_ICONS: Record<LMSResourceType, string> = {
  pdf: "FileText",
  link: "ExternalLink",
  article: "FileText",
  text: "AlignLeft",
  github: "Github",
};

// ============================================================================
// Helper Functions
// ============================================================================

export function createLMSLesson(
  title: string,
  order: number,
  options?: Partial<LMSLesson>
): LMSLesson {
  return {
    id: `lms-lesson-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    order,
    resources: [],
    ...options,
  };
}

export function createLMSSection(
  title: string,
  order: number,
  options?: Partial<LMSSection>
): LMSSection {
  return {
    id: `lms-section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    order,
    lessons: [],
    resources: [],
    ...options,
  };
}

export function createLMSResource(
  type: LMSResourceType,
  title: string,
  order: number,
  options?: Partial<LMSResource>
): LMSResource {
  return {
    id: `lms-resource-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    title,
    downloadable: type === "pdf",
    order,
    createdAt: new Date().toISOString(),
    ...options,
  };
}

export function createLMSVideoConfig(
  provider: VideoProvider,
  videoId: string,
  options?: Partial<LMSVideoConfig>
): LMSVideoConfig {
  return {
    provider,
    videoId,
    ...options,
  };
}

export function calculateCourseProgress(
  lessonProgress: LMSLessonProgress[],
  totalLessons: number
): { completed: number; percent: number } {
  const completed = lessonProgress.filter((p) => p.completed).length;
  const percent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
  return { completed, percent };
}

export function isLessonCompleted(
  lessonId: string,
  progress: LMSLessonProgress[]
): boolean {
  return progress.some((p) => p.lessonId === lessonId && p.completed);
}

export function getNextIncompleteLesson(
  lessons: LMSLesson[],
  progress: LMSLessonProgress[]
): LMSLesson | null {
  return lessons.find((lesson) => !isLessonCompleted(lesson.id, progress)) || null;
}
