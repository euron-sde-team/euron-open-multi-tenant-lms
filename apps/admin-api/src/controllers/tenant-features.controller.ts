import { Request, Response } from "express";
import tenantFeaturesService from "../services/tenant-features.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List active applications for the authenticated tenant.
 * GET /tenant/applications
 */
export const getApplications = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }

  const applications =
    await tenantFeaturesService.getApplicationsForTenant(tenantId);

  sendSuccessResponse({
    res,
    data: applications,
    statusCode: HttpSuccessStatus.OK,
    message: "Applications retrieved successfully",
  });
};

/**
 * Resolve features for the authenticated tenant, optionally filtered by application.
 * GET /tenant/features
 * GET /tenant/features?application_code=lms
 */
export const getResolvedFeatures = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }

  const applicationCode = req.query.application_code as string | undefined;

  const resolved = await tenantFeaturesService.getResolvedFeatures(
    tenantId,
    applicationCode
  );

  sendSuccessResponse({
    res,
    data: resolved,
    statusCode: HttpSuccessStatus.OK,
    message: "Features resolved successfully",
  });
};
