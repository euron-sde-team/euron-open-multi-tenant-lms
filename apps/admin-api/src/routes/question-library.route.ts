import type { IRouter } from "express";
import { Router } from "express";

import {
  getCourseTree,
  getQuestionsDetail,
  importQuestions,
  listCourses,
  searchQuestions,
} from "../controllers/question-library.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const questionLibraryRouter: IRouter = Router();

questionLibraryRouter.use(asyncHandler(authenticateTenantUser));

// All question-library endpoints share the same admin-side permission as the
// LMS editor, if you can edit curriculum, you can pick from the library.
const requireLmsManage = asyncHandler(requirePermission("courses.lms.manage"));

questionLibraryRouter.get("/courses", requireLmsManage, asyncHandler(listCourses));
questionLibraryRouter.get(
  "/courses/:courseId/tree",
  requireLmsManage,
  asyncHandler(getCourseTree)
);
questionLibraryRouter.get(
  "/search",
  requireLmsManage,
  asyncHandler(searchQuestions)
);
questionLibraryRouter.post(
  "/questions/detail",
  asyncHandler(requirePermission("courses.lms.manage")),
  requireLmsManage,
  asyncHandler(getQuestionsDetail)
);
questionLibraryRouter.post(
  "/import",
  asyncHandler(requirePermission("courses.lms.manage")),
  requireLmsManage,
  asyncHandler(importQuestions)
);

export default questionLibraryRouter;
