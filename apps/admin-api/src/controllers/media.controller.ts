import { Request, Response } from "express";

import { ForbiddenError } from "../errors/forbidden.error";
import {
  createPreviewPlayback,
  evsConfigured,
  getEvsVideo,
  listEvsVideos,
  normalizeVideoSource,
  VIDEO_PROVIDERS,
} from "../services/video-source.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Lecture video sources (/tenant/media). Nothing is uploaded here: admins
 * paste an EVS video id or an HLS / MP4 / YouTube URL and choose the provider.
 * These endpoints validate that input, look EVS videos up, and mint admin
 * preview playback.
 */

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

/**
 * GET /tenant/media/providers
 * The providers a lecture can use and whether EVS lookups are available.
 */
export const getProviders = async (_req: Request, res: Response) => {
  sendSuccessResponse({
    res,
    data: { providers: VIDEO_PROVIDERS, evsConfigured: evsConfigured() },
    statusCode: HttpSuccessStatus.OK,
    message: "Video providers",
  });
};

/**
 * POST /tenant/media/resolve
 * Body: { provider, videoKey }
 * Returns the stored form of the source, plus EVS metadata when available.
 */
export const resolveVideoSource = async (req: Request, res: Response) => {
  getTenantId(req);
  const source = normalizeVideoSource(req.body?.provider, req.body?.videoKey);
  const evs = source.provider === "EVS" ? await getEvsVideo(source.videoKey) : null;
  sendSuccessResponse({
    res,
    data: {
      ...source,
      title: evs?.title ?? null,
      status: evs?.status ?? (source.provider === "EVS" ? "unknown" : "ready"),
      durationSeconds: evs?.durationSeconds ?? null,
      posterUrl: evs?.posterUrl ?? null,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Video source resolved",
  });
};

/**
 * GET /tenant/media/evs/videos?q=&page=&limit=
 * EVS video picker. Empty list with configured=false when EVS is not set up.
 */
export const listVideos = async (req: Request, res: Response) => {
  getTenantId(req);
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20);
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const result = await listEvsVideos({ q, page, limit });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Videos",
  });
};

/**
 * POST /tenant/media/preview
 * Body: { provider, videoKey }
 * Admin editor preview: { provider: "EVS", manifestUrl, token, expiresAt } or
 * { provider, url } for external sources.
 */
export const previewPlayback = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const source = normalizeVideoSource(req.body?.provider, req.body?.videoKey);
  const result = await createPreviewPlayback(tenantId, req.tenantUser.id, source);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Preview playback",
  });
};
