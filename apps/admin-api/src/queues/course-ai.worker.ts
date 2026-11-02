import { Worker, type Job } from "bullmq";
import { QUEUE_PREFIX, redisConnection } from "./connection";
import { COURSE_AI_QUEUE_NAME } from "./course-ai.queue";
import courseAIService, {
  type CourseAISectionKey,
  type GeneratedCourseContent,
} from "../services/course-ai.service";
import courseAIApplyService from "../services/course-ai-apply.service";
import type {
  CourseAIJobData,
  CourseAIJobProgress,
  SectionProgress,
} from "../types/course-ai.type";
import logger from "../utils/logger";

/** Processing order, thumbnails always last. */
const SECTION_ORDER: CourseAISectionKey[] = [
  "subtitle",
  "learningOutcomes",
  "curriculum",
  "offerings",
  "requirements",
  "description",
  "faqs",
  "thumbnails",
];

const ALL_TEXT_SECTIONS: CourseAISectionKey[] = SECTION_ORDER.filter(
  (s) => s !== "thumbnails"
);

let worker: Worker | null = null;

// ---------------------------------------------------------------------------
// Job Handler
// ---------------------------------------------------------------------------

async function processJob(job: Job<CourseAIJobData>): Promise<void> {
  const { tenantId, courseTitle, sections } = job.data;
  logger.info(
    `[course-ai-worker] Starting job ${job.id} for tenant ${tenantId}: "${courseTitle}", sections: [${sections.join(", ")}]`
  );

  const requestedSet = new Set(sections);
  const orderedSections = SECTION_ORDER.filter((s) => requestedSet.has(s));

  // Initialize progress
  const sectionProgress: Partial<Record<CourseAISectionKey, SectionProgress>> =
    {};
  for (const s of orderedSections) {
    sectionProgress[s] = { status: "pending" };
  }
  const aggregateResult: Partial<GeneratedCourseContent> = {};

  const updateProgress = async (
    currentSection?: CourseAISectionKey,
    status: "processing" | "completed" | "failed" = "processing",
    error?: string
  ) => {
    const completedCount = Object.values(sectionProgress).filter(
      (sp) => sp?.status === "completed"
    ).length;

    const progress: CourseAIJobProgress = {
      status,
      currentSection,
      sections: sectionProgress,
      result: aggregateResult,
      completedCount,
      totalCount: orderedSections.length,
      error,
    };
    await job.updateProgress(progress);
  };

  // Separate text sections and thumbnails
  const textSections = orderedSections.filter((s) => s !== "thumbnails");
  const hasThumbnails = requestedSet.has("thumbnails");

  // Check if all 7 text sections are requested → use single the AI model call
  const allTextRequested =
    textSections.length === ALL_TEXT_SECTIONS.length &&
    ALL_TEXT_SECTIONS.every((s) => requestedSet.has(s));

  // Fetch the course's actual uploaded LMS content so syllabus/offerings/FAQs
  // are grounded in real curriculum instead of invented. Non-fatal: generation
  // proceeds without it if the fetch fails or the course has no content yet.
  let lmsContent: string | undefined;
  if (job.data.lmsCourseId) {
    try {
      lmsContent = await courseAIService.buildLmsContentContext(
        tenantId,
        job.data.lmsCourseId
      );
    } catch (err) {
      logger.warn(
        `[course-ai-worker] Failed to load LMS content for course ${job.data.lmsCourseId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Build shared params for service calls
  const serviceParams = {
    courseTitle: job.data.courseTitle,
    extraContext: job.data.extraContext,
    referenceDocument: job.data.referenceDocument,
    thumbnailContext: job.data.thumbnailContext,
    flavour: job.data.flavour,
    targetAudience: job.data.targetAudience,
    courseDuration: job.data.courseDuration,
    difficultyLevel: job.data.difficultyLevel,
    industry: job.data.industry,
    courseMetadata: job.data.courseMetadata,
    lmsContent,
  };

  // ── Process text sections ──
  if (allTextRequested) {
    // All text sections → single batch call
    for (const s of textSections) {
      sectionProgress[s] = { status: "processing" };
    }
    await updateProgress(textSections[0]);

    try {
      const batchResult = await courseAIService.generateCourseContent({
        ...serviceParams,
        sections: [...ALL_TEXT_SECTIONS],
      });

      // Mark each section as completed individually
      for (const s of textSections) {
        const sectionResult = extractSectionResult(s, batchResult);
        if (sectionResult && Object.keys(sectionResult).length > 0) {
          sectionProgress[s] = { status: "completed", result: sectionResult };
          Object.assign(aggregateResult, sectionResult);
        } else {
          sectionProgress[s] = { status: "completed", result: {} };
        }
      }
      await updateProgress(undefined);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error during batch generation";
      logger.error(`[course-ai-worker] Batch text generation failed: ${errorMsg}`);
      for (const s of textSections) {
        sectionProgress[s] = { status: "failed", error: errorMsg };
      }
      await updateProgress(undefined);
    }
  } else {
    // Sequential individual section calls
    for (const sectionKey of textSections) {
      sectionProgress[sectionKey] = { status: "processing" };
      await updateProgress(sectionKey);

      try {
        const sectionResult = await courseAIService.generateCourseContent({
          ...serviceParams,
          sections: [sectionKey],
        });

        sectionProgress[sectionKey] = {
          status: "completed",
          result: sectionResult,
        };
        Object.assign(aggregateResult, sectionResult);
        logger.info(
          `[course-ai-worker] Section "${sectionKey}" completed for "${courseTitle}"`
        );
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error";
        logger.error(
          `[course-ai-worker] Section "${sectionKey}" failed for "${courseTitle}": ${errorMsg}`
        );
        sectionProgress[sectionKey] = { status: "failed", error: errorMsg };
      }

      await updateProgress(sectionKey);
    }
  }

  // ── Process thumbnails (always last) ──
  if (hasThumbnails) {
    sectionProgress["thumbnails"] = { status: "processing" };
    await updateProgress("thumbnails");

    try {
      const thumbResult = await courseAIService.generateCourseContent({
        ...serviceParams,
        sections: ["thumbnails"],
      });

      sectionProgress["thumbnails"] = {
        status: "completed",
        result: thumbResult,
      };
      Object.assign(aggregateResult, thumbResult);
      logger.info(
        `[course-ai-worker] Thumbnails completed for "${courseTitle}"`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      logger.error(
        `[course-ai-worker] Thumbnails failed for "${courseTitle}": ${errorMsg}`
      );
      sectionProgress["thumbnails"] = { status: "failed", error: errorMsg };
    }

    await updateProgress("thumbnails");
  }

  // ── Final status ──
  const allFailed = Object.values(sectionProgress).every(
    (sp) => sp?.status === "failed"
  );

  await updateProgress(
    undefined,
    allFailed ? "failed" : "completed",
    allFailed ? "All sections failed to generate" : undefined
  );

  // ── Optional auto-apply (onboarding wizard only) ──
  //
  // The manual "Generate all with AI" admin flow does NOT pass courseId /
  // pageId / applyToDb (controller `course-ai.controller.ts` doesn't accept
  // them), so this branch is dead code for that path, its behaviour is
  // unchanged. The onboarding wizard (`tenant-provisioning.service.ts`)
  // sets all three so the worker becomes truly fire-and-forget: by the
  // time it returns, courses + course_sections/lessons/lectures +
  // course_faqs + tenant_pages.sections are persisted and the sample
  // course's landing page renders complete on the tenant subdomain.
  //
  // Errors here are logged + swallowed: the AI generation already
  // succeeded and was emitted into job progress, so we MUST NOT mark the
  // job failed (that would surface a misleading failure to the manual
  // modal if it ever shared a job, and would also drop the in-progress
  // result the apply was about to consume).
  if (
    !allFailed &&
    job.data.applyToDb &&
    job.data.courseId &&
    job.data.pageId
  ) {
    try {
      await courseAIApplyService.applyToCourse({
        tenantId: job.data.tenantId,
        courseId: job.data.courseId,
        pageId: job.data.pageId,
        courseTitle: job.data.courseTitle,
        courseMode: job.data.courseMode ?? "SELF_PACED",
        generated: aggregateResult,
      });
    } catch (err) {
      logger.error(
        `[course-ai-worker] auto-apply failed for tenant=${job.data.tenantId} course=${job.data.courseId} (job ${job.id} stays completed): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  logger.info(
    `[course-ai-worker] Job ${job.id} finished for tenant ${tenantId}`
  );
}

/**
 * Extract only the result fields relevant to a specific section from a
 * combined GeneratedCourseContent object.
 */
function extractSectionResult(
  sectionKey: CourseAISectionKey,
  data: Partial<GeneratedCourseContent>
): Partial<GeneratedCourseContent> | undefined {
  const keyMap: Record<CourseAISectionKey, (keyof GeneratedCourseContent)[]> = {
    subtitle: ["subTitle"],
    learningOutcomes: ["learningOutcomes"],
    curriculum: ["sections"],
    offerings: ["offerings"],
    requirements: ["prerequisites"],
    description: ["description"],
    faqs: ["faqs"],
    thumbnails: ["webThumbnailDataUrl", "mobileThumbnailDataUrl"],
  };

  const keys = keyMap[sectionKey];
  if (!keys) return undefined;

  const result: Partial<GeneratedCourseContent> = {};
  for (const k of keys) {
    if (data[k] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[k] = data[k];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startCourseAIWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(COURSE_AI_QUEUE_NAME, processJob, {
    connection: redisConnection,
    prefix: QUEUE_PREFIX,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    logger.info(`[course-ai-worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `[course-ai-worker] Job ${job?.id ?? "unknown"} failed: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    logger.error("[course-ai-worker] Worker error:", err);
  });

  logger.info("[course-ai-worker] Started");
  return worker;
}

export async function stopCourseAIWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("[course-ai-worker] Stopped");
}
