import { Response } from "express";
import { IResponseFormat } from "../types/response.type";
import logger from "./logger";


/**
 * HTTP Success Status Codes Enum
 * Represents all 2xx success status codes
 */
export enum HttpSuccessStatus {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
}

/**
 * Sends a standardized success response
 *
 * @param res - Express Response object
 * @param data - Data to wrap in the response (will be wrapped in 'data' property)
 * @param statusCode - HTTP success status code from HttpSuccessStatus enum
 * @param message - Optional success message (defaults to status code message)
 * @returns void
 *
 * @example
 * ```typescript
 * const user = await userService.createUser(userData);
 * sendSuccessResponse(res, user, HttpSuccessStatus.CREATED, "User created successfully");
 * ```
 */
export const sendSuccessResponse = <T>(
  { res, data, statusCode = HttpSuccessStatus.OK, message }: {
    res: Response<IResponseFormat>;
    data: T;
    statusCode: number;
    message?: string;
  }
): void => {
  // Check if headers have already been sent (connection might be closed)
  if (res.headersSent) {
    logger.warn("Attempted to send response after headers were already sent");
    return;
  }

  // Check if the response is still writable (client hasn't disconnected)
  if (!res.writable) {
    logger.warn("Attempted to send response to a closed connection");
    return;
  }

  // Default messages based on status code
  const defaultMessages: Record<HttpSuccessStatus, string> = {
    [HttpSuccessStatus.OK]: "Request successful",
    [HttpSuccessStatus.CREATED]: "Resource created successfully",
    [HttpSuccessStatus.ACCEPTED]: "Request accepted",
    [HttpSuccessStatus.NO_CONTENT]: "Request processed successfully",
  };

  const response: IResponseFormat = {
    data,
    statusCode,
    message: message || defaultMessages[statusCode as HttpSuccessStatus],
    success: true,
  };

  res.status(statusCode).json(response);
};

