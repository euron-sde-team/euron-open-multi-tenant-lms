import type { Request, Response } from "express";

import type { member_status } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import bulkEnrollService from "../services/bulk-enroll.service";
import type { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function requireTenantId(req: Request): string {
  if (!req.tenantId) throw new BadRequestError("Tenant context required");
  return req.tenantId;
}

export const runBulkEnroll = async (
  req: Request,
  res: Response<IResponseFormat>,
): Promise<void> => {
  const tenantId = requireTenantId(req);
  const body = (req.body ?? {}) as {
    target?: { type?: string; id?: string; batchId?: string | null };
    memberIds?: string[];
    selectAllFilter?: { status?: string; search?: string };
    validTill?: string | null;
  };
  const dryRun = req.query.dryRun === "true" || req.query.dryRun === "1";

  const TARGET_TYPES = [
    "COURSE",
    "BOOK",
    "BATCH",
    "TEST_SERIES",
    "BUNDLE",
  ] as const;
  type TargetType = (typeof TARGET_TYPES)[number];

  if (!body.target || !body.target.type || !body.target.id) {
    throw new BadRequestError(
      `target.type (one of ${TARGET_TYPES.join(", ")}) and target.id are required.`,
    );
  }
  const targetType = body.target.type.toUpperCase() as TargetType;
  if (!TARGET_TYPES.includes(targetType)) {
    throw new BadRequestError(
      `target.type must be one of ${TARGET_TYPES.join(", ")}.`,
    );
  }

  const target =
    targetType === "COURSE"
      ? {
          type: "COURSE" as const,
          id: body.target.id,
          batchId: body.target.batchId ?? null,
        }
      : { type: targetType, id: body.target.id };

  const validTill = body.validTill ? new Date(body.validTill) : null;
  if (validTill && Number.isNaN(validTill.getTime())) {
    throw new BadRequestError("validTill must be an ISO 8601 date.");
  }

  const memberIds = Array.isArray(body.memberIds) ? body.memberIds : null;
  const selectAllFilter = body.selectAllFilter
    ? {
        status: body.selectAllFilter.status
          ? (body.selectAllFilter.status as member_status)
          : undefined,
        search: body.selectAllFilter.search,
      }
    : null;

  const result = await bulkEnrollService.enroll({
    tenantId,
    actingUserId: req.tenantUser.id,
    target,
    memberIds,
    selectAllFilter,
    validTill,
    dryRun,
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Bulk enrollment processed",
  });
};
