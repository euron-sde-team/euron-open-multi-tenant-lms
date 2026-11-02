import { Router } from "express";
import * as quizzesController from "../controllers/quizzes.controller";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

router.get("/", asyncHandler(quizzesController.listQuizzes));
router.get("/:id/attempt", asyncHandler(quizzesController.getAttempt));
router.get("/:id/attempts", asyncHandler(quizzesController.listAttempts));
router.get(
  "/:id/attempts/:attemptId",
  asyncHandler(quizzesController.getAttemptReview)
);
router.get("/:id", asyncHandler(quizzesController.getQuizDetail));
router.post("/:id/start", asyncHandler(quizzesController.startAttempt));
router.post("/:id/submit", asyncHandler(quizzesController.submitAttempt));
router.post("/:id/mark-complete", asyncHandler(quizzesController.markComplete));

export default router;
