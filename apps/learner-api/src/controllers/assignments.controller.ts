import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import * as assignmentsService from "../services/assignments.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

function getMemberId(req: Request): string {
  const user = req.user as { id: string } | undefined;
  if (!user?.id) throw new BadRequestError("Authentication required");
  return user.id;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return (value as string) ?? "";
}

export async function listAssignments(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = (req.query.course_id as string) ?? "";
  if (!courseId) {
    throw new BadRequestError("course_id is required");
  }
  const result = await assignmentsService.getAssignmentsForUser(
    tenantId,
    memberId,
    courseId,
    {
      section_id: req.query.section_id as string | undefined,
      lesson_id: req.query.lesson_id as string | undefined,
      scope: req.query.scope as string | undefined,
    }
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignments retrieved successfully",
  });
}

export async function streamAssignmentPdf(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const { buffer, contentType } =
    await assignmentsService.getAssignmentPdfBuffer(tenantId, memberId, id);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  res.send(buffer);
}

export async function getAssignmentDetail(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const result = await assignmentsService.getAssignmentDetail(
    tenantId,
    memberId,
    id
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment retrieved successfully",
  });
}

export async function submitAssignment(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");

  const file = req.file;
  const body = req.body as { text_content?: string } | undefined;

  const result = await assignmentsService.submitAssignment(
    tenantId,
    memberId,
    id,
    body ?? null,
    file
      ? {
          buffer: file.buffer,
          mimetype: file.mimetype,
          originalname: file.originalname,
        }
      : undefined
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment submitted successfully",
  });
}

export async function getSubmission(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const result = await assignmentsService.getSubmission(
    tenantId,
    memberId,
    id
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Submission retrieved successfully",
  });
}

export async function markComplete(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const result = await assignmentsService.markAssignmentComplete(
    tenantId,
    memberId,
    id
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment marked complete",
  });
}

export async function markIncomplete(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const result = await assignmentsService.markAssignmentIncomplete(
    tenantId,
    memberId,
    id
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment marked incomplete",
  });
}

export async function getProgress(
  req: Request,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const id = param(req, "id");
  const result = await assignmentsService.getAssignmentProgress(
    tenantId,
    memberId,
    id
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Progress retrieved successfully",
  });
}
