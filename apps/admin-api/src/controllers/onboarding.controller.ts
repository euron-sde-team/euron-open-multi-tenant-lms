import { Request, Response } from "express";
import { ForbiddenError } from "../errors/forbidden.error";
import onboardingService from "../services/onboarding.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

export const getChecklist = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");

  const result = await onboardingService.getChecklist(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Onboarding checklist fetched",
  });
};

export const dismissChecklist = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");

  const result = await onboardingService.dismissChecklist(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Onboarding checklist dismissed",
  });
};
