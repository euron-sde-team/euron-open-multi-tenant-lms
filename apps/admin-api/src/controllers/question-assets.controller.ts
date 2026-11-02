import { Request, Response } from "express";
import courseLmsService from "../services/course-lms.service";
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

export const listAssets = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const assets = await courseLmsService.listQuestionAssets(tenantId);
  sendSuccessResponse({
    res,
    data: { assets },
    statusCode: HttpSuccessStatus.OK,
    message: "Assets fetched",
  });
};

export const createAsset = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  if (!req.file) {
    throw new BadRequestError(
      "File is required. Upload as multipart/form-data field 'file'."
    );
  }
  const name = typeof req.body?.name === "string" ? req.body.name : undefined;
  const result = await courseLmsService.createQuestionAssetFromCsv(
    tenantId,
    {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    },
    name
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Asset saved to library",
  });
};

export const deleteAsset = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  await courseLmsService.deleteQuestionAsset(tenantId, param(req, "assetId"));
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Asset deleted",
  });
};

export const importAssetToQuiz = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const assetId = param(req, "assetId");
  const { course_id, quiz_id } = req.body ?? {};
  if (!course_id || !quiz_id) {
    throw new BadRequestError("course_id and quiz_id are required");
  }
  const result = await courseLmsService.importAssetToQuiz(
    tenantId,
    course_id,
    quiz_id,
    assetId
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: `${result.created} question(s) imported from asset`,
  });
};
