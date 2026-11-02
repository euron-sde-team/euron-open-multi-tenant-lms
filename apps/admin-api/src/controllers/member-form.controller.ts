import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import memberFormService from "../services/member-form.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

const requireTenantId = (req: Request): string => {
  if (!req.tenantId) throw new BadRequestError("Tenant context required");
  return req.tenantId;
};

export const listMemberForms = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const forms = await memberFormService.listForms(tenantId);
  sendSuccessResponse({
    res,
    data: forms,
    statusCode: HttpSuccessStatus.OK,
    message: "User data forms retrieved",
  });
};

export const getMemberForm = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const form = await memberFormService.getForm(
    tenantId,
    req.params.formId as string
  );
  sendSuccessResponse({
    res,
    data: form,
    statusCode: HttpSuccessStatus.OK,
    message: "User data form retrieved",
  });
};

export const createMemberForm = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const form = await memberFormService.createForm(
    tenantId,
    (req.body ?? {}) as never
  );
  sendSuccessResponse({
    res,
    data: form,
    statusCode: HttpSuccessStatus.CREATED,
    message: "User data form created",
  });
};

export const updateMemberForm = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const form = await memberFormService.updateForm(
    tenantId,
    req.params.formId as string,
    (req.body ?? {}) as never
  );
  sendSuccessResponse({
    res,
    data: form,
    statusCode: HttpSuccessStatus.OK,
    message: "User data form saved",
  });
};

export const deleteMemberForm = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  await memberFormService.deleteForm(tenantId, req.params.formId as string);
  sendSuccessResponse({
    res,
    data: { id: req.params.formId },
    statusCode: HttpSuccessStatus.OK,
    message: "User data form deleted",
  });
};

export const reorderMemberForms = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const { orderedIds } = (req.body ?? {}) as { orderedIds?: unknown };
  await memberFormService.reorderForms(tenantId, orderedIds);
  sendSuccessResponse({
    res,
    data: { success: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Forms reordered",
  });
};

export const listMemberFormResponses = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(req.query.limit as string, 10) || 25)
  );

  const result = await memberFormService.listResponses(
    tenantId,
    req.params.formId as string,
    page,
    limit
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "User data form responses retrieved",
  });
};

export const getMemberFormResponse = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const result = await memberFormService.getMemberResponse(
    tenantId,
    req.params.formId as string,
    req.params.memberId as string
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "User data form response retrieved",
  });
};

export const listMemberResponsesForMember = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = requireTenantId(req);
  const result = await memberFormService.listMemberResponses(
    tenantId,
    req.params.memberId as string
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Member form responses retrieved",
  });
};
