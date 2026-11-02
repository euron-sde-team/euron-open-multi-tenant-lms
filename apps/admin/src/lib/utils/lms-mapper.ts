/**
 * LMS Data Mapper
 *
 * Maps between:
 * - API types (LMSCourseFullResponse from backend) ↔ Zustand store types (LMSCourseData from @open-mtlms/shared)
 *
 * The LMS editor uses @open-mtlms/shared types (LMSSection, LMSLesson, etc.) in the Zustand store.
 * The backend returns different types (LMSSectionWithLessons, CourseLesson, Lecture, etc.).
 * These mappers bridge the two so the existing editor UI keeps working while
 * data comes from and goes to the real LMS database tables.
 */

import type {
  CourseFormData,
  LMSCourseData,
  LMSLesson,
  LMSResource,
  LMSSection,
  LMSSettings,
  LMSTemplateId,
  VideoProvider,
  LMSVideoConfig,
} from "@open-mtlms/shared";
import { DEFAULT_LMS_SETTINGS, decodeHtmlEntities } from "@open-mtlms/shared";

const dh = decodeHtmlEntities;

import type {
  LMSCourseFullResponse,
  LMSSectionWithLessons,
  Lecture,
  CourseLesson,
  CourseSection,
} from "../types/course-lms";

// ============================================================================
// Helpers for resource_links ↔ LMSResource mapping
// ============================================================================

/**
 * Extract a friendly filename from a URL.
 * E.g. "https://s3.../tenants/.../myfile.pdf" → "myfile.pdf"
 */
function extractFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) return decodeURIComponent(last);
  } catch {
    // Not a valid URL, try simple split
    const parts = url.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return decodeURIComponent(last);
  }
  return url;
}

/**
 * Infer resource type from a URL based on extension or domain.
 */
function inferResourceType(url: string): "pdf" | "link" | "github" {
  const lower = url.toLowerCase();
  if (lower.includes("github.com") || lower.includes("gitlab.com")) return "github";
  // Check extension
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".pdf")) return "pdf";
  } catch {
    if (lower.endsWith(".pdf")) return "pdf";
  }
  return "link";
}

// ============================================================================
// API → Store (load from DB into editor)
// ============================================================================

/** Lecture video providers (DB enum `video_provider`). */
export type LectureVideoProviderDb = "YOUTUBE" | "EVS" | "HLS" | "MP4";
/** Lowercase provider ids used in the editor store (LMSVideoConfig.provider). */
export type LectureVideoProvider = VideoProvider;

export const LECTURE_VIDEO_PROVIDERS: LectureVideoProvider[] = ["evs", "hls", "mp4", "youtube"];

const PROVIDER_FROM_DB: Record<LectureVideoProviderDb, LectureVideoProvider> = {
  YOUTUBE: "youtube",
  EVS: "evs",
  HLS: "hls",
  MP4: "mp4",
};

const PROVIDER_TO_DB: Record<LectureVideoProvider, LectureVideoProviderDb> = {
  youtube: "YOUTUBE",
  evs: "EVS",
  hls: "HLS",
  mp4: "MP4",
};

/** Build an editor video config. `videoId` is the EVS video id, the YouTube id, or the HLS/MP4 URL. */
export function makeVideoConfig(provider: LectureVideoProvider, videoId: string): LMSVideoConfig {
  return { provider, videoId };
}

/** Read the provider of an editor video config, normalised to the supported set. */
export function getVideoProvider(video: LMSVideoConfig | undefined | null): LectureVideoProvider | null {
  if (!video) return null;
  const p = String(video.provider ?? "").toLowerCase();
  return (LECTURE_VIDEO_PROVIDERS as string[]).includes(p) ? (p as LectureVideoProvider) : null;
}

const YT_URL_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/** Extract an 11-char YouTube id from a URL or bare id; null when it is neither. */
export function extractYouTubeId(value: string): string | null {
  const v = value.trim();
  const m = v.match(YT_URL_REGEX);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{11}$/.test(v) ? v : null;
}

/**
 * Build LMSVideoConfig from API lecture (video_key + video_provider only; no video_url).
 */
function lectureVideoToConfig(
  videoKey: string | null | undefined,
  videoProvider: string | null | undefined
): LMSVideoConfig | undefined {
  if (!videoKey || !videoKey.trim()) return undefined;
  const key = videoKey.trim();
  const provider = PROVIDER_FROM_DB[(videoProvider ?? "") as LectureVideoProviderDb];
  if (provider === "youtube") return makeVideoConfig("youtube", extractYouTubeId(key) ?? key);
  if (provider) return makeVideoConfig(provider, key);
  // Fallback: detect from key
  const ytId = extractYouTubeId(key);
  if (ytId) return makeVideoConfig("youtube", ytId);
  if (/^https?:\/\//i.test(key)) return makeVideoConfig(/\.m3u8(\?|$)/i.test(key) ? "hls" : "mp4", key);
  return makeVideoConfig("evs", key);
}

/** Build a video config from a stored key/URL whose provider is unknown (detected from the value). */
export function videoKeyToConfig(videoKey: string | null | undefined): LMSVideoConfig | undefined {
  return lectureVideoToConfig(videoKey, null);
}

/**
 * Convert store video config to sync payload (video_key + video_provider).
 * Exported for use when calling updateLecture from the editor.
 */
export function videoConfigToSyncKeys(video: LMSVideoConfig | undefined): { video_key: string | null; video_provider: LectureVideoProviderDb | null } {
  const provider = getVideoProvider(video);
  if (!video || !video.videoId || !provider) return { video_key: null, video_provider: null };
  if (provider === "youtube") {
    return {
      video_key: `https://www.youtube.com/watch?v=${video.videoId}`,
      video_provider: "YOUTUBE",
    };
  }
  return { video_key: video.videoId.trim(), video_provider: PROVIDER_TO_DB[provider] };
}

/**
 * Map lesson type from DB enum to editor lessonType.
 * Content lessons (PDF/LINK/TEXT/IMAGE) keep their uppercase DB value so the
 * editor can render the inline ContentLessonPanel; LECTURE becomes "video".
 */
function dbTypeToLessonType(
  type: string
): "video" | "quiz" | "assignment" | "PDF" | "LINK" | "TEXT" | "IMAGE" {
  switch (type) {
    case "QUIZ": return "quiz";
    case "ASSIGNMENT": return "assignment";
    case "PDF": return "PDF";
    case "LINK": return "LINK";
    case "TEXT": return "TEXT";
    case "IMAGE": return "IMAGE";
    default: return "video"; // LECTURE -> video
  }
}

/**
 * Map a single API section+lessons into an LMSSection (store format).
 */
function apiSectionToStoreSection(
  apiSection: LMSSectionWithLessons,
  sectionIndex: number
): LMSSection {
  const lessons: LMSLesson[] = (apiSection.lessons ?? []).map((item, lessonIndex) => {
    const lesson: CourseLesson = item.lesson;
    const lecture: Lecture | null = item.lecture;

    // Build resources from lecture.resource_links
    const resources: LMSResource[] = (lecture?.resource_links ?? []).map((link, i) => ({
      id: `res-${lesson.id}-${i}`,
      type: inferResourceType(link),
      title: dh(extractFilenameFromUrl(link)),
      url: link,
      downloadable: false,
      order: i,
    }));

    const assignment = item.assignment;
    const quiz = item.quiz;
    return {
      id: lesson.id,
      title: dh(lesson.title),
      order: lessonIndex,
      duration: lecture?.duration ?? undefined,
      description: lecture?.summary ? dh(lecture.summary) : undefined,
      video: lecture ? lectureVideoToConfig(lecture.video_key, lecture.video_provider) : undefined,
      resources,
      isFreePreview: lesson.is_preview || false,
      lessonType: dbTypeToLessonType(lesson.type),
      lectureId: lecture?.id ?? undefined, // For linking to live sessions
      assignmentId: assignment?.id ?? undefined, // For LESSON-scope assignments
      quizId: quiz?.id ?? undefined, // For QUIZ lessons
    };
  });

  return {
    id: apiSection.id,
    title: dh(apiSection.title),
    order: sectionIndex,
    lessons,
    resources: [],
  };
}

/**
 * Map a single API section (e.g. from createSection response) to store LMSSection with empty lessons.
 */
export function apiSectionToStoreSectionSingle(
  apiSection: CourseSection,
  order: number
): LMSSection {
  return {
    id: apiSection.id,
    title: dh(apiSection.title),
    order,
    lessons: [],
    resources: [],
  };
}

/**
 * Map a single API lesson + optional lecture (e.g. from createLesson/createLecture) to store LMSLesson.
 */
export function apiLessonWithLectureToStoreLesson(
  lesson: CourseLesson,
  lecture: Lecture | null,
  order: number
): LMSLesson {
  const resources: LMSResource[] = (lecture?.resource_links ?? []).map((link, i) => ({
    id: `res-${lesson.id}-${i}`,
    type: inferResourceType(link),
    title: dh(extractFilenameFromUrl(link)),
    url: link,
    downloadable: false,
    order: i,
  }));
  return {
    id: lesson.id,
    title: dh(lesson.title),
    order,
    duration: lecture?.duration ?? undefined,
    description: lecture?.summary ? dh(lecture.summary) : undefined,
    video: lecture ? lectureVideoToConfig(lecture.video_key, lecture.video_provider) : undefined,
    resources,
    isFreePreview: lesson.is_preview || false,
    lessonType: dbTypeToLessonType(lesson.type),
    lectureId: lecture?.id ?? undefined, // For linking to live sessions
    assignmentId: undefined, // Set by caller when adding assignment lesson
  };
}

/**
 * Convert a full API response (LMSCourseFullResponse) into the Zustand store format (LMSCourseData).
 * Pass a CourseFormData for the `course` field (loaded separately or built from the API course).
 */
export function lmsFullToLmsStoreData(
  full: LMSCourseFullResponse,
  courseFormData: CourseFormData,
  templateId: LMSTemplateId = "classic",
  settings: LMSSettings = DEFAULT_LMS_SETTINGS
): LMSCourseData {
  const sections: LMSSection[] = (full.sections ?? []).map(
    (sec, idx) => apiSectionToStoreSection(sec, idx)
  );

  return {
    course: courseFormData,
    sections,
    templateId,
    settings,
  };
}

// ============================================================================
// Store → API (save from editor to DB via full-replace sync)
// ============================================================================

export interface SyncSection {
  title: string;
  sort_order: number;
  lessons: SyncLesson[];
}

export interface SyncLesson {
  title: string;
  type: "LECTURE" | "QUIZ" | "ASSIGNMENT";
  sort_order: number;
  is_preview: boolean;
  lecture: {
    title: string;
    video_key: string | null;
    video_provider: LectureVideoProviderDb | null;
    duration: string | null;
    resource_links: string[];
    summary: string | null;
  } | null;
}

export interface SyncPayload {
  sections: SyncSection[];
  lms_template_id: string;
  lms_settings: LMSSettings;
}

/**
 * Extract the sections/lessons/lectures from the Zustand store format
 * into a flat structure for the full-replace sync to the backend.
 * Also includes templateId and settings so they are persisted in the DB.
 */
export function lmsStoreDataToSyncPayload(
  lmsData: LMSCourseData
): SyncPayload {
  const sections: SyncSection[] = lmsData.sections.map((section, secIndex) => ({
    title: section.title,
    sort_order: secIndex,
    lessons: section.lessons.map((lesson, lesIndex) => {
      const isLecture = !lesson.lessonType || lesson.lessonType === "video" || lesson.lessonType === "text";
      const dbType: "LECTURE" | "QUIZ" | "ASSIGNMENT" =
        lesson.lessonType === "quiz" ? "QUIZ"
          : lesson.lessonType === "assignment" ? "ASSIGNMENT"
            : "LECTURE";

      return {
        title: lesson.title,
        type: dbType,
        sort_order: lesIndex,
        is_preview: lesson.isFreePreview ?? false,
        lecture: isLecture ? (() => {
          const { video_key, video_provider } = videoConfigToSyncKeys(lesson.video);
          return {
            title: lesson.title,
            video_key,
            video_provider,
            duration: lesson.duration ?? null,
            resource_links: lesson.resources
              .filter((r) => r.url)
              .map((r) => r.url!),
            summary: lesson.description ?? null,
          };
        })() : null,
      };
    }),
  }));

  return {
    sections,
    lms_template_id: lmsData.templateId || "classic",
    lms_settings: lmsData.settings || DEFAULT_LMS_SETTINGS,
  };
}
