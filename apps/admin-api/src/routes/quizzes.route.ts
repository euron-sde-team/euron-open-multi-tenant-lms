import { Router } from "express";
import {
  create,
  findAll,
  findOne,
  update,
  publish,
  unpublish,
  remove,
  generateFromTranscript,
  generateQuestions,
  downloadImportSample,
} from "../controllers/quizzes.controller";
import * as quizAnalyticsController from "../controllers/quiz-analytics.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requireAiAuthoring } from "../middlewares/ai-authoring.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const quizzesRouter: Router = Router();

quizzesRouter.use(asyncHandler(authenticateTenantUser));

quizzesRouter.post("/generate-from-transcript", asyncHandler(requirePermission("quizzes.create")), asyncHandler(requireAiAuthoring), asyncHandler(generateFromTranscript));
quizzesRouter.get("/analytics/overview", asyncHandler(requirePermission("quizzes.view")), asyncHandler(quizAnalyticsController.getOverviewAnalytics));
quizzesRouter.get("/analytics/course/:courseId", asyncHandler(requirePermission("quizzes.view")), asyncHandler(quizAnalyticsController.getCourseAnalytics));
// Sample CSV for the questions bulk import (must be before /:id)
quizzesRouter.get("/import-sample", asyncHandler(requirePermission("quizzes.view")), asyncHandler(downloadImportSample));
quizzesRouter.post("/", asyncHandler(requirePermission("quizzes.create")), asyncHandler(create));
quizzesRouter.get("/", asyncHandler(requirePermission("quizzes.view")), asyncHandler(findAll));
quizzesRouter.get("/:id", asyncHandler(requirePermission("quizzes.view")), asyncHandler(findOne));
quizzesRouter.post("/:id/generate-questions", asyncHandler(requirePermission("quizzes.create")), asyncHandler(requireAiAuthoring), asyncHandler(generateQuestions));
quizzesRouter.patch("/:id", asyncHandler(requirePermission("quizzes.update")), asyncHandler(update));
quizzesRouter.post("/:id/publish", asyncHandler(requirePermission("quizzes.update")), asyncHandler(publish));
quizzesRouter.post("/:id/unpublish", asyncHandler(requirePermission("quizzes.update")), asyncHandler(unpublish));
quizzesRouter.get("/:id/analytics", asyncHandler(requirePermission("quizzes.view")), asyncHandler(quizAnalyticsController.getQuizAnalytics));
quizzesRouter.delete("/:id", asyncHandler(requirePermission("quizzes.delete")), asyncHandler(remove));

export default quizzesRouter;
