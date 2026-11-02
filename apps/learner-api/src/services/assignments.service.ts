import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import courseService from "./course.service";
import certificateService from "./certificate.service";
import * as assignmentsRepo from "../repositories/assignments.repository";
import * as s3Service from "./s3.service";

export async function getAssignmentsForUser(
  tenantId: string,
  memberId: string,
  courseId: string,
  query?: { section_id?: string; lesson_id?: string; scope?: string }
) {
  await courseService.ensureEnrolled(tenantId, courseId, memberId);
  let result = await assignmentsRepo.listPublishedAssignments(
    tenantId,
    memberId,
    courseId,
    query
  );
  if (
    result.length === 0 &&
    query?.lesson_id
  ) {
    const byLesson = await assignmentsRepo.getAssignmentByLessonId(
      tenantId,
      query.lesson_id
    );
    if (byLesson) {
      try {
        await courseService.ensureEnrolled(
          tenantId,
          byLesson.course_id,
          memberId
        );
        const submission = await assignmentsRepo.getSubmissionByAssignmentAndMember(
          tenantId,
          byLesson.id,
          memberId
        );
        const evaluation = submission
          ? await assignmentsRepo.getEvaluationBySubmissionId(
              tenantId,
              submission.id
            )
          : null;
        result = [
          {
            id: byLesson.id,
            title: byLesson.title,
            instructions: byLesson.instructions,
            content_type: byLesson.content_type,
            scope: "LESSON",
            max_score: byLesson.max_score,
            due_date: byLesson.due_date,
            sort_order: 0,
            has_submitted: !!submission,
            submission_status: submission?.status ?? null,
            score: evaluation?.score ?? null,
          },
        ];
      } catch {
        result = [];
      }
    }
  }
  return result;
}

/** Stream assignment PDF from S3 (for same-origin iframe embedding). */
export async function getAssignmentPdfBuffer(
  tenantId: string,
  memberId: string,
  assignmentId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const assignment = await assignmentsRepo.getAssignmentById(
    tenantId,
    assignmentId
  );
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  await courseService.ensureEnrolled(tenantId, assignment.course_id, memberId);
  if (!assignment.pdf_key?.trim()) {
    throw new NotFoundError("Assignment has no PDF");
  }
  const buffer = await s3Service.getObjectBuffer(assignment.pdf_key);
  return {
    buffer,
    contentType: s3Service.getContentTypeForKey(assignment.pdf_key),
  };
}

export async function getAssignmentDetail(
  tenantId: string,
  memberId: string,
  assignmentId: string
) {
  const assignment = await assignmentsRepo.getAssignmentById(
    tenantId,
    assignmentId
  );
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  await courseService.ensureEnrolled(tenantId, assignment.course_id, memberId);

  let pdfUrl: string | null = null;
  if (assignment.pdf_key && assignment.pdf_key.trim()) {
    try {
      pdfUrl = await s3Service.getSignedGetUrl(assignment.pdf_key, 3600);
    } catch {
      // Log but don't fail
    }
  }

  const submission = await assignmentsRepo.getSubmissionByAssignmentAndMember(
    tenantId,
    assignmentId,
    memberId
  );

  let evaluation = null;
  if (submission) {
    const evalRow = await assignmentsRepo.getEvaluationBySubmissionId(
      tenantId,
      submission.id
    );
    if (evalRow) {
      evaluation = {
        score: evalRow.score,
        max_score: evalRow.max_score,
        feedback: evalRow.feedback,
        evaluated_at: evalRow.evaluated_at.toISOString(),
      };
    }
  }

  // Pass/fail is only meaningful once graded and only when the assignment sets a
  // passing score. null = not applicable (no passing bar, or not evaluated yet).
  const passed =
    assignment.passing_score != null && evaluation?.score != null
      ? evaluation.score >= assignment.passing_score
      : null;

  return {
    ...assignment,
    pdf_url: pdfUrl,
    passed,
    submission: submission
      ? {
          id: submission.id,
          content_type: submission.content_type,
          text_content: submission.text_content,
          status: submission.status,
          submitted_at: submission.submitted_at?.toISOString() ?? null,
          evaluation,
        }
      : null,
  };
}

export async function submitAssignment(
  tenantId: string,
  memberId: string,
  assignmentId: string,
  data: { text_content?: string } | null,
  file?: { buffer: Buffer; mimetype: string; originalname?: string }
) {
  const assignment = await assignmentsRepo.getAssignmentById(
    tenantId,
    assignmentId
  );
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  await courseService.ensureEnrolled(tenantId, assignment.course_id, memberId);

  if (String(assignment.status) !== "PUBLISHED") {
    throw new ForbiddenError("Assignment is not available for submission");
  }

  if (assignment.due_date && new Date() > assignment.due_date) {
    throw new BadRequestError("Submission deadline has passed");
  }

  const existingSubmission =
    await assignmentsRepo.getSubmissionByAssignmentAndMember(
      tenantId,
      assignmentId,
      memberId
    );

  if (
    existingSubmission &&
    String(existingSubmission.status) !== "RESUBMISSION_REQUESTED"
  ) {
    throw new BadRequestError("You have already submitted this assignment");
  }

  let content_type: "TEXT" | "PDF" = "TEXT";
  let text_content: string | null = null;
  let pdf_key: string | null = null;

  if (file) {
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.buffer.length > MAX_SIZE) {
      throw new BadRequestError("File size exceeds 10MB limit");
    }
    // content_type "PDF" denotes a file-based submission (any type), as opposed to TEXT.
    content_type = "PDF";
    pdf_key = await s3Service.uploadSubmissionPdf(
      tenantId,
      assignmentId,
      memberId,
      file
    );
  } else {
    const text = data?.text_content?.trim();
    if (!text || text.length < 10) {
      throw new BadRequestError(
        "text_content is required (min 10 characters) for text submission"
      );
    }
    text_content = text;
  }

  await assignmentsRepo.upsertSubmission(
    tenantId,
    assignmentId,
    assignment.course_id,
    memberId,
    { content_type, text_content, pdf_key }
  );

  await assignmentsRepo.upsertMemberAssignmentProgress(
    tenantId,
    memberId,
    assignmentId,
    assignment.course_id,
    assignment.lesson_id,
    true
  );

  const submission =
    await assignmentsRepo.getSubmissionByAssignmentAndMember(
      tenantId,
      assignmentId,
      memberId
    );
  const evalRow = submission
    ? await assignmentsRepo.getEvaluationBySubmissionId(
        tenantId,
        submission.id
      )
    : null;

  let pdfUrl: string | null = null;
  if (submission?.pdf_key) {
    try {
      pdfUrl = await s3Service.getSignedGetUrl(submission.pdf_key, 3600);
    } catch {
      // ignore
    }
  }

  return {
    id: submission!.id,
    content_type: submission!.content_type,
    text_content: submission!.text_content,
    pdf_url: pdfUrl,
    status: submission!.status,
    submitted_at: submission!.submitted_at?.toISOString() ?? null,
    evaluation: evalRow
      ? {
          score: evalRow.score,
          max_score: evalRow.max_score,
          feedback: evalRow.feedback,
          evaluated_at: evalRow.evaluated_at.toISOString(),
        }
      : null,
  };
}

export async function getSubmission(
  tenantId: string,
  memberId: string,
  assignmentId: string
) {
  const assignment = await assignmentsRepo.getAssignmentById(
    tenantId,
    assignmentId
  );
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  await courseService.ensureEnrolled(tenantId, assignment.course_id, memberId);

  const submission =
    await assignmentsRepo.getSubmissionByAssignmentAndMember(
      tenantId,
      assignmentId,
      memberId
    );
  if (!submission) {
    throw new NotFoundError("No submission found for this assignment");
  }

  const evalRow = await assignmentsRepo.getEvaluationBySubmissionId(
    tenantId,
    submission.id
  );

  let pdfUrl: string | null = null;
  if (submission.pdf_key) {
    try {
      pdfUrl = await s3Service.getSignedGetUrl(submission.pdf_key, 3600);
    } catch {
      // ignore
    }
  }

  return {
    id: submission.id,
    content_type: submission.content_type,
    text_content: submission.text_content,
    pdf_url: pdfUrl,
    status: submission.status,
    submitted_at: submission.submitted_at?.toISOString() ?? null,
    evaluation: evalRow
      ? {
          score: evalRow.score,
          max_score: evalRow.max_score,
          feedback: evalRow.feedback,
          evaluated_at: evalRow.evaluated_at.toISOString(),
        }
      : null,
  };
}

export async function markAssignmentComplete(
  tenantId: string,
  memberId: string,
  assignmentId: string
) {
  const assignment = await assignmentsRepo.getAssignmentById(
    tenantId,
    assignmentId
  );
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  await courseService.ensureEnrolled(tenantId, assignment.course_id, memberId);

  await assignmentsRepo.upsertMemberAssignmentProgress(
    tenantId,
    memberId,
    assignmentId,
    assignment.course_id,
    assignment.lesson_id,
    true
  );

  if (assignment.course_id) {
    void certificateService.maybeIssueCourseCertificateOnCompletion(
      tenantId,
      assignment.course_id,
      memberId
    );
  }

  const progress = await assignmentsRepo.getMemberAssignmentProgress(
    tenantId,
    memberId,
    assignmentId
  );
  return {
    completed: progress?.completed ?? true,
    completed_at: progress?.completed_at?.toISOString() ?? new Date().toISOString(),
  };
}

export async function markAssignmentIncomplete(
  tenantId: string,
  memberId: string,
  assignmentId: string
) {
  const assignment = await assignmentsRepo.getAssignmentById(
    tenantId,
    assignmentId
  );
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  await courseService.ensureEnrolled(tenantId, assignment.course_id, memberId);

  const submission = await assignmentsRepo.getSubmissionByAssignmentAndMember(
    tenantId,
    assignmentId,
    memberId
  );
  if (submission) {
    const evalRow = await assignmentsRepo.getEvaluationBySubmissionId(
      tenantId,
      submission.id
    );
    if (evalRow) {
      throw new BadRequestError(
        "Cannot mark incomplete: assignment has been evaluated"
      );
    }
  }

  await assignmentsRepo.upsertMemberAssignmentProgress(
    tenantId,
    memberId,
    assignmentId,
    assignment.course_id,
    assignment.lesson_id,
    false
  );

  const progress = await assignmentsRepo.getMemberAssignmentProgress(
    tenantId,
    memberId,
    assignmentId
  );
  return {
    completed: progress?.completed ?? false,
    completed_at: progress?.completed_at?.toISOString() ?? null,
  };
}

export async function getAssignmentProgress(
  tenantId: string,
  memberId: string,
  assignmentId: string
) {
  const assignment = await assignmentsRepo.getAssignmentById(
    tenantId,
    assignmentId
  );
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  await courseService.ensureEnrolled(tenantId, assignment.course_id, memberId);

  const progress = await assignmentsRepo.getMemberAssignmentProgress(
    tenantId,
    memberId,
    assignmentId
  );

  return {
    completed: progress?.completed ?? false,
    completed_at: progress?.completed_at?.toISOString() ?? null,
    created_at: progress?.created_at?.toISOString() ?? null,
    updated_at: progress?.updated_at?.toISOString() ?? null,
  };
}
