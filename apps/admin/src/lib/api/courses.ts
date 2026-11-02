/**
 * Courses API Client
 * 
 * Course records live in the `courses` table (LMS backend).
 * Each course also has a landing page in `tenant_pages` (slug = "courses/<slug>")
 * for visual templating. Creating a course creates both.
 */

import type { SectionConfig, SEOConfig, ThemeConfig } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";

import type { CreatePageRequest } from "../types/page";
import { generateSlug } from "../utils/slug";

import { apiClient } from "./axios";
import { coursesLmsApi } from "./courses-lms";
import { pagesApi } from "./pages";

/** Only self-paced courses are supported. */
export type CourseMode = "SELF_PACED";

// Course for the listing UI, we map from both sources
export interface Course {
  id: string;            // LMS course id (for delete, toggle, etc.)
  pageId: string | null; // Landing page id (tenant_pages), resolved server-side on list, from createPage on create
  /** Bundles containing this course, drives the "Part of X" chip on cards. */
  bundles?: { id: string; title: string; slug: string }[];
  tenantId: string;
  title: string;
  slug: string;          // direct slug (e.g. "python-masterclass")
  displaySlug: string;   // full slug for display (e.g. "courses/python-masterclass")
  status: string;
  mode: string;
  courseType: string;    // course type (NORMAL, PROJECT)
  isPublished: boolean;
  thumbnailKey: string | null;   // S3 key for thumbnail (resolve via getCourseThumbnailUrl)
  thumbnailUrl: string | null;  // Full URL from backend, or null
  updatedAt: string;
  createdAt: string;
}

export interface CoursesListResponse {
  courses: Course[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCourseRequest {
  tenantId: string;
  title: string;
  mode: CourseMode;
  /** Optional course type (NORMAL or PROJECT) */
  courseType?: string;
  /** When true, useCreateCourse will not redirect to the editor page */
  skipRedirect?: boolean;
}

// Helper to create a section with required defaults
function createSection(section: {
  id: string;
  type: string;
  variant?: string;
  order: number;
  content: unknown;
  visible?: boolean;
}): SectionConfig {
  return {
    id: section.id,
    type: section.type as SectionConfig["type"],
    variant: section.variant || "default",
    order: section.order,
    visible: section.visible ?? true,
    deleted: false,
    content: section.content,
    settings: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Default sections for a new course page
function getDefaultCourseSections(title: string): SectionConfig[] {
  const now = Date.now();
  return [
    createSection({
      id: `section-hero-${now}`,
      type: "course-hero",
      variant: "default",
      order: 0,
      content: {
        title: title,
        subtitle: "Learn everything you need to know",
        description: "",
        thumbnail: "",
        thumbnailAlt: title,
        mode: "SELF_PACED",
        duration: "8 hours",
        language: "English",
        price: 0,
        currency: "INR",
      },
    }),
    createSection({
      id: `section-curriculum-${now + 1}`,
      type: "course-curriculum",
      variant: "default",
      order: 1,
      content: {
        headline: "Course Curriculum",
        subheadline: "What you'll learn in this course",
        sections: [],
      },
    }),
    createSection({
      id: `section-offerings-${now + 2}`,
      type: "course-offerings",
      variant: "default",
      order: 2,
      content: {
        headline: "What's Included",
        subheadline: "Everything you get with this course",
        offerings: [],
      },
    }),
    createSection({
      id: `section-faq-${now + 3}`,
      type: "faq",
      variant: "default",
      order: 3,
      content: {
        headline: "Frequently Asked Questions",
        subheadline: "Find answers to common questions about this course",
        faqs: [],
      },
    }),
  ];
}

// Default SEO for a new course
function getDefaultCourseSEO(title: string): SEOConfig {
  return {
    title: title,
    description: `Learn ${title} with our comprehensive course.`,
    keywords: [],
  };
}

export const coursesApi = {
  /**
   * List courses for a tenant from the LMS backend (courses table).
   * The backend resolves each course's landing page id (tenant_pages) via
   * the slug convention. Do NOT resolve pageId by fetching the pages list
   * here: the server caps that list at 100 rows, which silently drops the
   * oldest pages once a tenant grows past 100.
   */
  getCourses: async (
    _tenantId: string,
    page = 1,
    limit = 100,
    filters?: { mode?: string; courseType?: string }
  ): Promise<CoursesListResponse> => {
    const lmsResponse = await coursesLmsApi.getCourses({
      page,
      limit,
      mode: filters?.mode,
      course_type: filters?.courseType,
    });

    const courses: Course[] = lmsResponse.courses.map((c) => ({
      id: c.id,
      pageId: c.pageId ?? null,
      tenantId: c.tenantId,
      title: c.title,
      slug: c.slug,
      displaySlug: `courses/${c.slug}`,
      status: c.status,
      mode: c.mode,
      courseType: c.courseType ?? "NORMAL",
      isPublished: c.status === "PUBLISHED",
      thumbnailKey: c.thumbnailKey ?? null,
      thumbnailUrl: c.thumbnailUrl ?? null,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      // This mapper rebuilds the object field-by-field, so anything not named
      // here is dropped before it reaches a card.
      bundles: c.bundles ?? [],
    }));
    return { courses, total: lmsResponse.total, page: lmsResponse.page, limit: lmsResponse.limit };
  },

  /**
   * Create a new course:
   * 1. Create LMS course record (backend does entitlement check + consume).
   * 2. Create the landing page in tenant_pages (backend skips consume since course exists).
   * Returns { lmsCourse, page } so the caller can redirect to either.
   */
  createCourse: async (
    data: CreateCourseRequest,
    theme?: ThemeConfig
  ): Promise<{ lmsCourseId: string; pageId: string }> => {
    const directSlug = generateSlug(data.title);
    if (!directSlug) {
      throw new Error("Invalid course title, cannot generate slug");
    }

    // 1. Create the LMS course (entitlement check + consume happens here)
    const lmsCourse = await coursesLmsApi.createCourse({
      title: data.title,
      slug: directSlug,
      mode: data.mode,
      ...(data.courseType && { course_type: data.courseType }),
    });

    // 2. Create the landing page for visual templating (no double-consume)
    // Layout is stored at the tenant level, no need to embed in sections
    const pageSlug = `courses/${lmsCourse.slug}`;
    const createPageReq: CreatePageRequest = {
      tenantId: data.tenantId,
      title: data.title,
      slug: pageSlug,
      sections: getDefaultCourseSections(data.title),
      theme: theme || defaultThemeConfig,
      seo: getDefaultCourseSEO(data.title),
      isPublished: false,
    };

    const page = await pagesApi.createPage(createPageReq);

    return { lmsCourseId: lmsCourse.id, pageId: page.id };
  },

  /**
   * Delete a course (LMS record + landing page cleaned up by backend).
   */
  deleteCourse: async (courseId: string): Promise<void> => {
    await coursesLmsApi.deleteCourse(courseId);
  },

  /**
   * Toggle publish: calls the dedicated backend endpoint that handles
   * entitlement consume (on publish) / release (on unpublish), then
   * syncs the landing page publish state.
   */
  togglePublish: async (
    courseId: string,
    isPublished: boolean,
    pageId?: string | null
  ): Promise<void> => {
    // Call the dedicated toggle-publish endpoint (handles entitlements)
    await apiClient.post(`/tenant/courses/${courseId}/toggle-publish`, {
      publish: isPublished,
    });

    // Also publish/unpublish the landing page so the user-facing site reflects the change
    if (pageId) {
      await pagesApi.togglePublish(pageId, isPublished);
    }
  },

  /**
   * Streams the 6-sheet course analytics .xlsx report. Filename comes from
   * the Content-Disposition header so it stays in sync with server-side naming.
   */
  downloadAnalyticsXlsx: async (courseId: string): Promise<void> => {
    const response = await apiClient.get(
      `/tenant/courses/${courseId}/analytics-export.xlsx`,
      { responseType: "blob" }
    );
    const blob = response.data as Blob;
    const disposition = response.headers["content-disposition"] as
      | string
      | undefined;
    const match = disposition?.match(/filename="?([^"]+)"?/i);
    const fileName = match?.[1] ?? `course-analytics-${courseId}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
