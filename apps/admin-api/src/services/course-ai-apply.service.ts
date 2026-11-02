/**
 * Server-side merge of an AI-generated course content blob into the
 * canonical persistence layer (courses + course_sections/lessons/lectures
 * + course_faqs + tenant_pages.sections).
 *
 * Used by the onboarding wizard: after the BullMQ course-ai worker finishes
 * generating, the same worker invokes this service so the wizard can be
 * truly fire-and-forget, no frontend polling, no manual "Save" click.
 *
 * IMPORTANT: do NOT call this from the manual "Generate all with AI" admin
 * flow. The editor's dirty-state contract (Zustand store + user-driven
 * Save) deliberately keeps the user in the loop. This server-side apply
 * skips that loop on purpose, which is correct for onboarding (where
 * there's no human to click Save) and wrong for in-editor generation.
 */

import { ulid } from "ulid";
import type { GeneratedCourseContent } from "./course-ai.service";
import coursesService from "./courses.service";
import courseLmsService from "./course-lms.service";
import pagesService from "./pages.service";
import uploadService from "./upload.service";
import logger from "../utils/logger";

/**
 * Decode an `data:image/...;base64,XXXX` data URL into a Buffer + mimeType,
 * matching the format the courseAIService thumbnail step emits (the service
 * runs the raw the AI model PNG output through sharp().webp() before returning,
 * so the data URL mime type is `image/webp`).
 */
function decodeImageDataUrl(
  dataUrl: string
): { buffer: Buffer; mimeType: string } | null {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) return null;
  return {
    mimeType: matches[1],
    buffer: Buffer.from(matches[2], "base64"),
  };
}

/**
 * Mirror the frontend manual flow's thumbnail upload exactly. The admin
 * editor's handleSave does:
 *   const file = dataUrlToFile(...)
 *   await uploadApi.uploadCourseThumbnail(file, { type: "course_thumbnail", tenantId, courseId, slot })
 * The backend HTTP handler that powers `uploadCourseThumbnail` ultimately
 * calls `uploadService.uploadCourseThumbnail(tenantId, courseId, slot, buffer, mimeType, name)`
 *, the very method we invoke here. Same bucket, key format, optimisation,
 * mime-type whitelist, and size limit as a manual upload from the editor.
 */
async function uploadGeneratedThumbnail(
  tenantId: string,
  courseId: string,
  slot: "web" | "mobile",
  dataUrl: string | undefined
): Promise<{ key: string; url: string } | null> {
  if (!dataUrl) return null;
  const decoded = decodeImageDataUrl(dataUrl);
  if (!decoded) {
    logger.warn(
      `[course-ai-apply] ignored ${slot} thumbnail, not a data URL`
    );
    return null;
  }
  try {
    const result = await uploadService.uploadCourseThumbnail(
      tenantId,
      courseId,
      slot,
      decoded.buffer,
      decoded.mimeType,
      `ai-${slot}-thumbnail`
    );
    return { key: result.key, url: result.url };
  } catch (err) {
    logger.error(
      `[course-ai-apply] uploadCourseThumbnail ${slot} failed tenant=${tenantId} course=${courseId}: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

interface CourseHeroContent {
  title: string;
  subtitle: string;
  description: string;
  thumbnail: string;
  thumbnailAlt: string;
  mode: string;
  duration: string;
  language: string;
  price: number;
  originalPrice: number;
  discount: number;
  currency: string;
  previewVideoUrl: string;
  validityDays: number;
}

interface SectionConfig {
  id: string;
  type: string;
  variant: string;
  order: number;
  visible: boolean;
  deleted: boolean;
  content: unknown;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function buildSection(params: {
  type: string;
  order: number;
  content: unknown;
  visible?: boolean;
  variant?: string;
  settings?: Record<string, unknown>;
  idHint: string;
}): SectionConfig {
  const now = new Date().toISOString();
  return {
    id: `section-${params.idHint}-${ulid()}`,
    type: params.type,
    variant: params.variant ?? "default",
    order: params.order,
    visible: params.visible !== false,
    deleted: false,
    content: params.content,
    settings: params.settings ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Build the SectionConfig[] payload for a course landing page from the
 * AI-generated content. Mirrors the section types the frontend converter
 * (`courseFormDataToSections` in apps/admin/.../course-converter.ts) emits
 * on a normal editor save, same types, same ordering, same default
 * headlines, so the round-trip through the editor reads back exactly as
 * if a tenant admin had typed and saved the content themselves.
 *
 * For LIVE/HYBRID modes, `liveClassLink` etc. stay empty here, the tenant
 * fills them in from the editor when they schedule. The sample course is
 * always SELF_PACED today so this is moot, but kept extensible.
 */
function buildPageSections(args: {
  courseTitle: string;
  generated: Partial<GeneratedCourseContent>;
  courseMode: string;
  webThumbnailUrl: string;
}): SectionConfig[] {
  const { courseTitle, generated, courseMode, webThumbnailUrl } = args;

  const heroContent: CourseHeroContent = {
    title: courseTitle,
    subtitle: generated.subTitle ?? "",
    description: generated.description ?? "",
    thumbnail: webThumbnailUrl,
    thumbnailAlt: courseTitle,
    mode: courseMode,
    duration: "",
    language: "English",
    price: 0,
    originalPrice: 0,
    discount: 0,
    currency: "INR",
    previewVideoUrl: "",
    validityDays: 365,
  };

  const sections: SectionConfig[] = [];

  // 1. Hero, always visible. Pricing locked to FREE: price=0, originalPrice=0.
  sections.push(
    buildSection({
      idHint: "hero",
      type: "course-hero",
      order: 0,
      visible: true,
      content: heroContent,
      settings: { __descriptionVisible: !!generated.description },
    })
  );

  // 2. Learning outcomes
  sections.push(
    buildSection({
      idHint: "learning",
      type: "course-learning-outcomes",
      order: 1,
      variant: "grid",
      visible: true,
      content: {
        headline: "What You'll Learn",
        subheadline: "By the end of this course, you will be able to:",
        outcomes: generated.learningOutcomes ?? [],
      },
    })
  );

  // 3. Curriculum
  const aiSections = generated.sections ?? [];
  const totalLectures = aiSections.reduce(
    (acc, s) =>
      acc +
      (s.modules ?? []).reduce(
        (mAcc, m) => mAcc + (m.lectures ?? []).length,
        0
      ),
    0
  );
  sections.push(
    buildSection({
      idHint: "curriculum",
      type: "course-curriculum",
      order: 2,
      visible: true,
      content: {
        headline: "Course Content",
        subheadline: "What you'll learn in this course",
        sections: aiSections.map((s) => ({
          id: ulid(),
          title: s.title,
          modules: (s.modules ?? []).map((m) => ({
            id: ulid(),
            title: m.title,
            order: m.order,
            lectures: (m.lectures ?? []).map((l) => ({
              id: ulid(),
              title: l.title,
              duration: l.duration,
              isPreview: false,
            })),
          })),
        })),
        totalLectures,
      },
    })
  );

  // 4. Offerings
  sections.push(
    buildSection({
      idHint: "offerings",
      type: "course-offerings",
      order: 3,
      visible: true,
      content: {
        headline: "This Course Includes",
        subheadline: "Everything you get with this course",
        offerings: (generated.offerings ?? []).map((o) => ({
          id: ulid(),
          icon: o.icon,
          text: o.text,
        })),
      },
    })
  );

  // 5. Prerequisites
  sections.push(
    buildSection({
      idHint: "prerequisites",
      type: "course-prerequisites",
      order: 4,
      visible: true,
      content: {
        headline: "Requirements",
        subheadline: "Before you begin this course",
        prerequisites: generated.prerequisites ?? [],
      },
    })
  );

  // 6. FAQ
  sections.push(
    buildSection({
      idHint: "faq",
      type: "faq",
      order: 5,
      visible: true,
      content: {
        headline: "Frequently Asked Questions",
        subheadline: "Find answers to common questions about this course",
        faqs: (generated.faqs ?? []).map((f) => ({
          id: ulid(),
          question: f.question,
          answer: f.answer,
        })),
      },
    })
  );

  // 6a. Ratings, content fetched from LMS at render time. Hidden by default.
  sections.push(
    buildSection({
      idHint: "ratings",
      type: "course-ratings",
      order: 5.4,
      visible: false,
      content: {},
    })
  );

  // 6b. Recommendations, populated when the tenant adds related courses.
  // Hidden by default.
  sections.push(
    buildSection({
      idHint: "recommendations",
      type: "course-recommendations",
      order: 5.5,
      visible: false,
      content: {
        headline: "You May Also Like",
        recommendations: [],
      },
    })
  );

  // 7. Instructor, empty by default. Tenant assigns instructors from the
  // editor; the section stays visible so the placeholder reminds them to.
  sections.push(
    buildSection({
      idHint: "instructor",
      type: "course-instructor",
      order: 6,
      visible: true,
      content: {
        headline: "Your Instructor",
        subheadline: "Learn from industry experts",
        instructors: [],
      },
    })
  );

  return sections;
}

/**
 * Which generated field stands behind each page section.
 *
 * A section is only safe to overwrite when the run that is writing it actually
 * generated the thing it displays. `course-ratings`, `course-recommendations`
 * and `course-instructor` are not driven by generation at all, so they are
 * never replaced by a generation run.
 */
const SECTION_SOURCE: Record<string, (g: GeneratedCourseContent) => boolean> = {
  "course-hero": (g) =>
    Boolean(g.subTitle || g.description || g.webThumbnailDataUrl),
  "course-learning-outcomes": (g) => (g.learningOutcomes ?? []).length > 0,
  "course-curriculum": (g) => (g.sections ?? []).length > 0,
  "course-offerings": (g) => (g.offerings ?? []).length > 0,
  "course-prerequisites": (g) => (g.prerequisites ?? []).length > 0,
  faq: (g) => (g.faqs ?? []).length > 0,
};

/** Empty means "this run produced nothing here", not "clear what was there". */
function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function mergeContent(
  previous: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...previous };
  for (const [k, v] of Object.entries(next)) {
    if (isEmptyValue(v) && !isEmptyValue(previous[k])) continue;
    out[k] = v;
  }
  return out;
}

export function mergeGeneratedSections(
  previous: SectionConfig[],
  built: SectionConfig[],
  generated: GeneratedCourseContent
): SectionConfig[] {
  const builtByType = new Map(built.map((s) => [s.type, s]));
  const usedTypes = new Set<string>();

  // Walk the page as it stands, so hand-made ordering and any sections the
  // generator knows nothing about survive untouched.
  const merged = previous.map((section) => {
    const replacement = builtByType.get(section.type);
    if (!replacement) return section;
    const hasSource = SECTION_SOURCE[section.type];
    if (!hasSource || !hasSource(generated)) return section;
    usedTypes.add(section.type);
    // Keep the page's own id and position; take the new content, but never let
    // an EMPTY new field overwrite a value that is already there.
    //
    // Section-level gating alone was not enough. `course-hero` carries a
    // subtitle, a description and a thumbnail independently: a run that
    // regenerated the copy arrived with `thumbnail: ""`, passed the
    // section-level check on the strength of the subtitle, and blanked a
    // thumbnail that had just been generated by the previous run. Field level
    // is where this has to be decided.
    return {
      ...replacement,
      id: section.id,
      order: section.order,
      content: mergeContent(
        section.content as Record<string, unknown>,
        replacement.content as Record<string, unknown>
      ),
    } as SectionConfig;
  });

  // Anything generated that the page did not already have gets appended rather
  // than dropped, a course whose page predates a section type still gains it.
  let nextOrder = merged.reduce((m, s) => Math.max(m, Number(s.order) || 0), 0);
  for (const section of built) {
    if (usedTypes.has(section.type)) continue;
    if (merged.some((s) => s.type === section.type)) continue;
    const hasSource = SECTION_SOURCE[section.type];
    if (hasSource && !hasSource(generated)) continue;
    merged.push({ ...section, order: ++nextOrder });
  }

  return merged;
}

interface ApplyToCourseInput {
  tenantId: string;
  courseId: string;
  pageId: string;
  /** Course title at job submission time, kept stable through the job. */
  courseTitle: string;
  /** Course mode at job submission time, used for the hero section. */
  courseMode: string;
  /** AI-generated content, possibly partial if some sections failed. */
  generated: Partial<GeneratedCourseContent>;
}

class CourseAIApplyService {
  /**
   * Persist `generated` AI content into the course + page records. Each
   * step is independently best-effort so a failure on one step doesn't
   * block the rest, a sample course with subtitle + description but no
   * curriculum is still vastly better than the previous "Sample Starter
   * Course" placeholder. Errors are logged but never re-thrown; the
   * caller (worker) treats the whole apply as fire-and-forget.
   */
  async applyToCourse(input: ApplyToCourseInput): Promise<void> {
    const { tenantId, courseId, pageId, courseTitle, courseMode, generated } =
      input;

    // 0. Thumbnails, base64 data URLs from the AI worker get uploaded to
    //    S3 via the SAME backend method (`uploadService.uploadCourseThumbnail`)
    //    that powers the manual editor's "save AI-generated thumbnail" path.
    //    Same bucket, same key format (`tenants/{tenantId}/courses/{courseId}
    //    /thumbnails/{slot}_{ulid}.{ext}`), same image optimisation. Failures
    //    are best-effort logged, the rest of the apply still proceeds and
    //    the page renders with no hero image (tenant can upload manually).
    const [webThumb, mobileThumb] = await Promise.all([
      uploadGeneratedThumbnail(
        tenantId,
        courseId,
        "web",
        generated.webThumbnailDataUrl
      ),
      uploadGeneratedThumbnail(
        tenantId,
        courseId,
        "mobile",
        generated.mobileThumbnailDataUrl
      ),
    ]);

    // 1. Course-table fields (subtitle, description, learning outcomes, prereqs,
    //    + thumbnail keys when the upload succeeded). Only sets fields the AI
    //    actually produced, preserves existing values otherwise.
    const courseUpdate: Record<string, unknown> = {};
    if (typeof generated.subTitle === "string" && generated.subTitle.trim()) {
      courseUpdate.subtitle = generated.subTitle.trim();
    }
    if (
      typeof generated.description === "string" &&
      generated.description.trim()
    ) {
      courseUpdate.description = generated.description.trim();
    }
    if (Array.isArray(generated.learningOutcomes)) {
      courseUpdate.learning_outcomes = generated.learningOutcomes;
    }
    if (Array.isArray(generated.prerequisites)) {
      courseUpdate.prerequisites = generated.prerequisites;
    }
    if (webThumb) {
      courseUpdate.thumbnail_key = webThumb.key;
    }
    if (mobileThumb) {
      courseUpdate.secondary_thumbnail_key = mobileThumb.key;
    }
    if (Object.keys(courseUpdate).length > 0) {
      try {
        await coursesService.updateCourse(courseId, tenantId, courseUpdate);
      } catch (err) {
        logger.error(
          `[course-ai-apply] updateCourse failed tenant=${tenantId} course=${courseId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // 2. Curriculum, bulk-replace via the same path the manual editor uses.
    //    Lectures are seeded with empty video_key/provider; the tenant will
    //    upload videos from the LMS editor.
    if (Array.isArray(generated.sections) && generated.sections.length > 0) {
      try {
        const curriculumPayload = generated.sections.map((s, sIdx) => ({
          title: s.title,
          sort_order: typeof s.order === "number" ? s.order : sIdx,
          lessons: (s.modules ?? []).flatMap((m) =>
            (m.lectures ?? []).map((l, lIdx) => ({
              title: l.title,
              type: "LECTURE" as const,
              sort_order: typeof l.order === "number" ? l.order : lIdx,
              is_preview: false,
              lecture: {
                title: l.title,
                video_key: null,
                video_provider: null,
                duration: l.duration ?? null,
                resource_links: [],
                summary: null,
              },
            }))
          ),
        }));
        await courseLmsService.syncCurriculum(
          tenantId,
          courseId,
          curriculumPayload,
          null,
          null
        );
      } catch (err) {
        logger.error(
          `[course-ai-apply] syncCurriculum failed tenant=${tenantId} course=${courseId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // 3. FAQs, bulk-replace
    if (Array.isArray(generated.faqs) && generated.faqs.length > 0) {
      try {
        await courseLmsService.syncFaqs(
          tenantId,
          courseId,
          generated.faqs.map((f, idx) => ({
            question: f.question,
            answer: f.answer,
            sort_order: idx,
          }))
        );
      } catch (err) {
        logger.error(
          `[course-ai-apply] syncFaqs failed tenant=${tenantId} course=${courseId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // 4. Landing page sections, single update with the full SectionConfig[].
    //    The eight section types match what the frontend converter emits on
    //    a normal save, so opening the editor immediately after this runs
    //    reads back identically to a manually-edited course.
    try {
      const built = buildPageSections({
        courseTitle,
        generated,
        courseMode,
        webThumbnailUrl: webThumb?.url ?? "",
      });

      // MERGE, DO NOT OVERWRITE.
      //
      // `buildPageSections` composes the whole page out of `generated`. That is
      // right for a full build and destructive for a partial one: a run asking
      // only for thumbnails arrives with no curriculum, no outcomes and no FAQs,
      // and rebuilding from it replaced a course's real curriculum with an
      // empty list. The course kept its 7 modules and 50 lessons in the LMS
      // tables while its public page showed nothing, a page that looks broken
      // above data that is perfectly fine.
      //
      // So a freshly built section only replaces the existing one when THIS run
      // actually produced the content behind it. Everything else is left alone.
      const existing = await pagesService.getPageById(pageId, tenantId).catch(() => null);
      const previous = Array.isArray(existing?.sections)
        ? (existing!.sections as unknown as SectionConfig[])
        : [];

      const pageSections = previous.length
        ? mergeGeneratedSections(previous, built, generated)
        : built;

      await pagesService.updatePage(pageId, tenantId, {
        sections: pageSections,
      });
    } catch (err) {
      logger.error(
        `[course-ai-apply] updatePage failed tenant=${tenantId} page=${pageId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    logger.info(
      `[course-ai-apply] applied tenant=${tenantId} course=${courseId} page=${pageId} ` +
        `sections=${(generated.sections ?? []).length} faqs=${(generated.faqs ?? []).length} ` +
        `outcomes=${(generated.learningOutcomes ?? []).length} offerings=${(generated.offerings ?? []).length} ` +
        `thumb_web=${webThumb ? "yes" : "no"} thumb_mobile=${mobileThumb ? "yes" : "no"}`
    );
  }
}

export default new CourseAIApplyService();
