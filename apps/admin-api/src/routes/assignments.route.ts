import { Router } from "express";
import multer from "multer";
import {
  create,
  findAll,
  findOne,
  update,
  publish,
  unpublish,
  remove,
  generateFromTranscript,
  uploadPdf,
  getPdfUrl,
  removePdf,
  listSubmissions,
  getSubmissionDetail,
  streamSubmissionPdf,
  evaluateSubmission,
  requestResubmission,
} from "../controllers/assignments.controller";
import * as assignmentAnalyticsController from "../controllers/assignment-analytics.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requireAiAuthoring } from "../middlewares/ai-authoring.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

// Assignment attachments accept any file type (PDF, source code, xlsx, docx, pptx,
// images, zip, etc.). Only the size ceiling is enforced here.
const assignmentPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const assignmentsRouter: Router = Router();

assignmentsRouter.use(asyncHandler(authenticateTenantUser));

assignmentsRouter.post("/generate-from-transcript", asyncHandler(requirePermission("assignments.create")), asyncHandler(requireAiAuthoring), asyncHandler(generateFromTranscript));
assignmentsRouter.get("/analytics/overview", asyncHandler(requirePermission("assignments.view")), asyncHandler(assignmentAnalyticsController.getOverviewAnalytics));
assignmentsRouter.get("/analytics/course/:courseId", asyncHandler(requirePermission("assignments.view")), asyncHandler(assignmentAnalyticsController.getCourseAnalytics));
assignmentsRouter.post("/", asyncHandler(requirePermission("assignments.create")), asyncHandler(create));
assignmentsRouter.get("/", asyncHandler(requirePermission("assignments.view")), asyncHandler(findAll));
assignmentsRouter.get("/:id/pdf-url", asyncHandler(requirePermission("assignments.view")), asyncHandler(getPdfUrl));
assignmentsRouter.get("/:id", asyncHandler(requirePermission("assignments.view")), asyncHandler(findOne));
assignmentsRouter.patch("/:id", asyncHandler(requirePermission("assignments.update")), asyncHandler(update));
assignmentsRouter.post("/:id/publish", asyncHandler(requirePermission("assignments.update")), asyncHandler(publish));
assignmentsRouter.post("/:id/unpublish", asyncHandler(requirePermission("assignments.update")), asyncHandler(unpublish));
assignmentsRouter.post(
  "/:id/upload-pdf",
  asyncHandler(requirePermission("assignments.update")),
  assignmentPdfUpload.single("file"),
  asyncHandler(uploadPdf)
);
assignmentsRouter.delete("/:id/pdf", asyncHandler(requirePermission("assignments.update")), asyncHandler(removePdf));
assignmentsRouter.get("/:id/analytics", asyncHandler(requirePermission("assignments.view")), asyncHandler(assignmentAnalyticsController.getAssignmentAnalytics));
assignmentsRouter.get("/:id/submissions/:submissionId/pdf", asyncHandler(requirePermission("assignments.grade")), asyncHandler(streamSubmissionPdf));
assignmentsRouter.get("/:id/submissions/:submissionId", asyncHandler(requirePermission("assignments.grade")), asyncHandler(getSubmissionDetail));
assignmentsRouter.post("/:id/submissions/:submissionId/evaluate", asyncHandler(requirePermission("assignments.grade")), asyncHandler(evaluateSubmission));
assignmentsRouter.post("/:id/submissions/:submissionId/request-resubmission", asyncHandler(requirePermission("assignments.grade")), asyncHandler(requestResubmission));
assignmentsRouter.get("/:id/submissions", asyncHandler(requirePermission("assignments.grade")), asyncHandler(listSubmissions));
assignmentsRouter.delete("/:id", asyncHandler(requirePermission("assignments.update")), asyncHandler(remove));

export default assignmentsRouter;
