import { Request, Response } from "express";
import sidebarService from "../services/sidebar.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * GET /api/v1/sidebar
 * Returns public sidebar navigation items for the current tenant.
 * Reads from the same data the admin navigation settings page writes to.
 */
export const getSidebarConfig = async (req: Request, res: Response<IResponseFormat>): Promise<void> => {
  const tenant = req.tenant;

  if (!tenant) {
    res.status(404).json({
      success: false,
      statusCode: 404,
      message: "Tenant not found for this hostname",
    });
    return;
  }

  const result = await sidebarService.getSidebarConfig(tenant.id);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Sidebar config retrieved successfully",
  });
};
