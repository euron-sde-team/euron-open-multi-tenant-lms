import { Request, Response } from "express";
import courseAnalyticsExportService from "../services/course-analytics-export.service";
import coursesService from "../services/courses.service";
import courseLmsService from "../services/course-lms.service";
import { db } from "../db/connection";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

/** Safely extract a single route param as string (Express 5 types params as string | string[]). */
function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// --- Courses ---
export const listCourses = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
  const status = req.query.status as string | undefined;
  const mode = req.query.mode as string | undefined;
  const course_type = req.query.course_type as string | undefined;
  const search = req.query.search as string | undefined;
  const result = await coursesService.getCourses(tenantId, {
    page,
    limit,
    status,
    mode,
    course_type,
    search,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Courses retrieved successfully",
  });
};

export const getCourse = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const course = await coursesService.getCourseById(courseId, tenantId);
  sendSuccessResponse({
    res,
    data: course,
    statusCode: HttpSuccessStatus.OK,
    message: "Course retrieved successfully",
  });
};

/**
 * Get course plus full LMS tree (sections, lessons, lecture/quiz/assignment per lesson) and FAQs.
 * Single request for editor load.
 */
export const getCourseFull = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const [course, tree, faqs] = await Promise.all([
    coursesService.getCourseById(courseId, tenantId),
    courseLmsService.getCourseFullTree(tenantId, courseId),
    courseLmsService.getFaqs(tenantId, courseId),
  ]);
  sendSuccessResponse({
    res,
    data: { course, sections: tree.sections, faqs },
    statusCode: HttpSuccessStatus.OK,
    message: "Course with full tree retrieved successfully",
  });
};

/**
 * Bulk-replace the entire curriculum (sections + lessons + lectures) in one request.
 * PUT /tenant/courses/:courseId/curriculum
 * Body: { sections: [...], lms_template_id?: string, lms_settings?: object }
 */
export const syncCurriculum = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const { sections, lms_template_id, lms_settings } = req.body;
  if (!Array.isArray(sections)) {
    throw new BadRequestError("sections array is required");
  }
  const tree = await courseLmsService.syncCurriculum(
    tenantId,
    courseId,
    sections,
    lms_template_id ?? null,
    lms_settings ?? null
  );
  sendSuccessResponse({
    res,
    data: tree,
    statusCode: HttpSuccessStatus.OK,
    message: "Curriculum synced successfully",
  });
};

/**
 * Get course by slug (for editor: resolve page slug -> LMS course).
 * Returns 200 with course or 404 if not found.
 */
export const getCourseBySlug = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const slug = decodeURIComponent(param(req, "slug") || "");
  if (!slug) {
    throw new BadRequestError("Slug is required");
  }
  const course = await coursesService.getCourseBySlug(tenantId, slug);
  if (!course) {
    throw new NotFoundError("Course not found for this slug");
  }
  sendSuccessResponse({
    res,
    data: course,
    statusCode: HttpSuccessStatus.OK,
    message: "Course retrieved successfully",
  });
};

export const createCourse = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const body = req.body;
  if (!body?.title || !body?.slug) {
    throw new BadRequestError("title and slug are required");
  }
  const course = await coursesService.createCourse(tenantId, {
    title: body.title,
    slug: body.slug,
    subtitle: body.subtitle,
    description: body.description,
    price_inr: body.price_inr,
    price_usd: body.price_usd,
    discount_inr: body.discount_inr,
    discount_usd: body.discount_usd,
    prices: body.prices,
    purchase_mode: body.purchase_mode,
    status: body.status,
    mode: body.mode,
    difficulty: body.difficulty,
    course_type: body.course_type,
    language: body.language,
    thumbnail_key: body.thumbnail_key,
    secondary_thumbnail_key: body.secondary_thumbnail_key,
    preview_key: body.preview_key,
    duration: body.duration,
    learning_outcomes: body.learning_outcomes,
    prerequisites: body.prerequisites,
    class_timing: body.class_timing,
    start_date: body.start_date,
    sort_order: body.sort_order,
    validity_days: body.validity_days,
  });
  sendSuccessResponse({
    res,
    data: course,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Course created successfully",
  });
};

export const updateCourse = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const body = req.body;
  const course = await coursesService.updateCourse(courseId, tenantId, {
    title: body.title,
    slug: body.slug,
    subtitle: body.subtitle,
    description: body.description,
    price_inr: body.price_inr,
    price_usd: body.price_usd,
    discount_inr: body.discount_inr,
    discount_usd: body.discount_usd,
    prices: body.prices,
    purchase_mode: body.purchase_mode,
    status: body.status,
    mode: body.mode,
    difficulty: body.difficulty,
    course_type: body.course_type,
    language: body.language,
    thumbnail_key: body.thumbnail_key,
    secondary_thumbnail_key: body.secondary_thumbnail_key,
    preview_key: body.preview_key,
    duration: body.duration,
    learning_outcomes: body.learning_outcomes,
    prerequisites: body.prerequisites,
    class_timing: body.class_timing,
    start_date: body.start_date,
    sort_order: body.sort_order,
    validity_days: body.validity_days,
    lms_template_id: body.lms_template_id,
    lms_settings: body.lms_settings,
    category_ids: body.category_ids,
  });
  sendSuccessResponse({
    res,
    data: course,
    statusCode: HttpSuccessStatus.OK,
    message: "Course updated successfully",
  });
};

export const togglePublishCourse = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const { publish } = req.body;
  if (typeof publish !== "boolean") {
    throw new BadRequestError("publish (boolean) is required");
  }
  const course = await coursesService.togglePublish(courseId, tenantId, publish);
  sendSuccessResponse({
    res,
    data: course,
    statusCode: HttpSuccessStatus.OK,
    message: publish ? "Course published successfully" : "Course unpublished successfully",
  });
};

export const deleteCourse = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  await coursesService.deleteCourse(courseId, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Course deleted successfully",
  });
};

// --- Sections ---
export const listSections = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const sections = await courseLmsService.getSections(tenantId, courseId);
  sendSuccessResponse({
    res,
    data: sections,
    statusCode: HttpSuccessStatus.OK,
    message: "Sections retrieved successfully",
  });
};

export const getSection = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const sectionId = param(req, "sectionId");
  const section = await courseLmsService.getSection(sectionId, tenantId);
  sendSuccessResponse({
    res,
    data: section,
    statusCode: HttpSuccessStatus.OK,
    message: "Section retrieved successfully",
  });
};

export const createSection = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const { title, sort_order } = req.body;
  if (!title) throw new BadRequestError("title is required");
  const section = await courseLmsService.createSection(tenantId, courseId, {
    title,
    sort_order,
  });
  sendSuccessResponse({
    res,
    data: section,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Section created successfully",
  });
};

/**
 * POST /tenant/courses/:courseId/videos/bulk-attach
 * Body: { section_id?, section_title?, items: [{ video_id, title? }] }
 *
 * A whole upload dump into curriculum in one request, one lesson per video,
 * in the order given. The loop lives server-side so a hundred videos is one
 * call, one approval, one result.
 */
export const bulkAttachVideos = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const { section_id, section_title, items } = (req.body ?? {}) as {
    section_id?: string;
    section_title?: string;
    items?: Array<{ video_id: string; title?: string }>;
  };
  if (!Array.isArray(items) || items.length === 0) {
    throw new BadRequestError("items is required");
  }
  const result = await courseLmsService.bulkAttachVideos(tenantId, courseId, {
    section_id,
    section_title,
    items,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: `Attached ${result.attachedCount} of ${items.length} video(s) as lessons`,
  });
};

export const updateSection = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const sectionId = param(req, "sectionId");
  const { title, sort_order } = req.body;
  const section = await courseLmsService.updateSection(sectionId, tenantId, {
    title,
    sort_order,
  });
  sendSuccessResponse({
    res,
    data: section,
    statusCode: HttpSuccessStatus.OK,
    message: "Section updated successfully",
  });
};

export const deleteSection = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const sectionId = param(req, "sectionId");
  await courseLmsService.deleteSection(sectionId, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Section deleted successfully",
  });
};

/**
 * Bulk reorder all sections of a course in one transaction.
 * PUT /tenant/courses/:courseId/sections/reorder
 * Body: { section_ids: string[] }
 * Returns: { updated, sections: [{ id, sort_order }] }
 * 409 STALE_CURRICULUM if section_ids doesn't match current sibling set.
 */
export const reorderSections = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const { section_ids } = req.body;
  const result = await courseLmsService.reorderSections(
    tenantId,
    courseId,
    section_ids
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Sections reordered successfully",
  });
};

/**
 * Bulk reorder all lessons within a single section.
 * PUT /tenant/courses/:courseId/sections/:sectionId/lessons/reorder
 * Body: { lesson_ids: string[] }
 * Returns: { updated, lessons: [{ id, section_id, sort_order }] }
 * 409 STALE_CURRICULUM if lesson_ids doesn't match current sibling set.
 */
export const reorderLessonsInSection = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const sectionId = param(req, "sectionId");
  const { lesson_ids } = req.body;
  const result = await courseLmsService.reorderLessonsInSection(
    tenantId,
    courseId,
    sectionId,
    lesson_ids
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Lessons reordered successfully",
  });
};

/**
 * Cross-section lesson move (also resequences source + target in one trx).
 * PUT /tenant/courses/:courseId/lessons/move
 * Body: {
 *   lesson_id: string,
 *   source_section_id: string,
 *   target_section_id: string,
 *   source_lesson_ids: string[],   // new source order, EXCLUDING moved lesson
 *   target_lesson_ids: string[]    // new target order, INCLUDING moved lesson
 * }
 * 400 if source === target (use the reorder endpoint instead).
 * 409 STALE_CURRICULUM if either sibling set doesn't match the request.
 */
export const moveLesson = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const {
    lesson_id,
    source_section_id,
    target_section_id,
    source_lesson_ids,
    target_lesson_ids,
  } = req.body;
  const result = await courseLmsService.moveLesson(tenantId, courseId, {
    lessonId: lesson_id,
    sourceSectionId: source_section_id,
    targetSectionId: target_section_id,
    sourceLessonIds: source_lesson_ids,
    targetLessonIds: target_lesson_ids,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Lesson moved successfully",
  });
};

// --- Lessons ---
export const listLessons = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const sectionId = param(req, "sectionId");
  const lessons = await courseLmsService.getLessons(tenantId, sectionId);
  sendSuccessResponse({
    res,
    data: lessons,
    statusCode: HttpSuccessStatus.OK,
    message: "Lessons retrieved successfully",
  });
};

export const getLesson = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const lessonId = param(req, "lessonId");
  const lesson = await courseLmsService.getLesson(lessonId, tenantId);
  sendSuccessResponse({
    res,
    data: lesson,
    statusCode: HttpSuccessStatus.OK,
    message: "Lesson retrieved successfully",
  });
};

export const createLesson = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const sectionId = param(req, "sectionId");
  const { title, type, sort_order, is_preview } = req.body;
  if (!title || !type) throw new BadRequestError("title and type are required");
  const lesson = await courseLmsService.createLesson(
    tenantId,
    courseId,
    sectionId,
    { title, type, sort_order, is_preview }
  );
  sendSuccessResponse({
    res,
    data: lesson,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Lesson created successfully",
  });
};

export const updateLesson = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const lessonId = param(req, "lessonId");
  const { title, type, sort_order, is_preview } = req.body;
  const lesson = await courseLmsService.updateLesson(lessonId, tenantId, {
    title,
    type,
    sort_order,
    is_preview,
  });
  sendSuccessResponse({
    res,
    data: lesson,
    statusCode: HttpSuccessStatus.OK,
    message: "Lesson updated successfully",
  });
};

export const deleteLesson = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const lessonId = param(req, "lessonId");
  await courseLmsService.deleteLesson(lessonId, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Lesson deleted successfully",
  });
};

// --- Lectures ---
export const getLecture = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const lessonId = param(req, "lessonId");
  const lecture = await courseLmsService.getLecture(tenantId, lessonId);
  sendSuccessResponse({
    res,
    data: lecture,
    statusCode: HttpSuccessStatus.OK,
    message: "Lecture retrieved successfully",
  });
};

export const createLecture = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  const { title, video_key, video_provider, duration, resource_links, summary } = req.body;
  if (!title) throw new BadRequestError("title is required");
  const lecture = await courseLmsService.createLecture(
    tenantId,
    courseId,
    lessonId,
    { title, video_key, video_provider, duration, resource_links, summary }
  );
  sendSuccessResponse({
    res,
    data: lecture,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Lecture created successfully",
  });
};

export const updateLecture = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  const { title, video_key, video_provider, duration, resource_links, summary } = req.body;
  const lecture = await courseLmsService.updateLecture(
    tenantId,
    courseId,
    lessonId,
    { title, video_key, video_provider, duration, resource_links, summary }
  );
  sendSuccessResponse({
    res,
    data: lecture,
    statusCode: HttpSuccessStatus.OK,
    message: "Lecture updated successfully",
  });
};

// --- Quizzes ---
export const getQuiz = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const lessonId = param(req, "lessonId");
  const quiz = await courseLmsService.getQuiz(tenantId, lessonId);
  sendSuccessResponse({
    res,
    data: quiz,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz retrieved successfully",
  });
};

export const createQuiz = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  const { title } = req.body;
  if (!title) throw new BadRequestError("title is required");
  const quiz = await courseLmsService.createQuiz(
    tenantId,
    courseId,
    lessonId,
    { title }
  );
  sendSuccessResponse({
    res,
    data: quiz,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Quiz created successfully",
  });
};

// --- Quiz questions ---
export const listQuizQuestions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const quizId = param(req, "quizId");
  const questions = await courseLmsService.getQuizQuestions(tenantId, quizId);
  sendSuccessResponse({
    res,
    data: questions,
    statusCode: HttpSuccessStatus.OK,
    message: "Quiz questions retrieved successfully",
  });
};

export const createQuizQuestion = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const quizId = param(req, "quizId");
  const { question, question_type, marks, sort_order } = req.body;
  if (!question) throw new BadRequestError("question is required");
  const q = await courseLmsService.createQuizQuestion(tenantId, quizId, {
    question,
    question_type,
    marks,
    sort_order,
  });
  sendSuccessResponse({
    res,
    data: q,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Quiz question created successfully",
  });
};

export const createQuizOption = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const questionId = param(req, "questionId");
  const { option_text, is_correct, blank_index, explanation, sort_order } =
    req.body;
  if (!option_text) throw new BadRequestError("option_text is required");
  const option = await courseLmsService.createQuizOption(tenantId, questionId, {
    option_text,
    is_correct,
    blank_index,
    explanation,
    sort_order,
  });
  sendSuccessResponse({
    res,
    data: option,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Quiz option created successfully",
  });
};

export const updateQuizQuestion = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const questionId = param(req, "questionId");
  const { question, question_type, marks, sort_order } = req.body;
  const updated = await courseLmsService.updateQuizQuestion(tenantId, questionId, {
    question,
    question_type,
    marks,
    sort_order,
  });
  sendSuccessResponse({
    res,
    data: updated,
    statusCode: HttpSuccessStatus.OK,
    message: "Question updated successfully",
  });
};

export const deleteQuizQuestion = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const questionId = param(req, "questionId");
  await courseLmsService.deleteQuizQuestion(tenantId, questionId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Question deleted successfully",
  });
};

export const updateQuizOption = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const optionId = param(req, "optionId");
  const { option_text, is_correct, blank_index, sort_order } = req.body;
  const updated = await courseLmsService.updateQuizOption(tenantId, optionId, {
    option_text,
    is_correct,
    blank_index,
    sort_order,
  });
  sendSuccessResponse({
    res,
    data: updated,
    statusCode: HttpSuccessStatus.OK,
    message: "Option updated successfully",
  });
};

export const deleteQuizOption = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const optionId = param(req, "optionId");
  await courseLmsService.deleteQuizOption(tenantId, optionId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Option deleted successfully",
  });
};

export const importQuizQuestions = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const quizId = param(req, "quizId");
  if (!req.file) {
    throw new BadRequestError(
      "File is required. Upload as multipart/form-data field 'file'."
    );
  }
  const result = await courseLmsService.importQuizQuestionsFromCsv(
    tenantId,
    courseId,
    quizId,
    {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    }
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: `${result.created} question(s) imported, ${result.skipped} duplicate(s) skipped`,
  });
};

export const importQuizQuestionsFromBank = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const quizId = param(req, "quizId");
  const { bank_id, question_ids, selection } = req.body ?? {};
  if (!bank_id) throw new BadRequestError("bank_id is required");
  const sel =
    selection && typeof selection === "object"
      ? {
          subject:
            typeof selection.subject === "string" ? selection.subject : undefined,
          chapter:
            typeof selection.chapter === "string" ? selection.chapter : undefined,
          topic:
            typeof selection.topic === "string" ? selection.topic : undefined,
          difficulty:
            typeof selection.difficulty === "string"
              ? selection.difficulty
              : undefined,
          count:
            typeof selection.count === "number" && selection.count > 0
              ? Math.floor(selection.count)
              : undefined,
        }
      : undefined;
  const result = await courseLmsService.importQuestionsFromTestBank(
    tenantId,
    courseId,
    quizId,
    bank_id,
    Array.isArray(question_ids) ? question_ids : undefined,
    sel
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: `${result.created} question(s) imported from bank`,
  });
};

// --- Assignments ---
export const getAssignment = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const lessonId = param(req, "lessonId");
  const assignment = await courseLmsService.getAssignment(tenantId, lessonId);
  sendSuccessResponse({
    res,
    data: assignment,
    statusCode: HttpSuccessStatus.OK,
    message: "Assignment retrieved successfully",
  });
};

export const createAssignment = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const lessonId = param(req, "lessonId");
  const { title, instructions, resource_links } = req.body;
  if (!title) throw new BadRequestError("title is required");
  const assignment = await courseLmsService.createAssignment(
    tenantId,
    courseId,
    lessonId,
    { title, instructions, resource_links }
  );
  sendSuccessResponse({
    res,
    data: assignment,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Assignment created successfully",
  });
};

/**
 * Bulk-replace all FAQs for a course in one request.
 * PUT /tenant/courses/:courseId/faqs/sync
 * Body: { faqs: Array<{ question, answer, sort_order }> }
 */
export const syncFaqs = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const { faqs } = req.body;
  if (!Array.isArray(faqs)) {
    throw new BadRequestError("faqs array is required");
  }
  const result = await courseLmsService.syncFaqs(tenantId, courseId, faqs);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "FAQs synced successfully",
  });
};

/**
 * Bulk-replace all course recommendations in one request.
 * PUT /tenant/courses/:courseId/recommendations/sync
 * Body: { recommendedCourseIds: string[] }
 */
export const syncRecommendations = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const { recommendedCourseIds } = req.body;
  if (!Array.isArray(recommendedCourseIds)) {
    throw new BadRequestError("recommendedCourseIds array is required");
  }
  const result = await courseLmsService.syncRecommendations(
    tenantId,
    courseId,
    recommendedCourseIds
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Course recommendations synced successfully",
  });
};

// --- Course Instructors ---
export const listCourseInstructors = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const instructors = await courseLmsService.getCourseInstructors(
    tenantId,
    courseId
  );
  sendSuccessResponse({
    res,
    data: instructors,
    statusCode: HttpSuccessStatus.OK,
    message: "Course instructors retrieved successfully",
  });
};

export const syncCourseInstructors = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const { instructorIds } = req.body;
  if (!Array.isArray(instructorIds)) {
    throw new BadRequestError("instructorIds array is required");
  }
  const result = await courseLmsService.syncCourseInstructors(
    tenantId,
    courseId,
    instructorIds
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Course instructors synced successfully",
  });
};

export const listRecommendations = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const recommendations = await courseLmsService.getRecommendations(
    tenantId,
    courseId
  );
  sendSuccessResponse({
    res,
    data: recommendations,
    statusCode: HttpSuccessStatus.OK,
    message: "Course recommendations retrieved successfully",
  });
};

// --- Course FAQs ---
export const listFaqs = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const faqs = await courseLmsService.getFaqs(tenantId, courseId);
  sendSuccessResponse({
    res,
    data: faqs,
    statusCode: HttpSuccessStatus.OK,
    message: "FAQs retrieved successfully",
  });
};

export const createFaq = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const { question, answer, sort_order } = req.body;
  if (!question || !answer) {
    throw new BadRequestError("question and answer are required");
  }
  const faq = await courseLmsService.createFaq(tenantId, courseId, {
    question,
    answer,
    sort_order,
  });
  sendSuccessResponse({
    res,
    data: faq,
    statusCode: HttpSuccessStatus.CREATED,
    message: "FAQ created successfully",
  });
};

export const updateFaq = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const faqId = param(req, "faqId");
  const { question, answer, sort_order } = req.body;
  const faq = await courseLmsService.updateFaq(faqId, tenantId, {
    question,
    answer,
    sort_order,
  });
  sendSuccessResponse({
    res,
    data: faq,
    statusCode: HttpSuccessStatus.OK,
    message: "FAQ updated successfully",
  });
};

export const deleteFaq = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const faqId = param(req, "faqId");
  await courseLmsService.deleteFaq(faqId, tenantId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "FAQ deleted successfully",
  });
};

/**
 * Returns the batches that contain this course AND are still open for
 * enrollment, for use as the "Also enroll in batch" dropdown on the course
 * bulk-enroll page.
 */
export const listEligibleBatches = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  const now = new Date();
  const rows = await db
    .selectFrom("batches as b")
    .innerJoin("batch_items as bi", (join) =>
      join
        .onRef("bi.batch_id", "=", "b.id")
        .on("bi.tenant_id", "=", tenantId)
        .on("bi.course_id", "=", courseId)
    )
    .select(["b.id", "b.title", "b.start_date", "b.enrollment_close_date", "b.status"])
    .where("b.tenant_id", "=", tenantId)
    .orderBy("b.start_date", "asc")
    .execute();

  const eligible = rows.filter(
    (b) =>
      !b.enrollment_close_date || b.enrollment_close_date.getTime() > now.getTime()
  );

  sendSuccessResponse({
    res,
    data: eligible.map((b) => ({
      id: b.id,
      title: b.title,
      start_date: b.start_date,
      enrollment_close_date: b.enrollment_close_date,
      status: b.status,
    })),
    statusCode: HttpSuccessStatus.OK,
    message: "Eligible batches retrieved",
  });
};

/**
 * Binary .xlsx download: 6-sheet course analytics workbook (profile + KPIs,
 * video performance, quiz performance, assignment performance, daily
 * engagement, top learners). Streams the binary; does NOT use sendSuccessResponse.
 */
export const downloadCourseAnalyticsXlsx = async (
  req: Request,
  res: Response
) => {
  const tenantId = getTenantId(req);
  const courseId = param(req, "courseId");
  if (!courseId) throw new BadRequestError("courseId is required");
  const { buffer, fileName } =
    await courseAnalyticsExportService.buildWorkbook(tenantId, courseId);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName}"`
  );
  res.setHeader("Content-Length", buffer.length.toString());
  res.status(HttpSuccessStatus.OK).end(buffer);
};
