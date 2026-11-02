/**
 * Watch session controller, heartbeat + end endpoints.
 * Both routes require authenticated end user + active tenant.
 *
 * /watch/end accepts both application/json (fetch) and text/plain
 * (navigator.sendBeacon, which uses text/plain by default). The body
 * shape is identical; we only differ in how we parse it.
 */

import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import watchSessionService, { type HeartbeatPayload } from "../services/watch-session.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

function getMemberId(req: Request): string {
  const user = req.user as { id: string } | undefined;
  if (!user?.id) throw new UnauthorizedError("Authentication required");
  return user.id;
}

function parseBody(req: Request): Record<string, unknown> {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === "string" && req.body.trim().length > 0) {
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestError("Invalid request body");
    }
  }
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    try {
      const parsed = JSON.parse(req.body.toString("utf8"));
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestError("Invalid request body");
    }
  }
  return {};
}

function readString(b: Record<string, unknown>, key: string): string {
  const v = b[key];
  if (typeof v !== "string") return "";
  return v.trim();
}

function readNumber(b: Record<string, unknown>, key: string): number {
  const v = b[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function readBoolean(b: Record<string, unknown>, key: string): boolean {
  return b[key] === true || b[key] === "true";
}

function readOptionalString(b: Record<string, unknown>, key: string): string | null {
  const v = b[key];
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

/**
 * POST /courses/:courseId/lectures/:lectureId/watch/heartbeat
 * Body: { sessionId, currentPosition, deltaSeconds, isSessionStart?, isProgressFlush?, deviceType?, userAgent? }
 */
export async function heartbeat(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = param(req, "courseId");
  const lectureId = param(req, "lectureId");
  if (!courseId || !lectureId) throw new BadRequestError("courseId and lectureId are required");

  const body = parseBody(req);
  const payload: HeartbeatPayload = {
    sessionId: readString(body, "sessionId"),
    currentPosition: readNumber(body, "currentPosition"),
    deltaSeconds: readNumber(body, "deltaSeconds"),
    isSessionStart: readBoolean(body, "isSessionStart"),
    isProgressFlush: readBoolean(body, "isProgressFlush"),
    deviceType: readOptionalString(body, "deviceType"),
    userAgent: readOptionalString(body, "userAgent"),
    // Player-reported duration, fallback when lectures.duration is missing.
    durationSeconds:
      body.durationSeconds === undefined ? undefined : readNumber(body, "durationSeconds"),
  };

  const result = await watchSessionService.recordHeartbeat(
    tenantId,
    memberId,
    courseId,
    lectureId,
    payload
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Heartbeat recorded",
  });
}

/**
 * POST /courses/:courseId/lectures/:lectureId/watch/end
 * Body: { sessionId, currentPosition? }
 *
 * Used by both fetch (Content-Type: application/json) and
 * navigator.sendBeacon (Content-Type: text/plain). Both shapes are parsed.
 */
export async function endSession(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = param(req, "courseId");
  const lectureId = param(req, "lectureId");
  if (!courseId || !lectureId) throw new BadRequestError("courseId and lectureId are required");

  const body = parseBody(req);
  const sessionId = readString(body, "sessionId");
  if (!sessionId) throw new BadRequestError("sessionId is required");
  const currentPositionRaw = body.currentPosition;
  const currentPosition = currentPositionRaw === undefined ? undefined : readNumber(body, "currentPosition");
  const pendingDeltaRaw = body.pendingDeltaSeconds;
  const pendingDeltaSeconds = pendingDeltaRaw === undefined ? undefined : readNumber(body, "pendingDeltaSeconds");
  const durationRaw = body.durationSeconds;
  const durationSeconds = durationRaw === undefined ? undefined : readNumber(body, "durationSeconds");

  const result = await watchSessionService.endWatchSession(
    tenantId,
    memberId,
    courseId,
    lectureId,
    sessionId,
    currentPosition,
    pendingDeltaSeconds,
    durationSeconds
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Session ended",
  });
}
