import { Router } from "express";
import {
  getBatchBySlug,
  getBatchContent,
  getBatchDashboard,
  getBatchLeaderboard,
  listMyBatches,
  listPublishedBatches,
} from "../controllers/batch.controller";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateUser, optionalAuth } from "../middlewares/auth.middleware";
import { tenantResolverMiddleware } from "../middlewares/tenant-resolver.middleware";

const batchRouter: Router = Router();

// Public list of published batches
batchRouter.get(
  "/batches",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(listPublishedBatches)
);

// "My batches", authenticated
batchRouter.get(
  "/me/batches",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(authenticateUser),
  asyncHandler(listMyBatches)
);

// Public detail by slug; if a token is present we include `hasAccess`
batchRouter.get(
  "/batches/:slug",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(optionalAuth),
  asyncHandler(getBatchBySlug)
);

// Public views, visible to anyone, but learner-specific fields (attendance,
// completion, leaderboard "me" row) are populated only when a token is
// present and the member is enrolled.
batchRouter.get(
  "/batches/:slug/dashboard",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(optionalAuth),
  asyncHandler(getBatchDashboard)
);
batchRouter.get(
  "/batches/:slug/content",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(optionalAuth),
  asyncHandler(getBatchContent)
);
batchRouter.get(
  "/batches/:slug/leaderboard",
  asyncHandler(tenantResolverMiddleware),
  asyncHandler(optionalAuth),
  asyncHandler(getBatchLeaderboard)
);

export default batchRouter;
