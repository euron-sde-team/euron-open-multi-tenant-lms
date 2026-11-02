import { Router } from "express";
import {
  listPendingAttempts,
  getAttemptForGrading,
  gradeAnswer,
} from "../controllers/test-grading.controller";
import { gradeAnswers, getGradingQueue } from "../controllers/exam-workflows.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const testGradingRouter: Router = Router();

testGradingRouter.use(asyncHandler(authenticateTenantUser));

// The whole queue in one call: every attempt waiting, with the answers to read.
// The pair below answers the same question one attempt at a time.
testGradingRouter.get(
  "/queue",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getGradingQueue)
);
// Mark a batch. Marking is a batch job for the person doing it, so sending one
// request per answer is a fan-out that half-lands.
testGradingRouter.post(
  "/grade",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(gradeAnswers)
);

// Evaluator queue: attempts with descriptive answers awaiting manual grading.
testGradingRouter.get(
  "/pending",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listPendingAttempts)
);

// One attempt's descriptive answers to grade.
testGradingRouter.get(
  "/attempts/:attemptId",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getAttemptForGrading)
);

// Mark a single descriptive answer (recomputes the attempt score).
testGradingRouter.post(
  "/answers/:answerId/grade",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(gradeAnswer)
);

export default testGradingRouter;
