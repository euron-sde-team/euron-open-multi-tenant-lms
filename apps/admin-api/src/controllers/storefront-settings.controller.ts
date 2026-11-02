import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { ForbiddenError } from "../errors/forbidden.error";
import { BadRequestError } from "../errors/bad-request.error";
import storefrontSettingsService from "../services/storefront-settings.service";
import { publishTenantConfigInvalidation } from "../services/cache-bus.publisher";

function tenantId(req: Request): string {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  return req.tenantId;
}

export const getStorefrontSettings = async (req: Request, res: Response<IResponseFormat>) => {
  const settings = await storefrontSettingsService.getSettings(tenantId(req));
  sendSuccessResponse({ res, data: settings, statusCode: HttpSuccessStatus.OK, message: "Storefront settings retrieved" });
};

export const updateStorefrontSettings = async (req: Request, res: Response<IResponseFormat>) => {
  const { access_managed_enabled } = req.body ?? {};

  if (typeof access_managed_enabled !== "boolean") {
    throw new BadRequestError("access_managed_enabled must be a boolean");
  }

  const id = tenantId(req);
  const settings = await storefrontSettingsService.updateSettings(
    id,
    access_managed_enabled,
    req.tenantUser.id,
  );

  // Bust the learner-api's in-memory tenant cache so the storefront change
  // (pricing/access) reaches learners within seconds, not the 60s TTL.
  void publishTenantConfigInvalidation(id);

  sendSuccessResponse({ res, data: settings, statusCode: HttpSuccessStatus.OK, message: "Storefront settings updated" });
};
