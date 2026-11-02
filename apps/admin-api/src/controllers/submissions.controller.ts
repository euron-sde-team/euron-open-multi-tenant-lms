import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import * as submissionsService from "../services/submissions.service";

function getTenantId(req: Request): string {
  const tenantId = (req as Request & { tenantId?: string }).tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }
  return tenantId;
}

export async function listSubmissions(
  req: Request,
  res: Response<IResponseFormat>
): Promise<void> {
  const tenantId = getTenantId(req);
  const result = await submissionsService.listSubmissions(tenantId, {
    course_id: (req.query.course_id as string) || undefined,
    assignment_id: (req.query.assignment_id as string) || undefined,
    status: (req.query.status as string) || undefined,
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
