import { Request, Response } from "express";
import tenantDomainService from "../services/tenant-domain.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { BadRequestError } from "../errors/bad-request.error";

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * GET /tenant/domains
 */
export const listDomains = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const domains = await tenantDomainService.getDomainsForTenant(tenantId);

  sendSuccessResponse({
    res,
    data: domains,
    statusCode: HttpSuccessStatus.OK,
    message: "Domains retrieved successfully",
  });
};

/**
 * GET /tenant/domains/:id
 */
export const getDomain = async (req: Request, res: Response<IResponseFormat>) => {
  const id = param(req, "id");
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const domain = await tenantDomainService.getDomainById(id, tenantId);

  sendSuccessResponse({
    res,
    data: {
      id: domain.id,
      domainType: domain.domain_type,
      domainName: domain.domain_name,
      subdomainPrefix: domain.subdomain_prefix,
      fullUrl: `https://${domain.domain_name}`,
      status: domain.status,
      sslStatus: domain.ssl_status,
      ownershipVerified: domain.ownership_verified,
      sslActive: domain.ssl_active,
      isPrimary: domain.is_primary,
      errorMessage: domain.error_message,
      createdAt: domain.created_at,
      verifiedAt: domain.verified_at,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Domain retrieved successfully",
  });
};

/**
 * GET /tenant/domains/:id/status
 */
export const getDomainStatus = async (req: Request, res: Response<IResponseFormat>) => {
  const id = param(req, "id");
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const status = await tenantDomainService.verifyCustomDomain(id, tenantId);

  sendSuccessResponse({
    res,
    data: status,
    statusCode: HttpSuccessStatus.OK,
    message: "Domain status retrieved successfully",
  });
};

/**
 * POST /tenant/domains/custom
 */
export const addCustomDomain = async (req: Request, res: Response<IResponseFormat>) => {
  const { domain } = req.body;
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  if (!domain) throw new BadRequestError("Domain is required");

  const result = await tenantDomainService.addCustomDomain(tenantId, domain);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Custom domain added successfully. Please configure the DNS records shown below.",
  });
};

/**
 * DELETE /tenant/domains/:id
 */
export const removeDomain = async (req: Request, res: Response<IResponseFormat>) => {
  const id = param(req, "id");
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  await tenantDomainService.removeDomain(id, tenantId);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Domain removed successfully",
  });
};

/**
 * POST /tenant/domains/:id/set-primary
 */
export const setPrimaryDomain = async (req: Request, res: Response<IResponseFormat>) => {
  const id = param(req, "id");
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const domain = await tenantDomainService.setDomainAsPrimary(id, tenantId);

  sendSuccessResponse({
    res,
    data: {
      id: domain.id,
      domainName: domain.domain_name,
      isPrimary: domain.is_primary,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Domain set as primary successfully",
  });
};

/**
 * POST /tenant/domains/subdomain
 */
export const deploySubdomain = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const result = await tenantDomainService.deploySubdomainForTenant(tenantId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: result.alreadyExists
      ? "Subdomain already deployed"
      : "Subdomain deployed successfully",
  });
};

/**
 * POST /tenant/domains/:id/verify
 */
export const verifyDomain = async (req: Request, res: Response<IResponseFormat>) => {
  const id = param(req, "id");
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const status = await tenantDomainService.verifyCustomDomain(id, tenantId);

  sendSuccessResponse({
    res,
    data: status,
    statusCode: HttpSuccessStatus.OK,
    message: "Domain verification check completed",
  });
};

/**
 * POST /tenant/domains/:id/retry
 */
export const retryDomain = async (req: Request, res: Response<IResponseFormat>) => {
  const id = param(req, "id");
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context required");

  const status = await tenantDomainService.retryCustomDomain(id, tenantId);

  sendSuccessResponse({
    res,
    data: status,
    statusCode: HttpSuccessStatus.OK,
    message: "Domain verification retry initiated",
  });
};
