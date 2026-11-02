import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import { generateText, Output } from "ai";
import { z } from "zod";
import logger from "../utils/logger";
import coursesRepository from "../repositories/courses.repository";
import * as courseLmsRepo from "../repositories/course-lms.repository";
import * as quizzesRepo from "../repositories/quizzes.repository";
import entitlementsService from "./entitlements.service";
import { getTextModel } from "../lib/ai/provider";

type QuizScope = "COURSE" | "SECTION" | "LESSON";

async function ensureQuizzesEnabled(tenantId: string): Promise<void> {
  await entitlementsService.ensureQuizzesEnabled(tenantId);
}

async function ensureCourseExists(
  tenantId: string,
  courseId: string
): Promise<void> {
  const course = await coursesRepository.findById(courseId);
  if (!course || course.tenant_id !== tenantId) {
    throw new NotFoundError("Course not found");
  }
}

async function ensureSectionExists(
  tenantId: string,
  courseId: string,
  sectionId: string
): Promise<void> {
  const section = await courseLmsRepo.findSectionById(sectionId, tenantId);
  if (!section || section.course_id !== courseId) {
    throw new NotFoundError("Section not found");
  }
}

async function ensureLessonExistsAndIsQuiz(
  tenantId: string,
  courseId: string,
  lessonId: string
): Promise<void> {
  const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
  if (!lesson || lesson.course_id !== courseId) {
    throw new NotFoundError("Lesson not found");
  }
  if (lesson.type !== "QUIZ") {
    throw new BadRequestError("Lesson is not a quiz type");
  }
}

async function validateScopeAndIds(
  tenantId: string,
  dto: {
    scope: QuizScope;
    course_id: string;
    section_id?: string;
    lesson_id?: string;
  }
): Promise<void> {
  if (dto.scope === "COURSE") {
    if (dto.section_id || dto.lesson_id) {
      throw new BadRequestError(
        "COURSE scope: section_id and lesson_id must be null"
      );
    }
  } else if (dto.scope === "SECTION") {
    if (!dto.section_id) {
      throw new BadRequestError("SECTION scope requires section_id");
    }
    if (dto.lesson_id) {
      throw new BadRequestError("SECTION scope: lesson_id must be null");
    }
    await ensureSectionExists(tenantId, dto.course_id, dto.section_id);
  } else if (dto.scope === "LESSON") {
    if (!dto.lesson_id) {
      throw new BadRequestError("LESSON scope requires lesson_id");
    }
    await ensureLessonExistsAndIsQuiz(tenantId, dto.course_id, dto.lesson_id);
    if (dto.section_id) {
      throw new BadRequestError("LESSON scope: section_id must be null");
    }
  }
}

export interface CreateQuizDto {
  title: string;
  course_id: string;
  section_id?: string;
  lesson_id?: string;
  scope: QuizScope;
  instructions?: string;
  max_score?: number;
  pass_percentage?: number;
  /** Overall quiz time limit in minutes; null = no timer. */
  duration_min?: number | null;
  due_date?: string;
  sort_order?: number;
}

export interface UpdateQuizDto {
  title?: string;
  section_id?: string;
  lesson_id?: string;
  scope?: QuizScope;
  instructions?: string;
  max_score?: number;
  pass_percentage?: number;
  /** Overall quiz time limit in minutes; null clears (no timer). */
  duration_min?: number | null;
  due_date?: string;
  sort_order?: number;
  /** How many random questions to serve per attempt; null clears (serve all). */
  random_question_count?: number | null;
  allow_reattempt?: boolean;
  /** Max attempts when allow_reattempt is true; null = unlimited. */
  max_attempts?: number | null;
  proctoring_enabled?: boolean;
  proctor_camera?: boolean;
  proctor_max_tab_switches?: number | null;
  /** "NONE" | "BASIC" | "SCIENTIFIC" */
  calculator_mode?: string;
}

export interface ListQuizzesDto {
  course_id: string;
  section_id?: string;
  lesson_id?: string;
  scope?: QuizScope;
  status?: "DRAFT" | "PUBLISHED";
  page?: number;
  limit?: number;
}

export async function create(
  tenantId: string,
  dto: CreateQuizDto
): Promise<quizzesRepo.QuizRow> {
  await ensureQuizzesEnabled(tenantId);
  await ensureCourseExists(tenantId, dto.course_id);
  await validateScopeAndIds(tenantId, {
    scope: dto.scope,
    course_id: dto.course_id,
    section_id: dto.section_id,
    lesson_id: dto.lesson_id,
  });

  const sectionId = dto.scope === "SECTION" ? dto.section_id : null;
  const lessonId = dto.scope === "LESSON" ? dto.lesson_id : null;
  if (dto.scope === "LESSON" && !lessonId) {
    throw new BadRequestError("LESSON scope requires lesson_id");
  }

  return quizzesRepo.create({
    tenant_id: tenantId,
    course_id: dto.course_id,
    section_id: sectionId,
    lesson_id: lessonId ?? null,
    title: dto.title,
    instructions: dto.instructions ?? null,
    scope: dto.scope,
    status: "DRAFT",
    max_score: dto.max_score ?? 100,
    pass_percentage: dto.pass_percentage ?? 60,
    duration_min: dto.duration_min ?? null,
    due_date: dto.due_date ? new Date(dto.due_date) : null,
    sort_order: dto.sort_order ?? 0,
  });
}

export async function findAll(
  tenantId: string,
  dto: ListQuizzesDto
): Promise<quizzesRepo.ListQuizzesResult> {
  await ensureCourseExists(tenantId, dto.course_id);
  return quizzesRepo.list(tenantId, {
    course_id: dto.course_id,
    section_id: dto.section_id,
    lesson_id: dto.lesson_id,
    status: dto.status,
    scope: dto.scope,
    page: dto.page ?? 1,
    limit: dto.limit ?? 20,
  });
}

export async function findOne(
  tenantId: string,
  id: string
): Promise<
  quizzesRepo.QuizRow & {
    course_title?: string;
    section_title?: string;
    lesson_title?: string;
  }
> {
  const quiz = await quizzesRepo.findByIdWithJoins(tenantId, id);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  return quiz;
}

export async function update(
  tenantId: string,
  id: string,
  dto: UpdateQuizDto
): Promise<quizzesRepo.QuizRow> {
  const existing = await quizzesRepo.findById(tenantId, id);
  if (!existing) {
    throw new NotFoundError("Quiz not found");
  }

  const scope: QuizScope = dto.scope ?? (existing.scope as unknown as QuizScope);
  const sectionId =
    scope === "SECTION" ? dto.section_id ?? existing.section_id : null;
  const lessonId =
    scope === "LESSON" ? dto.lesson_id ?? existing.lesson_id : existing.lesson_id;

  if (dto.scope || dto.section_id !== undefined || dto.lesson_id !== undefined) {
    await validateScopeAndIds(tenantId, {
      scope,
      course_id: existing.course_id,
      section_id: sectionId ?? undefined,
      lesson_id: scope === "LESSON" ? (lessonId ?? undefined) : undefined,
    });
  }

  const dueDateValue =
    dto.due_date !== undefined
      ? dto.due_date
        ? new Date(dto.due_date)
        : null
      : undefined;

  if (
    dto.random_question_count !== undefined &&
    dto.random_question_count !== null &&
    (!Number.isInteger(dto.random_question_count) ||
      dto.random_question_count < 1)
  ) {
    throw new BadRequestError(
      "random_question_count must be a positive integer (>= 1) or null to clear"
    );
  }

  if (
    dto.duration_min !== undefined &&
    dto.duration_min !== null &&
    (!Number.isInteger(dto.duration_min) || dto.duration_min < 1)
  ) {
    throw new BadRequestError(
      "duration_min must be a positive integer (>= 1) or null to clear"
    );
  }

  const updated = await quizzesRepo.update(tenantId, id, {
    title: dto.title,
    instructions: dto.instructions,
    scope: dto.scope,
    section_id: sectionId,
    max_score: dto.max_score,
    pass_percentage: dto.pass_percentage,
    duration_min: dto.duration_min,
    due_date: dueDateValue,
    sort_order: dto.sort_order,
    random_question_count: dto.random_question_count,
    allow_reattempt: dto.allow_reattempt,
    max_attempts: dto.max_attempts,
    proctoring_enabled: dto.proctoring_enabled,
    proctor_camera: dto.proctor_camera,
    proctor_max_tab_switches: dto.proctor_max_tab_switches,
    calculator_mode: dto.calculator_mode,
  });
  if (!updated) {
    throw new NotFoundError("Quiz not found");
  }
  // Keep the curriculum item (lesson) name in sync with the quiz title, so the
  // course tree and lesson preview show the rename instead of the default name.
  if (dto.title !== undefined && lessonId) {
    await courseLmsRepo.updateLesson(lessonId, tenantId, { title: dto.title });
  }
  return updated;
}

export async function publish(
  tenantId: string,
  id: string
): Promise<quizzesRepo.QuizRow> {
  const quiz = await quizzesRepo.findById(tenantId, id);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  if (String(quiz.status) === "PUBLISHED") {
    throw new BadRequestError("Quiz already published");
  }
  const questionCount = await courseLmsRepo.countQuestionsByQuizId(
    tenantId,
    id
  );
  if (questionCount < 1) {
    throw new BadRequestError(
      "Cannot publish quiz without at least one question"
    );
  }
  const updated = await quizzesRepo.updateStatus(tenantId, id, "PUBLISHED");
  if (!updated) {
    throw new NotFoundError("Quiz not found");
  }
  return updated;
}

export async function unpublish(
  tenantId: string,
  id: string
): Promise<quizzesRepo.QuizRow> {
  const quiz = await quizzesRepo.findById(tenantId, id);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  const updated = await quizzesRepo.updateStatus(tenantId, id, "DRAFT");
  if (!updated) {
    throw new NotFoundError("Quiz not found");
  }
  return updated;
}

export async function remove(
  tenantId: string,
  id: string,
  force = false
): Promise<void> {
  const quiz = await quizzesRepo.findById(tenantId, id);
  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }
  if (String(quiz.status) === "PUBLISHED" && !force) {
    throw new BadRequestError(
      "Cannot delete a published quiz. Use force=true to override."
    );
  }
  const deleted = await quizzesRepo.remove(tenantId, id);
  if (!deleted) {
    throw new NotFoundError("Quiz not found");
  }
}

const quizOptionSchema = z.object({
  text: z.string(),
  is_correct: z.boolean(),
});

const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(quizOptionSchema).length(4),
  marks: z.number().default(1),
});

const quizGenerationSchema = z.object({
  title: z.string(),
  instructions: z.string().optional(),
  questions: z.array(quizQuestionSchema).min(3).max(20),
});

const quizQuestionsOnlySchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(quizOptionSchema).min(2).max(6),
      marks: z.number().default(1),
    })
  ),
});

export interface GenerateQuestionsForQuizDto {
  input_text: string;
  question_limit: number;
}

export interface GenerateFromTranscriptDto {
  lecture_id: string;
  /**
   * Source text: the lecture transcript or notes, pasted by the admin. Falls
   * back to the lecture summary when omitted.
   */
  transcript?: string;
  course_id: string;
  section_id?: string;
  lesson_id?: string;
  scope: QuizScope;
  max_score?: number;
  pass_percentage?: number;
  due_date?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  num_questions_hint?: number;
}

export async function generateFromTranscript(
  tenantId: string,
  dto: GenerateFromTranscriptDto
): Promise<quizzesRepo.QuizRow> {
  await ensureQuizzesEnabled(tenantId);
  // Checked before the AI call so a tenant with no question allowance never
  // spends a generation.
  const questionCap = await entitlementsService.getQuizQuestionsLimit(tenantId);
  if (questionCap === 0) {
    await entitlementsService.ensureQuizQuestionCapacity(tenantId, 0, 1);
  }
  await ensureCourseExists(tenantId, dto.course_id);
  await validateScopeAndIds(tenantId, {
    scope: dto.scope,
    course_id: dto.course_id,
    section_id: dto.section_id,
    lesson_id: dto.lesson_id,
  });

  const lecture = await courseLmsRepo.findLectureById(dto.lecture_id, tenantId);
  if (!lecture || lecture.tenant_id !== tenantId) {
    throw new NotFoundError("Lecture not found");
  }
  if (lecture.course_id !== dto.course_id) {
    throw new BadRequestError("Lecture does not belong to this course");
  }

  const transcript = (dto.transcript ?? lecture.summary ?? "").trim();
  if (!transcript) {
    throw new BadRequestError(
      "Paste the lecture transcript or notes (transcript), or add a summary to the lecture first."
    );
  }
  if (transcript.length < 100) {
    throw new BadRequestError("Transcript too short to generate a quiz");
  }

  const difficulty = dto.difficulty ?? "MEDIUM";
  const numQuestionsHint = dto.num_questions_hint ?? 5;
  const maxScore = dto.max_score ?? 100;
  const passPercentage = dto.pass_percentage ?? 60;


  const systemPrompt =
    "You are an expert educational content creator. Generate a multiple-choice quiz based on a lecture transcript. Each question must have exactly 4 options, with exactly one correct answer. Ensure exactly one option has is_correct: true per question.";
  const userPrompt = `Based on the following lecture transcript, create a multiple-choice quiz for students.

Lecture Title: ${lecture.title}
Difficulty: ${difficulty}
Number of questions: ${numQuestionsHint}
Maximum total marks: ${maxScore}

Transcript:
${transcript}

Generate a quiz with:
1. A clear, descriptive title (max 100 characters)
2. Optional brief instructions
3. Between 3 and ${Math.min(numQuestionsHint + 2, 20)} multiple-choice questions
4. Each question must have exactly 4 options (A, B, C, D)
5. Exactly ONE option per question must have is_correct: true
6. Each question has marks (default 1)

Respond ONLY in valid JSON matching this structure (no markdown, no extra text):
{
  "title": "string",
  "instructions": "optional string",
  "questions": [
    {
      "question": "string",
      "options": [
        { "text": "string", "is_correct": false },
        { "text": "string", "is_correct": true },
        ...
      ],
      "marks": 1
    }
  ]
}`;


  let parsed: z.infer<typeof quizGenerationSchema>;
  try {
    const { output } = await generateText({
      model: getTextModel("quiz"),
      output: Output.object({ schema: quizGenerationSchema }),
      system: systemPrompt,
      prompt: userPrompt,
    });
    parsed = output as z.infer<typeof quizGenerationSchema>;
  } catch (error) {
    logger.error("AI quiz generation failed:", error);
    throw new BadRequestError("AI generation failed. Please try again.");
  }

  if (!parsed?.title || !parsed?.questions?.length) {
    throw new BadRequestError("AI generation failed. Please try again.");
  }

  const title = parsed.title.slice(0, 255);
  const instructions = parsed.instructions?.slice(0, 2000) ?? null;
  const sectionId = dto.scope === "SECTION" ? dto.section_id : null;
  const lessonId = dto.scope === "LESSON" ? dto.lesson_id : null;
  if (dto.scope === "LESSON" && !lessonId) {
    throw new BadRequestError("LESSON scope requires lesson_id");
  }

  // A generated quiz starts empty, so keep at most quiz_questions_per_quiz.
  if (questionCap !== null) parsed.questions = parsed.questions.slice(0, questionCap);

  const quiz = await quizzesRepo.create({
    tenant_id: tenantId,
    course_id: dto.course_id,
    section_id: sectionId,
    lesson_id: lessonId ?? null,
    source_lecture_id: dto.lecture_id,
    title,
    instructions,
    scope: dto.scope,
    status: "DRAFT",
    max_score: maxScore,
    pass_percentage: passPercentage,
    due_date: dto.due_date ? new Date(dto.due_date) : null,
    ai_generated: true,
    sort_order: 0,
  });

  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    const validOptions = q.options.filter((o) => o.text?.trim());
    if (validOptions.length < 2) continue;
    const hasCorrect = validOptions.some((o) => o.is_correct);
    const optionsToUse = hasCorrect
      ? validOptions
      : validOptions.map((o, idx) => ({
          ...o,
          is_correct: idx === 0,
        }));

    const questionRow = await courseLmsRepo.createQuizQuestion({
      tenant_id: tenantId,
      quiz_id: quiz.id,
      question: q.question?.slice(0, 2000) || `Question ${i + 1}`,
      marks: q.marks ?? 1,
      sort_order: i,
    });

    for (let j = 0; j < optionsToUse.length; j++) {
      await courseLmsRepo.createQuizOption({
        tenant_id: tenantId,
        question_id: questionRow.id,
        option_text: optionsToUse[j].text?.slice(0, 500) || `Option ${j + 1}`,
        is_correct: optionsToUse[j].is_correct,
        sort_order: j,
      });
    }
  }

  logger.info(`Quiz generated from transcript for lecture ${dto.lecture_id}`);
  const found = await quizzesRepo.findById(tenantId, quiz.id);
  if (!found) throw new NotFoundError("Quiz not found");
  return found;
}

export async function generateQuestionsForQuiz(
  tenantId: string,
  quizId: string,
  dto: GenerateQuestionsForQuizDto
): Promise<{ added: number }> {
  await ensureQuizzesEnabled(tenantId);

  const quiz = await quizzesRepo.findById(tenantId, quizId);
  if (!quiz) throw new NotFoundError("Quiz not found");

  const inputText = (dto.input_text || "").trim();
  if (!inputText) {
    throw new BadRequestError("Input text is required to generate questions.");
  }

  const questionLimit = Math.min(
    Math.max(dto.question_limit || 5, 1),
    20
  );


  const limit = await entitlementsService.getQuizQuestionsLimit(tenantId);
  const currentCount = await courseLmsRepo.countQuestionsByQuizId(
    tenantId,
    quizId
  );
  const remaining = limit != null ? limit - currentCount : questionLimit;
  if (remaining <= 0) {
    await entitlementsService.ensureQuizQuestionCapacity(tenantId, currentCount, 1);
  }
  const toGenerate = Math.min(questionLimit, remaining);

  const systemPrompt =
    "You are an expert educational content creator. Generate multiple-choice quiz questions based on the given content. Each question must have 2 to 6 options, with exactly one correct answer. Ensure exactly one option has is_correct: true per question.";
  const userPrompt = `Based on the following content, create ${toGenerate} multiple-choice quiz questions.

Quiz Title: ${quiz.title}
Number of questions to generate: ${toGenerate}

Content:
${inputText.slice(0, 15000)}

Generate questions with:
1. Each question must have 2-6 options (A, B, C, ...)
2. Exactly ONE option per question must have is_correct: true
3. Each question has marks (default 1)

Respond ONLY in valid JSON (no markdown, no extra text):
{
  "questions": [
    {
      "question": "string",
      "options": [
        { "text": "string", "is_correct": false },
        { "text": "string", "is_correct": true }
      ],
      "marks": 1
    }
  ]
}`;


  let parsed: z.infer<typeof quizQuestionsOnlySchema>;
  try {
    const { output } = await generateText({
      model: getTextModel("quiz"),
      output: Output.object({ schema: quizQuestionsOnlySchema }),
      system: systemPrompt,
      prompt: userPrompt,
    });
    parsed = output as z.infer<typeof quizQuestionsOnlySchema>;
  } catch (error) {
    logger.error("AI quiz questions generation failed:", error);
    throw new BadRequestError("AI generation failed. Please check your API key and try again.");
  }

  if (!parsed?.questions?.length) {
    throw new BadRequestError("AI generation failed. No questions were generated.");
  }

  const existingCount = await courseLmsRepo.countQuestionsByQuizId(
    tenantId,
    quizId
  );
  let added = 0;

  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    const validOptions = q.options.filter((o) => o.text?.trim());
    if (validOptions.length < 2) continue;

    const hasCorrect = validOptions.some((o) => o.is_correct);
    const optionsToUse = hasCorrect
      ? validOptions
      : validOptions.map((o, idx) => ({
          ...o,
          is_correct: idx === 0,
        }));

    const questionRow = await courseLmsRepo.createQuizQuestion({
      tenant_id: tenantId,
      quiz_id: quizId,
      question: q.question?.slice(0, 2000) || `Question ${i + 1}`,
      marks: q.marks ?? 1,
      sort_order: existingCount + added,
    });

    for (let j = 0; j < optionsToUse.length; j++) {
      await courseLmsRepo.createQuizOption({
        tenant_id: tenantId,
        question_id: questionRow.id,
        option_text: optionsToUse[j].text?.slice(0, 500) || `Option ${j + 1}`,
        is_correct: optionsToUse[j].is_correct,
        sort_order: j,
      });
    }
    added++;
  }

  logger.info(`Generated ${added} questions for quiz ${quizId}`);
  return { added };
}
