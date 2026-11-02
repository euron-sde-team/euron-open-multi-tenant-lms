import { ulid } from "ulid";
import { db } from "../db/connection";
import { shuffleArray } from "../utils/shuffle.util";
import { pickLeastServed } from "./question-serve-stats.repository";

export interface QuizWithQuestions {
  id: string;
  tenant_id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  max_score: number;
  pass_percentage: number;
  due_date: Date | null;
  questions: Array<{
    id: string;
    question: string;
    question_type: string;
    marks: number;
    sort_order: number;
    user_selected_option_id?: string;
    options: Array<{
      id: string;
      option_text: string;
      is_correct?: boolean;
      sort_order: number;
    }>;
  }>;
}

export async function getQuizById(
  tenantId: string,
  quizId: string
): Promise<{
  id: string;
  tenant_id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  instructions: string | null;
  max_score: number;
  pass_percentage: number;
  duration_min: number | null;
  due_date: Date | null;
  status: string;
  random_question_count: number | null;
  allow_reattempt: boolean;
  max_attempts: number | null;
} | null> {
  const row = await db
    .selectFrom("quizzes")
    .select([
      "id",
      "tenant_id",
      "course_id",
      "lesson_id",
      "title",
      "instructions",
      "max_score",
      "pass_percentage",
      "duration_min",
      "due_date",
      "status",
      "random_question_count",
      "allow_reattempt",
      "max_attempts",
    ])
    .where("tenant_id", "=", tenantId)
    .where("id", "=", quizId)
    .executeTakeFirst();
  return row as typeof row & { status: string } | null;
}

export interface QuizListItem {
  id: string;
  title: string;
  instructions: string | null;
  max_score: number;
  pass_percentage: number;
  due_date: Date | null;
  has_attempted: boolean;
  attempt_status: string | null;
  score: number | null;
  total_marks: number | null;
}

export async function getQuizzesForCourse(
  tenantId: string,
  memberId: string,
  courseId: string,
  filters?: { section_id?: string; lesson_id?: string; scope?: string }
): Promise<QuizListItem[]> {
  let query = db
    .selectFrom("quizzes")
    .select([
      "quizzes.id",
      "quizzes.title",
      "quizzes.instructions",
      "quizzes.max_score",
      "quizzes.pass_percentage",
      "quizzes.due_date",
    ])
    .where("quizzes.tenant_id", "=", tenantId)
    .where("quizzes.course_id", "=", courseId)
    .where("quizzes.status", "=", "PUBLISHED")
    .orderBy("quizzes.sort_order", "asc")
    .orderBy("quizzes.created_at", "asc");

  if (filters?.section_id) {
    query = query.where("quizzes.section_id", "=", filters.section_id);
  }
  if (filters?.lesson_id) {
    query = query.where("quizzes.lesson_id", "=", filters.lesson_id);
  }
  if (filters?.scope) {
    query = query.where(
      "quizzes.scope",
      "=",
      filters.scope as "COURSE" | "SECTION" | "LESSON"
    );
  }

  const quizzes = await query.execute();
  if (quizzes.length === 0) return [];

  const quizIds = quizzes.map((q) => q.id);
  const attempts = await db
    .selectFrom("quiz_attempts")
    .select(["quiz_id", "id as attempt_id", "status as attempt_status", "score", "total_marks"])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("quiz_id", "in", quizIds)
    .orderBy("started_at", "desc")
    .execute();

  const latestByQuiz = new Map<string, (typeof attempts)[0]>();
  for (const a of attempts) {
    if (!latestByQuiz.has(a.quiz_id)) {
      latestByQuiz.set(a.quiz_id, a);
    }
  }

  return quizzes.map((q) => {
    const att = latestByQuiz.get(q.id);
    return {
      id: q.id,
      title: q.title,
      instructions: q.instructions,
      max_score: Number(q.max_score),
      pass_percentage: Number(q.pass_percentage),
      due_date: q.due_date,
      has_attempted: !!att,
      attempt_status: att?.attempt_status ?? null,
      score: att?.score != null ? Number(att.score) : null,
      total_marks: att?.total_marks != null ? Number(att.total_marks) : null,
    };
  });
}

export async function getQuizByLessonId(
  tenantId: string,
  lessonId: string
): Promise<{
  id: string;
  title: string;
  instructions: string | null;
  max_score: number;
  pass_percentage: number;
  due_date: Date | null;
  status: string;
  question_count: number;
} | null> {
  const quiz = await db
    .selectFrom("quizzes")
    .select([
      "quizzes.id",
      "quizzes.title",
      "quizzes.instructions",
      "quizzes.max_score",
      "quizzes.pass_percentage",
      "quizzes.due_date",
      "quizzes.status",
    ])
    .where("quizzes.tenant_id", "=", tenantId)
    .where("quizzes.lesson_id", "=", lessonId)
    .where("quizzes.status", "=", "PUBLISHED")
    .executeTakeFirst();

  if (!quiz) return null;

  const countResult = await db
    .selectFrom("quiz_questions")
    .select(db.fn.count<number>("id").as("count"))
    .where("tenant_id", "=", tenantId)
    .where("quiz_id", "=", quiz.id)
    .executeTakeFirst();

  return {
    id: quiz.id,
    title: quiz.title,
    instructions: quiz.instructions,
    max_score: Number(quiz.max_score),
    pass_percentage: Number(quiz.pass_percentage),
    due_date: quiz.due_date,
    status: String(quiz.status),
    question_count: Number(countResult?.count ?? 0),
  };
}

export async function getQuizWithQuestions(
  tenantId: string,
  quizId: string,
  includeCorrectAnswers: boolean,
  shuffleSeed?: string
): Promise<QuizWithQuestions | null> {
  const quiz = await db
    .selectFrom("quizzes")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("id", "=", quizId)
    .executeTakeFirst();

  if (!quiz) return null;

  const questions = await db
    .selectFrom("quiz_questions")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("quiz_id", "=", quizId)
    .orderBy("sort_order", "asc")
    .execute();

  const questionIds = questions.map((q) => q.id);
  if (questionIds.length === 0) {
    return {
      ...quiz,
      questions: [],
    } as unknown as QuizWithQuestions;
  }

  const options = await db
    .selectFrom("quiz_options")
    .select([
      "id",
      "question_id",
      "option_text",
      "is_correct",
      "blank_index",
      "sort_order",
    ])
    .where("tenant_id", "=", tenantId)
    .where("question_id", "in", questionIds)
    .orderBy("sort_order", "asc")
    .execute();

  const optionsByQuestion = new Map<string, typeof options>();
  for (const opt of options) {
    const list = optionsByQuestion.get(opt.question_id) ?? [];
    list.push(opt);
    optionsByQuestion.set(opt.question_id, list);
  }

  // When a shuffle seed is supplied (the attempt id), shuffle questions and the
  // options within each question deterministically. The same seed always yields
  // the same order, so the order is stable for the whole attempt and only
  // changes for a fresh attempt. Grading is unaffected (answers map by option id).
  const orderedQuestions = shuffleSeed
    ? shuffleArray(questions, shuffleSeed)
    : questions;

  const questionsWithOptions = orderedQuestions.map((q) => {
    const opts = optionsByQuestion.get(q.id) ?? [];
    const orderedOpts = shuffleSeed
      ? shuffleArray(opts, shuffleSeed + q.id)
      : opts;
    return {
      id: q.id,
      question: q.question,
      question_type: String(q.question_type),
      marks: Number(q.marks),
      sort_order: Number(q.sort_order),
      options: orderedOpts.map((o) => ({
        id: o.id,
        option_text: o.option_text,
        ...(includeCorrectAnswers
          ? { is_correct: o.is_correct, blank_index: o.blank_index }
          : {}),
        sort_order: Number(o.sort_order),
      })),
    };
  });

  return {
    ...quiz,
    questions: questionsWithOptions,
  } as unknown as QuizWithQuestions;
}

export async function getAttemptAnswers(
  tenantId: string,
  attemptId: string
): Promise<Map<string, { option_id: string; answer: unknown }>> {
  const rows = await db
    .selectFrom("quiz_attempt_answers")
    .select(["question_id", "option_id", "answer"])
    .where("tenant_id", "=", tenantId)
    .where("attempt_id", "=", attemptId)
    .execute();

  const map = new Map<string, { option_id: string; answer: unknown }>();
  for (const r of rows) {
    let answer: unknown = r.answer ?? null;
    if (typeof answer === "string") {
      try {
        answer = JSON.parse(answer);
      } catch {
        // leave as-is
      }
    }
    map.set(r.question_id, { option_id: r.option_id, answer });
  }
  return map;
}

export interface QuizAttemptSummary {
  id: string;
  status: string;
  score: number;
  total_marks: number;
  started_at: Date;
  completed_at: Date | null;
}

/** All of a learner's attempts for a quiz, newest first (re-attempt history). */
export async function listAttemptsByMemberAndQuiz(
  tenantId: string,
  memberId: string,
  quizId: string
): Promise<QuizAttemptSummary[]> {
  const rows = await db
    .selectFrom("quiz_attempts")
    .select([
      "id",
      "status",
      "score",
      "total_marks",
      "started_at",
      "completed_at",
    ])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("quiz_id", "=", quizId)
    .orderBy("started_at", "desc")
    .execute();
  return rows as unknown as QuizAttemptSummary[];
}

/** A single attempt by id (for per-attempt review). Tenant-scoped. */
export async function getAttempt(
  tenantId: string,
  attemptId: string
): Promise<{
  id: string;
  quiz_id: string;
  tenant_member_id: string;
  status: string;
  score: number;
  total_marks: number;
  question_ids: string[];
  started_at: Date;
  completed_at: Date | null;
} | null> {
  const row = await db
    .selectFrom("quiz_attempts")
    .select([
      "id",
      "quiz_id",
      "tenant_member_id",
      "status",
      "score",
      "total_marks",
      "question_ids",
      "started_at",
      "completed_at",
    ])
    .where("tenant_id", "=", tenantId)
    .where("id", "=", attemptId)
    .executeTakeFirst();
  return (row ?? null) as unknown as {
    id: string;
    quiz_id: string;
    tenant_member_id: string;
    status: string;
    score: number;
    total_marks: number;
    question_ids: string[];
    started_at: Date;
    completed_at: Date | null;
  } | null;
}

export async function getOrCreateAttempt(
  tenantId: string,
  memberId: string,
  courseId: string,
  quizId: string
): Promise<{
  id: string;
  status: string;
  score: number;
  total_marks: number;
  started_at: Date;
  completed_at: Date | null;
  question_ids: string[];
}> {
  const existing = await db
    .selectFrom("quiz_attempts")
    .selectAll()
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("quiz_id", "=", quizId)
    .orderBy("started_at", "desc")
    .executeTakeFirst();

  if (existing && String(existing.status) === "IN_PROGRESS") {
    return existing as unknown as {
      id: string;
      status: string;
      score: number;
      total_marks: number;
      started_at: Date;
      completed_at: Date | null;
      question_ids: string[];
    };
  }

  const id = ulid();
  const now = new Date();
  await db
    .insertInto("quiz_attempts")
    .values({
      id,
      tenant_id: tenantId,
      tenant_member_id: memberId,
      course_id: courseId,
      quiz_id: quizId,
      score: 0,
      total_marks: 0,
      status: "IN_PROGRESS",
      started_at: now,
      completed_at: null,
      created_at: now,
      updated_at: now,
    })
    .execute();

  const row = await db
    .selectFrom("quiz_attempts")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow();

  return row as unknown as {
    id: string;
    status: string;
    score: number;
    total_marks: number;
    started_at: Date;
    completed_at: Date | null;
    question_ids: string[];
  };
}

export async function getLatestAttempt(
  tenantId: string,
  memberId: string,
  quizId: string
): Promise<{
  id: string;
  status: string;
  score: number;
  total_marks: number;
  started_at: Date;
  completed_at: Date | null;
  question_ids: string[];
} | null> {
  const row = await db
    .selectFrom("quiz_attempts")
    .select([
      "id",
      "status",
      "score",
      "total_marks",
      "started_at",
      "completed_at",
      "question_ids",
    ])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("quiz_id", "=", quizId)
    .orderBy("started_at", "desc")
    .executeTakeFirst();
  return row as typeof row & { status: string } | null;
}

/**
 * Pick `count` random question ids for a quiz (server-side ORDER BY random()).
 * If count >= total questions, all question ids are returned (random order).
 */
export async function pickRandomQuestionIds(
  tenantId: string,
  quizId: string,
  count: number
): Promise<string[]> {
  // Overlap-controlled selection across learners (see pickLeastServed). Pull the
  // full question pool, then spread by least-served rather than pure random().
  const rows = await db
    .selectFrom("quiz_questions")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("quiz_id", "=", quizId)
    .execute();
  return pickLeastServed(tenantId, "QUIZ", quizId, rows.map((r) => r.id), count);
}

/** Record the proctoring tab-switch count on an attempt. */
export async function setAttemptTabSwitches(
  tenantId: string,
  attemptId: string,
  count: number
): Promise<void> {
  await db
    .updateTable("quiz_attempts")
    .set({ tab_switch_count: count, updated_at: new Date() })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", attemptId)
    .execute();
}

/** Persist the fixed question set for an attempt. */
export async function setAttemptQuestionIds(
  tenantId: string,
  attemptId: string,
  questionIds: string[]
): Promise<void> {
  await db
    .updateTable("quiz_attempts")
    .set({
      question_ids: questionIds,
      updated_at: new Date(),
    })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", attemptId)
    .execute();
}

export async function submitAttemptAnswers(
  tenantId: string,
  attemptId: string,
  answers: Array<{ question_id: string; option_id: string; answer?: unknown }>
): Promise<void> {
  const now = new Date();
  for (const a of answers) {
    // Multi-blank DRAG_DROP answers arrive as an array of option ids (one per
    // blank). Persist the full array in `answer`; set option_id to the first
    // chosen option so the NOT NULL FK stays satisfied (grading reads `answer`
    // for multi-blank questions, option_id for everything else).
    const isArrayAnswer = Array.isArray(a.answer);
    const primaryOptionId = isArrayAnswer
      ? ((a.answer as unknown[]).find(
          (x) => typeof x === "string" && x
        ) as string | undefined) ?? a.option_id
      : a.option_id;
    if (!primaryOptionId) continue;
    await db
      .insertInto("quiz_attempt_answers")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        attempt_id: attemptId,
        question_id: a.question_id,
        option_id: primaryOptionId,
        answer: isArrayAnswer ? JSON.stringify(a.answer) : null,
        is_correct: false,
        marks_awarded: 0,
        created_at: now,
      })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "attempt_id", "question_id"]).doNothing()
      )
      .execute();
  }
}

export async function computeAndUpdateAttemptScore(
  tenantId: string,
  attemptId: string,
  quizPassPercentage: number
): Promise<{ score: number; total_marks: number; status: string }> {
  // When the attempt has a fixed random question set, grade only against it.
  const attemptRow = await db
    .selectFrom("quiz_attempts")
    .select("question_ids")
    .where("tenant_id", "=", tenantId)
    .where("id", "=", attemptId)
    .executeTakeFirst();
  const attemptQuestionIds = attemptRow?.question_ids ?? [];
  const questionIdSet = new Set(attemptQuestionIds);

  // Submitted answers + the raw multi-blank answer array, joined to question marks.
  const allAnswers = await db
    .selectFrom("quiz_attempt_answers as qaa")
    .innerJoin("quiz_questions as qq", (join) =>
      join
        .onRef("qq.id", "=", "qaa.question_id")
        .on("qq.tenant_id", "=", tenantId)
    )
    .select([
      "qaa.question_id",
      "qaa.option_id",
      "qaa.answer",
      "qq.marks",
    ])
    .where("qaa.tenant_id", "=", tenantId)
    .where("qaa.attempt_id", "=", attemptId)
    .execute();

  // Per-question option key (is_correct + blank_index) so we can grade both
  // single-option questions and multi-blank DRAG_DROP (one correct option per blank).
  const answeredQuestionIds = [...new Set(allAnswers.map((a) => a.question_id))];
  const optionRows = answeredQuestionIds.length
    ? await db
        .selectFrom("quiz_options")
        .select(["question_id", "id", "is_correct", "blank_index"])
        .where("tenant_id", "=", tenantId)
        .where("question_id", "in", answeredQuestionIds)
        .execute()
    : [];
  const optsByQuestion = new Map<
    string,
    Array<{ id: string; is_correct: boolean; blank_index: number | null }>
  >();
  for (const o of optionRows) {
    const arr = optsByQuestion.get(o.question_id) ?? [];
    arr.push({
      id: o.id,
      is_correct: Boolean(o.is_correct),
      blank_index:
        o.blank_index === null || o.blank_index === undefined
          ? null
          : Number(o.blank_index),
    });
    optsByQuestion.set(o.question_id, arr);
  }

  const gradeOne = (a: (typeof allAnswers)[number]): boolean => {
    const opts = optsByQuestion.get(a.question_id) ?? [];
    const isMultiBlank = opts.some((o) => o.blank_index !== null);
    if (isMultiBlank) {
      // All-or-nothing: every blank's chosen option must match the mapped correct one.
      const correctByBlank = new Map<number, string>();
      for (const o of opts) {
        if (o.is_correct && o.blank_index !== null) {
          correctByBlank.set(o.blank_index, o.id);
        }
      }
      if (correctByBlank.size === 0) return false;
      let submitted: unknown = a.answer;
      if (typeof submitted === "string") {
        try {
          submitted = JSON.parse(submitted);
        } catch {
          submitted = [];
        }
      }
      const arr = Array.isArray(submitted) ? submitted : [];
      for (const [blank, correctId] of correctByBlank) {
        if (String(arr[blank] ?? "") !== String(correctId)) return false;
      }
      return true;
    }
    // Single-option (MCQ / single-blank DRAG_DROP): the chosen option is correct.
    return Boolean(opts.find((o) => o.id === a.option_id)?.is_correct);
  };

  // Answers for questions outside the attempt's set are ignored.
  const graded = (
    questionIdSet.size > 0
      ? allAnswers.filter((a) => questionIdSet.has(a.question_id))
      : allAnswers
  ).map((a) => ({
    question_id: a.question_id,
    marks: Number(a.marks ?? 1),
    isCorrect: gradeOne(a),
  }));

  let score = 0;
  let totalMarks = 0;

  if (questionIdSet.size > 0) {
    // total_marks = sum of marks of the attempt's questions only (answered or not).
    const setQuestions = await db
      .selectFrom("quiz_questions")
      .select("marks")
      .where("tenant_id", "=", tenantId)
      .where("id", "in", attemptQuestionIds)
      .execute();
    for (const q of setQuestions) {
      totalMarks += Number(q.marks ?? 1);
    }
    for (const g of graded) {
      if (g.isCorrect) score += g.marks;
    }
  } else {
    for (const g of graded) {
      totalMarks += g.marks;
      if (g.isCorrect) score += g.marks;
    }
  }

  const scorePct = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
  const status = scorePct >= quizPassPercentage ? "PASSED" : "FAILED";

  for (const g of graded) {
    await db
      .updateTable("quiz_attempt_answers")
      .set({
        is_correct: g.isCorrect,
        marks_awarded: g.isCorrect ? g.marks : 0,
      })
      .where("tenant_id", "=", tenantId)
      .where("attempt_id", "=", attemptId)
      .where("question_id", "=", g.question_id)
      .execute();
  }

  const now = new Date();
  await db
    .updateTable("quiz_attempts")
    .set({
      score,
      total_marks: totalMarks,
      status,
      completed_at: now,
      updated_at: now,
    })
    .where("tenant_id", "=", tenantId)
    .where("id", "=", attemptId)
    .execute();

  return { score, total_marks: totalMarks, status };
}

export async function upsertMemberQuizProgress(
  tenantId: string,
  memberId: string,
  quizId: string,
  courseId: string,
  lessonId: string | null,
  completed: boolean
): Promise<void> {
  const now = new Date();
  const existing = await db
    .selectFrom("member_quiz_progress")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("quiz_id", "=", quizId)
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable("member_quiz_progress")
      .set({
        completed,
        completed_at: completed ? now : null,
        updated_at: now,
      })
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("quiz_id", "=", quizId)
      .execute();
  } else {
    await db
      .insertInto("member_quiz_progress")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        tenant_member_id: memberId,
        quiz_id: quizId,
        lesson_id: lessonId,
        course_id: courseId,
        completed,
        completed_at: completed ? now : null,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
}

export async function getMemberQuizProgress(
  tenantId: string,
  memberId: string,
  quizId: string
): Promise<{ completed: boolean; completed_at: Date | null } | null> {
  const row = await db
    .selectFrom("member_quiz_progress")
    .select(["completed", "completed_at"])
    .where("tenant_id", "=", tenantId)
    .where("tenant_member_id", "=", memberId)
    .where("quiz_id", "=", quizId)
    .executeTakeFirst();
  return row as { completed: boolean; completed_at: Date | null } | null;
}
