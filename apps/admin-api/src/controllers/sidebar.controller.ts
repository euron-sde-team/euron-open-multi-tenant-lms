import { Request, Response } from "express";
import sidebarService from "../services/sidebar.service";
import { IResponseFormat } from "../types/response.type";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

export const getSidebarConfig = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await sidebarService.getSidebarConfig(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Sidebar config retrieved successfully",
  });
};

export const updateNavItem = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const itemId = req.params.id as string;
  const result = await sidebarService.updateNavItem(tenantId, itemId, req.body);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Nav item updated" });
};

export const addCustomLink = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await sidebarService.addCustomLink(tenantId, req.body);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.CREATED, message: "Custom link added" });
};

export const deleteCustomLink = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const itemId = req.params.id as string;
  await sidebarService.deleteCustomLink(tenantId, itemId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Custom link deleted" });
};

export const reorderItems = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  await sidebarService.reorderItems(tenantId, req.body.orderedIds);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Items reordered" });
};
