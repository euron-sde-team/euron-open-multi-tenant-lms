import { Request, Response } from "express";
import emailSendingDomainService from "../services/email-sending-domain.service";
import domainHealthService from "../services/email-engine/domain-health.service";
import emailSendingDomainRepository from "../repositories/email-sending-domain.repository";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { IResponseFormat } from "../types/response.type";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export const onboardSendingDomain = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const subdomain = req.body?.subdomain;
  if (typeof subdomain !== "string" || !subdomain.trim()) {
    throw new BadRequestError("subdomain is required");
  }
  const result = await emailSendingDomainService.onboardSendingDomain(
    tenantId,
    subdomain,
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message:
      "Sending domain onboarded. Publish the returned DNS records, then call POST /:id/check (Phase 4) or wait for the verification poller.",
  });
};

export const listSendingDomains = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const data = await emailSendingDomainService.listForTenant(tenantId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Sending domains retrieved",
  });
};

export const getSendingDomain = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const data = await emailSendingDomainService.getById(tenantId, id);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Sending domain retrieved",
  });
};

export const deleteSendingDomain = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  await emailSendingDomainService.deleteById(tenantId, id);
  sendSuccessResponse({
    res,
    data: { id, deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Sending domain deleted",
  });
};

export const checkSendingDomain = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const data = await emailSendingDomainService.runCheckById(tenantId, id);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message:
      "Verification check complete. If DNS has not propagated yet, the row will stay PENDING and the 60s background poller will retry.",
  });
};

// Phase 12: post-verification health monitoring.

export const getDomainHealth = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const data = await domainHealthService.getLatestForDomain(tenantId, id);
  if (!data) {
    sendSuccessResponse({
      res,
      data: null,
      statusCode: HttpSuccessStatus.OK,
      message:
        "No health checks recorded yet. The daily sweep runs at 03:00 UTC; trigger an on-demand check via POST /:id/check-health.",
    });
    return;
  }
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Latest domain health check retrieved",
  });
};

export const runDomainHealthCheck = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const domain = await emailSendingDomainRepository.findByTenantAndId(tenantId, id);
  if (!domain) throw new NotFoundError("Sending domain not found");
  const data = await domainHealthService.checkDomainHealth(domain);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Health check completed",
  });
};
