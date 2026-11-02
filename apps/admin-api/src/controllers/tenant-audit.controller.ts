import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import tenantAuditService from "../services/tenant-audit.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new BadRequestError("Tenant context is required");
  return tenantId;
}

function parseDate(value: unknown, field: string): Date | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestError(`"${field}" is not a valid date`);
  }
  return d;
}

export const listAuditLogs = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const q = req.query as Record<string, string | undefined>;

  const limit = Math.min(Math.max(parseInt(q.limit ?? "50", 10) || 50, 1), 200);
  const page = Math.max(parseInt(q.page ?? "1", 10) || 1, 1);

  const { logs, total } = await tenantAuditService.list({
    tenantId: getTenantId(req),
    actorUserId: q.actorUserId || undefined,
    category: q.category || undefined,
    action: q.action || undefined,
    resourceType: q.resourceType || undefined,
    resourceId: q.resourceId || undefined,
    // "?succeeded=false" surfaces only the blocked attempts.
    succeeded:
      q.succeeded === undefined || q.succeeded === ""
        ? undefined
        : q.succeeded === "true",
    from: parseDate(q.from, "from"),
    to: parseDate(q.to, "to"),
    search: q.search || undefined,
    limit,
    offset: (page - 1) * limit,
  });

  sendSuccessResponse({
    res,
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Activity retrieved successfully",
  });
};

/**
 * The portal turned someone away from a page their role doesn't include.
 * Never fails the caller over a bad report, it is a log line, not an action.
 */
export const recordDeniedView = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const body = (req.body ?? {}) as { path?: unknown; label?: unknown };
  const path = typeof body.path === "string" ? body.path.split("?")[0].trim() : "";
  if (!/^\/dashboard(\/[\w\-./[\]]*)?$/.test(path) || path.length > 200) {
    throw new BadRequestError("path must be a dashboard page");
  }
  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 80)
      : null;

  const user = req.tenantUser;
  await tenantAuditService.recordDeniedView({
    tenantId: getTenantId(req),
    actor: { id: user.id ?? null, email: user.email ?? null, name: user.name ?? null },
    path,
    label,
    request: req,
  });

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Recorded",
  });
};

/** Everything the filter bar needs, in one round-trip. */
export const getAuditFilters = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const [actors, options] = await Promise.all([
    tenantAuditService.listActors(getTenantId(req)),
    Promise.resolve(tenantAuditService.getFilterOptions()),
  ]);

  sendSuccessResponse({
    res,
    data: { actors, ...options },
    statusCode: HttpSuccessStatus.OK,
    message: "Activity filters retrieved successfully",
  });
};
