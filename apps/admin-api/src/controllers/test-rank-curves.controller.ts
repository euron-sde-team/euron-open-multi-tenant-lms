import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import testRankCurvesService, {
  parseRankCurveCsv,
} from "../services/test-rank-curves.service";
import type { IResponseFormat } from "../types/response.type";

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

export const listRankCurves = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const data = await testRankCurvesService.list(tenantId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Rank curves retrieved",
  });
};

export const getRankCurve = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const data = await testRankCurvesService.getById(tenantId, id);
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK });
};

export const createRankCurve = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { exam_name, year, total_candidates, curve, csv } = req.body ?? {};

  let parsedCurve = curve;
  if ((!parsedCurve || !Array.isArray(parsedCurve)) && typeof csv === "string") {
    parsedCurve = parseRankCurveCsv(csv);
  }
  if (!Array.isArray(parsedCurve)) {
    throw new BadRequestError("Provide either `curve` (JSON array) or `csv` (string)");
  }

  const data = await testRankCurvesService.create(tenantId, {
    exam_name,
    year: Number(year),
    total_candidates: Number(total_candidates),
    curve: parsedCurve,
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Rank curve created",
  });
};

export const updateRankCurve = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const { exam_name, year, total_candidates, curve, csv } = req.body ?? {};

  let parsedCurve = curve;
  if (parsedCurve === undefined && typeof csv === "string") {
    parsedCurve = parseRankCurveCsv(csv);
  }

  const data = await testRankCurvesService.update(tenantId, id, {
    exam_name,
    year: year !== undefined ? Number(year) : undefined,
    total_candidates:
      total_candidates !== undefined ? Number(total_candidates) : undefined,
    curve: parsedCurve,
  });
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK });
};

export const deleteRankCurve = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  await testRankCurvesService.delete(tenantId, id);
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
  });
};
