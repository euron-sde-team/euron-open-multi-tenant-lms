import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { CurriculumConflictError } from "../errors/curriculum-conflict.error";
import { EntitlementForbiddenError } from "../errors/entitlement-forbidden.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import type {
  LectureRow,
  LessonSiblingRow,
  SectionSiblingRow,
} from "../repositories/course-lms.repository";
import coursesRepository from "../repositories/courses.repository";
import * as courseLmsRepo from "../repositories/course-lms.repository";
import * as quizzesRepo from "../repositories/quizzes.repository";
import testQuestionsRepository from "../repositories/test-questions.repository";
import * as questionAssetsRepo from "../repositories/question-assets.repository";
import { parseQuestionsCsv } from "./quiz-import.parser";
import uploadService from "./upload.service";
import tenantOrgS3Service from "./tenant-org.s3.service";
import entitlementsService from "./entitlements.service";
import {
  normalizeOptionalVideoSource,
  normalizeVideoSource,
  type VideoProvider,
} from "./video-source.service";
import logger from "../utils/logger";

/**
 * Validates a lecture's video source in place: provider + key are checked and
 * normalized (EVS id, https HLS/MP4 URL, canonical YouTube URL). Clearing the
 * key clears the provider too.
 */
function applyVideoSource<
  T extends { video_key?: string | null; video_provider?: VideoProvider | null },
>(data: T): T {
  const source = normalizeOptionalVideoSource(data.video_provider, data.video_key);
  if (source === undefined) return data;
  if (source === null) return { ...data, video_key: null, video_provider: null };
  return { ...data, video_key: source.videoKey, video_provider: source.provider };
}

/**
 * Ensure course belongs to tenant; throw if not found or wrong tenant.
 */
async function ensureCourseAccess(
  courseId: string,
  tenantId: string
): Promise<void> {
  const course = await coursesRepository.findById(courseId);
  if (!course) {
    throw new NotFoundError("Course not found");
  }
  if (course.tenant_id !== tenantId) {
    throw new ForbiddenError("You do not have access to this course");
  }
}

/** quizzes_enabled (BOOLEAN), default deny. */
const ensureQuizzesEnabled = (tenantId: string) =>
  entitlementsService.ensureQuizzesEnabled(tenantId);

/** assignments_enabled (BOOLEAN), default deny. */
const ensureAssignmentsEnabled = (tenantId: string) =>
  entitlementsService.ensureAssignmentsEnabled(tenantId);

/** quiz_questions_per_quiz: null = unlimited, 0 when the tenant has no row. */
const getQuizQuestionsLimit = (tenantId: string) =>
  entitlementsService.getQuizQuestionsLimit(tenantId);

const lectureResourcesBucket = () => uploadService.getLectureResourcesBucket();

type QuizQuestionType = "MCQ" | "DRAG_DROP";

/** Validate an (optional) client-submitted question_type against the enum. */
function validateQuestionType(value: string): QuizQuestionType {
  if (value !== "MCQ" && value !== "DRAG_DROP") {
    throw new BadRequestError("question_type must be MCQ or DRAG_DROP");
  }
  return value;
}

/** DRAG_DROP questions must mark the blank with "___" (three underscores). */
function assertDragDropHasBlank(question: string): void {
  if (!question.includes("___")) {
    throw new BadRequestError(
      `DRAG_DROP questions must contain "___" (three underscores) marking the blank`
    );
  }
}

/**
 * Validates that a client-submitted id list exactly covers the server's
 * current sibling set for a given scope.
 *
 * Three failure modes, each with a precise error:
 *  - Duplicates inside the payload  → 400 BadRequest (client bug)
 *  - Client list size differs OR set differs from current sibling set
 *    → 409 CurriculumConflict with STALE_CURRICULUM code; frontend refetches.
 *
 * Returning extra context (missingIds / unexpectedIds) makes the conflict
 * actionable for the frontend without forcing it to diff lists itself.
 */
function validateExhaustive(
  currentIds: ReadonlySet<string>,
  proposedIds: ReadonlyArray<string>,
  scope: "sections" | "lessons"
): void {
  const proposedSet = new Set(proposedIds);
  if (proposedSet.size !== proposedIds.length) {
    throw new BadRequestError(`Payload contains duplicate ${scope} ids`);
  }
  const missing: string[] = [];
  const unexpected: string[] = [];
  for (const id of currentIds) {
    if (!proposedSet.has(id)) missing.push(id);
  }
  for (const id of proposedIds) {
    if (!currentIds.has(id)) unexpected.push(id);
  }
  if (missing.length > 0 || unexpected.length > 0) {
    throw new CurriculumConflictError(
      "Curriculum has changed since you last loaded it. Please refresh and try again.",
      {
        code: "STALE_CURRICULUM",
        scope,
        missingIds: missing.length > 0 ? missing : undefined,
        unexpectedIds: unexpected.length > 0 ? unexpected : undefined,
      }
    );
  }
}

/**
 * Compute the minimal diff between current and desired sort_order. Only rows
 * whose position actually changes are returned, so the bulk UPDATE statement
 * stays small on local drags (e.g., moving item #10 to #8 in a 50-item list
 * yields 3 changes, not 50).
 */
function computeOrderDiff(
  current: ReadonlyArray<{ id: string; sort_order: number }>,
  proposedIds: ReadonlyArray<string>
): Array<{ id: string; sort_order: number }> {
  const currentSortOrderById = new Map(
    current.map((row) => [row.id, row.sort_order])
  );
  const changes: Array<{ id: string; sort_order: number }> = [];
  proposedIds.forEach((id, newOrder) => {
    if (currentSortOrderById.get(id) !== newOrder) {
      changes.push({ id, sort_order: newOrder });
    }
  });
  return changes;
}

/** Resolve lecture for API response: only video_key and video_provider (no video_url). */
function resolveLectureToResponse(lecture: LectureRow) {
  const bucket = lectureResourcesBucket();
  const resourceLinks = Array.isArray(lecture.resource_links)
    ? (lecture.resource_links as string[]).map((key) =>
        key.startsWith("http://") || key.startsWith("https://")
          ? key
          : uploadService.getPublicUrl(bucket, key) ?? key
      )
    : [];
  return {
    ...lecture,
    video_key: lecture.video_key,
    video_provider: lecture.video_provider,
    resource_links: resourceLinks,
  };
}

class CourseLmsService {
  // --- Sections ---
  async getSections(tenantId: string, courseId: string) {
    await ensureCourseAccess(courseId, tenantId);
    return courseLmsRepo.findSectionsByCourseId(tenantId, courseId);
  }

  async getSection(sectionId: string, tenantId: string) {
    const section = await courseLmsRepo.findSectionById(sectionId, tenantId);
    if (!section) throw new NotFoundError("Section not found");
    return section;
  }

  async createSection(
    tenantId: string,
    courseId: string,
    data: { title: string; sort_order?: number }
  ) {
    await ensureCourseAccess(courseId, tenantId);
    return courseLmsRepo.createSection({
      tenant_id: tenantId,
      course_id: courseId,
      title: data.title,
      sort_order: data.sort_order,
    });
  }

  async updateSection(
    sectionId: string,
    tenantId: string,
    data: { title?: string; sort_order?: number }
  ) {
    const section = await courseLmsRepo.findSectionById(sectionId, tenantId);
    if (!section) throw new NotFoundError("Section not found");
    return courseLmsRepo.updateSection(sectionId, tenantId, data);
  }

  async deleteSection(sectionId: string, tenantId: string) {
    const section = await courseLmsRepo.findSectionById(sectionId, tenantId);
    if (!section) throw new NotFoundError("Section not found");
    // Videos live in EVS or at external URLs; deleting a section only removes
    // the references.
    const ok = await courseLmsRepo.deleteSection(sectionId, tenantId);
    if (!ok) throw new NotFoundError("Section not found");
  }

  // --- Lessons ---
  async getLessons(tenantId: string, sectionId: string) {
    const section = await courseLmsRepo.findSectionById(sectionId, tenantId);
    if (!section) throw new NotFoundError("Section not found");
    return courseLmsRepo.findLessonsBySectionId(tenantId, sectionId);
  }

  async getLesson(lessonId: string, tenantId: string) {
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson) throw new NotFoundError("Lesson not found");
    return lesson;
  }

  async createLesson(
    tenantId: string,
    courseId: string,
    sectionId: string,
    data: {
      title: string;
      type: "LECTURE" | "QUIZ" | "ASSIGNMENT" | "PDF" | "LINK" | "TEXT" | "IMAGE";
      sort_order?: number;
      is_preview?: boolean;
    }
  ) {
    await ensureCourseAccess(courseId, tenantId);
    const section = await courseLmsRepo.findSectionById(sectionId, tenantId);
    if (!section || section.course_id !== courseId) {
      throw new NotFoundError("Section not found");
    }

    if (data.type === "QUIZ") {
      await ensureQuizzesEnabled(tenantId);
    }
    if (data.type === "ASSIGNMENT") {
      await ensureAssignmentsEnabled(tenantId);
    }

    return courseLmsRepo.createLesson({
      tenant_id: tenantId,
      course_id: courseId,
      section_id: sectionId,
      title: data.title,
      type: data.type,
      sort_order: data.sort_order,
      is_preview: data.is_preview,
    });
  }

  async updateLesson(
    lessonId: string,
    tenantId: string,
    data: {
      title?: string;
      type?: "LECTURE" | "QUIZ" | "ASSIGNMENT" | "PDF" | "LINK" | "TEXT" | "IMAGE";
      sort_order?: number;
      is_preview?: boolean;
    }
  ) {
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson) throw new NotFoundError("Lesson not found");
    return courseLmsRepo.updateLesson(lessonId, tenantId, data);
  }

  async deleteLesson(lessonId: string, tenantId: string) {
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson) throw new NotFoundError("Lesson not found");
    const ok = await courseLmsRepo.deleteLesson(lessonId, tenantId);
    if (!ok) throw new NotFoundError("Lesson not found");
  }

  // --- Bulk Reorder (curriculum drag-and-drop) ---

  /**
   * Reorder all sections of a course in one transaction.
   *
   * Payload `sectionIds` is the complete desired order. If the set doesn't
   * exactly match current siblings → 409 STALE_CURRICULUM (frontend refetches).
   * Only rows whose position actually changes are written.
   */
  async reorderSections(
    tenantId: string,
    courseId: string,
    sectionIds: string[]
  ): Promise<{ updated: number; sections: SectionSiblingRow[] }> {
    await ensureCourseAccess(courseId, tenantId);

    if (!Array.isArray(sectionIds)) {
      throw new BadRequestError("section_ids must be an array");
    }
    for (const id of sectionIds) {
      if (typeof id !== "string" || id.length === 0) {
        throw new BadRequestError("section_ids must contain non-empty strings");
      }
    }

    const { updated, sections } = await db
      .transaction()
      .execute(async (trx) => {
        const current = await courseLmsRepo.lockAndReadSectionSiblings(
          trx,
          tenantId,
          courseId
        );
        validateExhaustive(
          new Set(current.map((s) => s.id)),
          sectionIds,
          "sections"
        );

        const changes = computeOrderDiff(current, sectionIds);
        const updatedCount = await courseLmsRepo.bulkUpdateSectionSortOrder(
          trx,
          tenantId,
          courseId,
          changes
        );

        // Return the post-write state inside the trx so callers see consistent ordering
        const post = sectionIds.map((id, idx) => ({ id, sort_order: idx }));
        return { updated: updatedCount, sections: post };
      });

    return { updated, sections };
  }

  /**
   * Reorder all lessons within a single section in one transaction.
   * Lessons keep their `section_id`; only `sort_order` changes.
   */
  async reorderLessonsInSection(
    tenantId: string,
    courseId: string,
    sectionId: string,
    lessonIds: string[]
  ): Promise<{ updated: number; lessons: LessonSiblingRow[] }> {
    await ensureCourseAccess(courseId, tenantId);

    if (!Array.isArray(lessonIds)) {
      throw new BadRequestError("lesson_ids must be an array");
    }
    for (const id of lessonIds) {
      if (typeof id !== "string" || id.length === 0) {
        throw new BadRequestError("lesson_ids must contain non-empty strings");
      }
    }

    // Verify section belongs to course (cheap pre-check; the exhaustiveness
    // check would also catch a mismatched section but this gives a clearer
    // 404 vs 409 distinction).
    const section = await courseLmsRepo.findSectionById(sectionId, tenantId);
    if (!section || section.course_id !== courseId) {
      throw new NotFoundError("Section not found");
    }

    const { updated, lessons } = await db
      .transaction()
      .execute(async (trx) => {
        const current = await courseLmsRepo.lockAndReadLessonSiblings(
          trx,
          tenantId,
          courseId,
          sectionId
        );
        validateExhaustive(
          new Set(current.map((l) => l.id)),
          lessonIds,
          "lessons"
        );

        const changes = computeOrderDiff(current, lessonIds);
        const updatedCount = await courseLmsRepo.bulkUpdateLessonSortOrder(
          trx,
          tenantId,
          changes
        );

        const post = lessonIds.map((id, idx) => ({
          id,
          section_id: sectionId,
          sort_order: idx,
        }));
        return { updated: updatedCount, lessons: post };
      });

    return { updated, lessons };
  }

  /**
   * Cross-section move: relocate one lesson from `sourceSectionId` into
   * `targetSectionId` at the position implied by its index in `targetLessonIds`,
   * while resequencing both sections in the same transaction.
   *
   * Payload semantics (client view AFTER the desired move):
   *  - `sourceLessonIds`: new order for source section, EXCLUDING the moved lesson
   *  - `targetLessonIds`: new order for target section, INCLUDING the moved lesson
   *
   * For within-section moves (source === target), reject with 400 and direct
   * the caller to the dedicated lesson-reorder endpoint.
   */
  async moveLesson(
    tenantId: string,
    courseId: string,
    payload: {
      lessonId: string;
      sourceSectionId: string;
      targetSectionId: string;
      sourceLessonIds: string[];
      targetLessonIds: string[];
    }
  ): Promise<{
    updated: number;
    sourceLessons: LessonSiblingRow[];
    targetLessons: LessonSiblingRow[];
  }> {
    await ensureCourseAccess(courseId, tenantId);

    const {
      lessonId,
      sourceSectionId,
      targetSectionId,
      sourceLessonIds,
      targetLessonIds,
    } = payload;

    // --- Basic shape validation (before opening trx) ---
    if (
      typeof lessonId !== "string" ||
      typeof sourceSectionId !== "string" ||
      typeof targetSectionId !== "string"
    ) {
      throw new BadRequestError(
        "lesson_id, source_section_id, target_section_id are required strings"
      );
    }
    if (!Array.isArray(sourceLessonIds) || !Array.isArray(targetLessonIds)) {
      throw new BadRequestError(
        "source_lesson_ids and target_lesson_ids must be arrays"
      );
    }
    if (sourceSectionId === targetSectionId) {
      throw new BadRequestError(
        "Use the section-reorder endpoint for same-section moves"
      );
    }
    if (!targetLessonIds.includes(lessonId)) {
      throw new BadRequestError(
        "lesson_id must appear in target_lesson_ids"
      );
    }
    if (sourceLessonIds.includes(lessonId)) {
      throw new BadRequestError(
        "lesson_id must not appear in source_lesson_ids (it has moved out)"
      );
    }
    for (const id of [...sourceLessonIds, ...targetLessonIds]) {
      if (typeof id !== "string" || id.length === 0) {
        throw new BadRequestError("lesson id arrays must contain non-empty strings");
      }
    }

    // --- Verify both sections belong to the course (clear 404 if not) ---
    const [sourceSection, targetSection] = await Promise.all([
      courseLmsRepo.findSectionById(sourceSectionId, tenantId),
      courseLmsRepo.findSectionById(targetSectionId, tenantId),
    ]);
    if (!sourceSection || sourceSection.course_id !== courseId) {
      throw new NotFoundError("Source section not found");
    }
    if (!targetSection || targetSection.course_id !== courseId) {
      throw new NotFoundError("Target section not found");
    }

    const result = await db.transaction().execute(async (trx) => {
      // Lock both sections' lessons in deterministic order (section_id, id)
      // so two concurrent cross-section moves involving overlapping sections
      // cannot deadlock; the second writer simply waits.
      const allCurrent =
        await courseLmsRepo.lockAndReadLessonSiblingsInSections(
          trx,
          tenantId,
          courseId,
          [sourceSectionId, targetSectionId]
        );
      const currentSource = allCurrent.filter(
        (l) => l.section_id === sourceSectionId
      );
      const currentTarget = allCurrent.filter(
        (l) => l.section_id === targetSectionId
      );

      // Exhaustiveness: BEFORE the move, source contained
      // `sourceLessonIds ∪ {lessonId}` and target contained
      // `targetLessonIds ∖ {lessonId}`.
      const expectedSourceBefore = new Set<string>([
        ...sourceLessonIds,
        lessonId,
      ]);
      const expectedTargetBefore = new Set<string>(
        targetLessonIds.filter((id) => id !== lessonId)
      );

      validateExhaustive(
        new Set(currentSource.map((l) => l.id)),
        [...expectedSourceBefore],
        "lessons"
      );
      validateExhaustive(
        new Set(currentTarget.map((l) => l.id)),
        [...expectedTargetBefore],
        "lessons"
      );

      // Build the post-state we expect every lesson to have, then diff
      // against the current locked state. One UPDATE handles all three writes
      // (moved lesson's new section_id + sort_order; source resequencing;
      // target resequencing) in a single VALUES + JOIN statement.
      const currentById = new Map(
        allCurrent.map((l) => [l.id, l])
      );
      const changes: Array<{
        id: string;
        section_id: string;
        sort_order: number;
      }> = [];

      // Source lessons (minus moved): keep section_id, new sort_order = index
      sourceLessonIds.forEach((id, idx) => {
        const cur = currentById.get(id);
        if (!cur) return; // unreachable thanks to exhaustiveness check above
        if (cur.section_id !== sourceSectionId || cur.sort_order !== idx) {
          changes.push({
            id,
            section_id: sourceSectionId,
            sort_order: idx,
          });
        }
      });

      // Target lessons including moved: new section_id (for the moved one) + index
      targetLessonIds.forEach((id, idx) => {
        const cur = currentById.get(id);
        if (!cur) return; // unreachable for non-moved; moved lesson is in source siblings
        if (cur.section_id !== targetSectionId || cur.sort_order !== idx) {
          changes.push({
            id,
            section_id: targetSectionId,
            sort_order: idx,
          });
        }
      });

      const updatedCount =
        await courseLmsRepo.bulkUpdateLessonSectionAndOrder(
          trx,
          tenantId,
          changes
        );

      const post = {
        sourceLessons: sourceLessonIds.map((id, idx) => ({
          id,
          section_id: sourceSectionId,
          sort_order: idx,
        })),
        targetLessons: targetLessonIds.map((id, idx) => ({
          id,
          section_id: targetSectionId,
          sort_order: idx,
        })),
      };
      return { updated: updatedCount, ...post };
    });

    return result;
  }

  // --- Lectures ---
  async getLecture(tenantId: string, lessonId: string) {
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson) throw new NotFoundError("Lesson not found");
    const lecture = await courseLmsRepo.findLectureByLessonId(tenantId, lessonId);
    if (!lecture) throw new NotFoundError("Lecture not found");
    return resolveLectureToResponse(lecture);
  }

  async createLecture(
    tenantId: string,
    courseId: string,
    lessonId: string,
    data: {
      title: string;
      video_key?: string | null;
      video_provider?: VideoProvider | null;
      duration?: string | null;
      resource_links?: string[];
      summary?: string | null;
    }
  ) {
    await ensureCourseAccess(courseId, tenantId);
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson || lesson.course_id !== courseId) {
      throw new NotFoundError("Lesson not found");
    }
    if (lesson.type !== "LECTURE") {
      throw new BadRequestError("Lesson is not a lecture");
    }
    data = applyVideoSource(data);
    const lecture = await courseLmsRepo.createLecture({
      tenant_id: tenantId,
      course_id: courseId,
      lesson_id: lessonId,
      title: data.title,
      video_key: data.video_key,
      video_provider: data.video_provider,
      duration: data.duration,
      resource_links: data.resource_links,
      summary: data.summary,
    });
    return resolveLectureToResponse(lecture);
  }

  async updateLecture(
    tenantId: string,
    courseId: string,
    lessonId: string,
    data: {
      title?: string;
      video_key?: string | null;
      video_provider?: VideoProvider | null;
      duration?: string | null;
      resource_links?: string[];
      summary?: string | null;
    }
  ) {
    await ensureCourseAccess(courseId, tenantId);
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson || lesson.course_id !== courseId) {
      throw new NotFoundError("Lesson not found");
    }
    const lecture = await courseLmsRepo.findLectureByLessonId(tenantId, lessonId);
    if (!lecture) throw new NotFoundError("Lecture not found");
    const updated = await courseLmsRepo.updateLecture(
      lecture.id,
      tenantId,
      applyVideoSource(data)
    );
    return updated ? resolveLectureToResponse(updated) : null;
  }

  // --- Quizzes ---
  async getQuiz(tenantId: string, lessonId: string) {
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson) throw new NotFoundError("Lesson not found");
    const quiz = await courseLmsRepo.findQuizByLessonId(tenantId, lessonId);
    if (!quiz) throw new NotFoundError("Quiz not found");
    return quiz;
  }

  async createQuiz(
    tenantId: string,
    courseId: string,
    lessonId: string,
    data: { title: string }
  ) {
    await ensureCourseAccess(courseId, tenantId);
    await ensureQuizzesEnabled(tenantId);
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson || lesson.course_id !== courseId) {
      throw new NotFoundError("Lesson not found");
    }
    if (lesson.type !== "QUIZ") {
      throw new BadRequestError("Lesson is not a quiz");
    }
    return courseLmsRepo.createQuiz({
      tenant_id: tenantId,
      course_id: courseId,
      lesson_id: lessonId,
      title: data.title,
    });
  }

  // --- Quiz questions ---
  async getQuizQuestions(tenantId: string, quizId: string) {
    const questions = await courseLmsRepo.findQuestionsByQuizId(tenantId, quizId);
    const questionIds = questions.map((q) => q.id);
    const options = await courseLmsRepo.findOptionsByQuestionIds(
      tenantId,
      questionIds
    );
    const optionsByQuestion = new Map<string, typeof options>();
    for (const opt of options) {
      const list = optionsByQuestion.get(opt.question_id) ?? [];
      list.push(opt);
      optionsByQuestion.set(opt.question_id, list);
    }
    return questions.map((q) => ({
      ...q,
      options: optionsByQuestion.get(q.id) ?? [],
    }));
  }

  async createQuizQuestion(
    tenantId: string,
    quizId: string,
    data: {
      question: string;
      question_type?: string;
      marks?: number;
      sort_order?: number;
    }
  ) {
    const questionType: QuizQuestionType =
      data.question_type != null ? validateQuestionType(data.question_type) : "MCQ";
    if (questionType === "DRAG_DROP") {
      assertDragDropHasBlank(data.question);
    }
    const limit = await getQuizQuestionsLimit(tenantId);
    if (limit != null) {
      const count = await courseLmsRepo.countQuestionsByQuizId(tenantId, quizId);
      if (count >= limit) {
        throw new EntitlementForbiddenError(
          `Quiz question limit reached (max ${limit} per quiz). Upgrade your plan for more.`,
          {
            code: "ENTITLEMENT_LIMIT_REACHED",
            productCode: "quiz_questions_per_quiz",
            featureKey: "quiz_questions",
            currentUsed: count,
            limit,
            isUnlimited: false,
          }
        );
      }
    }
    return courseLmsRepo.createQuizQuestion({
      tenant_id: tenantId,
      quiz_id: quizId,
      question: data.question,
      question_type: questionType,
      marks: data.marks,
      sort_order: data.sort_order,
    });
  }

  async createQuizOption(
    tenantId: string,
    questionId: string,
    data: {
      option_text: string;
      is_correct?: boolean;
      blank_index?: number | null;
      explanation?: string | null;
      sort_order?: number;
    }
  ) {
    return courseLmsRepo.createQuizOption({
      tenant_id: tenantId,
      question_id: questionId,
      option_text: data.option_text,
      is_correct: data.is_correct,
      blank_index: data.blank_index,
      explanation: data.explanation,
      sort_order: data.sort_order,
    });
  }

  async updateQuizQuestion(
    tenantId: string,
    questionId: string,
    data: {
      question?: string;
      question_type?: string;
      marks?: number;
      sort_order?: number;
    }
  ) {
    const existing = await courseLmsRepo.findQuestionById(tenantId, questionId);
    if (!existing) throw new NotFoundError("Question not found");

    const questionType: QuizQuestionType | undefined =
      data.question_type != null
        ? validateQuestionType(data.question_type)
        : undefined;
    // Validate the blank against the post-update state: either field may be
    // changing, so check the effective (new ?? current) type and text.
    const effectiveType =
      questionType ?? (existing.question_type as unknown as QuizQuestionType);
    const effectiveQuestion = data.question ?? existing.question;
    if (effectiveType === "DRAG_DROP") {
      assertDragDropHasBlank(effectiveQuestion);
    }

    const updated = await courseLmsRepo.updateQuizQuestion(
      tenantId,
      questionId,
      {
        question: data.question,
        question_type: questionType,
        marks: data.marks,
        sort_order: data.sort_order,
      }
    );
    if (!updated) throw new NotFoundError("Question not found");
    return updated;
  }

  async deleteQuizQuestion(tenantId: string, questionId: string) {
    const deleted = await courseLmsRepo.deleteQuizQuestion(
      tenantId,
      questionId
    );
    if (!deleted) throw new NotFoundError("Question not found");
  }

  async updateQuizOption(
    tenantId: string,
    optionId: string,
    data: {
      option_text?: string;
      is_correct?: boolean;
      blank_index?: number | null;
      sort_order?: number;
    }
  ) {
    const updated = await courseLmsRepo.updateQuizOption(
      tenantId,
      optionId,
      data
    );
    if (!updated) throw new NotFoundError("Option not found");
    return updated;
  }

  async deleteQuizOption(tenantId: string, optionId: string) {
    const deleted = await courseLmsRepo.deleteQuizOption(tenantId, optionId);
    if (!deleted) throw new NotFoundError("Option not found");
  }

  /**
   * Import quiz questions (with options) from an uploaded CSV in the platform
   * format. The whole file is validated first (rejected with per-row errors if
   * any row is invalid), the quiz_questions_per_quiz entitlement is enforced
   * against existing + imported count, then questions and options are inserted
   * in one transaction with sort_order continuing from the current max.
   */
  async importQuizQuestionsFromCsv(
    tenantId: string,
    courseId: string,
    quizId: string,
    file: { buffer: Buffer; filename: string; mimetype?: string }
  ): Promise<{
    created: number;
    skipped: number;
    duplicates: Array<{ question: string; reason: string }>;
  }> {
    await ensureCourseAccess(courseId, tenantId);
    const quiz = await quizzesRepo.findById(tenantId, quizId);
    if (!quiz || quiz.course_id !== courseId) {
      throw new NotFoundError("Quiz not found");
    }

    const lower = file.filename.toLowerCase();
    if (!lower.endsWith(".csv") && file.mimetype !== "text/csv") {
      throw new BadRequestError("Unsupported file type. Upload a .csv file.");
    }

    const parsedRows = parseQuestionsCsv(file.buffer);

    // Duplicate detection: skip questions already in this quiz or repeated in
    // the same file, and report them so the UI can highlight what was dropped.
    const normalize = (s: string) =>
      s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const existingTexts = await courseLmsRepo.findQuestionTextsByQuiz(
      tenantId,
      quizId
    );
    const existingKeys = new Set(existingTexts.map(normalize));
    const seen = new Set<string>();
    const duplicates: Array<{ question: string; reason: string }> = [];
    const rows = parsedRows.filter((r) => {
      const key = normalize(r.question);
      if (existingKeys.has(key)) {
        duplicates.push({
          question: r.question.slice(0, 80),
          reason: "Already in this quiz",
        });
        return false;
      }
      if (seen.has(key)) {
        duplicates.push({
          question: r.question.slice(0, 80),
          reason: "Duplicate in this file",
        });
        return false;
      }
      seen.add(key);
      return true;
    });

    if (rows.length === 0) {
      return { created: 0, skipped: duplicates.length, duplicates };
    }

    const limit = await getQuizQuestionsLimit(tenantId);
    if (limit != null) {
      const count = await courseLmsRepo.countQuestionsByQuizId(tenantId, quizId);
      if (count + rows.length > limit) {
        throw new EntitlementForbiddenError(
          `Importing ${rows.length} question(s) would exceed the quiz question limit (max ${limit} per quiz). Upgrade your plan for more.`,
          {
            code: "ENTITLEMENT_LIMIT_REACHED",
            productCode: "quiz_questions_per_quiz",
            featureKey: "quiz_questions",
            currentUsed: count,
            limit,
            isUnlimited: false,
          }
        );
      }
    }

    const created = await db.transaction().execute(async (trx) => {
      const baseSort =
        (await courseLmsRepo.getMaxQuestionSortOrder(tenantId, quizId, trx)) + 1;

      const questionIds = await courseLmsRepo.createQuizQuestionsBulk(
        rows.map((r, i) => ({
          tenant_id: tenantId,
          quiz_id: quizId,
          question: r.question,
          question_type: r.questionType,
          marks: r.marks,
          sort_order: baseSort + i,
        })),
        trx
      );

      const optionInputs = rows.flatMap((r, qi) =>
        r.options.map((o, oi) => ({
          tenant_id: tenantId,
          question_id: questionIds[qi],
          option_text: o.text,
          is_correct: o.isCorrect,
          explanation: o.explanation,
          sort_order: oi,
        }))
      );
      await courseLmsRepo.createQuizOptionsBulk(optionInputs, trx);

      return questionIds.length;
    });

    logger.info(
      `[course-lms] imported ${created} quiz question(s) from CSV into quiz ${quizId} (tenant ${tenantId}), ${duplicates.length} skipped`
    );
    return { created, skipped: duplicates.length, duplicates };
  }

  /**
   * Import questions from a test Question Bank into a course quiz. Rich
   * test questions are converted to the quiz shape (MCQ / multi-blank
   * DRAG_DROP); unsupported types (FIB/NAT) and duplicates are skipped.
   */
  async importQuestionsFromTestBank(
    tenantId: string,
    courseId: string,
    quizId: string,
    bankId: string,
    questionIds?: string[],
    selection?: {
      subject?: string;
      chapter?: string;
      topic?: string;
      difficulty?: string;
      count?: number;
    }
  ): Promise<{ created: number; skipped: number }> {
    await ensureCourseAccess(courseId, tenantId);
    const quiz = await quizzesRepo.findById(tenantId, quizId);
    if (!quiz || quiz.course_id !== courseId) {
      throw new NotFoundError("Quiz not found");
    }

    // Already-imported bank questions (by source id) are excluded so a re-pull
    // of the same bank/filter draws fresh questions and never duplicates.
    const existingSourceIds = new Set(
      await courseLmsRepo.findSourceQuestionIdsByQuiz(tenantId, quizId)
    );

    // Explicit ids win; otherwise pull a RANDOM pool from the shared bank
    // filtered by its tags (subject / chapter / topic / difficulty). Only
    // PUBLISHED questions are eligible so drafts never leak into a live quiz.
    // Sampling AND already-imported exclusion run in SQL (ORDER BY random()) so
    // the entire bank is reachable, not just the newest 200 rows, which used to
    // make re-pulls return { created: 0, skipped } forever once that window was
    // imported. We over-fetch past `count` to absorb the in-memory type /
    // duplicate-text drops below.
    const requestedCount = selection?.count;
    const source =
      questionIds && questionIds.length > 0
        ? await testQuestionsRepository.findByIds(questionIds, tenantId)
        : await testQuestionsRepository.findRandomForImport({
            tenantId,
            questionBankId: bankId,
            subject: selection?.subject,
            chapter: selection?.chapter,
            topic: selection?.topic,
            difficulty: selection?.difficulty,
            excludeIds: [...existingSourceIds],
            limit:
              typeof requestedCount === "number" && requestedCount > 0
                ? Math.min(requestedCount * 3, 300)
                : 200,
          });
    const fromBank = source.filter(
      (q) => (q as { question_bank_id?: string }).question_bank_id === bankId
    );

    const safeParse = (v: unknown): unknown => {
      if (typeof v !== "string") return v;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    };
    const stemString = (stem: unknown): string => {
      const s = safeParse(stem);
      if (typeof s === "string") return s;
      if (
        s &&
        typeof s === "object" &&
        typeof (s as { text?: unknown }).text === "string"
      )
        return (s as { text: string }).text;
      return "";
    };
    const normalize = (s: string) =>
      s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

    const existing = await courseLmsRepo.findQuestionTextsByQuiz(
      tenantId,
      quizId
    );
    const existingKeys = new Set(existing.map((t) => normalize(t)));
    const seen = new Set<string>();

    type Converted = {
      source_question_id: string;
      question: string;
      question_type: "MCQ" | "DRAG_DROP";
      marks: number;
      options: Array<{
        text: string;
        is_correct: boolean;
        blank_index: number | null;
      }>;
    };
    const converted: Converted[] = [];
    let skipped = 0;

    for (const q of fromBank) {
      const type = String((q as { type?: string }).type ?? "");
      if (
        !["MCQ_SINGLE", "MCQ_MULTI", "TRUE_FALSE", "DRAG_DROP"].includes(type)
      ) {
        skipped++;
        continue;
      }
      const sourceId = String((q as { id?: unknown }).id ?? "");
      if (sourceId && existingSourceIds.has(sourceId)) {
        skipped++;
        continue;
      }
      const text = stemString((q as { stem?: unknown }).stem);
      const key = normalize(text);
      if (!text || existingKeys.has(key) || seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);

      const opts =
        (safeParse((q as { options?: unknown }).options) as Array<{
          id?: string;
          label?: string;
        }> | null) ?? [];
      const correct = safeParse((q as { correct_answer?: unknown }).correct_answer);
      const correctArr = Array.isArray(correct) ? correct.map(String) : null;
      const correctStr =
        !Array.isArray(correct) && correct != null ? String(correct) : null;
      const isDrag = type === "DRAG_DROP";

      converted.push({
        source_question_id: sourceId,
        question: text,
        question_type: isDrag ? "DRAG_DROP" : "MCQ",
        marks: Number((q as unknown as { marks?: unknown }).marks ?? 1) || 1,
        options: opts.map((o) => {
          const oid = String(o.id ?? "");
          let is_correct = false;
          let blank_index: number | null = null;
          if (isDrag && correctArr) {
            const b = correctArr.findIndex((c) => c === oid);
            if (b !== -1) {
              is_correct = true;
              blank_index = b;
            }
          } else if (correctArr) {
            is_correct = correctArr.includes(oid);
          } else if (correctStr != null) {
            is_correct = oid === correctStr;
          }
          return { text: String(o.label ?? ""), is_correct, blank_index };
        }),
      });
    }

    // The SQL pool already comes back in random order; when an explicit count is
    // requested and the surviving pool is larger, take the first `count`.
    let chosen = converted;
    if (
      typeof requestedCount === "number" &&
      requestedCount > 0 &&
      requestedCount < converted.length
    ) {
      chosen = converted.slice(0, requestedCount);
    }

    if (chosen.length === 0) {
      return { created: 0, skipped };
    }

    await entitlementsService.ensureQuizQuestionCapacity(
      tenantId,
      await courseLmsRepo.countQuestionsByQuizId(tenantId, quizId),
      chosen.length
    );

    const created = await db.transaction().execute(async (trx) => {
      const baseSort =
        (await courseLmsRepo.getMaxQuestionSortOrder(tenantId, quizId, trx)) + 1;
      const qIds = await courseLmsRepo.createQuizQuestionsBulk(
        chosen.map((c, i) => ({
          tenant_id: tenantId,
          quiz_id: quizId,
          question: c.question,
          question_type: c.question_type,
          marks: c.marks,
          sort_order: baseSort + i,
          source_question_id: c.source_question_id || null,
        })),
        trx
      );
      const optionInputs = chosen.flatMap((c, qi) =>
        c.options.map((o, oi) => ({
          tenant_id: tenantId,
          question_id: qIds[qi],
          option_text: o.text,
          is_correct: o.is_correct,
          blank_index: o.blank_index,
          sort_order: oi,
        }))
      );
      await courseLmsRepo.createQuizOptionsBulk(optionInputs, trx);
      // Remember the source bank + filter so the editor can re-pull / refresh.
      await courseLmsRepo.updateQuizBankSelection(
        tenantId,
        quizId,
        bankId,
        selection ?? null,
        trx
      );
      return qIds.length;
    });

    logger.info(
      `[course-lms] imported ${created} quiz question(s) from bank ${bankId} into quiz ${quizId} (tenant ${tenantId})`
    );
    return { created, skipped };
  }

  // --- Question Asset Library (reusable uploaded files) ---

  async createQuestionAssetFromCsv(
    tenantId: string,
    file: { buffer: Buffer; filename: string; mimetype?: string },
    name?: string,
    createdBy?: string
  ): Promise<{ id: string; question_count: number }> {
    const lower = file.filename.toLowerCase();
    if (!lower.endsWith(".csv") && file.mimetype !== "text/csv") {
      throw new BadRequestError("Unsupported file type. Upload a .csv file.");
    }
    const rows = parseQuestionsCsv(file.buffer);
    if (rows.length === 0) {
      throw new BadRequestError("No questions found in the file");
    }
    const id = await questionAssetsRepo.createAsset({
      tenant_id: tenantId,
      name: (name && name.trim()) || file.filename,
      questions: rows,
      question_count: rows.length,
      created_by: createdBy ?? null,
    });
    return { id, question_count: rows.length };
  }

  async listQuestionAssets(tenantId: string) {
    const rows = await questionAssetsRepo.listAssets(tenantId);
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      questionCount: Number(a.question_count ?? 0),
      createdAt:
        a.created_at instanceof Date
          ? a.created_at.toISOString()
          : String(a.created_at),
    }));
  }

  async deleteQuestionAsset(tenantId: string, assetId: string): Promise<void> {
    const ok = await questionAssetsRepo.deleteAsset(tenantId, assetId);
    if (!ok) throw new NotFoundError("Asset not found");
  }

  async importAssetToQuiz(
    tenantId: string,
    courseId: string,
    quizId: string,
    assetId: string
  ): Promise<{ created: number }> {
    await ensureCourseAccess(courseId, tenantId);
    const quiz = await quizzesRepo.findById(tenantId, quizId);
    if (!quiz || quiz.course_id !== courseId) {
      throw new NotFoundError("Quiz not found");
    }
    const asset = await questionAssetsRepo.getAsset(tenantId, assetId);
    if (!asset) throw new NotFoundError("Asset not found");
    const parsed =
      typeof asset.questions === "string"
        ? JSON.parse(asset.questions)
        : asset.questions;
    const rows = (Array.isArray(parsed) ? parsed : []) as Array<{
      question: string;
      questionType?: "MCQ" | "DRAG_DROP";
      marks?: number;
      options: Array<{
        text: string;
        isCorrect: boolean;
        explanation?: string | null;
      }>;
    }>;
    if (rows.length === 0) return { created: 0 };

    const limit = await getQuizQuestionsLimit(tenantId);
    if (limit != null) {
      const count = await courseLmsRepo.countQuestionsByQuizId(tenantId, quizId);
      if (count + rows.length > limit) {
        throw new EntitlementForbiddenError(
          `Importing ${rows.length} question(s) would exceed the quiz question limit (max ${limit} per quiz). Upgrade your plan for more.`,
          {
            code: "ENTITLEMENT_LIMIT_REACHED",
            productCode: "quiz_questions_per_quiz",
            featureKey: "quiz_questions",
            currentUsed: count,
            limit,
            isUnlimited: false,
          }
        );
      }
    }

    const created = await db.transaction().execute(async (trx) => {
      const baseSort =
        (await courseLmsRepo.getMaxQuestionSortOrder(tenantId, quizId, trx)) + 1;
      const qIds = await courseLmsRepo.createQuizQuestionsBulk(
        rows.map((r, i) => ({
          tenant_id: tenantId,
          quiz_id: quizId,
          question: r.question,
          question_type: r.questionType ?? "MCQ",
          marks: r.marks ?? 1,
          sort_order: baseSort + i,
        })),
        trx
      );
      const optionInputs = rows.flatMap((r, qi) =>
        r.options.map((o, oi) => ({
          tenant_id: tenantId,
          question_id: qIds[qi],
          option_text: o.text,
          is_correct: o.isCorrect,
          explanation: o.explanation ?? null,
          sort_order: oi,
        }))
      );
      await courseLmsRepo.createQuizOptionsBulk(optionInputs, trx);
      return qIds.length;
    });

    return { created };
  }

  // --- Assignments ---
  async getAssignment(tenantId: string, lessonId: string) {
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson) throw new NotFoundError("Lesson not found");
    const assignment = await courseLmsRepo.findAssignmentByLessonId(
      tenantId,
      lessonId
    );
    if (!assignment) throw new NotFoundError("Assignment not found");
    return assignment;
  }

  async createAssignment(
    tenantId: string,
    courseId: string,
    lessonId: string,
    data: {
      title: string;
      instructions?: string | null;
      resource_links?: string[];
    }
  ) {
    await ensureCourseAccess(courseId, tenantId);
    await ensureAssignmentsEnabled(tenantId);
    const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
    if (!lesson || lesson.course_id !== courseId) {
      throw new NotFoundError("Lesson not found");
    }
    if (lesson.type !== "ASSIGNMENT") {
      throw new BadRequestError("Lesson is not an assignment");
    }
    return courseLmsRepo.createAssignment({
      tenant_id: tenantId,
      course_id: courseId,
      lesson_id: lessonId,
      title: data.title,
      instructions: data.instructions,
      resource_links: data.resource_links,
    });
  }

  /**
   * Bulk-replace the entire curriculum for a course in a single transaction.
   * Deletes all existing sections (cascade removes lessons + lectures), then
   * inserts new sections, lessons, and lectures from the payload.
   */
  async syncCurriculum(
    tenantId: string,
    courseId: string,
    sections: Array<{
      title: string;
      sort_order: number;
      lessons: Array<{
        title: string;
        type: "LECTURE" | "QUIZ" | "ASSIGNMENT" | "PDF" | "LINK" | "TEXT" | "IMAGE";
        sort_order: number;
        is_preview: boolean;
        lecture: {
          title: string;
          video_key?: string | null;
          video_provider?: VideoProvider | null;
          duration: string | null;
          resource_links: string[];
          summary: string | null;
        } | null;
      }>;
    }>,
    lmsTemplateId: string | null = null,
    lmsSettings: unknown | null = null
  ) {
    await ensureCourseAccess(courseId, tenantId);

    // Validate every lecture's video source before anything is written.
    for (const sec of sections) {
      for (const les of sec.lessons ?? []) {
        if (les.lecture) Object.assign(les.lecture, applyVideoSource(les.lecture));
      }
    }

    const { ulid } = await import("ulid");
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      // 0. Always persist LMS template & settings on the course row
      await trx
        .updateTable("courses")
        .set({
          lms_template_id: lmsTemplateId ?? "classic",
          lms_settings: JSON.stringify(lmsSettings ?? {}),
          updated_at: now,
        })
        .where("id", "=", courseId)
        .where("tenant_id", "=", tenantId)
        .execute();

      // 1. Delete all existing sections for this course (cascade removes lessons + lectures)
      await trx
        .deleteFrom("course_sections")
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .execute();

      // 2. Bulk-insert sections, lessons, and lectures
      for (const sec of sections) {
        const sectionId = ulid();
        await trx
          .insertInto("course_sections")
          .values({
            id: sectionId,
            tenant_id: tenantId,
            course_id: courseId,
            title: sec.title,
            sort_order: sec.sort_order,
            created_at: now,
            updated_at: now,
          })
          .execute();

        for (const les of sec.lessons) {
          const lessonId = ulid();
          await trx
            .insertInto("course_lessons")
            .values({
              id: lessonId,
              tenant_id: tenantId,
              course_id: courseId,
              section_id: sectionId,
              title: les.title,
              type: les.type as "LECTURE" | "QUIZ" | "ASSIGNMENT" | "PDF" | "LINK" | "TEXT" | "IMAGE",
              sort_order: les.sort_order,
              is_preview: les.is_preview,
              created_at: now,
              updated_at: now,
            })
            .execute();

          if (les.lecture && les.type === "LECTURE") {
            const lectureId = ulid();
            await trx
              .insertInto("lectures")
              .values({
                id: lectureId,
                tenant_id: tenantId,
                course_id: courseId,
                lesson_id: lessonId,
                title: les.lecture.title,
                video_key: les.lecture.video_key ?? null,
                video_provider: les.lecture.video_provider ?? null,
                duration: les.lecture.duration ?? null,
                resource_links: les.lecture.resource_links ?? [],
                summary: les.lecture.summary ?? null,
                created_at: now,
                updated_at: now,
              })
              .execute();
          }
        }
      }
    });

    const tree = await this.getCourseFullTree(tenantId, courseId);

    return tree;
  }

  /**
   * Get full LMS tree for a course: sections with lessons and lecture/quiz/assignment per lesson.
   * Used by editor to load all data in one request.
   */
  async getCourseFullTree(tenantId: string, courseId: string) {
    await ensureCourseAccess(courseId, tenantId);
    const sections = await courseLmsRepo.findSectionsByCourseId(
      tenantId,
      courseId
    );
    const result = [];
    for (const section of sections) {
      const lessons = await courseLmsRepo.findLessonsBySectionId(
        tenantId,
        section.id
      );
      const lessonsWithContent = await Promise.all(
        lessons.map(async (lesson) => {
          let lecture = null;
          let quiz = null;
          let assignment = null;
          if (lesson.type === "LECTURE") {
            const row = await courseLmsRepo.findLectureByLessonId(
              tenantId,
              lesson.id
            );
            lecture = row ? resolveLectureToResponse(row) : null;
          } else if (lesson.type === "QUIZ") {
            quiz = await courseLmsRepo.findQuizByLessonId(tenantId, lesson.id);
          } else if (lesson.type === "ASSIGNMENT") {
            assignment = await courseLmsRepo.findAssignmentByLessonId(
              tenantId,
              lesson.id
            );
          }
          return { lesson, lecture, quiz, assignment };
        })
      );
      result.push({
        ...section,
        lessons: lessonsWithContent,
      });
    }
    return { sections: result };
  }

  /**
   * Bulk-replace all FAQs for a course in a single transaction.
   * Deletes existing FAQs then inserts the new set.
   */
  async syncFaqs(
    tenantId: string,
    courseId: string,
    faqs: Array<{ question: string; answer: string; sort_order: number }>
  ) {
    await ensureCourseAccess(courseId, tenantId);

    const { ulid } = await import("ulid");
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("course_faqs")
        .where("tenant_id", "=", tenantId)
        .where("course_id", "=", courseId)
        .execute();

      for (const faq of faqs) {
        await trx
          .insertInto("course_faqs")
          .values({
            id: ulid(),
            tenant_id: tenantId,
            course_id: courseId,
            question: faq.question,
            answer: faq.answer,
            sort_order: faq.sort_order,
            created_at: now,
            updated_at: now,
          })
          .execute();
      }
    });

    return courseLmsRepo.findFaqsByCourseId(tenantId, courseId);
  }

  async getFaqs(tenantId: string, courseId: string) {
    await ensureCourseAccess(courseId, tenantId);
    return courseLmsRepo.findFaqsByCourseId(tenantId, courseId);
  }

  /**
   * Bulk-replace all course recommendations in a single transaction.
   */
  async syncRecommendations(
    tenantId: string,
    courseId: string,
    recommendedCourseIds: string[]
  ) {
    await ensureCourseAccess(courseId, tenantId);
    return courseLmsRepo.syncCourseRecommendations(
      tenantId,
      courseId,
      recommendedCourseIds
    );
  }

  async getRecommendations(tenantId: string, courseId: string) {
    await ensureCourseAccess(courseId, tenantId);
    return courseLmsRepo.findRecommendationsByCourseId(tenantId, courseId);
  }

  // --- Course Instructors ---
  async getCourseInstructors(tenantId: string, courseId: string) {
    await ensureCourseAccess(courseId, tenantId);
    const rows = await courseLmsRepo.findInstructorsByCourseId(tenantId, courseId);
    return rows.map((row) => ({
      ...row,
      profile_url: row.profile_url && !row.profile_url.startsWith("http")
        ? tenantOrgS3Service.getPublicUrl(row.profile_url)
        : row.profile_url,
    }));
  }

  async syncCourseInstructors(
    tenantId: string,
    courseId: string,
    instructorIds: string[]
  ) {
    await ensureCourseAccess(courseId, tenantId);
    return courseLmsRepo.syncCourseInstructors(tenantId, courseId, instructorIds);
  }

  async createFaq(
    tenantId: string,
    courseId: string,
    data: { question: string; answer: string; sort_order?: number }
  ) {
    await ensureCourseAccess(courseId, tenantId);
    return courseLmsRepo.createCourseFaq({
      tenant_id: tenantId,
      course_id: courseId,
      question: data.question,
      answer: data.answer,
      sort_order: data.sort_order,
    });
  }

  async updateFaq(
    faqId: string,
    tenantId: string,
    data: { question?: string; answer?: string; sort_order?: number }
  ) {
    const faq = await courseLmsRepo.findFaqById(faqId, tenantId);
    if (!faq) throw new NotFoundError("FAQ not found");
    return courseLmsRepo.updateCourseFaq(faqId, tenantId, data);
  }

  async deleteFaq(faqId: string, tenantId: string) {
    const faq = await courseLmsRepo.findFaqById(faqId, tenantId);
    if (!faq) throw new NotFoundError("FAQ not found");
    const ok = await courseLmsRepo.deleteCourseFaq(faqId, tenantId);
    if (!ok) throw new NotFoundError("FAQ not found");
  }

  /**
   * Turn a pile of uploaded videos into curriculum, in one call.
   *
   * THE SHAPE OF THE PROBLEM
   * ------------------------
   * A creator drops a hundred recordings and says "put these in the Kafka
   * course, in order". One-call-per-video makes that a hundred-step plan for
   * an agent (over the step budget) or a hundred clicks for a human. The loop
   * belongs where the data is: here, so the whole dump is one request, one
   * approval, one verifiable result.
   *
   * Per item: create a LECTURE lesson titled from the file, create its
   * lecture bound to the video, in the order given. Items are validated
   * first: an invalid video id or URL fails the WHOLE call before anything
   * is written, because
   * "97 of your 100 landed" is a mess nobody asked for. Per-item errors
   * after that are collected, not thrown, so one bad row cannot strand the
   * ninety-nine good ones half-attached.
   */
  async bulkAttachVideos(
    tenantId: string,
    courseId: string,
    input: {
      section_id?: string;
      section_title?: string;
      /** video_id: an EVS video id, or a URL when provider is HLS / MP4 / YOUTUBE. */
      items: Array<{ video_id: string; title?: string; provider?: VideoProvider }>;
    }
  ) {
    await ensureCourseAccess(courseId, tenantId);
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestError("items must be a non-empty array of { video_id, title? }");
    }
    if (input.items.length > 200) {
      throw new BadRequestError("At most 200 videos per call, split a larger dump.");
    }

    // Validate EVERY video source up front.
    const sources = input.items.map((item) =>
      normalizeVideoSource(item.provider ?? "EVS", item.video_id)
    );

    // Resolve the destination section: by id, by title (created if absent),
    // or a sensible default so "just put them in the course" works.
    let sectionId = input.section_id;
    if (!sectionId) {
      const wantedTitle = (input.section_title ?? "Uploaded videos").trim();
      const sections = await courseLmsRepo.findSectionsByCourseId(courseId, tenantId);
      const existing = sections.find(
        (s) => s.title.trim().toLowerCase() === wantedTitle.toLowerCase()
      );
      sectionId = existing
        ? existing.id
        : (await this.createSection(tenantId, courseId, { title: wantedTitle })).id;
    }

    const attached: Array<{ video_id: string; lesson_id: string; title: string }> = [];
    const failed: Array<{ video_id: string; error: string }> = [];

    for (let i = 0; i < input.items.length; i += 1) {
      const item = input.items[i]!;
      const title =
        (item.title ?? "").trim() ||
        `Lesson ${i + 1}`;
      try {
        const lesson = await this.createLesson(tenantId, courseId, sectionId, {
          title,
          type: "LECTURE",
        });
        await this.createLecture(tenantId, courseId, lesson.id, {
          title,
          video_key: sources[i]!.videoKey,
          video_provider: sources[i]!.provider,
        });
        attached.push({ video_id: item.video_id, lesson_id: lesson.id, title });
      } catch (err) {
        failed.push({
          video_id: item.video_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      courseId,
      sectionId,
      attachedCount: attached.length,
      failedCount: failed.length,
      attached,
      failed,
    };
  }
}

const courseLmsService = new CourseLmsService();
export default courseLmsService;
