/**
 * Course Preview Controller
 *
 * Public, unauthenticated. Tenant comes from the hostname like the rest of the
 * user-facing surface; the preview itself is authorised inside the service
 * against the course page that publishes it.
 */

import { NextFunction, Request, Response } from "express";
import { createHash } from "crypto";

import { NotFoundError } from "../errors/not-found.error";
import coursePreviewService from "../services/course-preview.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * A stable-ish id for an anonymous viewer, used only to bind the playback
 * session. Derived from the request rather than stored, and hashed so no raw IP
 * reaches the token or the logs.
 */
function viewerId(req: Request): string {
  const member = (req as Request & { member?: { id?: string } }).member;
  if (member?.id) return member.id;
  const seed = `${req.ip ?? ""}|${req.get("user-agent") ?? ""}`;
  return `anon-${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

/** GET /course-previews/:courseSlug, which rows on this course have a sample. */
export const listCoursePreviews = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenant } = req;
  if (!tenant) throw new NotFoundError("Tenant not found");

  const data = await coursePreviewService.listForCourse(
    tenant.id,
    param(req, "courseSlug")
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Course previews retrieved successfully",
  });
};

/** POST /course-previews/:courseSlug/playback, mint playback for one sample. */
export const getCoursePreviewPlayback = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenant } = req;
  if (!tenant) throw new NotFoundError("Tenant not found");

  const videoKey = String((req.body as { videoKey?: unknown })?.videoKey ?? "");
  const result = await coursePreviewService.getPlayback(
    tenant.id,
    param(req, "courseSlug"),
    videoKey,
    viewerId(req)
  );

  // Same union the lecture playback endpoint returns, plus the title.
  const data = result;

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Preview playback retrieved successfully",
  });
};
