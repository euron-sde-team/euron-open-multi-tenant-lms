import { NextFunction, Request, Response } from "express";

import { ForbiddenError } from "../errors/forbidden.error";
import entitlementsService from "../services/entitlements.service";

/**
 * Gates AI content generation on the `ai_authoring_enabled` entitlement.
 * Mount after authentication, before the generation handler.
 */
export const requireAiAuthoring = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.tenantId) throw new ForbiddenError("Tenant context required");
  await entitlementsService.ensureAiAuthoringEnabled(req.tenantId);
  next();
};
