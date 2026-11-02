import { Request, Response } from "express";
import emailUnsubscribeService, {
  type UnsubscribeScope,
} from "../services/email-unsubscribe.service";
import { BadRequestError } from "../errors/bad-request.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { IResponseFormat } from "../types/response.type";

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestError(`${field} is required (string)`);
  }
  return value.trim();
}

export const verifyUnsubscribeToken = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const token = requireString(req.body?.token, "token");
  const data = await emailUnsubscribeService.verify(token);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Unsubscribe token verified",
  });
};

export const confirmUnsubscribe = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const token = requireString(req.body?.token, "token");
  const scope = (req.body?.scope ?? "category") as UnsubscribeScope;
  const data = await emailUnsubscribeService.confirm(token, scope);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Unsubscribe applied",
  });
};
