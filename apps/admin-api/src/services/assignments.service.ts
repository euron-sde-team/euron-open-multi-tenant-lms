import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";
import { generateText, Output } from "ai";
import { z } from "zod";
import logger from "../utils/logger";
import {
  assignment_scope,
  assignment_content_type,
  assignment_status,
} from "../db/enums";
import coursesRepository from "../repositories/courses.repository";
import * as courseLmsRepo from "../repositories/course-lms.repository";
import * as assignmentsRepo from "../repositories/assignments.repository";
import entitlementsService from "./entitlements.service";
import uploadService from "./upload.service";
import { getTextModel } from "../lib/ai/provider";

async function ensureAssignmentsEnabled(tenantId: string): Promise<void> {
  await entitlementsService.ensureAssignmentsEnabled(tenantId);
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

async function ensureLessonExistsAndIsAssignment(
  tenantId: string,
  courseId: string,
  lessonId: string
): Promise<void> {
  const lesson = await courseLmsRepo.findLessonById(lessonId, tenantId);
  if (!lesson || lesson.course_id !== courseId) {
    throw new NotFoundError("Lesson not found");
  }
  if (lesson.type !== "ASSIGNMENT") {
    throw new BadRequestError("Lesson is not an assignment type");
  }
}

export interface CreateAssignmentDto {
  title: string;
  course_id: string;
  section_id?: string;
  lesson_id?: string;
  scope: assignment_scope;
  content_type?: assignment_content_type;
  instructions?: string;
  pdf_key?: string;
  resource_links?: string[];
  max_score?: number;
  /** Minimum score to pass; null = no pass/fail (any evaluated score is final). */
  passing_score?: number | null;
  due_date?: string;
  sort_order?: number;
}

export interface UpdateAssignmentDto {
  title?: string;
  section_id?: string;
  lesson_id?: string;
  scope?: assignment_scope;
  content_type?: assignment_content_type;
  instructions?: string;
  pdf_key?: string;
  resource_links?: string[];
  max_score?: number;
  /** Minimum score to pass; null = no pass/fail (any evaluated score is final). */
  passing_score?: number | null;
  due_date?: string;
  sort_order?: number;
}

export interface ListAssignmentsDto {
  course_id: string;
  section_id?: string;
  lesson_id?: string;
  scope?: assignment_scope;
  status?: "DRAFT" | "PUBLISHED";
  page?: number;
  limit?: number;
}

async function validateScopeAndIds(
  tenantId: string,
  dto: { scope: assignment_scope; course_id: string; section_id?: string; lesson_id?: string }
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
    await ensureLessonExistsAndIsAssignment(
      tenantId,
      dto.course_id,
      dto.lesson_id
    );
    if (dto.section_id) {
      throw new BadRequestError("LESSON scope: section_id must be null");
    }
  }
}

export async function create(
  tenantId: string,
  dto: CreateAssignmentDto
): Promise<assignmentsRepo.AssignmentRow> {
  await ensureAssignmentsEnabled(tenantId);
  await ensureCourseExists(tenantId, dto.course_id);
  await validateScopeAndIds(tenantId, {
    scope: dto.scope,
    course_id: dto.course_id,
    section_id: dto.section_id,
    lesson_id: dto.lesson_id,
  });

  const sectionId =
    dto.scope === "SECTION" ? dto.section_id : null;
  const lessonId =
    dto.scope === "LESSON" ? dto.lesson_id : null;

  return assignmentsRepo.create({
    tenant_id: tenantId,
    course_id: dto.course_id,
    section_id: sectionId,
    lesson_id: lessonId,
    title: dto.title,
    instructions: dto.instructions ?? null,
    content_type: dto.content_type ?? "TEXT",
    pdf_key: dto.pdf_key ?? null,
    resource_links: dto.resource_links ?? [],
    scope: dto.scope,
    status: "DRAFT",
    max_score: dto.max_score ?? 100,
    passing_score: dto.passing_score ?? null,
    due_date: dto.due_date ? new Date(dto.due_date) : null,
    sort_order: dto.sort_order ?? 0,
  });
}

export async function findAll(
  tenantId: string,
  dto: ListAssignmentsDto
): Promise<assignmentsRepo.ListAssignmentsResult> {
  await ensureCourseExists(tenantId, dto.course_id);
  return assignmentsRepo.list(tenantId, {
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
  assignmentsRepo.AssignmentRow & {
    course_title?: string;
    section_title?: string;
    lesson_title?: string;
  }
> {
  const assignment = await assignmentsRepo.findByIdWithJoins(tenantId, id);
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  return assignment;
}

export async function update(
  tenantId: string,
  id: string,
  dto: UpdateAssignmentDto
): Promise<assignmentsRepo.AssignmentRow> {
  const existing = await assignmentsRepo.findById(tenantId, id);
  if (!existing) {
    throw new NotFoundError("Assignment not found");
  }

  const scope: assignment_scope =
    dto.scope ?? (existing.scope as unknown as assignment_scope);
  const sectionId =
    scope === "SECTION"
      ? dto.section_id ?? existing.section_id
      : null;
  const lessonId =
    scope === "LESSON"
      ? dto.lesson_id ?? existing.lesson_id
      : null;

  if (dto.scope || dto.section_id !== undefined || dto.lesson_id !== undefined) {
    await validateScopeAndIds(tenantId, {
      scope,
      course_id: existing.course_id,
      section_id: sectionId ?? undefined,
      lesson_id: lessonId ?? undefined,
    });
  }

  if (dto.passing_score !== undefined && dto.passing_score !== null) {
    if (!Number.isInteger(dto.passing_score) || dto.passing_score < 0) {
      throw new BadRequestError(
        "passing_score must be a non-negative integer or null to clear"
      );
    }
    const effectiveMax = dto.max_score ?? Number(existing.max_score);
    if (dto.passing_score > effectiveMax) {
      throw new BadRequestError(
        "passing_score cannot be greater than the max score"
      );
    }
  }

  const dueDateValue =
    dto.due_date !== undefined
      ? dto.due_date
        ? new Date(dto.due_date)
        : null
      : undefined;
  const updated = await assignmentsRepo.update(tenantId, id, {
    title: dto.title,
    instructions: dto.instructions,
    content_type: dto.content_type,
    pdf_key: dto.pdf_key,
    resource_links: dto.resource_links,
    scope: dto.scope,
    section_id: sectionId,
    lesson_id: lessonId,
    max_score: dto.max_score,
    passing_score: dto.passing_score,
    due_date: dueDateValue,
    sort_order: dto.sort_order,
  });
  if (!updated) {
    throw new NotFoundError("Assignment not found");
  }
  // Keep the curriculum item (lesson) name in sync with the assignment title, so
  // the course tree and lesson preview show the rename, not the default name.
  if (dto.title !== undefined && lessonId) {
    await courseLmsRepo.updateLesson(lessonId, tenantId, { title: dto.title });
  }
  return updated;
}

export async function publish(
  tenantId: string,
  id: string
): Promise<assignmentsRepo.AssignmentRow> {
  const assignment = await assignmentsRepo.findById(tenantId, id);
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  if (String(assignment.status) === assignment_status.PUBLISHED) {
    throw new BadRequestError("Assignment already published");
  }
  if (
    String(assignment.content_type) === assignment_content_type.PDF &&
    (!assignment.pdf_key || assignment.pdf_key.trim() === "")
  ) {
    throw new BadRequestError(
      "Cannot publish PDF assignment without a PDF file"
    );
  }
  const updated = await assignmentsRepo.updateStatus(tenantId, id, "PUBLISHED");
  if (!updated) {
    throw new NotFoundError("Assignment not found");
  }
  return updated;
}

export async function unpublish(
  tenantId: string,
  id: string
): Promise<assignmentsRepo.AssignmentRow> {
  const assignment = await assignmentsRepo.findById(tenantId, id);
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  const updated = await assignmentsRepo.updateStatus(tenantId, id, "DRAFT");
  if (!updated) {
    throw new NotFoundError("Assignment not found");
  }
  return updated;
}

export async function remove(
  tenantId: string,
  id: string,
  force = false
): Promise<void> {
  const assignment = await assignmentsRepo.findById(tenantId, id);
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  if (String(assignment.status) === assignment_status.PUBLISHED && !force) {
    throw new BadRequestError(
      "Cannot delete a published assignment. Use force=true to override."
    );
  }
  const deleted = await assignmentsRepo.remove(tenantId, id);
  if (!deleted) {
    throw new NotFoundError("Assignment not found");
  }
}

export async function uploadPdf(
  tenantId: string,
  id: string,
  file: { buffer: Buffer; mimetype: string; originalname?: string }
): Promise<assignmentsRepo.AssignmentRow> {
  const assignment = await assignmentsRepo.findById(tenantId, id);
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  const MAX_SIZE = 20 * 1024 * 1024;
  if (file.buffer.length > MAX_SIZE) {
    throw new BadRequestError("File size exceeds 20MB limit");
  }

  try {
    if (assignment.pdf_key) {
      const bucket = uploadService.getLectureResourcesBucket();
      await uploadService.deleteFile(assignment.pdf_key, bucket);
    }
    const result = await uploadService.uploadAssignmentPdf(
      tenantId,
      id,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    const updated = await assignmentsRepo.updatePdfKey(
      tenantId,
      id,
      result.key
    );
    if (!updated) {
      throw new NotFoundError("Assignment not found");
    }
    return updated;
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }
    logger.error("Failed to upload assignment attachment:", error);
    throw new BadRequestError("Failed to upload file. Please try again.");
  }
}

export async function getPdfSignedUrl(
  tenantId: string,
  id: string
): Promise<{ url: string; expires_in: number }> {
  const assignment = await assignmentsRepo.findById(tenantId, id);
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  if (!assignment.pdf_key || assignment.pdf_key.trim() === "") {
    throw new NotFoundError("No PDF uploaded for this assignment");
  }
  const url = await uploadService.getAssignmentPdfSignedUrl(
    assignment.pdf_key,
    3600
  );
  return { url, expires_in: 3600 };
}

export async function removePdf(
  tenantId: string,
  id: string
): Promise<assignmentsRepo.AssignmentRow> {
  const assignment = await assignmentsRepo.findById(tenantId, id);
  if (!assignment) {
    throw new NotFoundError("Assignment not found");
  }
  if (!assignment.pdf_key || assignment.pdf_key.trim() === "") {
    throw new BadRequestError("No PDF to remove");
  }
  if (String(assignment.status) === assignment_status.PUBLISHED) {
    throw new BadRequestError(
      "Cannot remove PDF from a published assignment. Unpublish first."
    );
  }
  const bucket = uploadService.getLectureResourcesBucket();
  await uploadService.deleteFile(assignment.pdf_key, bucket);
  const updated = await assignmentsRepo.updatePdfKey(tenantId, id, null);
  if (!updated) {
    throw new NotFoundError("Assignment not found");
  }
  return updated;
}

const assignmentGenerationSchema = z.object({
  title: z.string(),
  instructions: z.string(),
});

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
  scope: assignment_scope;
  max_score?: number;
  due_date?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  num_questions_hint?: number;
}

export async function generateFromTranscript(
  tenantId: string,
  dto: GenerateFromTranscriptDto
): Promise<assignmentsRepo.AssignmentRow> {
  await ensureAssignmentsEnabled(tenantId);
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
    throw new BadRequestError("Transcript too short to generate an assignment");
  }

  const difficulty = dto.difficulty ?? "MEDIUM";
  const numQuestionsHint = dto.num_questions_hint ?? 5;
  const maxScore = dto.max_score ?? 100;

  const systemPrompt =
    "You are an expert educational content creator. Generate a structured assignment based on a lecture transcript.";
  const userPrompt = `Based on the following lecture transcript, create a comprehensive assignment for students.

Lecture Title: ${lecture.title}
Difficulty: ${difficulty}
Number of questions/tasks to include: approximately ${numQuestionsHint}
Maximum Score: ${maxScore}

Transcript:
${transcript}

Generate a well-structured assignment with:
1. A clear, descriptive title (max 100 characters)
2. Detailed instructions that include:
   - Learning objectives being assessed
   - Clear task descriptions (numbered list)
   - Submission requirements
   - Grading criteria / rubric hints
3. Make the assignment test understanding, application, and critical thinking, not just recall.

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "title": "...",
  "instructions": "..."
}
`;


  let parsed: z.infer<typeof assignmentGenerationSchema>;
  try {
    const { output } = await generateText({
      model: getTextModel("assignment"),
      output: Output.object({ schema: assignmentGenerationSchema }),
      system: systemPrompt,
      prompt: userPrompt,
    });
    parsed = output as z.infer<typeof assignmentGenerationSchema>;
  } catch (error) {
    logger.error("AI assignment generation failed:", error);
    throw new BadRequestError("AI generation failed. Please try again.");
  }

  if (!parsed?.title || !parsed?.instructions) {
    throw new BadRequestError("AI generation failed. Please try again.");
  }

  const title = parsed.title.slice(0, 255);
  const instructions = parsed.instructions.slice(0, 10000);

  const sectionId = dto.scope === "SECTION" ? dto.section_id : null;
  const lessonId = dto.scope === "LESSON" ? dto.lesson_id : null;

  logger.info(
    `Assignment generated from transcript for lecture ${dto.lecture_id}`
  );

  return assignmentsRepo.create({
    tenant_id: tenantId,
    course_id: dto.course_id,
    section_id: sectionId ?? null,
    lesson_id: lessonId ?? null,
    source_lecture_id: dto.lecture_id,
    title,
    instructions,
    content_type: "TEXT",
    pdf_key: null,
    resource_links: [],
    scope: dto.scope,
    status: "DRAFT",
    max_score: maxScore,
    due_date: dto.due_date ? new Date(dto.due_date) : null,
    ai_generated: true,
    sort_order: 0,
  });
}
