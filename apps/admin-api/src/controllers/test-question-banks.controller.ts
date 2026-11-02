import { Request, Response } from "express";
import testQuestionBanksService from "../services/test-question-banks.service";
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

function getActorId(req: Request): string | undefined {
  return (req as Request & { tenantUser?: { id?: string } }).tenantUser?.id;
}

export const listQuestionBanks = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const search = req.query.search as string | undefined;
  const result = await testQuestionBanksService.list(tenantId, { page, limit, search });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Question banks retrieved successfully",
  });
};

export const getQuestionBank = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");
  const data = await testQuestionBanksService.getById(tenantId, bankId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Question bank retrieved successfully",
  });
};

export const createQuestionBank = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const data = await testQuestionBanksService.create(
    tenantId,
    req.body,
    getActorId(req)
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Question bank created successfully",
  });
};

export const updateQuestionBank = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");
  const data = await testQuestionBanksService.update(tenantId, bankId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Question bank updated successfully",
  });
};

export const deleteQuestionBank = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const bankId = param(req, "bankId");
  await testQuestionBanksService.delete(tenantId, bankId);
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Question bank deleted successfully",
  });
};
