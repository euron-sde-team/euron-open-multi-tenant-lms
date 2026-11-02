import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import {
  findPreviewLessonsByCourseSlug,
  findVideoProviderInCourse,
} from "../repositories/courses.repository";
import tenantPageRepository from "../repositories/tenant-page.repository";
import { playbackForVideo, type LecturePlayback } from "./lecture-playback.service";

/**
 * Free course previews, playable without logging in.
 *
 * A tenant admin attaches a sample video to a syllabus row in the course
 * landing page editor. Prospective students play it straight from the public
 * course page, which is the whole point: seeing a lesson before paying is what
 * converts.
 *
 * Because this endpoint is unauthenticated it has to prove, per request, that
 * the video really is a published preview for that course. It does that by
 * reading the same landing page record the public page renders from, so the
 * check can never disagree with what is on screen. A separate table of
 * "allowed preview ids" would be a second source of truth, and one stale row
 * there would leave paid content publicly playable.
 */

interface CurriculumLecture {
  id?: string;
  title?: string;
  previewVideo?: {
    videoKey?: string;
    title?: string;
    duration?: string;
  };
}

/** Every preview video published on a course page, keyed by video id. */
function collectPreviews(
  sections: unknown
): Map<string, { title: string; duration?: string }> {
  const out = new Map<string, { title: string; duration?: string }>();
  if (!Array.isArray(sections)) return out;

  for (const section of sections as Array<Record<string, unknown>>) {
    if (section?.type !== "course-curriculum") continue;
    // A hidden or deleted section is not on the page, so its videos are not
    // published and must not be playable.
    if (section.visible === false || section.deleted === true) continue;

    const content = section.content as Record<string, unknown> | undefined;
    const groups = Array.isArray(content?.sections)
      ? (content?.sections as Array<Record<string, unknown>>)
      : [];

    for (const group of groups) {
      const modules = Array.isArray(group?.modules)
        ? (group.modules as Array<Record<string, unknown>>)
        : [];
      // Legacy pages keep a flat lecture list on the group instead of modules.
      const buckets: Array<Record<string, unknown>> =
        modules.length > 0 ? modules : [group];

      for (const bucket of buckets) {
        const lectures = Array.isArray(bucket?.lectures)
          ? (bucket.lectures as CurriculumLecture[])
          : [];
        for (const lecture of lectures) {
          const key = lecture?.previewVideo?.videoKey;
          if (typeof key !== "string" || key.length === 0) continue;
          out.set(key, {
            title: lecture.previewVideo?.title || lecture.title || "Preview",
            duration: lecture.previewVideo?.duration,
          });
        }
      }
    }
  }
  return out;
}

class CoursePreviewService {
  /** The previews a course publishes, for rendering play controls. */
  async listForCourse(tenantId: string, courseSlug: string) {
    const page = await tenantPageRepository.findPublishedByTenantAndSlug(
      tenantId,
      `courses/${courseSlug}`
    );
    if (!page) throw new NotFoundError("Course not found");
    const previews = collectPreviews(page.sections);
    // Lessons ticked "free preview" in the LMS editor are published too, so this
    // list matches what the course page actually shows a play control for.
    for (const lesson of await findPreviewLessonsByCourseSlug(
      tenantId,
      courseSlug
    )) {
      if (!previews.has(lesson.videoKey)) {
        previews.set(lesson.videoKey, {
          title: lesson.title,
          duration: lesson.duration ?? undefined,
        });
      }
    }
    return {
      previews: Array.from(previews.entries()).map(([videoKey, meta]) => ({
        videoKey,
        title: meta.title,
        duration: meta.duration ?? null,
      })),
    };
  }

  /**
   * Playback for one preview. The provider comes from the lecture row that
   * holds this video (EVS, HLS, MP4 or YouTube); a key published only on the
   * landing page falls back to the lecture with the same key in this course,
   * then to the key's shape.
   */
  async getPlayback(
    tenantId: string,
    courseSlug: string,
    videoKey: string,
    viewerId: string
  ): Promise<LecturePlayback & { title: string }> {
    if (!courseSlug || !videoKey) {
      throw new BadRequestError("courseSlug and videoKey are required");
    }

    const page = await tenantPageRepository.findPublishedByTenantAndSlug(
      tenantId,
      `courses/${courseSlug}`
    );
    if (!page) throw new NotFoundError("Course not found");

    const previews = collectPreviews(page.sections);
    let meta: { title: string; duration?: string; provider?: string | null } | undefined =
      previews.get(videoKey);

    // The page also publishes whatever the LMS editor ticked as a free preview,
    // so the gate has to accept that set too. Without this the control renders
    // and then refuses to play. Still a closed set read from the database, not
    // anything the caller supplied: a lesson of THIS course, flagged is_preview,
    // holding this exact video.
    if (!meta) {
      const lesson = (
        await findPreviewLessonsByCourseSlug(tenantId, courseSlug)
      ).find((l) => l.videoKey === videoKey);
      if (lesson) {
        meta = {
          title: lesson.title,
          duration: lesson.duration ?? undefined,
          provider: lesson.videoProvider,
        };
      }
    }

    // The only gate. If the id is not published as a preview on this course, it
    // is paid content and must not be mintable from an anonymous request.
    if (!meta) {
      throw new ForbiddenError("This video is not available as a preview");
    }

    const provider =
      meta.provider ?? (await findVideoProviderInCourse(tenantId, courseSlug, videoKey));
    // Previews are public, so there is no member to bind to. The session is
    // short lived and only ever covers a video already published for free.
    const playback = await playbackForVideo(
      videoKey,
      provider,
      `${tenantId}:${viewerId}`,
      PREVIEW_TTL_SECONDS
    );
    return { ...playback, title: meta.title };
  }
}

/** Short enough that a leaked link dies quickly, long enough to watch a sample. */
const PREVIEW_TTL_SECONDS = 60 * 30;

export default new CoursePreviewService();
