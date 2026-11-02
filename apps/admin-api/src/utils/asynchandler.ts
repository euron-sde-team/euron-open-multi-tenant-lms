import { NextFunction, Request, Response } from "express";
import logger from "./logger";
import { getLogDataFromReqObject } from "./logger/index";

/**
 * Async handler wrapper that catches errors and passes them to Express error middleware
 * This allows centralized error handling via globalHandler middleware
 */
export const asyncHandler = (
  fnc: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): Promise<void> => {
    return Promise.resolve(fnc(req, res, next)).catch((err) => {
      // Safely log request data - wrap in try-catch to avoid Express 5 compatibility issues
      try {
        const reqObjectData = getLogDataFromReqObject(req);
        logger.error(`${reqObjectData} , Message -  ${JSON.stringify(err)}, Err - ${err}`);
      } catch (logError) {
        // If logging fails, just log the error without request context
        logger.error(`Error logging request data: ${logError}, Original error: ${err}`);
      }
      // Pass error to Express error middleware (globalHandler)
      next(err);
    });
  };
};
