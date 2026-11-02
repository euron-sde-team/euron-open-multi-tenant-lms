import { Request, Response } from "express";

import assetLibraryService from "../services/asset-library.service";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { IResponseFormat } from "../types/response.type";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function intParam(value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

/**
 * GET /tenant/asset-library/courses
 * Query: search, status (DRAFT|PUBLISHED), limit, offset
 */
export const listCourses = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const status =
    req.query.status === "DRAFT" || req.query.status === "PUBLISHED"
      ? req.query.status
      : undefined;
  const limit = intParam(req.query.limit, 50, 100);
  const offset = intParam(req.query.offset, 0, 10_000);
  const result = await assetLibraryService.listCourses(tenantId, {
    search,
    status,
    limit,
    offset,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Asset library courses fetched",
  });
};

/**
 * GET /tenant/asset-library/courses/:courseId/tree
 */
export const getCourseTree = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { courseId } = req.params;
  if (!courseId || typeof courseId !== "string") {
    throw new BadRequestError("courseId is required");
  }
  const tree = await assetLibraryService.getCourseTree(tenantId, courseId);
  sendSuccessResponse({
    res,
    data: tree,
    statusCode: HttpSuccessStatus.OK,
    message: "Asset library course tree fetched",
  });
};

/**
 * GET /tenant/asset-library/search?q=...
 */
export const searchAssets = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limit = intParam(req.query.limit, 30, 100);
  const hits = await assetLibraryService.searchAssets(tenantId, q, limit);
  sendSuccessResponse({
    res,
    data: { items: hits },
    statusCode: HttpSuccessStatus.OK,
    message: "Asset library search results fetched",
  });
};

/**
 * GET /tenant/asset-library/unmapped
 * Query: withPosters=true|false
 */
export const listUnmappedUploads = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const withPosters = req.query.withPosters === "true";
  const limit = intParam(req.query.limit, 200, 500);
  const result = await assetLibraryService.listUnmappedUploads(tenantId, {
    withPosters,
    limit,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Unmapped uploads fetched",
  });
};

/**
 * GET /tenant/asset-library/videos/:videoId/usage
 * Preview-pane data: where is this video used + size + reuseCount.
 */
export const getVideoUsage = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { videoId } = req.params;
  if (!videoId || typeof videoId !== "string") {
    throw new BadRequestError("videoId is required");
  }
  const data = await assetLibraryService.getVideoUsage(tenantId, videoId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Video usage fetched",
  });
};

/**
 * POST /tenant/asset-library/attach
 * Body: { videoId, lectureId, copyTranscript?: boolean }
 * Binds an existing tenant video to a target lecture. Does not consume storage.
 */
export const attachVideoToLecture = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { videoId, lectureId, copyTranscript } = req.body as {
    videoId?: string;
    lectureId?: string;
    copyTranscript?: boolean;
  };
  if (!videoId || typeof videoId !== "string") {
    throw new BadRequestError("videoId is required");
  }
  if (!lectureId || typeof lectureId !== "string") {
    throw new BadRequestError("lectureId is required");
  }
  const result = await assetLibraryService.attachExistingVideoToLecture(
    tenantId,
    videoId.trim(),
    lectureId.trim(),
    { copyTranscript: copyTranscript !== false }
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Video attached to lecture",
  });
};
