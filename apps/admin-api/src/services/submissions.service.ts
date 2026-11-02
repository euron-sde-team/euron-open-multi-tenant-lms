import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";

import * as submissionsRepo from "../repositories/submissions.repository";
import uploadService from "./upload.service";

export interface ListSubmissionsDto {
  course_id?: string;
  assignment_id?: string;
  status?: string;
  submitted_from?: string;
  submitted_to?: string;
  page?: number;
  limit?: number;
}

export interface EvaluateSubmissionDto {
  score: number;
  feedback?: string;
  /**
   * When the assignment has a passing score and the learner scores below it,
   * reopen the submission for another attempt. Defaults to true; set false to
   * finalize a failing grade.
   */
  allow_resubmission?: boolean;
}

export interface RequestResubmissionDto {
  feedback: string;
}

export async function listSubmissions(
  tenantId: string,
  dto: ListSubmissionsDto
) {
  return submissionsRepo.listSubmissions(tenantId, {
    course_id: dto.course_id,
    assignment_id: dto.assignment_id,
    status: dto.status,
    submitted_from: dto.submitted_from,
    submitted_to: dto.submitted_to,
    page: dto.page ?? 1,
    limit: dto.limit ?? 20,
  });
}

export async function getSubmissionDetail(
  tenantId: string,
  submissionId: string
) {
  const submission = await submissionsRepo.getSubmissionById(
    tenantId,
    submissionId
  );
  if (!submission) {
    throw new NotFoundError("Submission not found");
  }

  let pdfUrl: string | null = null;
  if (submission.pdf_key && submission.pdf_key.trim()) {
    try {
      pdfUrl = await uploadService.getAssignmentPdfSignedUrl(
        submission.pdf_key,
        3600
      );
    } catch {
      // ignore
    }
  }

  // Pass/fail is only meaningful once graded and only when the assignment has a
  // passing score. null = not applicable (no passing bar, or not evaluated yet).
  const passed =
    submission.assignment_passing_score != null && submission.score != null
      ? submission.score >= submission.assignment_passing_score
      : null;

  return {
    ...submission,
    pdf_url: pdfUrl,
    passed,
    submitted_at: submission.submitted_at?.toISOString() ?? null,
    evaluated_at: submission.evaluated_at?.toISOString() ?? null,
  };
}

export async function getSubmissionPdfBuffer(
  tenantId: string,
  submissionId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const submission = await submissionsRepo.getSubmissionById(
    tenantId,
    submissionId
  );
  if (!submission) {
    throw new NotFoundError("Submission not found");
  }
  if (!submission.pdf_key || !submission.pdf_key.trim()) {
    throw new NotFoundError("This submission has no PDF");
  }
  return uploadService.getPdfBuffer(submission.pdf_key);
}

export async function evaluateSubmission(
  tenantId: string,
  submissionId: string,
  evaluatorUserId: string,
  dto: EvaluateSubmissionDto
) {
  const submission = await submissionsRepo.getSubmissionById(
    tenantId,
    submissionId
  );
  if (!submission) {
    throw new NotFoundError("Submission not found");
  }

  if (String(submission.status) === "PENDING") {
    throw new BadRequestError(
      "Cannot evaluate a submission that hasn't been submitted yet"
    );
  }

  if (dto.score > submission.assignment_max_score) {
    throw new BadRequestError(
      `Score cannot exceed max score of ${submission.assignment_max_score}`
    );
  }

  if (dto.score < 0) {
    throw new BadRequestError("Score cannot be negative");
  }

  await submissionsRepo.upsertEvaluation(
    tenantId,
    submissionId,
    submission.assignment_id,
    submission.tenant_member_id,
    {
      score: dto.score,
      max_score: submission.assignment_max_score,
      feedback: dto.feedback ?? null,
      evaluated_by: evaluatorUserId,
    }
  );

  // Pass/fail only applies when the assignment defines a passing score. If the
  // learner scored below it and resubmission is allowed (the default), reopen
  // the submission so they can try again; otherwise finalize as EVALUATED.
  const passingScore = submission.assignment_passing_score;
  const failed = passingScore != null && dto.score < passingScore;
  const allowResubmission = dto.allow_resubmission ?? true;
  const nextStatus =
    failed && allowResubmission ? "RESUBMISSION_REQUESTED" : "EVALUATED";

  await submissionsRepo.updateSubmissionStatus(
    tenantId,
    submissionId,
    nextStatus
  );

  const updated = await submissionsRepo.getSubmissionById(
    tenantId,
    submissionId
  );
  return updated;
}

export async function requestResubmission(
  tenantId: string,
  submissionId: string,
  dto: RequestResubmissionDto
) {
  const submission = await submissionsRepo.getSubmissionById(
    tenantId,
    submissionId
  );
  if (!submission) {
    throw new NotFoundError("Submission not found");
  }

  const status = String(submission.status);
  if (
    status !== "SUBMITTED" &&
    status !== "UNDER_REVIEW" &&
    status !== "EVALUATED"
  ) {
    throw new BadRequestError(
      "Can only request resubmission for a submitted or evaluated submission"
    );
  }

  await submissionsRepo.updateSubmissionStatus(
    tenantId,
    submissionId,
    "RESUBMISSION_REQUESTED"
  );

  await submissionsRepo.upsertEvaluation(
    tenantId,
    submissionId,
    submission.assignment_id,
    submission.tenant_member_id,
    {
      score: 0,
      max_score: submission.assignment_max_score,
      feedback: dto.feedback,
      evaluated_by: "system",
    }
  );

  const updated = await submissionsRepo.getSubmissionById(
    tenantId,
    submissionId
  );
  return updated;
}
