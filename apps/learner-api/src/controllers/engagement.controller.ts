import type { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import engagementService from "../services/engagement.service";

function requireCtx(req: Request): { tenantId: string; memberId: string } {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and member required");
  return { tenantId, memberId };
}

function limitOf(req: Request): number {
  const l = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  return Number.isFinite(l) && l > 0 ? Math.min(l, 100) : 50;
}

export async function getTestLeaderboard(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const testId = req.params.testId as string;
  if (!testId) throw new BadRequestError("testId is required");
  const data = await engagementService.getTestLeaderboard(
    tenantId,
    testId,
    memberId,
    limitOf(req)
  );
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Leaderboard" });
}

export async function getStreak(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const data = await engagementService.getStreak(tenantId, memberId);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Streak" });
}
