/**
 * Quizzes API Client
 * Uses /tenant/quizzes backend endpoints.
 * x-tenant-id is set by axios interceptor.
 */

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

const BASE = "/tenant/quizzes";

export type QuizScope = "COURSE" | "SECTION" | "LESSON";
export type QuizStatus = "DRAFT" | "PUBLISHED";

export interface Quiz {
  id: string;
  tenant_id: string;
  course_id: string;
  section_id: string | null;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  scope: QuizScope;
  status: QuizStatus;
  max_score: number;
  pass_percentage: number;
  /** Overall quiz time limit in minutes; null = no timer. */
  duration_min?: number | null;
  due_date: string | null;
  /** Number of random questions served per attempt; null = all questions */
  random_question_count?: number | null;
  allow_reattempt: boolean;
  /** Max attempts when allow_reattempt is true; null = unlimited. */
  max_attempts: number | null;
  proctoring_enabled: boolean;
  proctor_camera: boolean;
  proctor_max_tab_switches: number | null;
  calculator_mode: string;
  ai_generated: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  course_title?: string;
  section_title?: string;
  lesson_title?: string;
}

export interface QuizzesListResponse {
  data: Quiz[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateQuizRequest {
  title: string;
  course_id: string;
  section_id?: string | null;
  lesson_id?: string | null;
  scope: QuizScope;
  instructions?: string | null;
  max_score?: number;
  pass_percentage?: number;
  due_date?: string | null;
  sort_order?: number;
}

export interface UpdateQuizRequest {
  title?: string;
  section_id?: string | null;
  lesson_id?: string | null;
  scope?: QuizScope;
  instructions?: string | null;
  max_score?: number;
  pass_percentage?: number;
  duration_min?: number | null;
  due_date?: string | null;
  sort_order?: number;
  random_question_count?: number | null;
  allow_reattempt?: boolean;
  max_attempts?: number | null;
  proctoring_enabled?: boolean;
  proctor_camera?: boolean;
  proctor_max_tab_switches?: number | null;
  calculator_mode?: string;
}

export interface ListQuizzesParams {
  course_id: string;
  section_id?: string;
  lesson_id?: string;
  scope?: QuizScope;
  status?: QuizStatus;
  page?: number;
  limit?: number;
}

export interface QuizAnalytics {
  quiz_id: string;
  title: string;
  scope: string;
  max_score: number;
  pass_percentage: number;
  total_attempts: number;
  passed_count: number;
  failed_count: number;
  average_score: number | null;
  median_score: number | null;
  pass_rate: number | null;
  score_distribution: Array<{ range: string; count: number }>;
  student_results?: Array<{
    tenant_member_id: string;
    member_name: string;
    member_email: string | null;
    attempted: boolean;
    attempt_status: string | null;
    score: number | null;
    score_percentage: number | null;
    passed: boolean;
  }>;
  student_results_total?: number;
  student_results_page?: number;
  student_results_limit?: number;
}

export const quizzesApi = {
  list: async (params: ListQuizzesParams): Promise<QuizzesListResponse> => {
    const search = new URLSearchParams();
    search.set("course_id", params.course_id);
    if (params.section_id) search.set("section_id", params.section_id);
    if (params.lesson_id) search.set("lesson_id", params.lesson_id);
    if (params.scope) search.set("scope", params.scope);
    if (params.status) search.set("status", params.status);
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    const response = await apiClient.get<ApiResponse<QuizzesListResponse>>(
      `${BASE}?${search.toString()}`
    );
    return response.data.data;
  },

  get: async (id: string): Promise<Quiz> => {
    const response = await apiClient.get<ApiResponse<Quiz>>(`${BASE}/${id}`);
    return response.data.data;
  },

  create: async (data: CreateQuizRequest): Promise<Quiz> => {
    const response = await apiClient.post<ApiResponse<Quiz>>(BASE, data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateQuizRequest): Promise<Quiz> => {
    const response = await apiClient.patch<ApiResponse<Quiz>>(`${BASE}/${id}`, data);
    return response.data.data;
  },

  publish: async (id: string): Promise<Quiz> => {
    const response = await apiClient.post<ApiResponse<Quiz>>(`${BASE}/${id}/publish`);
    return response.data.data;
  },

  unpublish: async (id: string): Promise<Quiz> => {
    const response = await apiClient.post<ApiResponse<Quiz>>(`${BASE}/${id}/unpublish`);
    return response.data.data;
  },

  remove: async (id: string, force = false): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}${force ? "?force=true" : ""}`);
  },

  generateFromTranscript: async (data: {
    lecture_id: string;
    course_id: string;
    section_id?: string | null;
    lesson_id?: string | null;
    scope: QuizScope;
    max_score?: number;
    pass_percentage?: number;
    due_date?: string | null;
    difficulty?: "EASY" | "MEDIUM" | "HARD";
    num_questions_hint?: number;
  }): Promise<{ quiz: Quiz; note: string }> => {
    const response = await apiClient.post<ApiResponse<{ quiz: Quiz; note: string }>>(
      `${BASE}/generate-from-transcript`,
      data
    );
    return response.data.data;
  },

  generateQuestions: async (
    quizId: string,
    data: {
      input_text: string;
      question_limit: number;
    }
  ): Promise<{ added: number }> => {
    const response = await apiClient.post<ApiResponse<{ added: number }>>(
      `${BASE}/${quizId}/generate-questions`,
      data
    );
    return response.data.data;
  },

  getCourseQuizAnalytics: async (
    courseId: string
  ): Promise<{
    total_quizzes: number;
    published_count: number;
    draft_count: number;
    enrolled_count: number;
    quizzes: Array<{
      quiz_id: string;
      title: string;
      scope: string;
      status: string;
      max_score: number;
      pass_percentage: number;
      attempt_count: number;
      attempt_rate: number;
      passed_count: number;
      failed_count: number;
      average_score: number | null;
      pass_rate: number | null;
    }>;
  }> => {
    const response = await apiClient.get<ApiResponse<{
      total_quizzes: number;
      published_count: number;
      draft_count: number;
      enrolled_count: number;
      quizzes: Array<{
        quiz_id: string;
        title: string;
        scope: string;
        status: string;
        max_score: number;
        pass_percentage: number;
        attempt_count: number;
        attempt_rate: number;
        passed_count: number;
        failed_count: number;
        average_score: number | null;
        pass_rate: number | null;
      }>;
    }>>(`${BASE}/analytics/course/${courseId}`);
    return response.data.data;
  },

  getAnalytics: async (
    quizId: string,
    options?: {
      includeStudentResults?: boolean;
      studentPage?: number;
      studentLimit?: number;
      studentSearch?: string;
    }
  ): Promise<QuizAnalytics> => {
    const params = new URLSearchParams();
    if (options?.includeStudentResults !== false) {
      params.set("include_student_results", "true");
    }
    if (options?.studentPage != null) params.set("student_page", String(options.studentPage));
    if (options?.studentLimit != null) params.set("student_limit", String(options.studentLimit));
    if (options?.studentSearch?.trim()) params.set("student_search", options.studentSearch.trim());
    const qs = params.toString() ? `?${params.toString()}` : "";
    const response = await apiClient.get<ApiResponse<QuizAnalytics>>(
      `${BASE}/${quizId}/analytics${qs}`
    );
    return response.data.data;
  },
};
