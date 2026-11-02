/**
 * Tenant Page Service
 *
 * Business logic for tenant page APIs.
 * Handles page retrieval for user-facing applications.
 */

import { NotFoundError } from "../errors/not-found.error";
import { findPreviewLessonsByCourseSlug } from "../repositories/courses.repository";
import tenantPageRepository from "../repositories/tenant-page.repository";
import {
  TenantPageListResponse,
  TenantPageResponse,
} from "../types/tenant.type";


/** A course landing page, whose syllabus rows may carry free samples. */
const COURSE_PAGE_SLUG = /^courses\/(.+)$/;

/**
 * Publish the LMS free-preview flag onto a course page's syllabus.
 *
 * The page stores its own copy of the curriculum, written when the landing page
 * was last edited. Ticking "free preview" in the LMS curriculum editor writes
 * `course_lessons.is_preview` instead, and nothing carried that across, so the
 * play control never appeared however many previews an admin marked.
 *
 * Matching is by lesson id, which is what a syllabus row stores. A row we cannot
 * match is simply left as it was: this only ever adds a control, so the worst
 * case is the behaviour that shipped before.
 */
function attachLessonPreviews(
  sections: unknown,
  previews: Map<string, { videoKey: string; title: string; duration: string | null }>
): void {
  if (!Array.isArray(sections) || previews.size === 0) return;

  for (const section of sections as Array<Record<string, unknown>>) {
    if (section?.type !== "course-curriculum") continue;
    // A hidden or deleted section is not on the page, so its videos are not
    // published and must not become playable.
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
      const buckets = modules.length > 0 ? modules : [group];

      for (const bucket of buckets) {
        const lectures = Array.isArray(bucket?.lectures)
          ? (bucket.lectures as Array<Record<string, unknown>>)
          : [];
        for (const lecture of lectures) {
          const id = lecture?.id;
          if (typeof id !== "string") continue;
          const match = previews.get(id);
          // An explicit previewVideo was set in the landing page editor. That is
          // the more specific statement of intent, so leave it alone.
          if (!match || lecture.previewVideo) continue;
          lecture.previewVideo = {
            videoKey: match.videoKey,
            title: match.title,
            duration: match.duration ?? undefined,
          };
          lecture.isPreview = true;
        }
      }
    }
  }
}

class TenantPageService {
  /**
   * Get a published page by tenant ID and page slug
   * Throws NotFoundError if page doesn't exist or is not published.
   */
  async getPage(tenantId: string, pageSlug: string): Promise<TenantPageResponse> {
    const page = await tenantPageRepository.findPublishedByTenantAndSlug(
      tenantId,
      pageSlug
    );

    if (!page) {
      throw new NotFoundError(`Page '${pageSlug}' not found`);
    }

    // A course page's syllabus learns about free previews marked in the LMS
    // editor, which the page's own stored curriculum never sees.
    const courseSlug = COURSE_PAGE_SLUG.exec(pageSlug)?.[1];
    if (courseSlug) {
      const lessons = await findPreviewLessonsByCourseSlug(tenantId, courseSlug);
      attachLessonPreviews(
        page.sections,
        new Map(lessons.map((l) => [l.lessonId, l]))
      );
    }

    return page;
  }

  /**
   * List all published pages for a tenant
   * Returns an array of page summaries.
   */
  async listPages(tenantId: string): Promise<TenantPageListResponse> {
    const pages = await tenantPageRepository.findPublishedByTenant(tenantId);

    return {
      pages,
    };
  }

  /**
   * Check if a published page exists
   */
  async pageExists(tenantId: string, pageSlug: string): Promise<boolean> {
    return tenantPageRepository.publishedExists(tenantId, pageSlug);
  }

  /**
   * Get count of published pages for a tenant
   */
  async getPublishedPageCount(tenantId: string): Promise<number> {
    return tenantPageRepository.countPublished(tenantId);
  }
}

export default new TenantPageService();
