/**
 * Site health, one endpoint, one job: audit the tenant's own public site and
 * report what a visitor would hit. Read-only; the fixes happen through the
 * ordinary page/nav/SEO routes with their own permissions and audit trail.
 */
import { Request, Response } from "express";

import { ForbiddenError } from "../errors/forbidden.error";
import siteHealthService from "../services/site-health.service";
import type { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

export const auditSite = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  const report = await siteHealthService.audit(tenantId);
  sendSuccessResponse({
    res,
    data: report,
    statusCode: HttpSuccessStatus.OK,
    message: "Site checked",
  });
};
