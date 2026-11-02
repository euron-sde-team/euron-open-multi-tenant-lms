import { Request, Response } from "express";
import dashboardService from "../services/dashboard.service";
import {
  getPostHogInsightsForTenant,
  getCourseAnalytics,
  getBookAnalytics,
  getUserAnalytics,
  getPageHeatmapDetail,
  getReplayEmbedToken,
} from "../services/posthog-analytics.service";
import { BadRequestError } from "../errors/bad-request.error";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

export const getDashboard = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }

  const data = await dashboardService.getDashboardData(tenantId);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Dashboard data retrieved successfully",
  });
};

export const getCourseStats = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }

  const data = await dashboardService.getCourseStatsByMode(tenantId);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Course stats retrieved successfully",
  });
};

export const getBookStats = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }

  const data = await dashboardService.getBookStatsWithAccess(tenantId);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Book stats retrieved successfully",
  });
};

export const getEnrollmentBreakdown = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const search = (req.query.search as string)?.trim() || undefined;
  const data = await dashboardService.getEnrollmentBreakdownByCourse(
    tenantId,
    limit,
    search
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Enrollment breakdown retrieved successfully",
  });
};

export const getBookAccessBreakdown = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const search = (req.query.search as string)?.trim() || undefined;
  const data = await dashboardService.getBookAccessBreakdown(tenantId, limit, search);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Book access breakdown retrieved successfully",
  });
};

export const getUserStats = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const search = (req.query.search as string)?.trim() || undefined;
  const data = await dashboardService.getUserStats(tenantId, page, limit, search);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "User stats retrieved successfully",
  });
};

export const getPostHogInsights = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new BadRequestError("Tenant context required");
  }

  const tenantSlug = String(req.query.tenantSlug ?? "");
  const data = await getPostHogInsightsForTenant(tenantId, tenantSlug);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "PostHog insights retrieved successfully",
  });
};

export const getPostHogCourseAnalytics = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const slug = String(req.params.slug ?? "");
  if (!slug) throw new BadRequestError("Course slug is required");

  const tenantSlug = String(req.query.tenantSlug ?? "");
  const data = await getCourseAnalytics(tenantId, slug, tenantSlug);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Course analytics retrieved successfully",
  });
};

export const getPostHogBookAnalytics = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const slug = String(req.params.slug ?? "");
  if (!slug) throw new BadRequestError("Book slug is required");

  const tenantSlug = String(req.query.tenantSlug ?? "");
  const data = await getBookAnalytics(tenantId, slug, tenantSlug);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Book analytics retrieved successfully",
  });
};

export const getPostHogUserAnalytics = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const userId = String(req.params.userId ?? "");
  if (!userId) throw new BadRequestError("User ID is required");

  const tenantSlug = String(req.query.tenantSlug ?? "");
  const data = await getUserAnalytics(tenantId, userId, { tenantSlug: tenantSlug ?? "" });

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "User analytics retrieved successfully",
  });
};

export const getPostHogPageHeatmap = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const pageUrl = String(req.query.pageUrl ?? "");
  if (!pageUrl) throw new BadRequestError("pageUrl query parameter is required");

  const tenantSlug = String(req.query.tenantSlug ?? "");
  const data = await getPageHeatmapDetail(tenantId, pageUrl, tenantSlug);

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Page heatmap detail retrieved successfully",
  });
};

export const getPostHogReplayEmbedToken = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const sessionId = String(req.query.sessionId ?? "");
  if (!sessionId) throw new BadRequestError("sessionId query parameter is required");

  const tenantSlug = String(req.query.tenantSlug ?? "");

  const result = await getReplayEmbedToken(tenantId, sessionId, tenantSlug);

  if (!result) {
    res.status(403).json({
      statusCode: 403,
      success: false,
      message: "Access denied: this recording does not belong to your organization",
      data: null,
    });
    return;
  }

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Replay embed token retrieved successfully",
  });
};
