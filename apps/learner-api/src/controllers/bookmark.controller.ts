/**
 * Bookmark controller, add, remove, list bookmarks for courses, books, bundles.
 * All routes require authentication.
 */

import type { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import * as bookmarkService from "../services/bookmark.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
function getTenantId(req: Request): string {
  const id = req.tenant?.id;
  if (!id) throw new BadRequestError("Tenant required");
  return id;
}

function getMemberId(req: Request): string {
  const id = (req.user as { id: string } | undefined)?.id;
  if (!id) throw new BadRequestError("Authentication required");
  return id;
}

const VALID_TYPES = ["COURSE", "BOOK", "BUNDLE"] as const;

/** POST /bookmarks, body: { type, item_id } */
export async function addBookmark(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);

  const body = req.body as { type?: string; item_id?: string };
  const type = typeof body?.type === "string" ? body.type.toUpperCase() : "";
  const itemId = typeof body?.item_id === "string" ? body.item_id.trim() : "";

  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    throw new BadRequestError("Invalid type. Must be COURSE, BOOK, or BUNDLE");
  }
  if (!itemId) throw new BadRequestError("item_id is required");

  await bookmarkService.addBookmark(tenantId, memberId, type as "COURSE" | "BOOK" | "BUNDLE", itemId);

  sendSuccessResponse({
    res,
    data: { added: true },
    statusCode: HttpSuccessStatus.CREATED,
    message: "Bookmark added",
  });
}

/** DELETE /bookmarks?type=COURSE&item_id=xxx */
export async function removeBookmark(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);

  const type = typeof req.query.type === "string" ? req.query.type.toUpperCase() : "";
  const itemId = typeof req.query.item_id === "string" ? req.query.item_id.trim() : "";

  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    throw new BadRequestError("Invalid type. Must be COURSE, BOOK, or BUNDLE");
  }
  if (!itemId) throw new BadRequestError("item_id is required");

  await bookmarkService.removeBookmark(tenantId, memberId, type as "COURSE" | "BOOK" | "BUNDLE", itemId);

  sendSuccessResponse({
    res,
    data: { removed: true },
    statusCode: HttpSuccessStatus.OK,
    message: "Bookmark removed",
  });
}

/** GET /bookmarks, returns { courses, books, bundles } with full item metadata */
export async function listBookmarks(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);

  const result = await bookmarkService.listBookmarks(tenantId, memberId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Bookmarks retrieved",
  });
}
