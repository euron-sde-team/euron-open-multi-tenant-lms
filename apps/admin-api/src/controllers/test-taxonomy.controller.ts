import { Request, Response } from "express";
import testTaxonomyService from "../services/test-taxonomy.service";
import { IResponseFormat } from "../types/response.type";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

export const listTaxonomy = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const kind = req.query.kind as string | undefined;
  const parentId =
    req.query.parentId === undefined ? undefined : (req.query.parentId as string);
  const data = await testTaxonomyService.list(tenantId, kind, parentId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Taxonomy fetched",
  });
};

export const createTaxonomy = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const { kind, name, parentId, orderIndex } = req.body;
  const data = await testTaxonomyService.create(tenantId, {
    kind,
    name,
    parentId,
    orderIndex,
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Taxonomy item created",
  });
};

export const updateTaxonomy = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const { name, parentId, orderIndex } = req.body;
  const data = await testTaxonomyService.update(tenantId, String(req.params.nodeId), {
    name,
    parentId,
    orderIndex,
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Taxonomy item updated",
  });
};

export const deleteTaxonomy = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const data = await testTaxonomyService.remove(tenantId, String(req.params.nodeId));
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Taxonomy item deleted",
  });
};

export const importTaxonomyFromTags = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const data = await testTaxonomyService.importFromTags(tenantId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Imported taxonomy from question tags",
  });
};

export const checkBlueprintAvailability = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { questionBankId, totalCount, rules } = req.body;
  const data = await testTaxonomyService.checkAvailability(tenantId, {
    questionBankId,
    totalCount,
    rules,
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Availability checked",
  });
};
