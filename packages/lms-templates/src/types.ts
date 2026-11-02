/**
 * Types for LMS Templates Package
 *
 * These types define the data structures used by the LMS course player templates.
 * They are designed to work with both admin (edit mode) and web (player mode) apps.
 */

import type { CourseLecture, CourseSectionData, CourseFormData } from "@open-mtlms/shared";

// ============================================================================
// Video Types
// ============================================================================

export type VideoProvider = "youtube" | "evs" | "hls" | "mp4";

export interface LMSVideoConfig {
  provider: VideoProvider;
  /** YouTube video id, EVS video id, or the external HLS / MP4 URL */
  videoId: string;
  /** YouTube specific - start time in seconds */
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

/**
 * NOTE: must stay identical to @open-mtlms/shared's LMSResourceType, the two are
 * used interchangeably (structural typing) across apps/web and the templates.
 * "image" resources are supported at runtime by ResourceItem/ResourceList but
 * are intentionally not part of this union until the shared type gains it.
 */
export type ResourceType = "pdf" | "link" | "article" | "text" | "github";

export interface LMSResource {
  id: string;
  type: ResourceType;
  title: string;
  description?: string;
  /** URL for pdf, link, github, image types */
  url?: string;
  /** Content for text/article types */
  content?: string;
  /** File size in bytes (for downloadable resources) */
  fileSize?: number;
  /** Whether the resource can be downloaded */
  downloadable: boolean;
  /** Display order */
  order: number;
}

// ============================================================================
// Rating Types
// ============================================================================

export interface LMSRating {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number; // 1-5
  review?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LMSRatingSummary {
  averageRating: number;
  totalRatings: number;
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
  lessonId: string;
  completed: boolean;
  completedAt?: string;
  /** Video watch time in seconds */
  watchedSeconds?: number;
  /** Total video duration in seconds */
  totalSeconds?: number;
  /** Last watched position in seconds */
  lastPosition?: number;
}

export interface LMSCourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  lessonProgress: LMSLessonProgress[];
  startedAt?: string;
  lastAccessedAt?: string;
}

// ============================================================================
// Extended Lesson Type
// ============================================================================

export interface LMSLesson extends CourseLecture {
  /** Video configuration */
  video?: LMSVideoConfig;
  /** Resources attached to this lesson */
  resources: LMSResource[];
  /** Whether lesson is free preview */
  isFreePreview?: boolean;
  /** Estimated reading/watch time in minutes */
  estimatedTime?: number;
  /**
   * Lesson type. PDF/LINK/TEXT/IMAGE are standalone content lessons whose body
   * is rendered in the main lesson area via `content` below.
   */
  lessonType?:
    | "LECTURE"
    | "ASSIGNMENT"
    | "QUIZ"
    | "PDF"
    | "LINK"
    | "TEXT"
    | "IMAGE"
    | "video"
    | "text"
    | "quiz"
    | "assignment";
  /** Assignment ID for ASSIGNMENT lessons */
  assignmentId?: string;
  /** Assignment data for ASSIGNMENT lessons (PDF URL, instructions, etc.) */
  assignment?: {
    id: string;
    title: string;
    instructions: string | null;
    content_type: string;
    max_score: number;
    due_date: string | null;
    pdf_url: string | null;
    submission?: {
      id: string;
      content_type: string;
      text_content: string | null;
      status: string;
      submitted_at: string | null;
      evaluation?: {
        score: number;
        max_score: number;
        feedback: string | null;
        evaluated_at: string;
      };
    } | null;
  };
  /** Quiz ID for QUIZ lessons */
  quizId?: string;
  /** Quiz data for QUIZ lessons */
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
  /**
   * Content body for standalone content lessons (PDF/LINK/TEXT/IMAGE). Rendered
   * in the main lesson area (where the video/quiz/assignment render).
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
  /** Resources shared across all lessons in this section */
  resources: LMSResource[];
  /** Whether section is locked */
  isLocked?: boolean;
}

// ============================================================================
// LMS Course Data
// ============================================================================

export interface LMSCourseData {
  /** Course basic info from CourseFormData */
  course: CourseFormData;
  /** LMS-specific sections with lessons */
  sections: LMSSection[];
  /** Selected LMS template */
  templateId: LMSTemplateId;
  /** LMS settings */
  settings: LMSSettings;
}

export interface LMSSettings {
  /** Enable ratings */
  enableRatings: boolean;
  /** Enable progress tracking (controls per-lesson mark-complete AND the top progress bar) */
  enableProgress: boolean;
  /** Enable certificate on completion */
  enableCertificate: boolean;
  /** Auto-play next lesson */
  autoPlayNext: boolean;
  /** Require sequential completion: lock each lesson/quiz/assignment until the prior one is marked complete (first is always unlocked) */
  requireSequential: boolean;
  /**
   * Optional: resolve a lecture's playback (web learn page provides this by
   * calling the learner API playback route after its enrollment check). The
   * video id is read from the lecture row server-side, never sent by the client.
   */
  getVideoPlayback?(lessonId: string): Promise<LMSVideoPlayback>;
}

/** Response of POST /courses/:courseId/lectures/:lectureId/playback. */
export type LMSVideoPlayback =
  | {
      provider: "EVS";
      /** Tokenized HLS master URL (the token is in the query string). */
      manifestUrl: string;
      token?: string;
      expiresAt?: string;
      posterUrl?: string | null;
      thumbnailsVttUrl?: string | null;
      watermarkText?: string | null;
    }
  | { provider: "HLS" | "MP4" | "YOUTUBE"; url: string };

/** Merge a resolved playback response into a lesson's video config. */
export function applyVideoPlayback(
  video: LMSVideoConfig,
  playback: LMSVideoPlayback
): LMSVideoConfig {
  switch (playback.provider) {
    case "EVS":
      return {
        ...video,
        provider: "evs",
        hlsUrl: playback.manifestUrl,
        posterUrl: playback.posterUrl ?? video.posterUrl,
        thumbnailsVttUrl: playback.thumbnailsVttUrl ?? undefined,
        watermarkText: playback.watermarkText ?? undefined,
      };
    case "HLS":
      return { ...video, provider: "hls", hlsUrl: playback.url };
    case "MP4":
      return { ...video, provider: "mp4", mp4Url: playback.url };
    case "YOUTUBE":
      return { ...video, provider: "youtube", videoId: extractYouTubeId(playback.url) ?? video.videoId };
  }
}

/** Pull the 11-char video id out of any YouTube URL form (or return a bare id). */
export function extractYouTubeId(input: string): string | null {
  const v = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  const m = v.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
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

export const lmsTemplateConfigs: LMSTemplateConfig[] = [
  {
    id: "classic",
    name: "Classic",
    description:
      "Traditional LMS layout with fixed sidebar navigation and tabbed content sections",
    features: [
      "Fixed left sidebar",
      "Tabbed content (Overview, Resources, Q&A, Ratings)",
      "Progress bar in sidebar",
      "Collapsible on mobile",
    ],
  },
  {
    id: "modern",
    name: "Modern",
    description:
      "Contemporary design with floating sidebar and theater mode video player",
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
    description:
      "Clean, distraction-free layout with focus on content consumption",
    features: [
      "Hidden sidebar (hamburger menu)",
      "Full-width video player",
      "Vertical scrolling sections",
      "Bottom navigation",
    ],
  },
];

// ============================================================================
// LMS Template Props
// ============================================================================

export interface LMSTemplateProps {
  /** Course data with LMS configuration */
  courseData: LMSCourseData;
  /** Current lesson being viewed */
  currentLesson: LMSLesson;
  /** Current section */
  currentSection: LMSSection;
  /** User's progress data */
  progress?: LMSCourseProgress;
  /** Whether in edit mode (admin) */
  isEditMode?: boolean;
  /** Current user info */
  currentUser?: {
    id: string;
    name: string;
    avatar?: string;
    isInstructor: boolean;
  };
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// Callback Types
// ============================================================================

export interface LMSCallbacks {
  /** Called when lesson is marked complete */
  onLessonComplete?: (lessonId: string) => void;
  /** Called when navigating to a different lesson */
  onLessonChange?: (lessonId: string) => void;
  /** Called when video progress updates */
  onVideoProgress?: (lessonId: string, seconds: number) => void;
  /** Called when submitting a rating */
  onSubmitRating?: (
    targetId: string,
    type: "course" | "lesson",
    rating: number,
    review?: string
  ) => void;
}

// ============================================================================
// API Service Interface (for mock/real implementation)
// ============================================================================

export interface LMSApiService {
  // Progress
  getProgress(courseId: string): Promise<LMSCourseProgress>;
  markLessonComplete(lessonId: string): Promise<void>;
  updateVideoProgress(lessonId: string, seconds: number): Promise<void>;

  // Ratings
  getCourseRatings(courseId: string): Promise<LMSRating[]>;
  getCoursRatingSummary(courseId: string): Promise<LMSRatingSummary>;
  getLessonRatings(lessonId: string): Promise<LMSRating[]>;
  submitCourseRating(
    courseId: string,
    rating: number,
    review?: string
  ): Promise<void>;
  submitLessonRating(
    lessonId: string,
    rating: number,
    review?: string
  ): Promise<void>;
}

// ============================================================================
// Default Values
// ============================================================================

export const defaultLMSSettings: LMSSettings = {
  enableRatings: true,
  enableProgress: true,
  enableCertificate: true,
  autoPlayNext: true,
  requireSequential: false,
};

export const createDefaultLMSLesson = (
  title: string,
  order: number
): LMSLesson => ({
  id: `lesson-${Date.now()}-${order}`,
  title,
  order,
  resources: [],
});

export const createDefaultLMSSection = (
  title: string,
  order: number
): LMSSection => ({
  id: `section-${Date.now()}-${order}`,
  title,
  order,
  lessons: [],
  resources: [],
});

export const createDefaultLMSResource = (
  type: ResourceType,
  title: string,
  order: number
): LMSResource => ({
  id: `resource-${Date.now()}-${order}`,
  type,
  title,
  downloadable: type === "pdf",
  order,
});
