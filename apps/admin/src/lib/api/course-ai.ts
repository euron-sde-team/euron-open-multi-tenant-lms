/**
 * Course AI Content Generation API client
 * Uses Gemini to generate course content based on title
 * Base path: /tenant/courses/ai
 */

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

const _BASE = "/tenant/courses/ai";

export type CourseAISectionKey =
  | "subtitle"
  | "learningOutcomes"
  | "curriculum"
  | "offerings"
  | "requirements"
  | "description"
  | "faqs"
  | "thumbnails";

export const ALL_AI_SECTION_KEYS: CourseAISectionKey[] = [
  "subtitle",
  "learningOutcomes",
  "curriculum",
  "offerings",
  "requirements",
  "description",
  "faqs",
  "thumbnails",
];

export interface ThumbnailContext {
  mentorName?: string;
  courseMode?: string;
  startDate?: string;
  organizationName?: string;
  instructorNames?: string[];
  batchLanguage?: string;
}

/** Existing course data sent alongside the request to enrich AI generation context. */
export interface CourseMetadata {
  subTitle?: string;
  description?: string;
  difficulty?: string;
  duration?: string;
  categoryNames?: string[];
  learningOutcomes?: string[];
}

export interface GenerateCourseContentRequest {
  courseTitle: string;
  sections: CourseAISectionKey[];
  extraContext?: string;
  referenceDocument?: string;
  thumbnailContext?: ThumbnailContext;
  /** Existing course metadata, helps AI generate more relevant content and thumbnails. */
  courseMetadata?: CourseMetadata;
  /** LMS course ID, when set, the backend grounds syllabus/offerings/FAQs in the actual uploaded curriculum. */
  lmsCourseId?: string;
}

export interface GeneratedCurriculumSection {
  title: string;
  order: number;
  modules: Array<{
    title: string;
    order: number;
    lectures: Array<{
      title: string;
      order: number;
      duration: string;
    }>;
  }>;
}

export interface GeneratedOffering {
  icon: string;
  text: string;
}

export interface GeneratedFAQ {
  question: string;
  answer: string;
}

export interface GeneratedCourseContent {
  subTitle?: string;
  learningOutcomes?: string[];
  sections?: GeneratedCurriculumSection[];
  offerings?: GeneratedOffering[];
  prerequisites?: string[];
  description?: string;
  faqs?: GeneratedFAQ[];
  webThumbnailDataUrl?: string;
  mobileThumbnailDataUrl?: string;
}

// ─── Async Job Types ────────────────────────────────────────────────────────

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

export interface SubmitGenerationResponse {
  jobId: string;
}

export interface GenerationStatusResponse {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: CourseAIJobProgress | null;
  failedReason?: string;
}

export const courseAIApi = {
  /**
   * Submit a course AI generation job (async). Returns a jobId for polling.
   */
  submitGeneration: async (
    params: GenerateCourseContentRequest
  ): Promise<SubmitGenerationResponse> => {
    const response = await apiClient.post<
      ApiResponse<SubmitGenerationResponse>
    >(`${_BASE}/generate`, params);
    return response.data.data;
  },

  /**
   * Poll the status of a course AI generation job.
   */
  getGenerationStatus: async (
    jobId: string
  ): Promise<GenerationStatusResponse> => {
    const response = await apiClient.get<
      ApiResponse<GenerationStatusResponse>
    >(`${_BASE}/status/${jobId}`);
    return response.data.data;
  },

  /**
   * @deprecated Use submitGeneration + getGenerationStatus polling instead.
   * Kept for backward compatibility.
   */
  generateContent: async (
    params: GenerateCourseContentRequest
  ): Promise<GeneratedCourseContent> => {
    const response = await apiClient.post<ApiResponse<GeneratedCourseContent>>(
      "/api/ai-generate",
      params,
      { baseURL: "", timeout: 180_000 }
    );
    return response.data.data;
  },
};

export default courseAIApi;
