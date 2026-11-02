import { Request, Response } from "express";
import emailMessagesService from "../services/email-messages.service";
import { ForbiddenError } from "../errors/forbidden.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { IResponseFormat } from "../types/response.type";
import type {
  email_message_category,
  email_message_status,
} from "../db/enums";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

const VALID_STATUSES: email_message_status[] = [
  "QUEUED",
  "SENT",
  "DELIVERED",
  "BOUNCED",
  "COMPLAINED",
  "REJECTED",
  "FAILED",
  "SUPPRESSED",
  "FROZEN",
];
const VALID_CATEGORIES: email_message_category[] = [
  "TRANSACTIONAL",
  "NOTIFICATION",
  "MARKETING",
];

export const listEmailMessages = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const page = parseInt((req.query.page as string) ?? "1", 10) || 1;
  const limit = parseInt((req.query.limit as string) ?? "50", 10) || 50;
  const search = (req.query.search as string | undefined)?.trim() || undefined;

  const statusParam = req.query.status as string | undefined;
  const categoryParam = req.query.category as string | undefined;
  const status =
    statusParam && VALID_STATUSES.includes(statusParam as email_message_status)
      ? (statusParam as email_message_status)
      : undefined;
  const category =
    categoryParam &&
    VALID_CATEGORIES.includes(categoryParam as email_message_category)
      ? (categoryParam as email_message_category)
      : undefined;

  let createdAfter: Date | undefined;
  let createdBefore: Date | undefined;
  const afterParam = req.query.createdAfter as string | undefined;
  const beforeParam = req.query.createdBefore as string | undefined;
  if (afterParam) {
    const parsed = Date.parse(afterParam);
    if (Number.isFinite(parsed)) createdAfter = new Date(parsed);
  }
  if (beforeParam) {
    const parsed = Date.parse(beforeParam);
    if (Number.isFinite(parsed)) createdBefore = new Date(parsed);
  }

  const result = await emailMessagesService.list(tenantId, {
    page,
    limit,
    search,
    status,
    category,
    createdAfter,
    createdBefore,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Messages retrieved",
  });
};
