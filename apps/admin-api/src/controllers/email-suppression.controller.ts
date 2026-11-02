import { Request, Response } from "express";
import {
  listSuppressions,
  removeSuppression,
} from "../services/email-engine/suppression";
import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { IResponseFormat } from "../types/response.type";
import type {
  email_message_category,
  email_suppression_reason,
} from "../db/enums";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const v = req.params[name];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

const VALID_CATEGORIES = ["TRANSACTIONAL", "NOTIFICATION", "MARKETING"] as const;
const VALID_REASONS = [
  "HARD_BOUNCE",
  "COMPLAINT",
  "MANUAL_UNSUBSCRIBE",
  "ADMIN_BLOCK",
  "IMPORTED",
] as const;

export const listEmailSuppressions = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const page = parseInt((req.query.page as string) ?? "1", 10) || 1;
  const limit = parseInt((req.query.limit as string) ?? "50", 10) || 50;
  const search = (req.query.search as string | undefined)?.trim() || undefined;
  const reasonParam = req.query.reason as string | undefined;
  const categoryParam = req.query.category as string | undefined;

  const reason =
    reasonParam && VALID_REASONS.includes(reasonParam as email_suppression_reason)
      ? (reasonParam as email_suppression_reason)
      : undefined;

  let categoryScope: email_message_category | null | undefined;
  if (categoryParam === "ALL") categoryScope = null;
  else if (
    categoryParam &&
    VALID_CATEGORIES.includes(categoryParam as email_message_category)
  ) {
    categoryScope = categoryParam as email_message_category;
  }

  const result = await listSuppressions(tenantId, {
    page,
    limit,
    search,
    reason,
    categoryScope,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Suppressions retrieved",
  });
};

export const removeEmailSuppression = async (
  req: Request,
  res: Response<IResponseFormat>,
) => {
  const tenantId = getTenantId(req);
  const id = param(req, "id");
  if (!id) throw new BadRequestError("Suppression id required");

  // Look up the row first so we can use the email + category as the delete
  // key. We don't expose a delete-by-id in the engine's suppression service
  // (it deletes by tenant+email+scope); fetch the row first.
  const row = await db
    .selectFrom("tenant_email_suppressions")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) throw new NotFoundError("Suppression not found");

  await removeSuppression(tenantId, row.email, row.category_scope ?? null);
  sendSuccessResponse({
    res,
    data: { id, deleted: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Suppression removed",
  });
};
