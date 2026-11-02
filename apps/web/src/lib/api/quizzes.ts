/**
 * Quizzes API client, fetch quiz detail, start/submit attempt, mark complete.
 * Requires authentication and enrollment.
 */

import { apiGet, apiPost } from "./api-client";

export interface QuizOption {
  id: string;
  text?: string;
  option_text?: string;
  is_correct?: boolean;
}

export interface QuizQuestion {
  id: string;
  text?: string;
  question?: string;
  marks: number;
  options: QuizOption[];
  /** User's selected option id (after submission, from API) */
  user_selected_option_id?: string;
}

export interface QuizAttempt {
  id: string;
  status: string;
  score: number;
  total_marks: number;
  started_at: string;
  completed_at: string | null;
  /** Overall time limit in minutes; null = no timer. */
  duration_min?: number | null;
}

export interface QuizDetail {
  id: string;
  title: string;
  instructions: string | null;
  max_score: number;
  pass_percentage: number;
  due_date: string | null;
  question_count?: number;
  questions?: QuizQuestion[];
  attempt?: QuizAttempt | null;
  /** Overall time limit in minutes; null = no timer. */
  duration_min?: number | null;
  // Proctoring config (Bug 5).
  proctoring_enabled?: boolean;
  proctor_camera?: boolean;
  proctor_max_tab_switches?: number | null;
  calculator_mode?: string;
}

export interface QuizListItem {
  id: string;
  title: string;
  instructions: string | null;
  max_score: number;
  pass_percentage: number;
  due_date: string | null;
  question_count?: number;
  attempt_id?: string;
  attempt_status?: string;
  score?: number;
  total_marks?: number;
}

export async function getQuizDetail(
  quizId: string,
  includeCorrect = false
): Promise<QuizDetail> {
  const qs = includeCorrect ? "?include_correct=true" : "";
  return apiGet<QuizDetail>(`/quizzes/${quizId}${qs}`);
}

export async function listQuizzes(
  courseId: string,
  filters?: { section_id?: string; lesson_id?: string; scope?: string }
): Promise<QuizListItem[]> {
  const params = new URLSearchParams({ course_id: courseId });
  if (filters?.section_id) params.set("section_id", filters.section_id);
  if (filters?.lesson_id) params.set("lesson_id", filters.lesson_id);
  if (filters?.scope) params.set("scope", filters.scope);
  return apiGet<QuizListItem[]>(`/quizzes?${params.toString()}`);
}

export async function startAttempt(quizId: string): Promise<QuizAttempt> {
  return apiPost<QuizAttempt>(`/quizzes/${quizId}/start`);
}

export async function submitAttempt(
  quizId: string,
  answers: Array<{
    question_id: string;
    option_id: string;
    // Multi-blank DRAG_DROP: one option id per blank (in stem order).
    answer?: (string | null)[];
  }>,
  tabSwitchCount?: number
): Promise<{
  attempt_id: string;
  score: number;
  total_marks: number;
  status: string;
  passed: boolean;
  questions: QuizQuestion[];
}> {
  return apiPost(`/quizzes/${quizId}/submit`, {
    answers,
    tab_switch_count: tabSwitchCount,
  });
}

export async function getAttempt(quizId: string): Promise<QuizAttempt | null> {
  const res = await apiGet<{ attempt: QuizAttempt | null }>(
    `/quizzes/${quizId}/attempt`
  );
  return res?.attempt ?? null;
}

export interface QuizAttemptSummary {
  id: string;
  attempt_number: number;
  status: string;
  score: number;
  total_marks: number;
  percentage: number;
  started_at: string;
  completed_at: string | null;
}

/** A learner's full re-attempt history for a quiz, newest first. */
export async function listQuizAttempts(
  quizId: string
): Promise<QuizAttemptSummary[]> {
  const res = await apiGet<{ attempts: QuizAttemptSummary[] }>(
    `/quizzes/${quizId}/attempts`
  );
  return res?.attempts ?? [];
}

export interface QuizAttemptReview {
  attempt_id: string;
  score: number;
  total_marks: number;
  status: string;
  questions: QuizQuestion[];
}

/** Per-attempt review: questions, correct answers, and what the learner chose. */
export async function getQuizAttemptReview(
  quizId: string,
  attemptId: string
): Promise<QuizAttemptReview> {
  return apiGet<QuizAttemptReview>(`/quizzes/${quizId}/attempts/${attemptId}`);
}

export async function markQuizComplete(
  quizId: string
): Promise<{ completed: boolean; completed_at: string }> {
  return apiPost(`/quizzes/${quizId}/mark-complete`);
}
