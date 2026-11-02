/**
 * Book AI Content Generation API client
 * Uses Gemini to generate book description + cover from title + EPUB content
 * Base path: /tenant/books/ai
 */

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

const BASE = "/tenant/books/ai";

export type BookAISectionKey = "description" | "thumbnail";

export const ALL_BOOK_AI_SECTION_KEYS: BookAISectionKey[] = [
  "description",
  "thumbnail",
];

export interface BookThumbnailContext {
  authorName?: string;
  organizationName?: string;
  language?: string;
}

export interface GenerateBookContentRequest {
  bookTitle: string;
  sections: BookAISectionKey[];
  epubUrl?: string;
  extraContext?: string;
  referenceDocument?: string;
  thumbnailContext?: BookThumbnailContext;
}

export interface EpubMetadata {
  author?: string;
  language?: string;
  pageCount?: number;
}

export interface GeneratedBookContent {
  description?: string;
  thumbnailDataUrl?: string;
  metadata?: EpubMetadata;
}

// ─── Async Job Types ────────────────────────────────────────────────────────

export type SectionStatus = "pending" | "processing" | "completed" | "failed";

export interface SectionProgress {
  status: SectionStatus;
  error?: string;
  result?: Partial<GeneratedBookContent>;
}

export interface BookAIJobProgress {
  status: "processing" | "completed" | "failed";
  currentSection?: BookAISectionKey;
  sections: Partial<Record<BookAISectionKey, SectionProgress>>;
  result: Partial<GeneratedBookContent>;
  completedCount: number;
  totalCount: number;
  error?: string;
}

export interface SubmitBookGenerationResponse {
  jobId: string;
}

export interface BookGenerationStatusResponse {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: BookAIJobProgress | null;
  failedReason?: string;
}

export const bookAIApi = {
  /**
   * Submit a book AI generation job (async). Returns a jobId for polling.
   */
  submitGeneration: async (
    params: GenerateBookContentRequest
  ): Promise<SubmitBookGenerationResponse> => {
    const response = await apiClient.post<
      ApiResponse<SubmitBookGenerationResponse>
    >(`${BASE}/generate`, params);
    return response.data.data;
  },

  /**
   * Poll the status of a book AI generation job.
   */
  getGenerationStatus: async (
    jobId: string
  ): Promise<BookGenerationStatusResponse> => {
    const response = await apiClient.get<
      ApiResponse<BookGenerationStatusResponse>
    >(`${BASE}/status/${jobId}`);
    return response.data.data;
  },

  /**
   * @deprecated Use submitGeneration + getGenerationStatus polling instead.
   */
  generateContent: async (
    params: GenerateBookContentRequest
  ): Promise<GeneratedBookContent> => {
    const response = await apiClient.post<ApiResponse<GeneratedBookContent>>(
      `${BASE}/generate`,
      params
    );
    return response.data.data;
  },
};

export default bookAIApi;
