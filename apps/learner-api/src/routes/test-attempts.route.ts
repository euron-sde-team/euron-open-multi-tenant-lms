import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateUser } from "../middlewares/auth.middleware";
import {
  startAttempt,
  getAttempt,
  listAttempts,
  patchAnswer,
  submitAttempt,
  submitModule,
  recordProctoringEvent,
  resumeBreak,
  getResult,
  downloadResultPdf,
} from "../controllers/test-attempts.controller";

const router: Router = Router();

router.use(asyncHandler(authenticateUser));

router.post("/start", asyncHandler(startAttempt));
// Re-attempt history for a test (newest first). Registered before /:attemptId
// so the "by-test" literal segment is never swallowed by the param route.
router.get("/by-test/:testId", asyncHandler(listAttempts));
router.get("/:attemptId", asyncHandler(getAttempt));
router.patch("/:attemptId/answer", asyncHandler(patchAnswer));
router.post("/:attemptId/submit", asyncHandler(submitAttempt));
router.post(
  "/:attemptId/proctoring-event",
  asyncHandler(recordProctoringEvent)
);
router.post("/:attemptId/resume-break", asyncHandler(resumeBreak));
router.post(
  "/:attemptId/modules/:attemptModuleId/submit",
  asyncHandler(submitModule)
);
router.get("/:attemptId/result", asyncHandler(getResult));
router.get("/:attemptId/report-card.pdf", asyncHandler(downloadResultPdf));

export default router;
