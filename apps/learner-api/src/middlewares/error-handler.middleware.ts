
import { NextFunction, Request } from "express";
import { customAlphabet } from "nanoid";
import config from "../config";
import { CustomError, SerializedErrorOutput } from "../errors/custom.error";
import { ResponseType } from "../types/response.type";
import logger from "../utils/logger";

const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", 18);

/**
 * Global error handler middleware
 * Handles all errors thrown in controllers and routes
 * Provides consistent error response format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const globalHandler = (err: any, req: Request, res: ResponseType, _next: NextFunction) => {
  // Handle CustomError instances (all custom application errors)
  if (err instanceof CustomError) {
    const error = err.serializeErrors() as SerializedErrorOutput;
    const errorId = nanoid();
    const message = `route: ${req.path}, errorMsg: ${error?.message || err.message}, rayId: ${errorId}`;
    logger.error(message);

    // Special handling for ConflictErrorJSON if needed
    // Note: If ConflictErrorJSON needs special data handling, it should be done in its serializeErrors method
    return res.status(err.statusCode).send({
      error,
      statusCode: err.statusCode,
      message,
      success: false
    });
  }

  // Handle generic Error instances (unexpected errors)
  if (err instanceof Error) {
    const statusCode = 500;
    const errorId = nanoid();
    const errorMessage = err.message;
    const message = `route: ${req.path}, errorMsg: ${errorMessage}, rayId: ${errorId}`;
    logger.error(message);

    return res.status(statusCode).json({
      error:
      {
        message: config.NODE_ENV !== "production" ? errorMessage : "Internal Server Error"
      }
      ,
      statusCode,
      message,
      success: false
    });
  }

  // Handle non-error data passed via next() (legacy support, but not recommended)
  // This should be removed in favor of direct response sending in controllers
  if (err && !(err instanceof Error)) {
    const data = err;
    const msg = data.msg;
    if (data["msg"]) {
      delete data["msg"];
    }
    const statusCode = data.statusCode || 200;
    if (data["statusCode"]) {
      delete data["statusCode"];
    }
    return res.status(statusCode).send({
      data,
      statusCode: statusCode,
      message: msg,
      success: true
    });
  }

  // Fallback for undefined/null errors
  const errorId = nanoid();
  return res.status(500).json({
    statusCode: 500,
    message: `route: ${req.path}, errorMsg: INTERNAL SERVER ERROR, rayId: ${errorId}`,
    success: false
  });
};
