/**
 * Assignments API Client
 * Uses /tenant/assignments backend endpoints.
 * x-tenant-id is set by axios interceptor.
 */

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

const BASE = "/tenant/assignments";

export type AssignmentScope = "COURSE" | "SECTION" | "LESSON";
export type AssignmentStatus = "DRAFT" | "PUBLISHED";
export type AssignmentContentType = "TEXT" | "PDF";

export interface Assignment {
  id: string;
  tenant_id: string;
  course_id: string;
  section_id: string | null;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  content_type: AssignmentContentType;
  pdf_key: string | null;
  resource_links: string[];
  scope: AssignmentScope;
  status: AssignmentStatus;
  max_score: number;
  /** Minimum score to pass; null = no pass/fail. */
  passing_score: number | null;
  due_date: string | null;
  ai_generated: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  course_title?: string;
  section_title?: string;
  lesson_title?: string;
}

export interface AssignmentsListResponse {
  data: Assignment[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAssignmentRequest {
  title: string;
  course_id: string;
  section_id?: string | null;
  lesson_id?: string | null;
  scope: AssignmentScope;
  content_type?: AssignmentContentType;
  instructions?: string | null;
  pdf_key?: string | null;
  resource_links?: string[];
  max_score?: number;
  passing_score?: number | null;
  due_date?: string | null;
  sort_order?: number;
}

export interface UpdateAssignmentRequest {
  title?: string;
  section_id?: string | null;
  lesson_id?: string | null;
  scope?: AssignmentScope;
  content_type?: AssignmentContentType;
  instructions?: string | null;
  pdf_key?: string | null;
  resource_links?: string[];
  max_score?: number;
  passing_score?: number | null;
  due_date?: string | null;
  sort_order?: number;
}

export interface ListAssignmentsParams {
  course_id: string;
  section_id?: string;
  lesson_id?: string;
  scope?: AssignmentScope;
  status?: AssignmentStatus;
  page?: number;
  limit?: number;
}

export const assignmentsApi = {
  list: async (params: ListAssignmentsParams): Promise<AssignmentsListResponse> => {
    const search = new URLSearchParams();
    search.set("course_id", params.course_id);
    if (params.section_id) search.set("section_id", params.section_id);
    if (params.lesson_id) search.set("lesson_id", params.lesson_id);
    if (params.scope) search.set("scope", params.scope);
    if (params.status) search.set("status", params.status);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    const response = await apiClient.get<ApiResponse<AssignmentsListResponse>>(
      `${BASE}?${search.toString()}`
    );
    return response.data.data;
  },

  get: async (id: string): Promise<Assignment> => {
    const response = await apiClient.get<ApiResponse<Assignment>>(`${BASE}/${id}`);
    return response.data.data;
  },

  create: async (data: CreateAssignmentRequest): Promise<Assignment> => {
    const response = await apiClient.post<ApiResponse<Assignment>>(BASE, data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateAssignmentRequest): Promise<Assignment> => {
    const response = await apiClient.patch<ApiResponse<Assignment>>(`${BASE}/${id}`, data);
    return response.data.data;
  },

  publish: async (id: string): Promise<Assignment> => {
    const response = await apiClient.post<ApiResponse<Assignment>>(`${BASE}/${id}/publish`);
    return response.data.data;
  },

  unpublish: async (id: string): Promise<Assignment> => {
    const response = await apiClient.post<ApiResponse<Assignment>>(`${BASE}/${id}/unpublish`);
    return response.data.data;
  },

  remove: async (id: string, force = false): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}${force ? "?force=true" : ""}`);
  },

  getPdfUrl: async (id: string): Promise<{ url: string; expires_in: number }> => {
    const response = await apiClient.get<ApiResponse<{ url: string; expires_in: number }>>(
      `${BASE}/${id}/pdf-url`
    );
    return response.data.data;
  },

  uploadPdf: async (id: string, file: File): Promise<Assignment> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<ApiResponse<Assignment>>(
      `${BASE}/${id}/upload-pdf`,
      formData
    );
    return response.data.data;
  },

  removePdf: async (id: string): Promise<Assignment> => {
    const response = await apiClient.delete<ApiResponse<Assignment>>(`${BASE}/${id}/pdf`);
    return response.data.data;
  },

  getSubmissionPdfBlobUrl: async (
    assignmentId: string,
    submissionId: string
  ): Promise<string | null> => {
    try {
      const res = await apiClient.get(
        `${BASE}/${assignmentId}/submissions/${submissionId}/pdf`,
        { responseType: "blob" }
      );
      const blob = res.data as Blob;
      if (!blob || blob.size === 0) return null;
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  },

  getSubmissionDetail: async (assignmentId: string, submissionId: string) => {
    const response = await apiClient.get(
      `${BASE}/${assignmentId}/submissions/${submissionId}`
    );
    return response.data.data as {
      id: string;
      assignment_id: string;
      tenant_member_id: string;
      content_type: string;
      text_content: string | null;
      pdf_key: string | null;
      status: string;
      submitted_at: string | null;
      member_name: string;
      member_email: string | null;
      assignment_title: string;
      assignment_max_score: number;
      assignment_passing_score: number | null;
      score: number | null;
      max_score: number | null;
      feedback: string | null;
      evaluated_at: string | null;
      /** True/false once graded against a passing score; null = not applicable. */
      passed: boolean | null;
      pdf_url?: string | null;
    };
  },

  evaluateSubmission: async (
    assignmentId: string,
    submissionId: string,
    data: { score: number; feedback?: string; allow_resubmission?: boolean }
  ) => {
    const response = await apiClient.post(
      `${BASE}/${assignmentId}/submissions/${submissionId}/evaluate`,
      data
    );
    return response.data.data;
  },

  requestResubmission: async (
    assignmentId: string,
    submissionId: string,
    data: { feedback: string }
  ) => {
    const response = await apiClient.post(
      `${BASE}/${assignmentId}/submissions/${submissionId}/request-resubmission`,
      data
    );
    return response.data.data;
  },

  listSubmissions: async (
    assignmentId: string,
    params?: {
      status?: string;
      submitted_from?: string;
      submitted_to?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.submitted_from) search.set("submitted_from", params.submitted_from);
    if (params?.submitted_to) search.set("submitted_to", params.submitted_to);
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    const q = search.toString();
    const response = await apiClient.get(
      `${BASE}/${assignmentId}/submissions${q ? `?${q}` : ""}`
    );
    return response.data.data as {
      data: Array<{
        id: string;
        tenant_member_id: string;
        member_name: string;
        member_email: string | null;
        status: string;
        submitted_at: string | null;
        content_type: string;
        score: number | null;
        max_score: number | null;
        feedback: string | null;
        evaluated_at: string | null;
        assignment_title: string;
        assignment_max_score: number;
      }>;
      total: number;
      page: number;
      limit: number;
      status_options: string[];
    };
  },

  getAssignmentAnalyticsOverview: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.search) search.set("search", params.search);
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    const qs = search.toString();
    const response = await apiClient.get(
      `${BASE}/analytics/overview${qs ? `?${qs}` : ""}`
    );
    return response.data.data as {
      total_assignments: number;
      published_count: number;
      draft_count: number;
      total_submissions: number;
      evaluated_count: number;
      pending_evaluation_count: number;
      courses: Array<{
        course_id: string;
        course_title: string;
        total_assignments: number;
        published_count: number;
        draft_count: number;
        total_submissions: number;
        evaluated_count: number;
        pending_evaluation: number;
      }>;
      total: number;
      page: number;
      limit: number;
    };
  },

  getCourseAssignmentAnalytics: async (courseId: string) => {
    const response = await apiClient.get(`${BASE}/analytics/course/${courseId}`);
    return response.data.data as {
      total_assignments: number;
      published_count: number;
      draft_count: number;
      enrolled_count: number;
      assignments: Array<{
        assignment_id: string;
        title: string;
        scope: string;
        status: string;
        max_score: number;
        submission_count: number;
        submission_rate: number;
        evaluated_count: number;
        average_score: number | null;
        pass_rate: number | null;
        pending_evaluation: number;
      }>;
    };
  },

  generateFromTranscript: async (data: {
    lecture_id: string;
    course_id: string;
    section_id?: string | null;
    lesson_id?: string | null;
    scope: AssignmentScope;
    max_score?: number;
    due_date?: string | null;
    difficulty?: "EASY" | "MEDIUM" | "HARD";
    num_questions_hint?: number;
  }): Promise<{ assignment: Assignment; note: string }> => {
    const response = await apiClient.post<ApiResponse<{ assignment: Assignment; note: string }>>(
      `${BASE}/generate-from-transcript`,
      data
    );
    return response.data.data;
  },
};
