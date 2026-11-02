/**
 * A learner's state on an enrolled course, from the server's progress percent
 * (completed lectures, assignments and quizzes over the total; the same rule
 * My Learning's "Completed" filter uses).
 */
export type CourseStatus = "not_started" | "in_progress" | "completed";

/** Null when the progress is unknown (not loaded, or the course was not found). */
export function courseStatusFromProgress(
  percent: number | null | undefined
): CourseStatus | null {
  if (percent == null || !Number.isFinite(percent)) return null;
  if (percent >= 100) return "completed";
  if (percent <= 0) return "not_started";
  return "in_progress";
}

/**
 * An owner's call to action on a course card, by their progress: the same
 * wording as the shared CourseCard and the bundle page.
 */
export function ownedCourseLabel(percent: number | null | undefined, courseTerm: string): string {
  switch (courseStatusFromProgress(percent)) {
    case "completed":
      return `${courseTerm} Completed`;
    case "not_started":
      return `Start ${courseTerm}`;
    default:
      return "Continue Learning";
  }
}

/** The course player for a course the learner owns. */
export function courseLearnHref(slug: string): string {
  return `/learn/courses/${encodeURIComponent(slug)}`;
}

export const MY_LEARNING_HREF = "/my-learning";

/**
 * Page through the learner's enrolled courses (the server returns at most 50
 * per page) until every wanted course is found or the list ends.
 */
export async function findEnrolledCourses<T extends { id: string }>(
  wantedIds: string[],
  fetchPage: (page: number) => Promise<{ courses: T[]; page: number; limit: number; total: number }>,
  maxPages = 20
): Promise<Map<string, T>> {
  const wanted = new Set(wantedIds);
  const found = new Map<string, T>();
  if (wanted.size === 0) return found;
  for (let page = 1; page <= maxPages && found.size < wanted.size; page++) {
    const res = await fetchPage(page);
    for (const c of res.courses) {
      if (wanted.has(c.id)) found.set(c.id, c);
    }
    if (res.courses.length === 0 || res.page * res.limit >= res.total) break;
  }
  return found;
}
