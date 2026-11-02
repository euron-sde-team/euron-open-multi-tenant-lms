import { storefrontUrlForSlug } from "../utils/tenant-domain.util";
import { db } from "../db/connection";
import { NotFoundError } from "../errors/not-found.error";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  hint_url?: string;
  action_url: string;
}

export interface ChecklistResponse {
  items: ChecklistItem[];
  percent_done: number;
  is_completed: boolean;
  can_share_academy_link: boolean;
  academy_preview_url: string | null;
  sample_course_slug: string | null;
  is_dismissed: boolean;
}

class OnboardingService {
  /**
   * Build the launch checklist server-side from real tables, no separate
   * status table needed. Each step's `done` is derived from a single signal:
   *
   *   1. Customize home page, tenant_pages.updated_at > created_at on slug='home'
   *   2. Add a real course title, courses.title differs from auto-seeded default
   *      (heuristic: title doesn't equal "Getting Started with {orgName}" etc.)
   *   3. Upload first video, any tenant_video_storage row with
   *                                lecture_id IS NOT NULL on the sample course
   *   4. Set pricing, courses.price_inr > 0 OR purchase_mode='FREE'
   *   5. Publish academy, courses.status='PUBLISHED'
   *
   * Items 2–5 are scoped to the FIRST course (the seeded sample). Once the
   * tenant adds more courses, the dashboard nudges step 5 toward "your
   * latest course is published" naturally.
   */
  async getChecklist(tenantId: string): Promise<ChecklistResponse> {
    // Pull tenant + first course in parallel
    const [tenant, homePage, firstCourse] = await Promise.all([
      db
        .selectFrom("tenants")
        .select(["id", "slug", "custom_domain", "onboarding_checklist_dismissed_at"])
        .where("id", "=", tenantId)
        .executeTakeFirst(),
      db
        .selectFrom("tenant_pages")
        .select(["created_at", "updated_at", "is_published"])
        .where("tenant_id", "=", tenantId)
        .where("slug", "=", "home")
        .executeTakeFirst(),
      db
        .selectFrom("courses")
        .select(["id", "title", "slug", "price_inr", "purchase_mode", "status"])
        .where("tenant_id", "=", tenantId)
        .orderBy("created_at", "asc")
        .limit(1)
        .executeTakeFirst(),
    ]);

    if (!tenant) throw new NotFoundError("Tenant not found");

    // The dual-storage convention pairs each course with a `tenant_pages` row
    // at slug `courses/{course.slug}`. The course-editor routes
    // (`/dashboard/courses/[id]/editor` and `/dashboard/courses/[id]/lms/editor`)
    // resolve `[id]` as a PAGE id, not the courses-table id, they call
    // `pagesApi.getPage(id)` first and derive the LMS course from the page
    // slug. Building the action URLs with `firstCourse.id` (the courses row
    // id) sends users to a page that doesn't exist → 404 from the page API.
    //
    // Fetch the companion landing page in parallel with the count of
    // lectures that have a video attached so the checklist links resolve to the actual page id.
    let hasUploadedVideo = false;
    let coursePageId: string | null = null;
    if (firstCourse) {
      const [videoCount, coursePage] = await Promise.all([
        db
          .selectFrom("lectures")
          .select(db.fn.count<number>("id").as("count"))
          .where("tenant_id", "=", tenantId)
          .where("course_id", "=", firstCourse.id)
          .where("video_key", "is not", null)
          .executeTakeFirst(),
        db
          .selectFrom("tenant_pages")
          .select("id")
          .where("tenant_id", "=", tenantId)
          .where("slug", "=", `courses/${firstCourse.slug}`)
          .executeTakeFirst(),
      ]);
      hasUploadedVideo = Number(videoCount?.count ?? 0) > 0;
      coursePageId = coursePage?.id ?? null;
    }

    const homeCustomized = homePage
      ? new Date(homePage.updated_at).getTime() -
          new Date(homePage.created_at).getTime() >
        2000 // 2-second tolerance for the same-transaction creation
      : false;

    const courseTitleEdited = firstCourse
      ? !/^(Getting Started with|Full-Stack Engineering|Photography Fundamentals|30-Day Foundation|JEE Main Foundation|UPSC Civil Services|Vedic Astrology|Manager Onboarding)/i.test(
          firstCourse.title,
        )
      : false;

    const pricingSet =
      firstCourse?.purchase_mode === "FREE" ||
      Number(firstCourse?.price_inr ?? 0) > 0;
    const isPublished = firstCourse?.status === "PUBLISHED";

    // Editor routes are keyed by page id (see CLAUDE.md: "URL params.id in
    // /courses/[id]/... is a page ID"). Fall back to /dashboard/courses if
    // the companion page row is missing (shouldn't happen post-provisioning,
    // but a Course→Page race during initial create has been seen historically).
    const courseHref = coursePageId
      ? `/dashboard/courses/${coursePageId}/editor`
      : "/dashboard/courses";
    const lmsHref = coursePageId
      ? `/dashboard/courses/${coursePageId}/lms/editor`
      : "/dashboard/courses";

    const items: ChecklistItem[] = [
      {
        id: "home",
        label: "Customize your home page",
        done: homeCustomized,
        action_url: "/dashboard/pages",
      },
      {
        id: "course-title",
        label: "Add your course title",
        done: courseTitleEdited,
        action_url: courseHref,
      },
      {
        id: "first-video",
        label: "Upload your first video",
        done: hasUploadedVideo,
        action_url: lmsHref,
      },
      {
        id: "pricing",
        label: "Set your pricing",
        done: pricingSet,
        action_url: courseHref,
      },
      {
        id: "publish",
        label: "Publish your academy",
        done: isPublished,
        action_url: courseHref,
      },
    ];

    const doneCount = items.filter((i) => i.done).length;
    const percentDone = Math.round((doneCount / items.length) * 100);

    const academyPreviewUrl =
      tenant.custom_domain && tenant.custom_domain.length > 0
        ? `https://${tenant.custom_domain}`
        : tenant.slug
          ? storefrontUrlForSlug(tenant.slug)
          : null;

    return {
      items,
      percent_done: percentDone,
      is_completed: percentDone === 100,
      can_share_academy_link: !!academyPreviewUrl,
      academy_preview_url: academyPreviewUrl,
      sample_course_slug: firstCourse?.slug ?? null,
      is_dismissed: !!tenant.onboarding_checklist_dismissed_at,
    };
  }

  async dismissChecklist(tenantId: string): Promise<{ dismissed_at: Date }> {
    const now = new Date();
    await db
      .updateTable("tenants")
      .set({ onboarding_checklist_dismissed_at: now, updated_at: now })
      .where("id", "=", tenantId)
      .execute();
    return { dismissed_at: now };
  }
}

export default new OnboardingService();
