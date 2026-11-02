import { Request, Response } from "express";
import { IResponseFormat } from "../types/response.type";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import type { CourseAISectionKey } from "../services/course-ai.service";
import { courseAIQueue, submitCourseAIJob } from "../queues";
import coursesRepository from "../repositories/courses.repository";
import pagesRepository from "../repositories/pages.repository";
import type { CourseAIJobProgress } from "../types/course-ai.type";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

const VALID_SECTION_KEYS: CourseAISectionKey[] = [
  "subtitle",
  "learningOutcomes",
  "curriculum",
  "offerings",
  "requirements",
  "description",
  "faqs",
  "thumbnails",
];

export const submitGeneration = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);

  const {
    courseTitle,
    sections,
    extraContext,
    referenceDocument,
    thumbnailContext,
    flavour,
    targetAudience,
    courseDuration,
    difficultyLevel,
    industry,
    courseMetadata,
    lmsCourseId,
    applyToDb,
  } = req.body;

  if (!courseTitle || typeof courseTitle !== "string" || !courseTitle.trim()) {
    throw new BadRequestError("courseTitle is required and must be a non-empty string");
  }

  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    throw new BadRequestError("sections is required and must be a non-empty array");
  }

  const validSections = sections.filter(
    (s: unknown): s is CourseAISectionKey =>
      typeof s === "string" && VALID_SECTION_KEYS.includes(s as CourseAISectionKey)
  );

  if (validSections.length === 0) {
    throw new BadRequestError(
      `Invalid sections. Valid options: ${VALID_SECTION_KEYS.join(", ")}`
    );
  }

  // Persisting the generated content is opt-in via `applyToDb`.
  //
  // Historically the worker only persisted for the onboarding wizard, because
  // it was the sole caller that knew the courseId and pageId. The admin modal
  // generates, reads the result out of job progress, and saves from the
  // BROWSER. That made the whole pipeline unusable to anything without a
  // browser: the assistant (or any API client) could submit a generation, get
  // a "completed" job back, and still be left with a course that has no
  // curriculum, no outcomes and no thumbnail, a success report over an empty
  // course, which is the worst failure mode we have.
  //
  // Callers now ask for persistence explicitly. The browser flow does not pass
  // the flag, so its behaviour is byte-for-byte unchanged and there is no risk
  // of the server and the browser both applying the same curriculum twice.
  let applyTargets: { courseId: string; pageId: string; courseMode: string } | undefined;
  if (applyToDb === true) {
    if (!lmsCourseId || typeof lmsCourseId !== "string" || !lmsCourseId.trim()) {
      throw new BadRequestError("lmsCourseId is required when applyToDb is true");
    }
    const course = await coursesRepository.findById(lmsCourseId.trim(), tenantId);
    if (!course) {
      throw new NotFoundError("Course not found");
    }
    // The landing page is the course slug under `courses/`, the same
    // convention createCourse uses when it creates the pair.
    const page = await pagesRepository.findByTenantAndSlug(tenantId, `courses/${course.slug}`);
    if (!page) {
      throw new NotFoundError(
        `Course "${course.title}" has no landing page to write to. It may have been created before landing pages were generated automatically.`
      );
    }
    applyTargets = {
      courseId: course.id,
      pageId: page.id,
      courseMode: String(course.mode ?? "SELF_PACED"),
    };
  }

  const jobId = await submitCourseAIJob({
    tenantId,
    courseTitle: courseTitle.trim(),
    sections: validSections,
    extraContext: extraContext?.trim() || undefined,
    referenceDocument: referenceDocument?.trim() || undefined,
    thumbnailContext: thumbnailContext || undefined,
    flavour: flavour?.trim() || undefined,
    targetAudience: targetAudience?.trim() || undefined,
    courseDuration: courseDuration?.trim() || undefined,
    difficultyLevel: difficultyLevel || undefined,
    industry: industry?.trim() || undefined,
    courseMetadata: courseMetadata || undefined,
    lmsCourseId:
      typeof lmsCourseId === "string" && lmsCourseId.trim()
        ? lmsCourseId.trim()
        : undefined,
    ...(applyTargets
      ? {
          applyToDb: true,
          courseId: applyTargets.courseId,
          pageId: applyTargets.pageId,
          courseMode: applyTargets.courseMode,
        }
      : {}),
  });

  sendSuccessResponse({
    res,
    data: { jobId },
    statusCode: HttpSuccessStatus.ACCEPTED,
    message: "Course AI generation job submitted",
  });
};

export const getGenerationStatus = async (
  req: Request,
  res: Response<IResponseFormat>
) => {
  const tenantId = getTenantId(req);
  const { jobId } = req.params;

  if (!jobId) {
    throw new BadRequestError("jobId is required");
  }

  // Verify tenant ownership, jobId must match tenant
  const expectedPrefix = `course-ai-${tenantId}`;
  if (jobId !== expectedPrefix) {
    throw new ForbiddenError("Access denied to this job");
  }

  const job = await courseAIQueue.getJob(jobId);
  if (!job) {
    throw new NotFoundError("Job not found or expired. Please try again.");
  }

  const state = await job.getState();
  const progress = (job.progress as CourseAIJobProgress) || null;

  let status: string;
  switch (state) {
    case "active":
      status = "processing";
      break;
    case "completed":
      status = "completed";
      break;
    case "failed":
      status = "failed";
      break;
    case "waiting":
    case "delayed":
      status = "queued";
      break;
    default:
      status = state;
  }

  sendSuccessResponse({
    res,
    data: {
      jobId,
      status,
      progress,
      failedReason: state === "failed" ? job.failedReason : undefined,
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Generation status retrieved",
  });
};
