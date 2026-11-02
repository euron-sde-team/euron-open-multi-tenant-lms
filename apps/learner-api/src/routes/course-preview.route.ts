/**
 * Course Preview Routes
 *
 * Public and deliberately unauthenticated: the point is that someone who has
 * not signed up can watch a sample lesson and decide to buy. Tenant is resolved
 * from the hostname by the shared middleware; whether a given video may be
 * played is decided per request against the course page that publishes it.
 */

import { Router } from "express";

import {
  getCoursePreviewPlayback,
  listCoursePreviews,
} from "../controllers/course-preview.controller";
import { asyncHandler } from "../utils/asynchandler";

const coursePreviewRouter: Router = Router();

coursePreviewRouter.get("/:courseSlug", asyncHandler(listCoursePreviews));
coursePreviewRouter.post(
  "/:courseSlug/playback",
  asyncHandler(getCoursePreviewPlayback)
);

export default coursePreviewRouter;
