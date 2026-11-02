import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { ForbiddenError } from "../errors/forbidden.error";
import { BadRequestError } from "../errors/bad-request.error";
import { certificateTemplateService } from "../services/certificate-template.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

export const getTemplates = async (
  _req: Request,
  res: Response<IResponseFormat>
) => {
  const templates = certificateTemplateService.getTemplates();
  sendSuccessResponse({
    res,
    data: { templates },
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate templates retrieved",
  });
};

export const getSelected = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");

  const result = await certificateTemplateService.getSelected(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Selected certificate template retrieved",
  });
};

export const selectTemplate = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");

  const { templateId, logoUrl } = req.body as { templateId?: string; logoUrl?: string | null };
  if (!templateId || typeof templateId !== "string") {
    throw new BadRequestError("templateId is required");
  }

  const result = await certificateTemplateService.selectTemplate(tenantId, templateId, logoUrl);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate template selected",
  });
};

export const togglePublish = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");

  const { isPublished } = req.body as { isPublished?: boolean };
  if (typeof isPublished !== "boolean") {
    throw new BadRequestError("isPublished (boolean) is required");
  }

  const result = await certificateTemplateService.togglePublish(tenantId, isPublished);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: isPublished ? "Certificate template published" : "Certificate template unpublished",
  });
};
