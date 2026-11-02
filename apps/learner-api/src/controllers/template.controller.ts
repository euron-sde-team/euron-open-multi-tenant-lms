import { Request, Response } from "express";
import templateService from "../services/template.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * GET /api/v1/template
 * Returns published page config for the current tenant (from hostname).
 * Requires req.tenant from tenant resolver middleware.
 */
export const getTemplate = async (req: Request, res: Response<IResponseFormat>): Promise<void> => {
  const tenant = req.tenant;

  if (!tenant) {
    res.status(404).json({
      success: false,
      statusCode: 404,
      message: "Tenant not found for this hostname",
    });
    return;
  }

  const slug = (req.query.slug as string) || "home";
  const pageConfig = await templateService.getTemplateForTenant(tenant.id, slug, tenant.name);

  sendSuccessResponse({
    res,
    data: pageConfig,
    statusCode: HttpSuccessStatus.OK,
    message: "Page retrieved successfully",
  });
};
