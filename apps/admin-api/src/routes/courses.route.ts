import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import {
  findReviewsByCourseId,
  getCourseRatingSummary,
} from "../repositories/course-reviews.repository";
import {
  listCourses,
  getCourse,
  getCourseBySlug,
  getCourseFull,
  syncCurriculum,
  createCourse,
  updateCourse,
  togglePublishCourse,
  deleteCourse,
  downloadCourseAnalyticsXlsx,
  listSections,
  getSection,
  createSection,
  updateSection,
  deleteSection,
  bulkAttachVideos,
  reorderSections,
  reorderLessonsInSection,
  moveLesson,
  listLessons,
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  getLecture,
  createLecture,
  updateLecture,
  getQuiz,
  createQuiz,
  listQuizQuestions,
  createQuizQuestion,
  createQuizOption,
  updateQuizQuestion,
  deleteQuizQuestion,
  updateQuizOption,
  deleteQuizOption,
  importQuizQuestions,
  importQuizQuestionsFromBank,
  getAssignment,
  createAssignment,
  syncFaqs,
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  syncRecommendations,
  listRecommendations,
  listCourseInstructors,
  syncCourseInstructors,
  listEligibleBatches,
} from "../controllers/courses.controller";
// Content-product-link gating disabled, routes commented out
// import {
//   listCourseLinkedProducts,
//   setCourseLinkedProducts,
// } from "../controllers/content-product-links.controller";
import {
  listLessonResources,
  createLessonResource,
  updateLessonResource,
  deleteLessonResource,
} from "../controllers/lesson-resources.controller";
import {
  addCurriculum,
  arrangeCurriculum,
  getCurriculumOutline,
  publishCurriculumToPage,
  updateCurriculumItem,
} from "../controllers/curriculum-authoring.controller";
import * as courseAIController from "../controllers/course-ai.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requireAiAuthoring } from "../middlewares/ai-authoring.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  getSequenceSettings,
  updateSequenceSettings,
  getChain,
  getSequence,
  getSuccessors,
  setPrerequisite,
  saveSequence,
} from "../controllers/course-sequence.controller";
import { asyncHandler } from "../utils/asynchandler";
import { NotFoundError } from "../errors/not-found.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { QUIZ_IMPORT_MAX_FILE_BYTES } from "../services/quiz-import.parser";

function getTenantId(req: Request): string {
  const tenantId = (req as Request & { tenantId?: string }).tenantId;
  if (!tenantId) throw new Error("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return (value as string) ?? "";
}

async function getCourseReviews(req: Request, res: Response, _next: NextFunction) {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new NotFoundError("Course ID is required");
  const reviews = await findReviewsByCourseId(tenantId, courseId, { showHidden: false });
  const summary = await getCourseRatingSummary(tenantId, courseId);
  sendSuccessResponse({
    res,
    data: { reviews, summary: { average: summary.averageRating, count: summary.totalRatings } },
    statusCode: HttpSuccessStatus.OK,
    message: "Reviews retrieved successfully",
  });
}

const coursesRouter: Router = Router();

coursesRouter.use(asyncHandler(authenticateTenantUser));

const questionCsvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: QUIZ_IMPORT_MAX_FILE_BYTES },
});

// AI Course Content Generation (must be before :courseId to avoid "ai" being parsed as courseId)
coursesRouter.post("/ai/generate", asyncHandler(requirePermission("courses.create")), asyncHandler(requireAiAuthoring), asyncHandler(courseAIController.submitGeneration));
coursesRouter.get("/ai/status/:jobId", asyncHandler(requirePermission("courses.create")), asyncHandler(courseAIController.getGenerationStatus));

// Course CRUD (by-slug must be before :courseId)
coursesRouter.get("/by-slug/:slug", asyncHandler(requirePermission("courses.view")), asyncHandler(getCourseBySlug));
coursesRouter.get("/", asyncHandler(requirePermission("courses.view")), asyncHandler(listCourses));
coursesRouter.post("/", asyncHandler(requirePermission("courses.create")), asyncHandler(createCourse));
coursesRouter.get("/:courseId/full", asyncHandler(requirePermission("courses.view")), asyncHandler(getCourseFull));
coursesRouter.get("/:courseId/reviews", asyncHandler(requirePermission("courses.view")), asyncHandler(getCourseReviews));
coursesRouter.put("/:courseId/curriculum", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(syncCurriculum));
// SEQUENTIAL COURSES, the tenant-wide master switch.
//
// MUST be registered before ANY "/:courseId" route (Express matches top-to-
// bottom). Otherwise PUT /sequence-settings hits PUT /:courseId first with
// courseId="sequence-settings" → updateCourse → "Course not found".
coursesRouter.get(
  "/sequence-settings",
  asyncHandler(requirePermission("courses.view")),
  asyncHandler(getSequenceSettings)
);
coursesRouter.put(
  "/sequence-settings",
  asyncHandler(requirePermission("courses.update")),
  asyncHandler(updateSequenceSettings)
);

// The whole ordered chain (tenant-wide sequence builder). Course-agnostic, so
// it lives here with sequence-settings, ABOVE every /:courseId route.
coursesRouter.get(
  "/sequence",
  asyncHandler(requirePermission("courses.view")),
  asyncHandler(getChain)
);
coursesRouter.put(
  "/sequence",
  asyncHandler(requirePermission("courses.update")),
  asyncHandler(saveSequence)
);

coursesRouter.get("/:courseId", asyncHandler(requirePermission("courses.view")), asyncHandler(getCourse));
coursesRouter.put("/:courseId", asyncHandler(requirePermission("courses.update")), asyncHandler(updateCourse));

// ---------------------------------------------------------------------------
// SEQUENTIAL COURSES
//
// A course can require another to be finished first (A → B → C). Setting a
// prerequisite says what a course waits for; the master switch above decides whether any of it is enforced; clearing it is the off-switch. There is no
// separate feature flag, a second source of truth could disagree with this one.
//
// Gated on courses.update: deciding what a learner must finish before they can
// start something is editing the course, not a new kind of power.
// ---------------------------------------------------------------------------
coursesRouter.get("/:courseId/sequence", asyncHandler(requirePermission("courses.view")), asyncHandler(getSequence));
coursesRouter.get("/:courseId/unlocks", asyncHandler(requirePermission("courses.view")), asyncHandler(getSuccessors));
coursesRouter.put("/:courseId/prerequisite", asyncHandler(requirePermission("courses.update")), asyncHandler(setPrerequisite));
coursesRouter.put("/:courseId/sequence", asyncHandler(requirePermission("courses.update")), asyncHandler(saveSequence));
coursesRouter.post("/:courseId/toggle-publish", asyncHandler(requirePermission("courses.publish")), asyncHandler(togglePublishCourse));
coursesRouter.get("/:courseId/analytics-export.xlsx", asyncHandler(requirePermission("courses.view")), asyncHandler(downloadCourseAnalyticsXlsx));
coursesRouter.delete("/:courseId", asyncHandler(requirePermission("courses.delete")), asyncHandler(deleteCourse));

// ---------------------------------------------------------------------------
// CURRICULUM AS A WHOLE JOB
//
// The section/lesson routes below are shaped for the editor screen, which holds
// the entire tree in memory: reordering wants every sibling id, moving a lesson
// wants two complete lists, and building a module is one call per lesson. These
// five do the same work in the shape a person describes it, so a caller without
// the tree in front of them can still get it right. See
// src/services/curriculum-authoring.service.ts for why that matters.
//
// Registered above "/:courseId/sections/..." only for readability; the paths do
// not overlap.
// ---------------------------------------------------------------------------
coursesRouter.get(
  "/:courseId/curriculum-outline",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(getCurriculumOutline)
);
coursesRouter.post(
  "/:courseId/curriculum/modules",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(addCurriculum)
);
coursesRouter.patch(
  "/:courseId/curriculum/items/:itemId",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(updateCurriculumItem)
);
coursesRouter.put(
  "/:courseId/curriculum/arrange",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(arrangeCurriculum)
);
// Writes tenant_pages, which is why it asks for the page permission too: the
// whole point of the route is that it changes what a VISITOR sees, and the
// person doing it should be someone allowed to edit pages.
coursesRouter.post(
  "/:courseId/curriculum/publish-to-page",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(requirePermission("pages.update")),
  asyncHandler(publishCurriculumToPage)
);

// Sections (nested under course)
// IMPORTANT: bulk reorder routes must be registered BEFORE the :sectionId / :lessonId
// parameterized routes; Express matches in registration order, otherwise "reorder"
// and "move" would be captured as a sectionId / lessonId param.
coursesRouter.put(
  "/:courseId/sections/reorder",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(reorderSections)
);
coursesRouter.put(
  "/:courseId/sections/:sectionId/lessons/reorder",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(reorderLessonsInSection)
);
coursesRouter.put(
  "/:courseId/lessons/move",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(moveLesson)
);

// A whole upload dump into curriculum in one request, one lesson per video,
// in order. The loop lives server-side so 100 videos is one call, one
// approval, one verifiable result.
coursesRouter.post(
  "/:courseId/videos/bulk-attach",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(bulkAttachVideos)
);

coursesRouter.get("/:courseId/sections", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(listSections));
coursesRouter.post("/:courseId/sections", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(createSection));
coursesRouter.get("/:courseId/sections/:sectionId", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(getSection));
coursesRouter.put("/:courseId/sections/:sectionId", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(updateSection));
coursesRouter.delete("/:courseId/sections/:sectionId", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(deleteSection));

// Lessons (list/create under section; get/update/delete by lessonId)
coursesRouter.get(
  "/:courseId/sections/:sectionId/lessons",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(listLessons)
);
coursesRouter.post(
  "/:courseId/sections/:sectionId/lessons",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(createLesson)
);
coursesRouter.get("/:courseId/lessons/:lessonId", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(getLesson));
coursesRouter.put("/:courseId/lessons/:lessonId", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(updateLesson));
coursesRouter.delete("/:courseId/lessons/:lessonId", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(deleteLesson));

// Lecture (one per lesson)
coursesRouter.get(
  "/:courseId/lessons/:lessonId/lecture",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(getLecture)
);
coursesRouter.post(
  "/:courseId/lessons/:lessonId/lecture",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(createLecture)
);
coursesRouter.put(
  "/:courseId/lessons/:lessonId/lecture",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(updateLecture)
);

// Lesson resources (PDF/LINK/TEXT/IMAGE/GITHUB attachments per lesson)
coursesRouter.get(
  "/:courseId/lessons/:lessonId/resources",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(listLessonResources)
);
coursesRouter.post(
  "/:courseId/lessons/:lessonId/resources",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(createLessonResource)
);
coursesRouter.patch(
  "/:courseId/lessons/:lessonId/resources/:resourceId",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(updateLessonResource)
);
coursesRouter.delete(
  "/:courseId/lessons/:lessonId/resources/:resourceId",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(deleteLessonResource)
);

// Quiz (one per lesson)
coursesRouter.get(
  "/:courseId/lessons/:lessonId/quiz",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(getQuiz)
);
coursesRouter.post(
  "/:courseId/lessons/:lessonId/quiz",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(createQuiz)
);

// Quiz questions (under quiz)
coursesRouter.get(
  "/:courseId/quizzes/:quizId/questions",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(listQuizQuestions)
);
coursesRouter.post(
  "/:courseId/quizzes/:quizId/questions",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(createQuizQuestion)
);
coursesRouter.post(
  "/:courseId/quizzes/:quizId/questions/import",
  asyncHandler(requirePermission("courses.lms.manage")),
  questionCsvUpload.single("file"),
  asyncHandler(importQuizQuestions)
);
coursesRouter.post(
  "/:courseId/quizzes/:quizId/import-from-bank",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(importQuizQuestionsFromBank)
);
coursesRouter.patch(
  "/:courseId/quizzes/:quizId/questions/:questionId",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(updateQuizQuestion)
);
coursesRouter.delete(
  "/:courseId/quizzes/:quizId/questions/:questionId",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(deleteQuizQuestion)
);
coursesRouter.post(
  "/:courseId/questions/:questionId/options",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(createQuizOption)
);
coursesRouter.patch(
  "/:courseId/questions/:questionId/options/:optionId",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(updateQuizOption)
);
coursesRouter.delete(
  "/:courseId/questions/:questionId/options/:optionId",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(deleteQuizOption)
);

// Assignment (one per lesson)
coursesRouter.get(
  "/:courseId/lessons/:lessonId/assignment",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(getAssignment)
);
coursesRouter.post(
  "/:courseId/lessons/:lessonId/assignment",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(createAssignment)
);

// Content-Product Links, disabled (content-product-link gating removed)
// coursesRouter.get("/:courseId/linked-products", asyncHandler(requirePermission('courses.view')), asyncHandler(listCourseLinkedProducts));
// coursesRouter.put("/:courseId/linked-products", asyncHandler(requirePermission('courses.lms.manage')), asyncHandler(setCourseLinkedProducts));

// Course FAQs
coursesRouter.put("/:courseId/faqs/sync", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(syncFaqs));
coursesRouter.get("/:courseId/faqs", asyncHandler(requirePermission("courses.view")), asyncHandler(listFaqs));

// Course Recommendations
coursesRouter.put("/:courseId/recommendations/sync", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(syncRecommendations));
coursesRouter.get("/:courseId/recommendations", asyncHandler(requirePermission("courses.view")), asyncHandler(listRecommendations));

// Course Instructors
coursesRouter.get("/:courseId/instructors", asyncHandler(requirePermission("courses.view")), asyncHandler(listCourseInstructors));
coursesRouter.put("/:courseId/instructors/sync", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(syncCourseInstructors));
coursesRouter.post("/:courseId/faqs", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(createFaq));
coursesRouter.put("/:courseId/faqs/:faqId", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(updateFaq));
coursesRouter.delete("/:courseId/faqs/:faqId", asyncHandler(requirePermission("courses.lms.manage")), asyncHandler(deleteFaq));

coursesRouter.get(
  "/:courseId/eligible-batches",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(listEligibleBatches)
);

export default coursesRouter;
