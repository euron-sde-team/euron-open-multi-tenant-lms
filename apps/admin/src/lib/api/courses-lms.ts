/**
 * Tenant LMS Courses API client
 * Courses table + sections, lessons, lectures, quizzes, assignments.
 * Base path: /tenant/courses (x-tenant-id set by axios interceptor)
 */

import type { ApiResponse } from "../types/auth";
import type {
  LMSCourse,
  LMSCoursesListResponse,
  LMSCourseFullResponse,
  CourseSection,
  CourseLesson,
  Lecture,
  Quiz,
  QuizQuestion,
  Assignment,
  CourseFaq,
  CourseInstructorResponse,
  LessonType,
} from "../types/course-lms";

import { apiClient } from "./axios";

const BASE = "/tenant/courses";

/** Structured lesson resource (course_lesson_resources table) */
export type LessonResourceType = "PDF" | "LINK" | "TEXT" | "IMAGE" | "GITHUB";

export interface LessonResource {
  id: string;
  type: LessonResourceType;
  title: string;
  url?: string | null;
  /** HTML content for TEXT resources */
  content?: string | null;
  downloadable: boolean;
  sort_order: number;
}

export interface CreateLessonResourceRequest {
  type: LessonResourceType;
  title: string;
  url?: string | null;
  content?: string | null;
  downloadable?: boolean;
  sort_order?: number;
}

export type UpdateLessonResourceRequest = Partial<CreateLessonResourceRequest>;

export const coursesLmsApi = {
  getCourses: async (
    params?: { page?: number; limit?: number; status?: string; mode?: string; course_type?: string }
  ): Promise<LMSCoursesListResponse> => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.status) search.set("status", params.status);
    if (params?.mode) search.set("mode", params.mode);
    if (params?.course_type) search.set("course_type", params.course_type);
    const q = search.toString();
    const response = await apiClient.get<ApiResponse<LMSCoursesListResponse>>(
      q ? `${BASE}?${q}` : BASE
    );
    return response.data.data;
  },

  getCourse: async (courseId: string): Promise<LMSCourse> => {
    const response = await apiClient.get<ApiResponse<LMSCourse>>(
      `${BASE}/${courseId}`
    );
    return response.data.data;
  },

  /**
   * Get course by slug (for editor: resolve page slug -> LMS course).
   * Pass the direct slug only (e.g. "python-masterclass"), not "courses/python-masterclass".
   * URL: /tenant/courses/by-slug/python-masterclass
   * Returns null if 404 (no LMS course → show default template).
   */
  getCourseBySlug: async (slug: string): Promise<LMSCourse | null> => {
    try {
      const response = await apiClient.get<ApiResponse<LMSCourse>>(
        `${BASE}/by-slug/${encodeURIComponent(slug)}`
      );
      return response.data.data;
    } catch (err: unknown) {
      if ((err as import("./axios").ApiError).status === 404) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Get course with full LMS tree (sections, lessons, lecture/quiz/assignment per lesson) and FAQs.
   * Single request for editor load.
   */
  getCourseFull: async (
    courseId: string
  ): Promise<LMSCourseFullResponse> => {
    const response = await apiClient.get<ApiResponse<LMSCourseFullResponse>>(
      `${BASE}/${courseId}/full`
    );
    return response.data.data;
  },

  createCourse: async (data: {
    title: string;
    slug: string;
    mode?: string;
    course_type?: string;
    [key: string]: unknown;
  }): Promise<LMSCourse> => {
    const response = await apiClient.post<ApiResponse<LMSCourse>>(BASE, data);
    return response.data.data;
  },

  updateCourse: async (
    courseId: string,
    data: Partial<
      Pick<
        LMSCourse,
        | "title"
        | "slug"
        | "status"
        | "mode"
        | "subtitle"
        | "description"
        | "duration"
        | "learningOutcomes"
        | "prerequisites"
        | "priceInr"
        | "priceUsd"
        | "discountInr"
        | "discountUsd"
        | "prices"
        | "purchaseMode"
        | "categoryIds"
        | "language"
        | "thumbnailKey"
        | "secondaryThumbnailKey"
        | "previewKey"
        | "lmsTemplateId"
        | "lmsSettings"
        | "courseType"
        | "validityDays"
        | "difficulty"
      >
    >
  ): Promise<LMSCourse> => {
    // Map camelCase to snake_case for the backend
    const body: Record<string, unknown> = {};
    if (data.title !== undefined) body.title = data.title;
    if (data.slug !== undefined) body.slug = data.slug;
    if (data.status !== undefined) body.status = data.status;
    if (data.mode !== undefined) body.mode = data.mode;
    if (data.subtitle !== undefined) body.subtitle = data.subtitle;
    if (data.description !== undefined) body.description = data.description;
    if (data.duration !== undefined) body.duration = data.duration;
    if (data.learningOutcomes !== undefined) body.learning_outcomes = data.learningOutcomes;
    if (data.prerequisites !== undefined) body.prerequisites = data.prerequisites;
    if (data.priceInr !== undefined) body.price_inr = data.priceInr;
    if (data.priceUsd !== undefined) body.price_usd = data.priceUsd;
    if (data.discountInr !== undefined) body.discount_inr = data.discountInr;
    if (data.discountUsd !== undefined) body.discount_usd = data.discountUsd;
    if (data.prices !== undefined) body.prices = data.prices;
    if (data.purchaseMode !== undefined) body.purchase_mode = data.purchaseMode;
    if (data.categoryIds !== undefined) body.category_ids = data.categoryIds;
    if (data.language !== undefined) body.language = data.language;
    if (data.thumbnailKey !== undefined) body.thumbnail_key = data.thumbnailKey;
    if (data.secondaryThumbnailKey !== undefined) body.secondary_thumbnail_key = data.secondaryThumbnailKey;
    if (data.previewKey !== undefined) body.preview_key = data.previewKey;
    if (data.lmsTemplateId !== undefined) body.lms_template_id = data.lmsTemplateId;
    if (data.lmsSettings !== undefined) body.lms_settings = data.lmsSettings;
    if (data.courseType !== undefined) body.course_type = data.courseType;
    if (data.validityDays !== undefined) body.validity_days = data.validityDays;
    if (data.difficulty !== undefined) body.difficulty = data.difficulty;

    const response = await apiClient.put<ApiResponse<LMSCourse>>(
      `${BASE}/${courseId}`,
      body
    );
    return response.data.data;
  },

  deleteCourse: async (courseId: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${courseId}`);
  },

  getSections: async (courseId: string): Promise<CourseSection[]> => {
    const response = await apiClient.get<ApiResponse<CourseSection[]>>(
      `${BASE}/${courseId}/sections`
    );
    return response.data.data;
  },

  createSection: async (
    courseId: string,
    data: { title: string; sort_order?: number }
  ): Promise<CourseSection> => {
    const response = await apiClient.post<ApiResponse<CourseSection>>(
      `${BASE}/${courseId}/sections`,
      data
    );
    return response.data.data;
  },

  updateSection: async (
    courseId: string,
    sectionId: string,
    data: { title?: string; sort_order?: number }
  ): Promise<CourseSection> => {
    const response = await apiClient.put<ApiResponse<CourseSection>>(
      `${BASE}/${courseId}/sections/${sectionId}`,
      data
    );
    return response.data.data;
  },

  deleteSection: async (
    courseId: string,
    sectionId: string
  ): Promise<void> => {
    await apiClient.delete(
      `${BASE}/${courseId}/sections/${sectionId}`
    );
  },

  getLessons: async (
    courseId: string,
    sectionId: string
  ): Promise<CourseLesson[]> => {
    const response = await apiClient.get<ApiResponse<CourseLesson[]>>(
      `${BASE}/${courseId}/sections/${sectionId}/lessons`
    );
    return response.data.data;
  },

  getLesson: async (
    courseId: string,
    lessonId: string
  ): Promise<CourseLesson> => {
    const response = await apiClient.get<ApiResponse<CourseLesson>>(
      `${BASE}/${courseId}/lessons/${lessonId}`
    );
    return response.data.data;
  },

  createLesson: async (
    courseId: string,
    sectionId: string,
    data: {
      title: string;
      type: LessonType;
      sort_order?: number;
      is_preview?: boolean;
    }
  ): Promise<CourseLesson> => {
    const response = await apiClient.post<ApiResponse<CourseLesson>>(
      `${BASE}/${courseId}/sections/${sectionId}/lessons`,
      data
    );
    return response.data.data;
  },

  updateLesson: async (
    courseId: string,
    lessonId: string,
    data: Partial<{
      title: string;
      type: LessonType;
      sort_order: number;
      is_preview: boolean;
    }>
  ): Promise<CourseLesson> => {
    const response = await apiClient.put<ApiResponse<CourseLesson>>(
      `${BASE}/${courseId}/lessons/${lessonId}`,
      data
    );
    return response.data.data;
  },

  deleteLesson: async (
    courseId: string,
    lessonId: string
  ): Promise<void> => {
    await apiClient.delete(`${BASE}/${courseId}/lessons/${lessonId}`);
  },

  getLecture: async (
    courseId: string,
    lessonId: string
  ): Promise<Lecture> => {
    const response = await apiClient.get<ApiResponse<Lecture>>(
      `${BASE}/${courseId}/lessons/${lessonId}/lecture`
    );
    return response.data.data;
  },

  createLecture: async (
    courseId: string,
    lessonId: string,
    data: {
      title: string;
      video_key?: string | null;
      video_provider?: "YOUTUBE" | "EVS" | "HLS" | "MP4" | null;
      duration?: string | null;
      resource_links?: string[];
      summary?: string | null;
    }
  ): Promise<Lecture> => {
    const response = await apiClient.post<ApiResponse<Lecture>>(
      `${BASE}/${courseId}/lessons/${lessonId}/lecture`,
      data
    );
    return response.data.data;
  },

  updateLecture: async (
    courseId: string,
    lessonId: string,
    data: {
      title?: string;
      video_key?: string | null;
      video_provider?: "YOUTUBE" | "EVS" | "HLS" | "MP4" | null;
      duration?: string | null;
      resource_links?: string[];
      summary?: string | null;
    }
  ): Promise<Lecture> => {
    const response = await apiClient.put<ApiResponse<Lecture>>(
      `${BASE}/${courseId}/lessons/${lessonId}/lecture`,
      data
    );
    return response.data.data;
  },

  /**
   * List structured resources for a lesson.
   * GET /tenant/courses/:courseId/lessons/:lessonId/resources
   */
  getLessonResources: async (
    courseId: string,
    lessonId: string
  ): Promise<LessonResource[]> => {
    const response = await apiClient.get<ApiResponse<LessonResource[]>>(
      `${BASE}/${courseId}/lessons/${lessonId}/resources`
    );
    return response.data.data;
  },

  /**
   * Create a structured lesson resource.
   * POST /tenant/courses/:courseId/lessons/:lessonId/resources
   */
  createLessonResource: async (
    courseId: string,
    lessonId: string,
    data: CreateLessonResourceRequest
  ): Promise<LessonResource> => {
    const response = await apiClient.post<ApiResponse<LessonResource>>(
      `${BASE}/${courseId}/lessons/${lessonId}/resources`,
      data
    );
    return response.data.data;
  },

  /**
   * Update a structured lesson resource.
   * PATCH /tenant/courses/:courseId/lessons/:lessonId/resources/:resourceId
   */
  updateLessonResource: async (
    courseId: string,
    lessonId: string,
    resourceId: string,
    data: UpdateLessonResourceRequest
  ): Promise<LessonResource> => {
    const response = await apiClient.patch<ApiResponse<LessonResource>>(
      `${BASE}/${courseId}/lessons/${lessonId}/resources/${resourceId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Delete a structured lesson resource.
   * DELETE /tenant/courses/:courseId/lessons/:lessonId/resources/:resourceId
   */
  deleteLessonResource: async (
    courseId: string,
    lessonId: string,
    resourceId: string
  ): Promise<void> => {
    await apiClient.delete(
      `${BASE}/${courseId}/lessons/${lessonId}/resources/${resourceId}`
    );
  },

  getQuiz: async (
    courseId: string,
    lessonId: string
  ): Promise<Quiz> => {
    const response = await apiClient.get<ApiResponse<Quiz>>(
      `${BASE}/${courseId}/lessons/${lessonId}/quiz`
    );
    return response.data.data;
  },

  createQuiz: async (
    courseId: string,
    lessonId: string,
    data: { title: string }
  ): Promise<Quiz> => {
    const response = await apiClient.post<ApiResponse<Quiz>>(
      `${BASE}/${courseId}/lessons/${lessonId}/quiz`,
      data
    );
    return response.data.data;
  },

  getQuizQuestions: async (
    courseId: string,
    quizId: string
  ): Promise<QuizQuestion[]> => {
    const response = await apiClient.get<ApiResponse<QuizQuestion[]>>(
      `${BASE}/${courseId}/quizzes/${quizId}/questions`
    );
    return response.data.data;
  },

  createQuizQuestion: async (
    courseId: string,
    quizId: string,
    data: {
      question: string;
      question_type?: "MCQ" | "DRAG_DROP";
      marks?: number;
      sort_order?: number;
    }
  ): Promise<QuizQuestion> => {
    const response = await apiClient.post<ApiResponse<QuizQuestion>>(
      `${BASE}/${courseId}/quizzes/${quizId}/questions`,
      data
    );
    return response.data.data;
  },

  createQuizOption: async (
    courseId: string,
    questionId: string,
    data: {
      option_text: string;
      is_correct?: boolean;
      // Multi-blank DRAG_DROP: which blank this option answers (0-indexed).
      blank_index?: number | null;
      explanation?: string | null;
      sort_order?: number;
    }
  ): Promise<unknown> => {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `${BASE}/${courseId}/questions/${questionId}/options`,
      data
    );
    return response.data.data;
  },

  updateQuizQuestion: async (
    courseId: string,
    quizId: string,
    questionId: string,
    data: {
      question?: string;
      question_type?: "MCQ" | "DRAG_DROP";
      marks?: number;
      sort_order?: number;
    }
  ): Promise<QuizQuestion> => {
    const response = await apiClient.patch<ApiResponse<QuizQuestion>>(
      `${BASE}/${courseId}/quizzes/${quizId}/questions/${questionId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Import quiz questions from a CSV file.
   * POST /tenant/courses/:courseId/quizzes/:quizId/questions/import
   * Returns { created } on success; 400 with row error messages on bad rows.
   */
  importQuizQuestionsCsv: async (
    courseId: string,
    quizId: string,
    file: File
  ): Promise<{
    created: number;
    skipped?: number;
    duplicates?: Array<{ question: string; reason: string }>;
  }> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<
      ApiResponse<{
        created: number;
        skipped?: number;
        duplicates?: Array<{ question: string; reason: string }>;
      }>
    >(`${BASE}/${courseId}/quizzes/${quizId}/questions/import`, formData);
    return response.data.data;
  },

  /** Import questions from a test Question Bank into the quiz. */
  importQuizQuestionsFromBank: async (
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
  ): Promise<{ created: number; skipped: number }> => {
    const response = await apiClient.post<
      ApiResponse<{ created: number; skipped: number }>
    >(`${BASE}/${courseId}/quizzes/${quizId}/import-from-bank`, {
      bank_id: bankId,
      question_ids: questionIds,
      selection,
    });
    return response.data.data;
  },

  deleteQuizQuestion: async (
    courseId: string,
    quizId: string,
    questionId: string
  ): Promise<void> => {
    await apiClient.delete(
      `${BASE}/${courseId}/quizzes/${quizId}/questions/${questionId}`
    );
  },

  updateQuizOption: async (
    courseId: string,
    questionId: string,
    optionId: string,
    data: {
      option_text?: string;
      is_correct?: boolean;
      blank_index?: number | null;
      sort_order?: number;
    }
  ): Promise<unknown> => {
    const response = await apiClient.patch<ApiResponse<unknown>>(
      `${BASE}/${courseId}/questions/${questionId}/options/${optionId}`,
      data
    );
    return response.data.data;
  },

  deleteQuizOption: async (
    courseId: string,
    questionId: string,
    optionId: string
  ): Promise<void> => {
    await apiClient.delete(
      `${BASE}/${courseId}/questions/${questionId}/options/${optionId}`
    );
  },

  getAssignment: async (
    courseId: string,
    lessonId: string
  ): Promise<Assignment> => {
    const response = await apiClient.get<ApiResponse<Assignment>>(
      `${BASE}/${courseId}/lessons/${lessonId}/assignment`
    );
    return response.data.data;
  },

  createAssignment: async (
    courseId: string,
    lessonId: string,
    data: {
      title: string;
      instructions?: string | null;
      resource_links?: string[];
    }
  ): Promise<Assignment> => {
    const response = await apiClient.post<ApiResponse<Assignment>>(
      `${BASE}/${courseId}/lessons/${lessonId}/assignment`,
      data
    );
    return response.data.data;
  },

  /**
   * Bulk reorder all sections of a course in one transaction.
   * Optimised single-statement UPDATE on the backend (VALUES + JOIN, diff-based).
   * Pass the full desired order. Stale clients receive 409 STALE_CURRICULUM.
   * PUT /tenant/courses/:courseId/sections/reorder
   */
  reorderSections: async (
    courseId: string,
    sectionIds: string[]
  ): Promise<{ updated: number; sections: Array<{ id: string; sort_order: number }> }> => {
    const response = await apiClient.put<
      ApiResponse<{
        updated: number;
        sections: Array<{ id: string; sort_order: number }>;
      }>
    >(`${BASE}/${courseId}/sections/reorder`, { section_ids: sectionIds });
    return response.data.data;
  },

  /**
   * Bulk reorder all lessons within a single section in one transaction.
   * 409 STALE_CURRICULUM if the lesson set has changed since the client loaded.
   * PUT /tenant/courses/:courseId/sections/:sectionId/lessons/reorder
   */
  reorderLessonsInSection: async (
    courseId: string,
    sectionId: string,
    lessonIds: string[]
  ): Promise<{
    updated: number;
    lessons: Array<{ id: string; section_id: string; sort_order: number }>;
  }> => {
    const response = await apiClient.put<
      ApiResponse<{
        updated: number;
        lessons: Array<{ id: string; section_id: string; sort_order: number }>;
      }>
    >(`${BASE}/${courseId}/sections/${sectionId}/lessons/reorder`, {
      lesson_ids: lessonIds,
    });
    return response.data.data;
  },

  /**
   * Cross-section lesson move (also resequences source + target in one trx).
   * `sourceLessonIds` = new source order EXCLUDING the moved lesson.
   * `targetLessonIds` = new target order INCLUDING the moved lesson.
   * 400 if source === target (use reorder endpoint instead).
   * 409 STALE_CURRICULUM if either sibling set has drifted server-side.
   * PUT /tenant/courses/:courseId/lessons/move
   */
  moveLesson: async (
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
    sourceLessons: Array<{ id: string; section_id: string; sort_order: number }>;
    targetLessons: Array<{ id: string; section_id: string; sort_order: number }>;
  }> => {
    const response = await apiClient.put<
      ApiResponse<{
        updated: number;
        sourceLessons: Array<{ id: string; section_id: string; sort_order: number }>;
        targetLessons: Array<{ id: string; section_id: string; sort_order: number }>;
      }>
    >(`${BASE}/${courseId}/lessons/move`, {
      lesson_id: payload.lessonId,
      source_section_id: payload.sourceSectionId,
      target_section_id: payload.targetSectionId,
      source_lesson_ids: payload.sourceLessonIds,
      target_lesson_ids: payload.targetLessonIds,
    });
    return response.data.data;
  },

  /**
   * Bulk-replace the entire curriculum (sections + lessons + lectures) in one request.
   * Also saves lms_template_id and lms_settings on the course row.
   * PUT /tenant/courses/:courseId/curriculum
   */
  syncCurriculum: async (
    courseId: string,
    payload: {
      sections: Array<{
        title: string;
        sort_order: number;
        lessons: Array<{
          title: string;
          type: "LECTURE" | "QUIZ" | "ASSIGNMENT";
          sort_order: number;
          is_preview: boolean;
          lecture: {
            title: string;
            video_key: string | null;
            video_provider: "YOUTUBE" | "EVS" | "HLS" | "MP4" | null;
            duration: string | null;
            resource_links: string[];
            summary: string | null;
          } | null;
        }>;
      }>;
      lms_template_id?: string;
      lms_settings?: unknown;
    }
  ): Promise<unknown> => {
    const response = await apiClient.put<ApiResponse<unknown>>(
      `${BASE}/${courseId}/curriculum`,
      payload
    );
    return response.data.data;
  },

  /**
   * Bulk-replace all FAQs for a course in one request.
   * PUT /tenant/courses/:courseId/faqs/sync
   */
  syncFaqs: async (
    courseId: string,
    faqs: Array<{ question: string; answer: string; sort_order: number }>
  ): Promise<CourseFaq[]> => {
    const response = await apiClient.put<ApiResponse<CourseFaq[]>>(
      `${BASE}/${courseId}/faqs/sync`,
      { faqs }
    );
    return response.data.data;
  },

  getFaqs: async (courseId: string): Promise<CourseFaq[]> => {
    const response = await apiClient.get<ApiResponse<CourseFaq[]>>(
      `${BASE}/${courseId}/faqs`
    );
    return response.data.data;
  },

  createFaq: async (
    courseId: string,
    data: { question: string; answer: string; sort_order?: number }
  ): Promise<CourseFaq> => {
    const response = await apiClient.post<ApiResponse<CourseFaq>>(
      `${BASE}/${courseId}/faqs`,
      data
    );
    return response.data.data;
  },

  updateFaq: async (
    courseId: string,
    faqId: string,
    data: { question?: string; answer?: string; sort_order?: number }
  ): Promise<CourseFaq> => {
    const response = await apiClient.put<ApiResponse<CourseFaq>>(
      `${BASE}/${courseId}/faqs/${faqId}`,
      data
    );
    return response.data.data;
  },

  deleteFaq: async (
    courseId: string,
    faqId: string
  ): Promise<void> => {
    await apiClient.delete(`${BASE}/${courseId}/faqs/${faqId}`);
  },

  /**
   * Bulk-replace all course recommendations.
   * PUT /tenant/courses/:courseId/recommendations/sync
   */
  syncRecommendations: async (
    courseId: string,
    recommendedCourseIds: string[]
  ): Promise<{ id: string; recommended_course_id: string; sort_order: number }[]> => {
    const response = await apiClient.put<ApiResponse<{ id: string; recommended_course_id: string; sort_order: number }[]>>(
      `${BASE}/${courseId}/recommendations/sync`,
      { recommendedCourseIds }
    );
    return response.data.data;
  },

  getRecommendations: async (
    courseId: string
  ): Promise<{ id: string; recommended_course_id: string; sort_order: number }[]> => {
    const response = await apiClient.get<ApiResponse<{ id: string; recommended_course_id: string; sort_order: number }[]>>(
      `${BASE}/${courseId}/recommendations`
    );
    return response.data.data;
  },

  /**
   * Get instructors assigned to a course.
   * GET /tenant/courses/:courseId/instructors
   */
  getCourseInstructors: async (
    courseId: string
  ): Promise<CourseInstructorResponse[]> => {
    const response = await apiClient.get<ApiResponse<CourseInstructorResponse[]>>(
      `${BASE}/${courseId}/instructors`
    );
    return response.data.data;
  },

  /**
   * Bulk-replace all course instructors.
   * PUT /tenant/courses/:courseId/instructors/sync
   */
  syncCourseInstructors: async (
    courseId: string,
    instructorIds: string[]
  ): Promise<CourseInstructorResponse[]> => {
    const response = await apiClient.put<ApiResponse<CourseInstructorResponse[]>>(
      `${BASE}/${courseId}/instructors/sync`,
      { instructorIds }
    );
    return response.data.data;
  },

  /**
   * Get course reviews (for ratings section in editor preview).
   * GET /tenant/courses/:courseId/reviews
   */
  getCourseReviews: async (
    courseId: string
  ): Promise<{
    reviews: Array<{
      id: string;
      tenant_member_id: string;
      rating: number;
      review_text: string | null;
      created_at: string;
    }>;
    summary: { average: number; count: number };
  }> => {
    const response = await apiClient.get<
      ApiResponse<{
        reviews: Array<{
          id: string;
          tenant_member_id: string;
          rating: number;
          review_text: string | null;
          created_at: string;
        }>;
        summary: { average: number; count: number };
      }>
    >(`${BASE}/${courseId}/reviews`);
    return response.data.data;
  },

};



// --- Question Asset Library (reusable uploaded question files, Bug 2) ---

export interface QuestionAsset {
  id: string;
  name: string;
  questionCount: number;
  createdAt: string;
}

export const questionAssetsApi = {
  list: async (): Promise<QuestionAsset[]> => {
    const r = await apiClient.get<ApiResponse<{ assets: QuestionAsset[] }>>(
      "/tenant/question-assets"
    );
    return r.data.data.assets ?? [];
  },
  create: async (
    file: File,
    name?: string
  ): Promise<{ id: string; question_count: number }> => {
    const formData = new FormData();
    formData.append("file", file);
    if (name) formData.append("name", name);
    const r = await apiClient.post<
      ApiResponse<{ id: string; question_count: number }>
    >("/tenant/question-assets", formData);
    return r.data.data;
  },
  remove: async (assetId: string): Promise<void> => {
    await apiClient.delete(`/tenant/question-assets/${assetId}`);
  },
  importToQuiz: async (
    assetId: string,
    courseId: string,
    quizId: string
  ): Promise<{ created: number }> => {
    const r = await apiClient.post<ApiResponse<{ created: number }>>(
      `/tenant/question-assets/${assetId}/import-to-quiz`,
      { course_id: courseId, quiz_id: quizId }
    );
    return r.data.data;
  },
};
