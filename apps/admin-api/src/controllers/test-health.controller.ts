import { Request, Response } from "express";
import testHealthService from "../services/test-health.service";
import { IResponseFormat } from "../types/response.type";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export const getAdaptiveHealth = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testHealthService.getAdaptiveHealth(tenantId, testId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Adaptive health retrieved",
  });
};

export const getQuestionHealth = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const data = await testHealthService.getQuestionHealth(tenantId, bankId, {
    page,
    limit,
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Question health retrieved",
  });
};
