import { NextFunction, Request, Response } from "express";
import dashboardService from "../services/dashboard.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Get aggregated dashboard statistics
 * GET /admin/dashboard/stats
 */
export const getDashboardStats = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const stats = await dashboardService.getStats();

  sendSuccessResponse({
    res,
    data: stats,
    statusCode: HttpSuccessStatus.OK,
    message: "Dashboard statistics retrieved successfully",
  });
};
