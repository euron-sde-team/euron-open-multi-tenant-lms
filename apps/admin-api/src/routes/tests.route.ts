import { Router } from "express";
import {
  listTests,
  getTest,
  getTestFull,
  createTest,
  createTestFull,
  updateTest,
  deleteTest,
  listTestAttempts,
  listTestLearners,
  listLearnerAttempts,
  getAttemptReview,
  getTestAnalytics,
  exportTestAnalytics,
  publishTest,
  unpublishTest,
  listSections,
  createSection,
  updateSection,
  deleteSection,
  addSectionQuestions,
  removeSectionQuestion,
  reorderSectionQuestions,
} from "../controllers/tests.controller";
import {
  listTestModules,
  createTestModule,
  updateTestModule,
  deleteTestModule,
  addModuleQuestions,
  updateModuleQuestion,
  removeModuleQuestion,
  saveScoreScales,
  autoGenerateScoreScales,
  saveNormTable,
  autoGenerateNormTable,
} from "../controllers/test-modules.controller";
import { getAdaptiveHealth } from "../controllers/test-health.controller";
import { getTestResults } from "../controllers/exam-workflows.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const testsRouter: Router = Router();

testsRouter.use(asyncHandler(authenticateTenantUser));

// Learner-first views, and one attempt replayed question by question.
// Declared before the "/:testId" patterns so the literal prefixes always win.
testsRouter.get(
  "/learners",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listTestLearners)
);
testsRouter.get(
  "/learners/:learnerId/attempts",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listLearnerAttempts)
);
testsRouter.get(
  "/attempts/:attemptId/review",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getAttemptReview)
);

// Tests CRUD
testsRouter.get("/", asyncHandler(requirePermission("tests.view")), asyncHandler(listTests));
testsRouter.post(
  "/",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createTest)
);
testsRouter.post(
  "/full",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createTestFull)
);
testsRouter.get(
  "/:testId/full",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getTestFull)
);
testsRouter.get(
  "/:testId/attempts",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listTestAttempts)
);
testsRouter.get(
  "/:testId/analytics",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getTestAnalytics)
);
// "How did test 3 go, and who scored below forty percent?" in one answer:
// the numbers and the attempts behind them, filtered the way it was asked.
testsRouter.get(
  "/:testId/results",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getTestResults)
);
testsRouter.get(
  "/:testId/analytics-export",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(exportTestAnalytics)
);
testsRouter.get(
  "/:testId",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getTest)
);
testsRouter.put(
  "/:testId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateTest)
);
testsRouter.delete(
  "/:testId",
  asyncHandler(requirePermission("tests.delete")),
  asyncHandler(deleteTest)
);
testsRouter.post(
  "/:testId/publish",
  asyncHandler(requirePermission("tests.publish")),
  asyncHandler(publishTest)
);
testsRouter.post(
  "/:testId/unpublish",
  asyncHandler(requirePermission("tests.publish")),
  asyncHandler(unpublishTest)
);

// Sections
testsRouter.get(
  "/:testId/sections",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listSections)
);
testsRouter.post(
  "/:testId/sections",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createSection)
);
testsRouter.put(
  "/:testId/sections/:sectionId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateSection)
);
testsRouter.delete(
  "/:testId/sections/:sectionId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(deleteSection)
);

// Adaptive modules (mode = ADAPTIVE tests only)
testsRouter.get(
  "/:testId/adaptive-health",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getAdaptiveHealth)
);
testsRouter.get(
  "/:testId/modules",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listTestModules)
);
testsRouter.post(
  "/:testId/sections/:sectionId/modules",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createTestModule)
);
testsRouter.put(
  "/:testId/modules/:moduleId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateTestModule)
);
testsRouter.delete(
  "/:testId/modules/:moduleId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(deleteTestModule)
);
testsRouter.post(
  "/:testId/modules/:moduleId/questions",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(addModuleQuestions)
);
testsRouter.put(
  "/:testId/modules/:moduleId/questions/:questionId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateModuleQuestion)
);
testsRouter.delete(
  "/:testId/modules/:moduleId/questions/:questionId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(removeModuleQuestion)
);
testsRouter.put(
  "/:testId/sections/:sectionId/score-scales",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(saveScoreScales)
);
testsRouter.post(
  "/:testId/sections/:sectionId/score-scales/auto-generate",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(autoGenerateScoreScales)
);
testsRouter.put(
  "/:testId/norm-table",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(saveNormTable)
);
testsRouter.post(
  "/:testId/norm-table/auto-generate",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(autoGenerateNormTable)
);

// Section questions
testsRouter.post(
  "/:testId/sections/:sectionId/questions",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(addSectionQuestions)
);
testsRouter.delete(
  "/:testId/sections/:sectionId/questions/:questionId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(removeSectionQuestion)
);
testsRouter.post(
  "/:testId/sections/:sectionId/questions/reorder",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(reorderSectionQuestions)
);

export default testsRouter;
