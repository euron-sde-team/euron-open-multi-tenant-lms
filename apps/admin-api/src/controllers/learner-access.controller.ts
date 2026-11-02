/**
 * The two composite learner endpoints: one read that answers "tell me about
 * this learner", one write that answers "change what they can reach".
 *
 * They sit beside the fine-grained members routes rather than replacing them.
 * The dashboard wants a tab at a time; anything driving the whole job at once
 * wants these.
 */
import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import learnerAccessService, {
  ACCESS_ACTIONS,
  LEARNER_CONTENT_TYPES,
  type AccessAction,
  type LearnerContentType,
} from "../services/learner-access.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

const requireTenantId = (req: Request): string => {
  if (!req.tenantId) throw new BadRequestError("Tenant context required");
  return req.tenantId;
};

/**
 * `valid_till` is deliberately three-valued and the difference matters:
 *   absent  -> leave the end date exactly as it is
 *   null    -> access never ends
 *   string  -> that ISO date
 * Collapsing absent and null would silently turn "grant it" into "grant it
 * forever", which is not a thing anybody asked for.
 */
function parseValidTill(body: unknown): Date | null | undefined {
  const value = (body as { valid_till?: unknown } | null)?.valid_till;
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new BadRequestError("valid_till must be an ISO date string, or null for access that never ends.");
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`"${value}" is not a date. Send an ISO date such as 2026-06-30.`);
  }
  return parsed;
}

/** Everything about one learner in a single answer. */
export const getLearnerOverview = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = requireTenantId(req);
  const rawLimit = parseInt(String(req.query.orderLimit ?? ""), 10);

  const data = await learnerAccessService.overview(
    tenantId,
    req.params.memberId as string,
    { orderLimit: Number.isFinite(rawLimit) ? rawLimit : undefined }
  );

  sendSuccessResponse({
    res,
    data,
    statusCode: HttpSuccessStatus.OK,
    message: "Learner overview",
  });
};

/**
 * Grant, extend or revoke access to any kind of content, in one place.
 *
 * The access row is found from the CONTENT id, not supplied by the caller: an
 * admin names the course, and making anyone carry an enrolment id around is how
 * the wrong person's access gets removed.
 */
export const changeLearnerAccess = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = requireTenantId(req);
  const body = (req.body ?? {}) as Record<string, unknown>;

  const action = String(body.action ?? "").toUpperCase() as AccessAction;
  if (!action) throw new BadRequestError("action is required");
  if (!ACCESS_ACTIONS.includes(action)) {
    throw new BadRequestError(
      `action must be one of ${ACCESS_ACTIONS.join(", ")}. Received "${String(body.action)}".`
    );
  }

  const contentType = String(body.content_type ?? "").toUpperCase() as LearnerContentType;
  if (!contentType) throw new BadRequestError("content_type is required");
  if (!LEARNER_CONTENT_TYPES.includes(contentType)) {
    throw new BadRequestError(
      `content_type must be one of ${LEARNER_CONTENT_TYPES.join(", ")}. Received "${String(body.content_type)}".`
    );
  }

  const contentId = typeof body.content_id === "string" ? body.content_id.trim() : "";
  if (!contentId) throw new BadRequestError("content_id is required");

  const result = await learnerAccessService.changeAccess({
    tenantId,
    memberId: req.params.memberId as string,
    action,
    contentType,
    contentId,
    validTill: parseValidTill(body),
  });

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message:
      result.action === "GRANT"
        ? `${result.memberName} can now reach "${result.contentTitle}".`
        : result.action === "REVOKE"
          ? `${result.memberName} can no longer reach "${result.contentTitle}".`
          : `Access to "${result.contentTitle}" now ends ${result.validTill ?? "never"}.`,
  });
};
