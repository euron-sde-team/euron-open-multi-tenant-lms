import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import * as assignmentsService from "../services/assignments.service";
import * as submissionsService from "../services/submissions.service";

function getTenantId(req: Request): string {
  const tenantId = (req as Request & { tenantId?: string }).tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return (value as string) ?? "";
}

export async function create(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const dto = req.body as assignmentsService.CreateAssignmentDto;
  if (!dto.title || dto.title.length < 3 || dto.title.length > 255) {
    throw new BadRequestError("title is required (3-255 characters)");
  }
  if (!dto.course_id) {
    throw new BadRequestError("course_id is required");
  }
  if (!dto.scope) {
    throw new BadRequestError("scope is required (COURSE | SECTION | LESSON)");
  }
  const assignment = await assignmentsService.create(tenantId, dto);
  sendSuccessResponse({
    res,
    data: assignment,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Assignment created successfully",
  });
}

export async function findAll(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const course_id = (req.query.course_id as string) ?? "";
  if (!course_id) {
    throw new BadRequestError("course_id is required");
  }
  const dto: assignmentsService.ListAssignmentsDto = {
    course_id,
    section_id: req.query.section_id as string | undefined,
    lesson_id: req.query.lesson_id as string | undefined,
    scope: req.query.scope as "COURSE" | "SECTION" | "LESSON" | undefined,
    status: req.query.status as "DRAFT" | "PUBLISHED" | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  };
  const result = await assignmentsService.findAll(tenantId, dto);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignments retrieved successfully",
  });
}

export async function findOne(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const assignment = await assignmentsService.findOne(tenantId, id);
  sendSuccessResponse({
    res,
    data: assignment,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment retrieved successfully",
  });
}

export async function update(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const dto = req.body as assignmentsService.UpdateAssignmentDto;
  const assignment = await assignmentsService.update(tenantId, id, dto);
  sendSuccessResponse({
    res,
    data: assignment,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment updated successfully",
  });
}

export async function publish(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const assignment = await assignmentsService.publish(tenantId, id);
  sendSuccessResponse({
    res,
    data: assignment,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment published successfully",
  });
}

export async function unpublish(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const assignment = await assignmentsService.unpublish(tenantId, id);
  sendSuccessResponse({
    res,
    data: assignment,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment unpublished successfully",
  });
}

export async function remove(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const force = req.query.force === "true";
  await assignmentsService.remove(tenantId, id, force);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment deleted successfully",
  });
}

export async function generateFromTranscript(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const dto = req.body as assignmentsService.GenerateFromTranscriptDto;
  if (!dto.lecture_id) {
    throw new BadRequestError("lecture_id is required");
  }
  if (!dto.course_id) {
    throw new BadRequestError("course_id is required");
  }
  if (!dto.scope) {
    throw new BadRequestError("scope is required (COURSE | SECTION | LESSON)");
  }
  const assignment = await assignmentsService.generateFromTranscript(
    tenantId,
    dto
  );
  sendSuccessResponse({
    res,
    data: {
      assignment,
      note: "Assignment generated as DRAFT. Review and edit before publishing.",
    },
    statusCode: HttpSuccessStatus.CREATED,
    message: "Assignment generated successfully",
  });
}

export async function uploadPdf(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const file = req.file;
  if (!file) {
    throw new BadRequestError("No file provided");
  }
  const assignment = await assignmentsService.uploadPdf(tenantId, id, {
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
  });
  sendSuccessResponse({
    res,
    data: assignment,
    statusCode: HttpSuccessStatus.OK,
    message: "File uploaded successfully",
  });
}

export async function getPdfUrl(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const result = await assignmentsService.getPdfSignedUrl(tenantId, id);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "PDF URL generated successfully",
  });
}

export async function removePdf(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const assignment = await assignmentsService.removePdf(tenantId, id);
  sendSuccessResponse({
    res,
    data: assignment,
    statusCode: HttpSuccessStatus.OK,
    message: "PDF removed successfully",
  });
}

function getEvaluatorUserId(req: Request): string {
  const user = (req as Request & { tenantUser?: { id: string } }).tenantUser;
  return user?.id ?? "system";
}

export async function listSubmissions(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const assignmentId = param(req, "id");
  const assignment = await assignmentsService.findOne(tenantId, assignmentId);
  const result = await submissionsService.listSubmissions(tenantId, {
    course_id: assignment.course_id,
    assignment_id: assignmentId,
    status: req.query.status as string | undefined,
    submitted_from: req.query.submitted_from as string | undefined,
    submitted_to: req.query.submitted_to as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Submissions retrieved successfully",
  });
}

export async function getSubmissionDetail(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const submissionId = param(req, "submissionId");
  const result = await submissionsService.getSubmissionDetail(
    tenantId,
    submissionId
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Submission retrieved successfully",
  });
}

export async function streamSubmissionPdf(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const submissionId = param(req, "submissionId");
  const { buffer, contentType } =
    await submissionsService.getSubmissionPdfBuffer(tenantId, submissionId);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  res.send(buffer);
}

export async function evaluateSubmission(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const submissionId = param(req, "submissionId");
  const evaluatorId = getEvaluatorUserId(req);
  const dto = req.body as submissionsService.EvaluateSubmissionDto;
  if (typeof dto?.score !== "number") {
    throw new BadRequestError("score is required");
  }
  const result = await submissionsService.evaluateSubmission(
    tenantId,
    submissionId,
    evaluatorId,
    dto
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Submission evaluated successfully",
  });
}

export async function requestResubmission(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const submissionId = param(req, "submissionId");
  const dto = req.body as submissionsService.RequestResubmissionDto;
  if (!dto?.feedback || dto.feedback.length < 10) {
    throw new BadRequestError("feedback is required (min 10 characters)");
  }
  if (dto.feedback.length > 1000) {
    throw new BadRequestError("feedback must be at most 1000 characters");
  }
  const result = await submissionsService.requestResubmission(
    tenantId,
    submissionId,
    dto
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Resubmission requested successfully",
  });
}
