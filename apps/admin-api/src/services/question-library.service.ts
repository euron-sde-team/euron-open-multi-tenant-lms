import { db } from "../db/connection";
import * as courseLmsRepo from "../repositories/course-lms.repository";
import * as quizzesRepo from "../repositories/quizzes.repository";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import logger from "../utils/logger";
import entitlementsService from "./entitlements.service";

/**
 * Question Library: lets tenant admins discover and reuse quiz questions
 * (with their options + marks) already authored under their account across all
 * courses/quizzes. Unlike the Asset Library (which references one video from
 * many lectures), questions are COPIED: each imported question becomes brand new
 * quiz_questions/quiz_options rows owned by the destination quiz and is fully
 * editable thereafter, independent of the source.
 *
 * Tree shape returned to the frontend:
 *   courses[]: { id, title, slug, status, thumbnailKey, questionCount, updatedAt }
 *   (course expand) quizzes[] -> questions[] { questionId, question, marks, optionCount }
 */

export interface QuestionCourseSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  thumbnailKey: string | null;
  updatedAt: Date;
  questionCount: number;
}

export interface LibraryQuestionNode {
  questionId: string;
  question: string;
  marks: number;
  sortOrder: number;
  optionCount: number;
}

export interface LibraryQuizNode {
  quizId: string;
  quizTitle: string;
  status: string;
  sortOrder: number;
  questions: LibraryQuestionNode[];
}

export interface QuestionCourseTree {
  courseId: string;
  quizzes: LibraryQuizNode[];
}

export interface QuestionSearchHit {
  questionId: string;
  question: string;
  marks: number;
  optionCount: number;
  quizId: string;
  quizTitle: string;
  quizStatus: string;
  courseId: string;
  courseTitle: string;
}

export interface QuestionDetail {
  questionId: string;
  question: string;
  marks: number;
  options: Array<{
    optionId: string;
    optionText: string;
    isCorrect: boolean;
    sortOrder: number;
  }>;
}

export interface ListCoursesFilters {
  search?: string;
  status?: "DRAFT" | "PUBLISHED";
  limit?: number;
  offset?: number;
}

export interface ImportQuestionInput {
  question: string;
  marks?: number;
  options: Array<{
    option_text: string;
    is_correct?: boolean;
    sort_order?: number;
  }>;
}

/**
 * Page of courses that contain at least one quiz question.
 * Top-level tree node list in the Question Library picker.
 */
async function listCourses(
  tenantId: string,
  filters: ListCoursesFilters = {}
): Promise<{ items: QuestionCourseSummary[]; nextOffset: number | null }> {
  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;
  const rows = await courseLmsRepo.findCoursesWithQuestions(tenantId, {
    search: filters.search,
    status: filters.status,
    limit: limit + 1, // fetch one extra to detect "has more"
    offset,
  });
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: slice.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      status: String(r.status),
      thumbnailKey: r.thumbnail_key ?? null,
      updatedAt: r.updated_at,
      questionCount: r.question_count,
    })),
    nextOffset: hasMore ? offset + limit : null,
  };
}

/**
 * Per-course tree: quizzes -> questions. Empty quizzes (no questions) drop out
 * naturally because the repo INNER-joins quiz_questions.
 */
async function getCourseTree(
  tenantId: string,
  courseId: string
): Promise<QuestionCourseTree> {
  const flat = await courseLmsRepo.findCourseQuestionTree(tenantId, courseId);
  return { courseId, quizzes: groupFlatRowsIntoTree(flat) };
}

/**
 * Cross-course search by question text / quiz title / course title.
 * Flat hit list (no tree assembly), best for search UX.
 */
async function searchQuestions(
  tenantId: string,
  query: string,
  limit = 30
): Promise<QuestionSearchHit[]> {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return [];
  if (trimmed.length < 2) {
    throw new BadRequestError("Search query must be at least 2 characters");
  }
  const rows = await courseLmsRepo.searchQuestions(tenantId, trimmed, limit);
  return rows.map((r) => ({
    questionId: r.question_id,
    question: r.question,
    marks: Number(r.marks),
    optionCount: r.option_count,
    quizId: r.quiz_id,
    quizTitle: r.quiz_title,
    quizStatus: String(r.quiz_status),
    courseId: r.course_id,
    courseTitle: r.course_title,
  }));
}

/**
 * Full detail (question + every option) for a set of selected question ids.
 * Feeds the editable "review before save" step in the picker.
 */
async function getQuestionsDetail(
  tenantId: string,
  questionIds: string[]
): Promise<QuestionDetail[]> {
  const ids = Array.from(new Set(questionIds.filter(Boolean)));
  if (ids.length === 0) return [];
  if (ids.length > 200) {
    throw new BadRequestError("Too many questions selected (max 200)");
  }
  const [questions, options] = await Promise.all([
    db
      .selectFrom("quiz_questions")
      .select(["id", "question", "marks"])
      .where("tenant_id", "=", tenantId)
      .where("id", "in", ids)
      .execute(),
    courseLmsRepo.findOptionsByQuestionIds(tenantId, ids),
  ]);
  const optionsByQuestion = new Map<string, typeof options>();
  for (const o of options) {
    const list = optionsByQuestion.get(o.question_id) ?? [];
    list.push(o);
    optionsByQuestion.set(o.question_id, list);
  }
  // Preserve the caller's selection order.
  const byId = new Map(questions.map((q) => [q.id, q]));
  return ids
    .map((id) => byId.get(id))
    .filter((q): q is (typeof questions)[number] => Boolean(q))
    .map((q) => ({
      questionId: q.id,
      question: q.question,
      marks: Number(q.marks),
      options: (optionsByQuestion.get(q.id) ?? []).map((o) => ({
        optionId: o.id,
        optionText: o.option_text,
        isCorrect: Boolean(o.is_correct),
        sortOrder: Number(o.sort_order),
      })),
    }));
}

/**
 * Copy a batch of (already edited) questions into a destination quiz.
 * - Verifies the destination quiz belongs to the tenant.
 * - Appends after the quiz's current highest sort_order.
 * - One transaction: each question -> new quiz_questions row, then its options
 *   -> new quiz_options rows, all with fresh ULIDs.
 * - Deliberately does NOT enforce quiz_questions_per_quiz: admins can import as
 *   many questions as they want (calls the repo inserts directly, bypassing the
 *   limit check in course-lms.service.createQuizQuestion).
 */
async function importQuestionsToQuiz(
  tenantId: string,
  destQuizId: string,
  questions: ImportQuestionInput[]
): Promise<{ added: number }> {
  if (!destQuizId) {
    throw new BadRequestError("quizId is required");
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new BadRequestError("At least one question is required");
  }

  const quiz = await quizzesRepo.findById(tenantId, destQuizId);
  if (!quiz) {
    throw new NotFoundError("Destination quiz not found");
  }

  // Validate/normalize payload before opening a transaction.
  const normalized = questions.map((q, i) => {
    const text = (q.question ?? "").trim();
    if (!text) {
      throw new BadRequestError(`Question ${i + 1} has empty text`);
    }
    const opts = (q.options ?? [])
      .map((o) => ({
        option_text: (o.option_text ?? "").trim(),
        is_correct: Boolean(o.is_correct),
        sort_order: o.sort_order,
      }))
      .filter((o) => o.option_text.length > 0);
    return {
      question: text,
      marks: q.marks != null && q.marks > 0 ? q.marks : 1,
      options: opts,
    };
  });

  await entitlementsService.ensureQuizQuestionCapacity(
    tenantId,
    await courseLmsRepo.countQuestionsByQuizId(tenantId, destQuizId),
    normalized.length
  );

  const added = await db.transaction().execute(async (trx) => {
    const baseSort =
      (await courseLmsRepo.getMaxQuestionSortOrder(tenantId, destQuizId, trx)) +
      1;

    // One multi-row INSERT for all questions (ids returned in order), then one
    // multi-row INSERT for all options referencing those ids. Two statements
    // instead of one-per-question + one-per-option.
    const questionIds = await courseLmsRepo.createQuizQuestionsBulk(
      normalized.map((q, qi) => ({
        tenant_id: tenantId,
        quiz_id: destQuizId,
        question: q.question,
        marks: q.marks,
        sort_order: baseSort + qi,
      })),
      trx
    );

    const optionInputs = normalized.flatMap((q, qi) =>
      q.options.map((o, oi) => ({
        tenant_id: tenantId,
        question_id: questionIds[qi],
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: o.sort_order != null ? o.sort_order : oi,
      }))
    );
    await courseLmsRepo.createQuizOptionsBulk(optionInputs, trx);

    return questionIds.length;
  });

  logger.info(
    `[question-library] imported ${added} question(s) into quiz ${destQuizId} (tenant ${tenantId})`
  );

  return { added };
}

// --- helpers ---

function groupFlatRowsIntoTree(
  rows: courseLmsRepo.QuestionTreeFlatRow[]
): LibraryQuizNode[] {
  const quizzesById = new Map<string, LibraryQuizNode>();
  for (const r of rows) {
    let quiz = quizzesById.get(r.quiz_id);
    if (!quiz) {
      quiz = {
        quizId: r.quiz_id,
        quizTitle: r.quiz_title,
        status: String(r.quiz_status),
        sortOrder: Number(r.quiz_sort),
        questions: [],
      };
      quizzesById.set(r.quiz_id, quiz);
    }
    quiz.questions.push({
      questionId: r.question_id,
      question: r.question,
      marks: Number(r.marks),
      sortOrder: Number(r.question_sort),
      optionCount: r.option_count,
    });
  }
  // Already ordered by SQL (quiz sort, then question sort); preserve order.
  return Array.from(quizzesById.values());
}

export default {
  listCourses,
  getCourseTree,
  searchQuestions,
  getQuestionsDetail,
  importQuestionsToQuiz,
};
