import { Request, Response } from "express";
import testSeriesService from "../services/test-series.service";
import testsService from "../services/tests.service";
import testAnalyticsService from "../services/test-analytics.service";
import testAnalyticsExportService from "../services/test-analytics-export.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getActorId(req: Request): string | undefined {
  return (req as Request & { tenantUser?: { id?: string } }).tenantUser?.id;
}

export const listSeries = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const result = await testSeriesService.list(tenantId, {
    page,
    limit,
    status: req.query.status as string | undefined,
    visibility: req.query.visibility as string | undefined,
    pricing_type: req.query.pricing_type as string | undefined,
    search: req.query.search as string | undefined,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Series retrieved successfully",
  });
};

export const getSeriesEntitlementUsage = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const data = await testSeriesService.getEntitlementUsage(tenantId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Usage retrieved",
  });
};

export const getSeries = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const data = await testSeriesService.getById(tenantId, seriesId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Series retrieved successfully",
  });
};

export const getSeriesBySlug = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(param(req, "slug") || "");
  if (!slug) throw new BadRequestError("Slug is required");
  const data = await testSeriesService.getBySlug(tenantId, slug);
  if (!data) throw new NotFoundError("Series not found");
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Series retrieved successfully",
  });
};

export const createSeries = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await testSeriesService.create(tenantId, req.body, getActorId(req));
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Series created successfully",
  });
};

export const updateSeries = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const data = await testSeriesService.update(tenantId, seriesId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Series updated successfully",
  });
};

export const deleteSeries = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  await testSeriesService.delete(tenantId, seriesId);
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Series deleted successfully",
  });
};

export const publishSeries = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const data = await testSeriesService.publish(tenantId, seriesId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Series published successfully",
  });
};

export const unpublishSeries = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const data = await testSeriesService.unpublish(tenantId, seriesId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Series unpublished successfully",
  });
};

// ---------- Series-Tests linking ----------
export const listSeriesTests = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const data = await testSeriesService.listSeriesTests(tenantId, seriesId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Series tests retrieved",
  });
};

export const addTestToSeries = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  if (!req.body?.test_id) throw new BadRequestError("test_id is required");
  const data = await testSeriesService.addTestToSeries(tenantId, seriesId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Test added to series",
  });
};

export const removeTestFromSeries = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const testId = param(req, "testId");
  await testSeriesService.removeTestFromSeries(tenantId, seriesId, testId);
  sendSuccessResponse({
    res,
    data: { removed: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Test removed from series",
  });
};

export const reorderSeriesTests = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const orderedTestIds = req.body?.orderedTestIds;
  if (!Array.isArray(orderedTestIds)) {
    throw new BadRequestError("orderedTestIds array is required");
  }
  const data = await testSeriesService.reorderSeriesTests(
    tenantId,
    seriesId,
    orderedTestIds
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Series tests reordered",
  });
};

export const listSeriesAttempts = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const attempts = await testsService.listSeriesAttempts(tenantId, seriesId);
  sendSuccessResponse({
    res,
    data: { attempts },
    statusCode: HttpSuccessStatus.OK,
    message: "Series attempts retrieved",
  });
};

export const getSeriesAnalytics = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const data = await testAnalyticsService.getSeriesAnalytics(tenantId, seriesId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Series analytics retrieved successfully",
  });
};

export const exportSeriesAnalytics = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const seriesId = param(req, "seriesId");
  const { buffer, fileName } =
    await testAnalyticsExportService.buildSeriesWorkbook(tenantId, seriesId);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.status(HttpSuccessStatus.OK).end(buffer);
};

