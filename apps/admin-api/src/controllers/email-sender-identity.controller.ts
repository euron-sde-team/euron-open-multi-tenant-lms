import { Request, Response } from "express";
import emailSenderIdentityService from "../services/email-sender-identity.service";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { IResponseFormat } from "../types/response.type";
import type {
  CreateSenderIdentityInput,
  UpdateSenderIdentityInput,
} from "../types/email-sender-identity.type";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function asOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new BadRequestError("expected a string");
  }
  return value;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new BadRequestError("expected a boolean");
  }
  return value;
}

export const createSenderIdentity = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const body = req.body ?? {};
  if (typeof body.emailAddress !== "string" || !body.emailAddress.trim()) {
    throw new BadRequestError("emailAddress is required");
  }
  const input: CreateSenderIdentityInput = {
    emailAddress: body.emailAddress,
    displayName: asOptionalString(body.displayName) ?? null,
    replyTo: asOptionalString(body.replyTo) ?? null,
    isDefaultTransactional: asOptionalBoolean(body.isDefaultTransactional),
    isDefaultNotification: asOptionalBoolean(body.isDefaultNotification),
    isDefaultMarketing: asOptionalBoolean(body.isDefaultMarketing),
  };
  const data = await emailSenderIdentityService.create(tenantId, input);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Sender identity created",
  });
};

export const listSenderIdentities = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const data = await emailSenderIdentityService.listForTenant(tenantId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Sender identities retrieved",
  });
};

export const getSenderIdentity = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const data = await emailSenderIdentityService.getById(tenantId, id);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Sender identity retrieved",
  });
};

export const updateSenderIdentity = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  const body = req.body ?? {};
  const input: UpdateSenderIdentityInput = {
    displayName: asOptionalString(body.displayName),
    replyTo: asOptionalString(body.replyTo),
    isDefaultTransactional: asOptionalBoolean(body.isDefaultTransactional),
    isDefaultNotification: asOptionalBoolean(body.isDefaultNotification),
    isDefaultMarketing: asOptionalBoolean(body.isDefaultMarketing),
  };
  const data = await emailSenderIdentityService.update(tenantId, id, input);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Sender identity updated",
  });
};

export const archiveSenderIdentity = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  await emailSenderIdentityService.archiveById(tenantId, id);
  sendSuccessResponse({
    res,
    data: { id, archived: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Sender identity archived",
  });
};
