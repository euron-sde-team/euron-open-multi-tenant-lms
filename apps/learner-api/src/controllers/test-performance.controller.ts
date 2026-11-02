import type { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import testPerformanceService from "../services/test-performance.service";

function requireCtx(req: Request): { tenantId: string; memberId: string } {
  const tenantId = req.tenant?.id;
  const memberId = req.user?.id;
  if (!tenantId || !memberId) throw new BadRequestError("Tenant and member required");
  return { tenantId, memberId };
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const { tenantId, memberId } = requireCtx(req);
  const data = await testPerformanceService.getDashboard(tenantId, memberId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Performance dashboard",
  });
}

export async function calculateScore(req: Request, res: Response): Promise<void> {
  requireCtx(req);
  const data = testPerformanceService.calculateScore(req.body ?? {});
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Estimated score",
  });
}
