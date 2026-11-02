/**
 * Page AI Content Generation API client
 * Uses Gemini to generate page section content
 * Base path: /tenant/pages/ai
 */

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

const BASE = "/tenant/pages/ai";

export interface GenerateSectionRequest {
  sectionType: string;
  prompt: string;
  businessContext?: string;
  pageLayout?: { type: string; order: number }[];
  generateImages?: boolean;
  /** JSON Schema from the frontend registry. When set, backend returns raw AI output. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientSchema?: Record<string, any>;
  /** Section-specific instructions from the frontend registry. */
  clientInstructions?: string;
}

export interface GeneratedSectionResult {
  sectionType: string;
  content: Record<string, unknown>;
  orgLogos?: {
    light: string | null;
    dark: string | null;
  };
}

export interface PlanPageRequest {
  prompt: string;
  businessContext?: string;
  availableSections: { type: string; label: string; description: string }[];
}

export interface PlanPageResult {
  enhancedSummary: string;
  sections: { type: string; brief: string }[];
}

export interface PagePlanJobProgress {
  status: "processing" | "completed" | "failed";
  result?: PlanPageResult;
  error?: string;
}

export interface PagePlanStatusResponse {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: PagePlanJobProgress | null;
  failedReason?: string;
}

export interface PageImageJobProgress {
  status: "processing" | "completed" | "failed";
  result?: { url: string };
  error?: string;
}

export interface PageImageStatusResponse {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: PageImageJobProgress | null;
  failedReason?: string;
}

export const pageAIApi = {
  generateSection: async (
    params: GenerateSectionRequest
  ): Promise<GeneratedSectionResult> => {
    const response = await apiClient.post<ApiResponse<GeneratedSectionResult>>(
      `${BASE}/generate-section`,
      params
    );
    return response.data.data;
  },

  /**
   * Submit a page-plan job. Planning does grounded web research + a large
   * generation that is too slow for a single request (it trips the gateway's
   * 504 timeout), so the backend runs it as a job. Use `planPageAndWait` to
   * submit + poll, or call this + `getPagePlanStatus` directly.
   */
  submitPagePlan: async (params: PlanPageRequest): Promise<{ jobId: string }> => {
    const response = await apiClient.post<ApiResponse<{ jobId: string }>>(
      `${BASE}/plan-page`,
      params
    );
    return response.data.data;
  },

  getPagePlanStatus: async (
    jobId: string
  ): Promise<PagePlanStatusResponse> => {
    const response = await apiClient.get<ApiResponse<PagePlanStatusResponse>>(
      `${BASE}/plan-status/${jobId}`
    );
    return response.data.data;
  },

  /**
   * Submit a page-plan job and poll until it completes. Resolves with the plan
   * or throws on failure/timeout. No single request stays open long enough to
   * hit the gateway 504.
   */
  planPageAndWait: async (
    params: PlanPageRequest,
    opts?: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal }
  ): Promise<PlanPageResult> => {
    const intervalMs = opts?.intervalMs ?? 2000;
    const timeoutMs = opts?.timeoutMs ?? 180000; // 3 min, plan + research can be slow

    const { jobId } = await pageAIApi.submitPagePlan(params);

    const startedAt = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (opts?.signal?.aborted) throw new Error("Page plan cancelled");
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("Page plan timed out. Please try again.");
      }

      await new Promise((r) => setTimeout(r, intervalMs));

      const st = await pageAIApi.getPagePlanStatus(jobId);

      if (st.status === "completed" && st.progress?.result) {
        return st.progress.result;
      }
      if (st.status === "failed") {
        throw new Error(
          st.progress?.error || st.failedReason || "Failed to design the page."
        );
      }
      // queued / processing → keep polling
    }
  },

  submitImageGeneration: async (params: {
    prompt: string;
    aspectRatio?: string;
    sectionContext?: {
      sectionType?: string;
      headline?: string;
      description?: string;
      badge?: string;
    };
  }): Promise<{ jobId: string }> => {
    const response = await apiClient.post<ApiResponse<{ jobId: string }>>(
      `${BASE}/generate-image`,
      params
    );
    return response.data.data;
  },

  getImageGenerationStatus: async (
    jobId: string
  ): Promise<PageImageStatusResponse> => {
    const response = await apiClient.get<ApiResponse<PageImageStatusResponse>>(
      `${BASE}/image-status/${jobId}`
    );
    return response.data.data;
  },
};

export default pageAIApi;
