import { Request, Response } from "express";
import { ForbiddenError } from "../errors/forbidden.error";
import routesService from "../services/routes.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Get available routes for the current tenant
 * GET /routes/available
 * Requires authentication and tenant context (X-Tenant-Id or default from membership)
 */
export const getAvailableRoutes = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }

  const result = await routesService.getAvailableRoutes(tenantId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Available routes retrieved successfully",
  });
};
