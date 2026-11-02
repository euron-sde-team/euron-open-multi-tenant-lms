import type { Request, Response } from "express";

import lessonResourcesService from "../services/lesson-resources.service";
import { BadRequestError } from "../errors/bad-request.error";
import type { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = (req as Request & { tenantId?: string }).tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return (value as string) ?? "";
}

export const listLessonResources = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  const resources = await lessonResourcesService.listResources(
    tenantId,
    courseId,
    lessonId
  );
  sendSuccessResponse({
    res,
    data: resources,
    statusCode: HttpSuccessStatus.OK,
    message: "Lesson resources retrieved successfully",
  });
};

export const createLessonResource = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  const { type, title, url, content, downloadable, sort_order } = req.body;
  if (!type) throw new BadRequestError("type is required");
  const resource = await lessonResourcesService.createResource(
    tenantId,
    courseId,
    lessonId,
    { type, title, url, content, downloadable, sort_order }
  );
  sendSuccessResponse({
    res,
    data: resource,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Lesson resource created successfully",
  });
};

export const updateLessonResource = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  const resourceId = param(req, "resourceId");
  const { title, url, content, downloadable, sort_order } = req.body;
  const updated = await lessonResourcesService.updateResource(
    tenantId,
    courseId,
    lessonId,
    resourceId,
    { title, url, content, downloadable, sort_order }
  );
  sendSuccessResponse({
    res,
    data: updated,
    statusCode: HttpSuccessStatus.OK,
    message: "Lesson resource updated successfully",
  });
};

export const deleteLessonResource = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  const resourceId = param(req, "resourceId");
  await lessonResourcesService.deleteResource(
    tenantId,
    courseId,
    lessonId,
    resourceId
  );
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Lesson resource deleted successfully",
  });
};
