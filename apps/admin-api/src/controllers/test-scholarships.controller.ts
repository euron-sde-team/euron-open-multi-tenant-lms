import { Request, Response } from "express";

import { ForbiddenError } from "../errors/forbidden.error";
import testScholarshipsService from "../services/test-scholarships.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function getActorId(req: Request): string | undefined {
  return (req as Request & { tenantUser?: { id?: string } }).tenantUser?.id;
}

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export const listScholarships = async (req: Request, res: Response<IResponseFormat>) => {
  const data = await testScholarshipsService.list(getTenantId(req));
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "OK" });
};

export const createScholarship = async (req: Request, res: Response<IResponseFormat>) => {
  const data = await testScholarshipsService.create(
    getTenantId(req),
    req.body,
    getActorId(req)
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Scholarship created",
  });
};

export const updateScholarship = async (req: Request, res: Response<IResponseFormat>) => {
  const data = await testScholarshipsService.update(
    getTenantId(req),
    param(req, "scholarshipId"),
    req.body
  );
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Updated" });
};

export const deleteScholarship = async (req: Request, res: Response<IResponseFormat>) => {
  await testScholarshipsService.delete(getTenantId(req), param(req, "scholarshipId"));
  sendSuccessResponse({
    res,
    data: { deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Deleted",
  });
};

export const listScholarshipAwards = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const data = await testScholarshipsService.listAwards(
    getTenantId(req),
    req.query.scholarship_id as string | undefined,
    req.query.status as string | undefined
  );
  sendSuccessResponse({
    res,
    data: { awards: data },
    statusCode: HttpSuccessStatus.OK,
    message: "OK",
  });
};

export const decideScholarshipAward = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const data = await testScholarshipsService.decideAward(
    getTenantId(req),
    param(req, "awardId"),
    String(req.body?.status ?? ""),
    getActorId(req)
  );
  sendSuccessResponse({ res, data, statusCode: HttpSuccessStatus.OK, message: "Updated" });
};
