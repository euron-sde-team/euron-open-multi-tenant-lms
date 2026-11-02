import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { ForbiddenError } from "../errors/forbidden.error";
import { BadRequestError } from "../errors/bad-request.error";
import enrolledCoursesSettingsService from "../services/enrolled-courses-settings.service";
import { publishTenantConfigInvalidation } from "../services/cache-bus.publisher";

function tenantId(req: Request): string {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  return req.tenantId;
}

export const getEnrolledCoursesSettings = async (req: Request, res: Response<IResponseFormat>) => {
  const settings = await enrolledCoursesSettingsService.getSettings(tenantId(req));
  sendSuccessResponse({ res, data: settings, statusCode: HttpSuccessStatus.OK, message: "Course access settings retrieved" });
};

export const updateEnrolledCoursesSettings = async (req: Request, res: Response<IResponseFormat>) => {
  const { enrolled_courses_only_enabled } = req.body ?? {};

  if (typeof enrolled_courses_only_enabled !== "boolean") {
    throw new BadRequestError("enrolled_courses_only_enabled must be a boolean");
  }

  const id = tenantId(req);
  const settings = await enrolledCoursesSettingsService.updateSettings(
    id,
    enrolled_courses_only_enabled,
    req.tenantUser.id,
  );

  // Bust the learner-api's in-memory tenant cache so the catalog-visibility
  // change reaches learners within seconds instead of the 60s TTL.
  void publishTenantConfigInvalidation(id);

  sendSuccessResponse({ res, data: settings, statusCode: HttpSuccessStatus.OK, message: "Course access settings updated" });
};
