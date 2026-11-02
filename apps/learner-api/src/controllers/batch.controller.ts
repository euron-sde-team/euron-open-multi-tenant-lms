/**
 * Public batch controller, serves published batch data and learner views.
 */

import { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import * as batchService from "../services/batch.service";
import * as batchLeaderboardService from "../services/batch-leaderboard.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/** The only columns a client may sort batches by. */
const VALID_BATCH_SORT_COLUMNS = [
  "created_at",
  "start_date",
  "title",
  "sort_order",
] as const;
type BatchSortColumn = (typeof VALID_BATCH_SORT_COLUMNS)[number];

function getTenantId(req: Request): string {
  const tenant = req.tenant;
  if (!tenant) throw new NotFoundError("Tenant not found");
  return tenant.id;
}

function requireMemberId(req: Request): string {
  const memberId = req.user?.id;
  if (!memberId) throw new UnauthorizedError("Authentication required");
  return memberId;
}

/** GET /batches */
export const listPublishedBatches = async (
  req: Request,
  res: Response
): Promise<void> => {
  const tenantId = getTenantId(req);
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const limit =
    typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 12;
  // Whitelist, not a cast. The repository interpolates this into
  // `.orderBy(\`batches.${sortBy}\`)`, so an unchecked value would reach SQL.
  // (A bare `as` satisfies the compiler and validates nothing at runtime.)
  const requestedSort =
    typeof req.query.sortBy === "string" ? req.query.sortBy : undefined;
  const sortBy = VALID_BATCH_SORT_COLUMNS.includes(
    requestedSort as BatchSortColumn
  )
    ? (requestedSort as BatchSortColumn)
    : // Batches and test series are the two catalogs that ignored sort_order
      // before this feature (courses/books/bundles already defaulted to it).
      // So the switch governs exactly these two: ON follows the admin's
      // arrangement, OFF keeps the start_date ordering learners see today.
      req.tenant?.orderedProducts
      ? "sort_order"
      : "start_date";
  const sortOrder = req.query.sortOrder === "desc" ? "desc" : "asc";

  const data = await batchService.listPublishedBatches(tenantId, {
    page,
    limit,
    sortBy,
    sortOrder,
  });
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Batches retrieved successfully",
  });
};

/** GET /batches/:slug, public detail (auth optional; if present, includes hasAccess) */
export const getBatchBySlug = async (
  req: Request,
  res: Response
): Promise<void> => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(String(req.params.slug || ""));
  if (!slug) throw new BadRequestError("Slug is required");
  const memberId = req.user?.id;
  const data = await batchService.getBatchPublic(tenantId, slug, memberId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch retrieved successfully",
  });
};

/** GET /me/batches, list my batches */
export const listMyBatches = async (
  req: Request,
  res: Response
): Promise<void> => {
  const tenantId = getTenantId(req);
  const memberId = requireMemberId(req);
  const data = await batchService.listMyBatches(tenantId, memberId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Batches retrieved successfully",
  });
};

/** GET /batches/:slug/dashboard, auth optional; missing member returns
 *  zero attended/completed but still surfaces public counters. */
export const getBatchDashboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  const tenantId = getTenantId(req);
  const memberId = req.user?.id ?? null;
  const slug = decodeURIComponent(String(req.params.slug || ""));
  if (!slug) throw new BadRequestError("Slug is required");
  const data = await batchService.getBatchDashboard(tenantId, slug, memberId);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch dashboard retrieved successfully",
  });
};

/** GET /batches/:slug/content, auth optional. Items are the same set the
 *  About tab already exposes; this endpoint just returns them in the shape
 *  the Content tab expects. */
export const getBatchContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(String(req.params.slug || ""));
  if (!slug) throw new BadRequestError("Slug is required");
  const data = await batchService.getBatchContent(tenantId, slug);
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Batch content retrieved successfully",
  });
};

/** GET /batches/:slug/leaderboard, auth optional. The "me" row is
 *  populated only when an authenticated, enrolled member calls. */
export const getBatchLeaderboard = async (
  req: Request,
  res: Response
): Promise<void> => {
  const tenantId = getTenantId(req);
  const memberId = req.user?.id ?? null;
  const slug = decodeURIComponent(String(req.params.slug || ""));
  if (!slug) throw new BadRequestError("Slug is required");
  const data = await batchLeaderboardService.getLeaderboard(
    tenantId,
    slug,
    memberId
  );
  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Leaderboard retrieved successfully",
  });
};
