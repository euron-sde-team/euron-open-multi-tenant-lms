import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { ForbiddenError } from "../errors/forbidden.error";
import { BadRequestError } from "../errors/bad-request.error";
import certificatesSettingsService from "../services/certificates-settings.service";
import { publishTenantConfigInvalidation } from "../services/cache-bus.publisher";

function tenantId(req: Request): string {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  return req.tenantId;
}

export const getCertificatesSettings = async (req: Request, res: Response<IResponseFormat>) => {
  const settings = await certificatesSettingsService.getSettings(tenantId(req));
  sendSuccessResponse({ res, data: settings, statusCode: HttpSuccessStatus.OK, message: "Certificate settings retrieved" });
};

export const updateCertificatesSettings = async (req: Request, res: Response<IResponseFormat>) => {
  const { certificate_tab_enabled } = req.body ?? {};

  if (typeof certificate_tab_enabled !== "boolean") {
    throw new BadRequestError("certificate_tab_enabled must be a boolean");
  }

  const id = tenantId(req);
  const settings = await certificatesSettingsService.updateSettings(id, certificate_tab_enabled);

  // Bust the learner-api's in-memory tenant cache so learners see the change
  // within seconds instead of waiting out the 60s TTL. Fire-and-forget.
  void publishTenantConfigInvalidation(id);

  sendSuccessResponse({ res, data: settings, statusCode: HttpSuccessStatus.OK, message: "Certificate settings updated" });
};
