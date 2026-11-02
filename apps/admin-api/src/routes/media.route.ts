import type { IRouter } from "express";
import { Router } from "express";

import {
  getProviders,
  listVideos,
  previewPlayback,
  resolveVideoSource,
} from "../controllers/media.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

/**
 * Lecture video sources: EVS ids and external HLS / MP4 / YouTube links.
 */
const mediaRouter: IRouter = Router();

mediaRouter.use(asyncHandler(authenticateTenantUser));

mediaRouter.get(
  "/providers",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(getProviders)
);
mediaRouter.post(
  "/resolve",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(resolveVideoSource)
);
mediaRouter.get(
  "/evs/videos",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(listVideos)
);
mediaRouter.post(
  "/preview",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(previewPlayback)
);

export default mediaRouter;
