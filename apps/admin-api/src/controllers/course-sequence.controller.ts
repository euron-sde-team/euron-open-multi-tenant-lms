import { Request, Response } from "express";

import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import courseSequenceService from "../services/course-sequence.service";
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
 * The whole chain a course belongs to, in order.
 *
 * Not just "what does this course wait for", the admin needs to see the journey
 * they're building, not the one link they happen to be editing.
 */
export const getSequence = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const sequence = await courseSequenceService.getSequenceFor(
    getTenantId(req),
    param(req, "courseId")
  );
  sendSuccessResponse({
    res,
    data: sequence,
    statusCode: HttpSuccessStatus.OK,
    message: "Sequence retrieved successfully",
  });
};

/** Everything this course unlocks. Derived from the same column, never stored. */
export const getSuccessors = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const successors = await courseSequenceService.getSuccessors(
    getTenantId(req),
    param(req, "courseId")
  );
  sendSuccessResponse({
    res,
    data: successors,
    statusCode: HttpSuccessStatus.OK,
    message: "Successors retrieved successfully",
  });
};

/**
 * Set what a course waits for, or clear it.
 *
 * `{ requires: null }` clears the prerequisite for this course, permanently.
 *
 * Not to be confused with the tenant-wide master switch
 * (PUT /courses/sequence-settings), which turns enforcement on and off for the
 * whole tenant WITHOUT touching any links. Off there = not enforced, nothing
 * lost; null here = the link is gone.
 */
export const setPrerequisite = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const { requires } = req.body ?? {};

  if (requires !== null && requires !== undefined) {
    if (typeof requires !== "object" || !requires.id) {
      throw new BadRequestError(
        "Send { requires: { id, type } } to set a prerequisite, or { requires: null } to clear it."
      );
    }
  }

  await courseSequenceService.setPrerequisite(
    getTenantId(req),
    param(req, "courseId"),
    requires
      ? { id: String(requires.id), type: requires.type ?? "COURSE" }
      : null
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: requires ? "Prerequisite set" : "Prerequisite cleared",
  });
};

/**
 * Save a whole chain at once, from an ordered list of course ids.
 *
 * This is what the Sequences screen sends: the admin drags courses into order,
 * and each one is rewritten to wait for the one above it. The first has none.
 */
export const saveSequence = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const { courseIds } = req.body ?? {};

  if (!Array.isArray(courseIds)) {
    throw new BadRequestError("courseIds must be an array, in order");
  }

  await courseSequenceService.saveSequence(
    getTenantId(req),
    courseIds.map(String)
  );

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Sequence saved",
  });
};

/** The tenant-wide master switch: is sequencing enforced at all? */
export const getSequenceSettings = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const settings = await courseSequenceService.getSettings(getTenantId(req));
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
 * Turning it off leaves every prerequisite exactly where it is, it just stops
 * enforcing them. Nothing an admin built is lost, so this is safe to toggle.
 */
export const updateSequenceSettings = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const { enabled } = req.body ?? {};
  if (typeof enabled !== "boolean") {
    throw new BadRequestError("Send { enabled: true } or { enabled: false }.");
  }

  const userId = req.tenantUser?.id;
  if (!userId) throw new ForbiddenError("Tenant user context required");

  const settings = await courseSequenceService.updateSettings(
    getTenantId(req),
    enabled,
    userId
  );

  sendSuccessResponse({
    res,
    data: settings,
    statusCode: HttpSuccessStatus.OK,
    message: enabled
      ? "Sequential courses enabled"
      : "Sequential courses disabled, your course order is saved and will be restored if you turn it back on.",
  });
};

/** The tenant's whole ordered chain, for the sequence builder. */
export const getChain = async (req: Request, res: Response<IResponseFormat>) => {
  const steps = await courseSequenceService.getChain(getTenantId(req));
  sendSuccessResponse({
    res,
    data: { steps },
    statusCode: HttpSuccessStatus.OK,
    message: "Chain retrieved successfully",
  });
};
