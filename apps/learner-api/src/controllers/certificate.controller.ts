import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import certificateService from "../services/certificate.service";
import certificateLogoProxyService from "../services/certificate-logo-proxy.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

function getMemberId(req: Request): string {
  const user = req.user as { id: string } | undefined;
  if (!user?.id) throw new UnauthorizedError("Authentication required");
  return user.id;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** POST /courses/:courseId/certificate */
export async function generateCertificate(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");

  const result = await certificateService.generateCertificate(tenantId, courseId, memberId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Certificate generated",
  });
}

/** GET /courses/:courseId/certificate/status */
export async function getCertificateStatus(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");

  const result = await certificateService.getCertificateStatus(tenantId, courseId, memberId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate status retrieved",
  });
}

/** GET /certificates/verify/:certificateNumber: PUBLIC (no auth) */
export async function verifyCertificate(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const certNumber = param(req, "certificateNumber");
  if (!certNumber) throw new NotFoundError("Certificate number is required");

  const result = await certificateService.verifyCertificate(tenantId, certNumber);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Certificate verified",
  });
}

/**
 * GET /certificates/logo-proxy?url=<encoded>: PUBLIC (no auth, no tenant required)
 *
 * Proxies a certificate logo image so the frontend PDF exporter can read its
 * pixel data regardless of the source bucket's CORS configuration. Streams the
 * image bytes back with an echoed CORS `Access-Control-Allow-Origin` header
 * and a 1-hour cache-control for CDN friendliness.
 *
 * Only hosts in the service allowlist are proxied (SSRF protection).
 */
export async function proxyCertificateLogo(req: Request, res: Response): Promise<void> {
  const rawUrl = req.query.url;
  const url = typeof rawUrl === "string" ? rawUrl : "";
  if (!url) throw new BadRequestError("url query parameter is required");

  const { contentType, buffer } = await certificateLogoProxyService.fetchLogo(url);

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", buffer.byteLength.toString());
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).send(buffer);
}
