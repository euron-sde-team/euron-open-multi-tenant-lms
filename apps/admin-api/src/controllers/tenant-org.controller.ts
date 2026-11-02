import { Request, Response } from "express";
import { ForbiddenError } from "../errors/forbidden.error";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { IResponseFormat } from "../types/response.type";
import tenantOrgService from "../services/tenant-org.service";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

export const getOrgDetails = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantOrgService.getOrgDetails(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Organisation details retrieved successfully",
  });
};

export const getEmailStyle = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantOrgService.getEmailStyle(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Email style retrieved",
  });
};

export const setEmailStyle = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantOrgService.setEmailStyle(tenantId, req.body?.email_style);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Email style updated",
  });
};

export const updateOrgDetails = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantOrgService.updateOrgDetails(tenantId, req.body);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Organisation details updated successfully",
  });
};

export const uploadLogo = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  if (!req.file) throw new BadRequestError("No file uploaded");
  const slot = req.params.slot as "light" | "dark";
  if (slot !== "light" && slot !== "dark") {
    throw new BadRequestError("Slot must be 'light' or 'dark'");
  }
  const result = await tenantOrgService.uploadLogo(tenantId, slot, req.file);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Logo uploaded successfully",
  });
};

export const uploadFavicon = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  if (!req.file) throw new BadRequestError("No file uploaded");
  const result = await tenantOrgService.uploadFavicon(tenantId, req.file);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Favicon uploaded successfully",
  });
};

export const uploadFounderPhoto = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  if (!req.file) throw new BadRequestError("No file uploaded");
  const result = await tenantOrgService.uploadFounderPhoto(tenantId, req.file);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Founder photo uploaded successfully",
  });
};

export const deleteLogo = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const slot = req.params.slot as "light" | "dark";
  if (slot !== "light" && slot !== "dark") {
    throw new BadRequestError("Slot must be 'light' or 'dark'");
  }
  const result = await tenantOrgService.deleteLogo(tenantId, slot);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Logo deleted successfully",
  });
};

export const deleteFavicon = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantOrgService.deleteFavicon(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Favicon deleted successfully",
  });
};

export const deleteFounderPhoto = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantOrgService.deleteFounderPhoto(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Founder photo deleted successfully",
  });
};

export const getBillingDetails = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const orgDetails = await tenantOrgService.getOrgDetails(tenantId);
  const billing = {
    legalEntityName: orgDetails.legalEntityName,
    registrationNumber: orgDetails.registrationNumber,
    gstin: orgDetails.gstin,
    panNumber: orgDetails.panNumber,
    billingAddress: orgDetails.billingAddress,
    billingEmail: orgDetails.billingEmail,
    billingPhone: orgDetails.billingPhone,
    hsnSacCode: orgDetails.hsnSacCode,
    taxId: orgDetails.taxId,
    taxMode: orgDetails.taxMode,
    taxPercentage: orgDetails.taxPercentage,
  };
  sendSuccessResponse({
    res,
    data: billing,
    statusCode: HttpSuccessStatus.OK,
    message: "Billing details retrieved successfully",
  });
};

export const updateBillingDetails = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantOrgService.updateOrgDetails(tenantId, {
    legal_entity_name: req.body.legal_entity_name,
    registration_number: req.body.registration_number,
    gstin: req.body.gstin,
    pan_number: req.body.pan_number,
    billing_address: req.body.billing_address,
    billing_email: req.body.billing_email,
    billing_phone: req.body.billing_phone,
    hsn_sac_code: req.body.hsn_sac_code,
    tax_id: req.body.tax_id,
    tax_mode: req.body.tax_mode,
    tax_percentage: req.body.tax_percentage,
  });
  const billing = {
    legalEntityName: result.legalEntityName,
    registrationNumber: result.registrationNumber,
    gstin: result.gstin,
    panNumber: result.panNumber,
    billingAddress: result.billingAddress,
    billingEmail: result.billingEmail,
    billingPhone: result.billingPhone,
    hsnSacCode: result.hsnSacCode,
    taxId: result.taxId,
    taxMode: result.taxMode,
    taxPercentage: result.taxPercentage,
  };
  sendSuccessResponse({
    res,
    data: billing,
    statusCode: HttpSuccessStatus.OK,
    message: "Billing details updated successfully",
  });
};
