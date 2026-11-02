import type { IRouter } from "express";
import { Router } from "express";

import {
  attachVideoToLecture,
  getCourseTree,
  getVideoUsage,
  listCourses,
  listUnmappedUploads,
  searchAssets,
} from "../controllers/asset-library.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const assetLibraryRouter: IRouter = Router();

assetLibraryRouter.use(asyncHandler(authenticateTenantUser));

// All asset-library endpoints share the same admin-side permission as the LMS
// editor, if you can edit curriculum, you can pick from the library.
const requireLmsManage = asyncHandler(requirePermission("courses.lms.manage"));

assetLibraryRouter.get("/courses", requireLmsManage, asyncHandler(listCourses));
assetLibraryRouter.get(
  "/courses/:courseId/tree",
  requireLmsManage,
  asyncHandler(getCourseTree)
);
assetLibraryRouter.get("/search", requireLmsManage, asyncHandler(searchAssets));
assetLibraryRouter.get(
  "/unmapped",
  requireLmsManage,
  asyncHandler(listUnmappedUploads)
);
assetLibraryRouter.get(
  "/videos/:videoId/usage",
  requireLmsManage,
  asyncHandler(getVideoUsage)
);
assetLibraryRouter.post(
  "/attach",
  asyncHandler(requirePermission("courses.lms.manage")),
  requireLmsManage,
  asyncHandler(attachVideoToLecture)
);

export default assetLibraryRouter;
