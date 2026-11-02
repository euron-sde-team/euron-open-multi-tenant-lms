import { NextFunction, Request, Response } from "express";
import activityFeedService from "../services/activity-feed.service";
import { ActivityFeedQueryParams, ActivityKind } from "../types/activity-feed.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Get global activity feed
 * GET /admin/activity-feed
 */
export const getActivityFeed = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: ActivityFeedQueryParams = {
    kind: req.query.kind as ActivityKind | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 30,
  };

  const result = await activityFeedService.getActivityFeed(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Activity feed retrieved successfully",
  });
};
