import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../errors/not-found.error";
import healthService from "../services/health.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

export const notFound = () => {
  throw new NotFoundError("Route not found");
};

export const helloWorld = async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const data = await healthService.getRootRouteMsg();
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK });
};

export const health = async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
  // const key = "healthCheck";
  // await redisClient.setEx(key, 100, "ok");
  // const cached = await redisClient.get(key);
  // await redisClient.del(key);
  const data = await healthService.getHealth();

  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK });
};

