import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { ForbiddenError } from "../errors/forbidden.error";
import certificateAssignmentsService from "../services/certificate-assignments.service";
import { publishTenantConfigInvalidation } from "../services/cache-bus.publisher";

function tenantId(req: Request): string {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  return req.tenantId;
}

export const listCertificateAssignments = async (req: Request, res: Response<IResponseFormat>) => {
  const data = await certificateAssignmentsService.list(tenantId(req));
  sendSuccessResponse({ res, data: { assignments: data }, statusCode: HttpSuccessStatus.OK, message: "Certificate assignments retrieved" });
};

export const setCertificateAssignment = async (req: Request, res: Response<IResponseFormat>) => {
  const id = tenantId(req);
  const offeringType = String(req.params.offeringType ?? "");
  const { presetTemplate, certificateTemplateId, certificateLogo } = req.body ?? {};

  const data = await certificateAssignmentsService.set(id, offeringType, {
    presetTemplate: presetTemplate ?? null,
    certificateTemplateId: certificateTemplateId ?? null,
    certificateLogo: certificateLogo ?? null,
  });

  // Bust the learner-api's tenant cache so issuance picks up the new design
  // within seconds. Fire-and-forget (matches the settings controller).
  publishTenantConfigInvalidation(id).catch(() => {});

  sendSuccessResponse({ res, data: { assignments: data }, statusCode: HttpSuccessStatus.OK, message: "Certificate assignment saved" });
};

export const clearCertificateAssignment = async (req: Request, res: Response<IResponseFormat>) => {
  const id = tenantId(req);
  const offeringType = String(req.params.offeringType ?? "");

  const data = await certificateAssignmentsService.clear(id, offeringType);
  publishTenantConfigInvalidation(id).catch(() => {});

  sendSuccessResponse({ res, data: { assignments: data }, statusCode: HttpSuccessStatus.OK, message: "Certificate assignment cleared" });
};
