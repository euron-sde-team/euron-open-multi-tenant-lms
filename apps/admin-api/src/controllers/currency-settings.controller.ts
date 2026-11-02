import { Request, Response } from "express";

import { ForbiddenError } from "../errors/forbidden.error";
import currencySettingsService from "../services/currency-settings.service";
import type { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

export const getCurrencySettings = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await currencySettingsService.getSettings(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Currency settings retrieved successfully",
  });
};

export const updateCurrencySettings = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await currencySettingsService.updateSettings(tenantId, req.body);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Currency settings updated successfully",
  });
};

export const getPricingCoverage = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await currencySettingsService.getCoverage(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Pricing coverage retrieved successfully",
  });
};

export const getFxSuggestions = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const amount = parseFloat(String(req.query.amount ?? ""));
  const result = await currencySettingsService.fxSuggest(tenantId, from, to, amount);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "FX suggestions retrieved successfully",
  });
};
