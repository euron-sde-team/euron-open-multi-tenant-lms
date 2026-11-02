/**
 * The payment success page and where it sends the learner next.
 *
 * Every checkout redirect carries what was bought (`?type=&id=&slug=`), so the
 * success page can offer a direct way into the course instead of only Home and
 * Browse. Only courses and bundles are carried; any other purchase keeps the
 * plain page.
 */
import { courseLearnHref, MY_LEARNING_HREF } from "./course-status";

export const CHECKOUT_SUCCESS_PATH = "/checkout/success";

export interface PurchasedItemRef {
  type: string;
  id: string;
  slug?: string | null;
}

export function checkoutSuccessPath(items: PurchasedItemRef[]): string {
  const learnable = items.filter((i) => i.type === "COURSE" || i.type === "BUNDLE");
  if (learnable.length === 0) return CHECKOUT_SUCCESS_PATH;
  if (learnable.length > 1) return `${CHECKOUT_SUCCESS_PATH}?type=MULTI`;
  const [only] = learnable;
  const params = new URLSearchParams({ type: only.type, id: only.id });
  if (only.slug) params.set("slug", only.slug);
  return `${CHECKOUT_SUCCESS_PATH}?${params.toString()}`;
}

/** "course" → one course's contents; "courses" → a list of the bought courses. */
export type SuccessTargetKind = "course" | "courses";

export interface SuccessTarget {
  href: string;
  kind: SuccessTargetKind;
}

export interface SuccessTargetDeps {
  /** Slug of an enrolled course by id, or null when not found. */
  courseSlugById: (courseId: string) => Promise<string | null>;
  /** Slug of a published bundle by id, or null when not found. */
  bundleSlugById: (bundleId: string) => Promise<string | null>;
  /** Slugs of the courses inside a bundle, in bundle order. */
  bundleCourseSlugs: (bundleSlug: string) => Promise<string[]>;
}

/**
 * Resolve the "Go to course" target from the success page's query. Falls back
 * to My Learning when a course cannot be resolved; null when there is nothing
 * to go to (nothing bought that has courses).
 */
export async function resolveSuccessTarget(
  query: { type: string | null; id: string | null; slug: string | null },
  deps: SuccessTargetDeps
): Promise<SuccessTarget | null> {
  const { type, id, slug } = query;
  if (type === "MULTI") return { href: MY_LEARNING_HREF, kind: "courses" };

  if (type === "COURSE" && id) {
    const courseSlug = slug || (await deps.courseSlugById(id).catch(() => null));
    return courseSlug
      ? { href: courseLearnHref(courseSlug), kind: "course" }
      : { href: MY_LEARNING_HREF, kind: "courses" };
  }

  if (type === "BUNDLE" && id) {
    const bundleSlug = slug || (await deps.bundleSlugById(id).catch(() => null));
    if (!bundleSlug) return { href: MY_LEARNING_HREF, kind: "courses" };
    const courseSlugs = await deps.bundleCourseSlugs(bundleSlug).catch(() => null);
    if (courseSlugs === null) return { href: MY_LEARNING_HREF, kind: "courses" };
    if (courseSlugs.length === 1) return { href: courseLearnHref(courseSlugs[0]), kind: "course" };
    // Several courses: the bundle page lists each with Start / Continue.
    if (courseSlugs.length > 1) {
      return { href: `/bundles/${encodeURIComponent(bundleSlug)}`, kind: "courses" };
    }
    return null;
  }

  return null;
}
