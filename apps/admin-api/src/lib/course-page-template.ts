/**
 * The sections a brand-new course landing page starts with.
 *
 * WHY THIS EXISTS SERVER-SIDE
 * ---------------------------
 * `createCourse` used to write the landing page with `sections: []`, because
 * the section templates live in the admin UI and the browser filled them in
 * after the create call returned. Anything that created a course WITHOUT the
 * browser, the API, a script, or the assistant, produced a course whose
 * public page had nothing on it and stayed unpublished. A visitor clicking that
 * course on the storefront got "Page Not Found".
 *
 * That is not a cosmetic gap: it meant the agent could create and publish a
 * course, report success truthfully, and still leave a dead link on the site.
 * A default template here makes a course created by ANY caller a real, viewable
 * course, which the UI is then free to rearrange.
 *
 * The copy is deliberately skeletal and honest, headings and structure, with
 * the course's own title, subtitle and description filled in. It does not
 * invent outcomes, ratings or testimonials, because a landing page that lies
 * about a course on its first day is worse than one that is plainly new.
 */
import { ulid } from "ulid";

export interface CoursePageSeed {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  mode?: string | null;
  difficulty?: string | null;
  priceInr?: number | null;
  priceUsd?: number | null;
}

interface Section {
  id: string;
  type: string;
  order: number;
  content: Record<string, unknown>;
  deleted: boolean;
  variant: string;
  visible: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function section(type: string, order: number, content: Record<string, unknown>): Section {
  const now = new Date().toISOString();
  return {
    id: ulid(),
    type,
    order,
    content,
    deleted: false,
    variant: "default",
    visible: true,
    settings: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function buildCoursePageSections(course: CoursePageSeed): Section[] {
  const title = course.title;

  return [
    section("course-hero", 0, {
      title,
      subtitle: course.subtitle ?? "",
      description: course.description ?? "",
      mode: course.mode ?? "SELF_PACED",
      difficulty: course.difficulty ?? "",
      currency: "INR",
      // Pricing is merged from the courses table when the page is served, so
      // these are a starting value rather than the source of truth.
      price: course.priceInr ?? 0,
      originalPrice: 0,
      discount: 0,
      duration: "",
      language: "English",
      thumbnail: "",
      thumbnailAlt: title,
      validityDays: null,
      previewVideoUrl: "",
    }),
    section("course-learning-outcomes", 1, {
      headline: "What You'll Learn",
      subheadline: "By the end of this course, you will be able to:",
      outcomes: [],
    }),
    section("course-curriculum", 2, {
      headline: "Course Content",
      subheadline: "",
      sections: [],
      totalLectures: 0,
    }),
    section("course-offerings", 3, {
      headline: "This Course Includes",
      subheadline: "Everything you get with this course",
      offerings: [],
    }),
    section("course-prerequisites", 4, {
      headline: "Requirements",
      subheadline: "Before you begin this course",
      prerequisites: [],
    }),
    section("faq", 5, {
      headline: "Frequently Asked Questions",
      subheadline: "Find answers to common questions about this course",
      faqs: [],
    }),
    section("course-ratings", 6, {}),
    section("course-recommendations", 7, {
      headline: "You May Also Like",
      recommendations: [],
    }),
    section("course-instructor", 8, {
      headline: "Your Instructor",
      subheadline: "Learn from industry experts",
      instructors: [],
    }),
  ];
}
