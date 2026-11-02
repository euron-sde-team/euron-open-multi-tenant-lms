/**
 * Assignments API client, fetch assignments, submit (PDF or text/link).
 * Requires authentication and enrollment.
 */

import { apiGet, axiosInstance } from "./api-client";

export interface AssignmentSubmission {
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
}

export interface AssignmentDetail {
  id: string;
  title: string;
  instructions: string | null;
  content_type: string;
  max_score: number;
  /** Minimum score to pass; null = no pass/fail. */
  passing_score: number | null;
  due_date: string | null;
  pdf_url: string | null;
  /** True/false once graded against a passing score; null = not applicable. */
  passed: boolean | null;
  submission: AssignmentSubmission | null;
}

export async function getAssignmentDetail(
  assignmentId: string
): Promise<AssignmentDetail> {
  return apiGet<AssignmentDetail>(`/assignments/${assignmentId}`);
}

export async function submitAssignment(
  assignmentId: string,
  data: { file?: File; text_content?: string }
): Promise<{ id: string }> {
  const formData = new FormData();
  if (data.file) {
    formData.append("file", data.file);
  }
  if (data.text_content?.trim()) {
    formData.append("text_content", data.text_content.trim());
  }
  const res = await axiosInstance.post<{ success?: boolean; data?: unknown }>(
    `/assignments/${assignmentId}/submit`,
    formData
  );
  const json = res.data;
  if (!json?.success) {
    throw new Error(
      (json as { error?: { message?: string }; message?: string })?.error?.message ||
        (json as { message?: string })?.message ||
        "Submission failed"
    );
  }
  const d = json.data as { id?: string };
  return { id: d?.id ?? "" };
}
