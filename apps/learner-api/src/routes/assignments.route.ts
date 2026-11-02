import { Router } from "express";
import multer from "multer";
import * as assignmentsController from "../controllers/assignments.controller";
import { asyncHandler } from "../utils/asynchandler";

// Submissions accept any file type (PDF, source code, xlsx, docx, pptx, images,
// zip, etc.). Only the size ceiling is enforced here.
const assignmentSubmitUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router: Router = Router();

router.get("/", asyncHandler(assignmentsController.listAssignments));
router.get("/:id/submission", asyncHandler(assignmentsController.getSubmission));
router.get("/:id/progress", asyncHandler(assignmentsController.getProgress));
router.get("/:id/pdf", asyncHandler(assignmentsController.streamAssignmentPdf));
router.get("/:id", asyncHandler(assignmentsController.getAssignmentDetail));
router.post(
  "/:id/submit",
  assignmentSubmitUpload.single("file"),
  asyncHandler(assignmentsController.submitAssignment)
);
router.post("/:id/mark-complete", asyncHandler(assignmentsController.markComplete));
router.post("/:id/mark-incomplete", asyncHandler(assignmentsController.markIncomplete));

export default router;
