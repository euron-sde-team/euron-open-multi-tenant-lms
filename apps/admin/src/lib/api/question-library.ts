/**
 * Question Library API (admin-api)
 *
 * Lets tenant admins discover and copy quiz questions (with options + marks)
 * already authored across their courses into the quiz they are editing.
 * Endpoints under /tenant/question-library/*.
 */

import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

const BASE = "/tenant/question-library";

export type QuestionCourseStatus = "DRAFT" | "PUBLISHED";

export interface QuestionCourseSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  thumbnailKey: string | null;
  updatedAt: string;
  questionCount: number;
}

export interface LibraryQuestionNode {
  questionId: string;
  question: string;
  marks: number;
  sortOrder: number;
  optionCount: number;
}

export interface LibraryQuizNode {
  quizId: string;
  quizTitle: string;
  status: string;
  sortOrder: number;
  questions: LibraryQuestionNode[];
}

export interface QuestionCourseTree {
  courseId: string;
  quizzes: LibraryQuizNode[];
}

export interface QuestionSearchHit {
  questionId: string;
  question: string;
  marks: number;
  optionCount: number;
  quizId: string;
  quizTitle: string;
  quizStatus: string;
  courseId: string;
  courseTitle: string;
}

export interface QuestionDetailOption {
  optionId: string;
  optionText: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface QuestionDetail {
  questionId: string;
  question: string;
  marks: number;
  options: QuestionDetailOption[];
}

export interface ListCoursesFilters {
  search?: string;
  status?: QuestionCourseStatus;
  limit?: number;
  offset?: number;
}

export interface ListCoursesResult {
  items: QuestionCourseSummary[];
  nextOffset: number | null;
}

export interface ImportQuestionPayload {
  question: string;
  marks?: number;
  options: Array<{
    option_text: string;
    is_correct?: boolean;
    sort_order?: number;
  }>;
}

export interface ImportResult {
  added: number;
}

export const questionLibraryApi = {
  listCourses: async (
    filters: ListCoursesFilters = {}
  ): Promise<ListCoursesResult> => {
    const params: Record<string, string | number> = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.limit != null) params.limit = filters.limit;
    if (filters.offset != null) params.offset = filters.offset;
    const response = await apiClient.get<ApiResponse<ListCoursesResult>>(
      `${BASE}/courses`,
      { params }
    );
    return response.data.data;
  },

  getCourseTree: async (courseId: string): Promise<QuestionCourseTree> => {
    const response = await apiClient.get<ApiResponse<QuestionCourseTree>>(
      `${BASE}/courses/${courseId}/tree`
    );
    return response.data.data;
  },

  search: async (query: string, limit = 30): Promise<QuestionSearchHit[]> => {
    const response = await apiClient.get<ApiResponse<QuestionSearchHit[]>>(
      `${BASE}/search`,
      { params: { q: query, limit } }
    );
    return response.data.data;
  },

  getQuestionsDetail: async (
    questionIds: string[]
  ): Promise<QuestionDetail[]> => {
    const response = await apiClient.post<ApiResponse<QuestionDetail[]>>(
      `${BASE}/questions/detail`,
      { questionIds }
    );
    return response.data.data;
  },

  importQuestions: async (params: {
    quizId: string;
    questions: ImportQuestionPayload[];
  }): Promise<ImportResult> => {
    const response = await apiClient.post<ApiResponse<ImportResult>>(
      `${BASE}/import`,
      params
    );
    return response.data.data;
  },
};
