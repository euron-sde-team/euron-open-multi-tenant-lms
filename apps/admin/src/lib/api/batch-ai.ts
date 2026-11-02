/**
 * Batch AI Content Generation API client.
 * Endpoints:
 *  - POST /tenant/batches/:batchId/ai/generate
 *  - GET  /tenant/batches/:batchId/ai/status/:jobId
 *
 * Pattern is identical to the book/course AI clients, submit returns a
 * jobId, poll until completed/failed. Job IDs are scoped per (tenant, batch)
 * server-side so a tenant can have one in-flight generation per batch.
 */

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export type BatchAISectionKey =
  | "subtitle"
  | "description"
  | "learningOutcomes"
  | "webThumbnail"
  | "mobileThumbnail";

export const ALL_BATCH_AI_SECTION_KEYS: BatchAISectionKey[] = [
  "subtitle",
  "description",
  "learningOutcomes",
  "webThumbnail",
  "mobileThumbnail",
];

export interface BatchThumbnailContext {
  startDate?: string;
  organizationName?: string;
  instructorNames?: string[];
  language?: string;
  durationLabel?: string;
}

export interface GenerateBatchContentRequest {
  batchId: string;
  batchTitle: string;
  sections: BatchAISectionKey[];
  extraContext?: string;
  referenceDocument?: string;
  thumbnailContext?: BatchThumbnailContext;
}

export interface GeneratedBatchContent {
  subtitle?: string;
  description?: string;
  learningOutcomes?: string[];
  webThumbnailDataUrl?: string;
  mobileThumbnailDataUrl?: string;
}

export type SectionStatus = "pending" | "processing" | "completed" | "failed";

export interface SectionProgress {
  status: SectionStatus;
  error?: string;
  result?: Partial<GeneratedBatchContent>;
}

export interface BatchAIJobProgress {
  status: "processing" | "completed" | "failed";
  currentSection?: BatchAISectionKey;
  sections: Partial<Record<BatchAISectionKey, SectionProgress>>;
  result: Partial<GeneratedBatchContent>;
  completedCount: number;
  totalCount: number;
  error?: string;
}

export interface SubmitBatchGenerationResponse {
  jobId: string;
}

export interface BatchGenerationStatusResponse {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: BatchAIJobProgress | null;
  failedReason?: string;
}

export const batchAIApi = {
  submitGeneration: async (
    params: GenerateBatchContentRequest
  ): Promise<SubmitBatchGenerationResponse> => {
    const { batchId, ...body } = params;
    const response = await apiClient.post<
      ApiResponse<SubmitBatchGenerationResponse>
    >(`/tenant/batches/${batchId}/ai/generate`, body);
    return response.data.data;
  },

  getGenerationStatus: async (
    batchId: string,
    jobId: string
  ): Promise<BatchGenerationStatusResponse> => {
    const response = await apiClient.get<
      ApiResponse<BatchGenerationStatusResponse>
    >(`/tenant/batches/${batchId}/ai/status/${jobId}`);
    return response.data.data;
  },
};

export default batchAIApi;
