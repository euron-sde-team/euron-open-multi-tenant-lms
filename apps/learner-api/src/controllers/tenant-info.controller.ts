import { NextFunction, Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import tenantOrgRepository from "../repositories/tenant-org.repository";
import config from "../config";

export const getTenantInfo = async (req: Request, res: Response<IResponseFormat>, _next: NextFunction) => {
  const tenant = req.tenant;
  if (!tenant) throw new BadRequestError("Tenant context required");

  const orgDetails = await tenantOrgRepository.findByTenantId(tenant.id);
  const logoUrl = orgDetails?.logo_light_key
    ? orgDetails.logo_light_key.startsWith("http")
      ? orgDetails.logo_light_key
      : `${config.TENANT_DETAILS_BASE_URL}/${orgDetails.logo_light_key}`
    : undefined;

  sendSuccessResponse({
    res,
    data: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoUrl,
      // Store links from admin Organisation → Mobile Apps; the website footer
      // shows "Download App" badges for whichever are set.
      androidAppUrl: orgDetails?.android_app_url || null,
      iosAppUrl: orgDetails?.ios_app_url || null,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant info retrieved",
  });
};
