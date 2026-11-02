import { Router } from "express";
import multer from "multer";
import {
  listQuestions,
  getQuestion,
  getQuestionsByIds,
  createQuestion,
  bulkCreateQuestions,
  importQuestionsDocx,
  importQuestionsDocxAI,
  importQuestionsFileAI,
  seedQuestionDescriptions,
  italicizeQuestionTitles,
  downloadQuestionsDocxTemplate,
  randomPickQuestions,
  updateQuestion,
  deleteQuestion,
  bulkUpdateStatus,
} from "../controllers/test-questions.controller";
import { DOCX_IMPORT_MAX_FILE_BYTES } from "../services/test-question-docx.parser";
import {
  getQuestionInventory,
  importQuestionsIntoBank,
} from "../controllers/exam-workflows.controller";
import {
  submitGeneration as submitAIGeneration,
  getGenerationStatus as getAIGenerationStatus,
  getUploadUrl as getAIGenerateUploadUrl,
} from "../controllers/test-ai.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requireAiAuthoring } from "../middlewares/ai-authoring.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const testQuestionsRouter: Router = Router();

const docxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCX_IMPORT_MAX_FILE_BYTES },
});

testQuestionsRouter.use(asyncHandler(authenticateTenantUser));

// Composite endpoints: one call for a whole job. Must precede :questionId.
// "What have I got to build papers out of?" in one answer rather than a bank
// list plus a count query per bank per difficulty.
testQuestionsRouter.get(
  "/inventory",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getQuestionInventory)
);
// "Add these questions to the physics bank": resolves or creates the bank by
// name and imports in one request, so a near miss on the name is not a dead end.
testQuestionsRouter.post(
  "/import",
  asyncHandler(requirePermission("tests.import")),
  asyncHandler(importQuestionsIntoBank)
);

// AI generation endpoints (must come before :questionId param routes)
// The PDF is uploaded directly to S3 via a presigned URL, the submit call
// is JSON-only, so no multer middleware is needed here.
testQuestionsRouter.get(
  "/banks/:bankId/ai-generate/upload-url",
  asyncHandler(requirePermission("tests.ai_generate")),
  asyncHandler(getAIGenerateUploadUrl)
);
testQuestionsRouter.post(
  "/banks/:bankId/ai-generate",
  asyncHandler(requirePermission("tests.ai_generate")),
  asyncHandler(requireAiAuthoring),
  asyncHandler(submitAIGeneration)
);
testQuestionsRouter.get(
  "/ai/status/:jobId",
  asyncHandler(requirePermission("tests.ai_generate")),
  asyncHandler(getAIGenerationStatus)
);

// Bulk operations (must come before :questionId)
testQuestionsRouter.post(
  "/banks/:bankId/bulk-import",
  asyncHandler(requirePermission("tests.import")),
  asyncHandler(bulkCreateQuestions)
);
// Word (.docx) import: same template format renders to the SAT question shape.
testQuestionsRouter.get(
  "/import/docx-template",
  asyncHandler(requirePermission("tests.import")),
  asyncHandler(downloadQuestionsDocxTemplate)
);
testQuestionsRouter.post(
  "/banks/:bankId/import-docx",
  asyncHandler(requirePermission("tests.import")),
  docxUpload.single("file"),
  asyncHandler(importQuestionsDocx)
);
// AI-powered import for arbitrary (non-template) question docs, extracts text
// + math and structures it with the AI model.
testQuestionsRouter.post(
  "/banks/:bankId/import-docx-ai",
  asyncHandler(requirePermission("tests.import")),
  docxUpload.single("file"),
  asyncHandler(importQuestionsDocxAI)
);
// Multi-format AI import: Word / PDF / Excel / CSV → the AI model → questions.
testQuestionsRouter.post(
  "/banks/:bankId/import-ai",
  asyncHandler(requirePermission("tests.import")),
  docxUpload.single("file"),
  asyncHandler(importQuestionsFileAI)
);
testQuestionsRouter.post(
  "/bulk-status",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(bulkUpdateStatus)
);
// AI-seed reference "descriptions" (context/passage) onto existing questions.
// Idempotent + resumable, call repeatedly with a modest `limit` until
// `remaining` is 0. Treated as an import-class AI write.
testQuestionsRouter.post(
  "/seed-descriptions",
  asyncHandler(requirePermission("tests.import")),
  asyncHandler(seedQuestionDescriptions)
);
// AI-italicize long-work titles (books/plays/films…) in R&W stems; author
// names left plain. Idempotent + resumable; `dry_run: true` previews samples
// without writing. Import-class AI write.
testQuestionsRouter.post(
  "/italicize-titles",
  asyncHandler(requirePermission("tests.import")),
  asyncHandler(italicizeQuestionTitles)
);
testQuestionsRouter.post(
  "/by-ids",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getQuestionsByIds)
);
// Random pick for test composition: read-only, like /by-ids.
testQuestionsRouter.post(
  "/random-pick",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(randomPickQuestions)
);

// CRUD
testQuestionsRouter.get(
  "/",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listQuestions)
);
testQuestionsRouter.post(
  "/",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createQuestion)
);
testQuestionsRouter.get(
  "/:questionId",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getQuestion)
);
testQuestionsRouter.put(
  "/:questionId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateQuestion)
);
testQuestionsRouter.delete(
  "/:questionId",
  asyncHandler(requirePermission("tests.delete")),
  asyncHandler(deleteQuestion)
);

export default testQuestionsRouter;
