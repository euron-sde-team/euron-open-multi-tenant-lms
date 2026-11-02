import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import orderedProductsService from "../services/ordered-products.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Which course tab this request is about, required for courses, rejected for
 * every other catalog (they're single flat lists).
 *
 * Accepted from the query string OR the JSON body, because a reorder is a PUT
 * carrying a body: making callers append `?mode=` to a body-bearing request is
 * an easy detail to miss, and missing it silently 400s a drag that looked fine.
 * The body wins when both are sent.
 */
function resolveMode(req: Request): string | undefined {
  const fromBody = (req.body ?? {}).mode;
  const raw = fromBody !== undefined ? fromBody : req.query.mode;
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new BadRequestError("mode must be a non-empty string");
  }
  return raw;
}

/** The tenant-wide master switch: is admin-defined catalog order applied at all? */
export const getOrderedProductsSettings = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const settings = await orderedProductsService.getSettings(getTenantId(req));
  sendSuccessResponse({
    res,
    data: settings,
    statusCode: HttpSuccessStatus.OK,
    message: "Settings retrieved successfully",
  });
};

/**
 * Flip the master switch.
 *
 * Turning it off leaves every saved arrangement exactly where it is, the
 * catalog just stops sorting by it. Nothing an admin dragged is lost, so this
 * is safe to toggle back and forth.
 */
export const updateOrderedProductsSettings = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const { enabled } = req.body ?? {};
  if (typeof enabled !== "boolean") {
    throw new BadRequestError("Send { enabled: true } or { enabled: false }.");
  }

  const userId = req.tenantUser?.id;
  if (!userId) throw new ForbiddenError("Tenant user context required");

  const settings = await orderedProductsService.updateSettings(
    getTenantId(req),
    enabled,
    userId
  );

  sendSuccessResponse({
    res,
    data: settings,
    statusCode: HttpSuccessStatus.OK,
    message: enabled
      ? "Ordered products enabled"
      : "Ordered products disabled, your arrangement is saved and will be restored if you turn it back on.",
  });
};

/**
 * The list an admin drags, already in saved order.
 * GET /tenant/ordered-products/:entity        (books, bundles, batches, test_series)
 * GET /tenant/ordered-products/courses?mode=LIVE
 */
export const listOrderableItems = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const items = await orderedProductsService.listOrderable(
    getTenantId(req),
    param(req, "entity"),
    { mode: resolveMode(req) }
  );
  sendSuccessResponse({
    res,
    data: { items },
    statusCode: HttpSuccessStatus.OK,
    message: "Items retrieved successfully",
  });
};

/**
 * Persist a new arrangement.
 * PUT /tenant/ordered-products/:entity/reorder
 * Body: { item_ids: string[] }, the COMPLETE desired order for this list.
 * Courses additionally require a mode (body `mode` or ?mode=); each mode is
 * ordered independently.
 *
 * 409 STALE_CATALOG if item_ids no longer matches the current row set.
 */
export const reorderItems = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const { item_ids } = req.body ?? {};
  const result = await orderedProductsService.reorder(
    getTenantId(req),
    param(req, "entity"),
    item_ids,
    { mode: resolveMode(req) }
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Order saved",
  });
};
