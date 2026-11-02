import type { NextFunction, Request, Response } from "express";
import memberAnalyticsService from "../services/member-analytics.service";
import { sendSuccessResponse } from "../utils/response.util";

export const getAnalytics = async (
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const tenantId = req.tenant!.id;
  const memberId = req.user!.id;
  const data = await memberAnalyticsService.getAnalytics(tenantId, memberId);
  sendSuccessResponse({ res, data, statusCode: 200, message: "Analytics retrieved" });
};
