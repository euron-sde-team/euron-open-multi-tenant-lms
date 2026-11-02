import { Request, Response } from "express";
import testModulesService from "../services/test-modules.service";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
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

export const listTestModules = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testModulesService.listForTest(tenantId, testId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Modules retrieved successfully",
  });
};

export const createTestModule = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const sectionId = param(req, "sectionId");
  const data = await testModulesService.createModule(tenantId, testId, sectionId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Module created successfully",
  });
};

export const updateTestModule = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const moduleId = param(req, "moduleId");
  const data = await testModulesService.updateModule(tenantId, testId, moduleId, req.body);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Module updated successfully",
  });
};

export const deleteTestModule = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const moduleId = param(req, "moduleId");
  await testModulesService.deleteModule(tenantId, testId, moduleId);
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Module deleted successfully",
  });
};

export const addModuleQuestions = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const moduleId = param(req, "moduleId");
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError("items array is required");
  }
  const data = await testModulesService.addQuestions(tenantId, testId, moduleId, items);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Questions added to module",
  });
};

export const updateModuleQuestion = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const moduleId = param(req, "moduleId");
  const questionId = param(req, "questionId");
  await testModulesService.updateQuestion(tenantId, testId, moduleId, questionId, req.body);
  sendSuccessResponse({
    res,
    data: { updated: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Module question updated",
  });
};

export const removeModuleQuestion = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const moduleId = param(req, "moduleId");
  const questionId = param(req, "questionId");
  await testModulesService.removeQuestion(tenantId, testId, moduleId, questionId);
  sendSuccessResponse({
    res,
    data: { removed: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Question removed from module",
  });
};

export const saveScoreScales = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const sectionId = param(req, "sectionId");
  const scales = req.body?.scales;
  if (!Array.isArray(scales)) {
    throw new BadRequestError("scales array is required (empty array clears)");
  }
  const data = await testModulesService.saveScoreScales(tenantId, testId, sectionId, scales);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Score scales saved",
  });
};

export const autoGenerateScoreScales = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const sectionId = param(req, "sectionId");
  const data = await testModulesService.autoGenerateScoreScales(
    tenantId,
    testId,
    sectionId,
    req.body?.scale_max
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Score scales generated",
  });
};

export const saveNormTable = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testModulesService.saveNormTable(
    tenantId,
    testId,
    req.body?.points,
    req.body?.max_score
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Norm table saved",
  });
};

export const autoGenerateNormTable = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const testId = param(req, "testId");
  const data = await testModulesService.autoGenerateNormTable(
    tenantId,
    testId,
    req.body?.max_score
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Norm table generated",
  });
};
