import { NextFunction, Request, Response, Router } from "express";

import config from "../config";
import { issueTestRewards } from "../controllers/internal.controller";
import { UnauthorizedError } from "../errors/unauthorized.error";
import { asyncHandler } from "../utils/asynchandler";

/**
 * Server-to-server routes for the other platform APIs (e.g. admin-api). There is
 * no tenant hostname on these calls, so this router is mounted BEFORE tenant
 * resolution and authenticated by a shared internal key instead.
 */
const internalRouter: Router = Router();

const requireInternalKey = (req: Request, _res: Response, next: NextFunction) => {
  const provided = String(req.headers["x-internal-key"] ?? "");
  if (!config.INTERNAL_API_KEY || provided !== config.INTERNAL_API_KEY) {
    throw new UnauthorizedError("Invalid internal key");
  }
  next();
};

internalRouter.use(requireInternalKey);

internalRouter.post(
  "/test-rewards/:attemptId",
  asyncHandler(issueTestRewards)
);

export default internalRouter;
