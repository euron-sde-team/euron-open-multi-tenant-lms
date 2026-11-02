/**
 * Builds the LMS deep-link for a live session whose lecture is part of a
 * batch course. The calendar API computes `lessonPosition` server-side
 * (1-based index of the lesson in the course's flat curriculum), so we
 * deep-link straight to the LMS-native positional URL
 * `/learn/{bareSlug}/lesson/{N}`. The LMS player parses that URL on
 * mount and sets the active lesson with no client-side matcher races.
 *
 * Even on the positional path, we keep `?lectureId=<X>` in the URL.
 * `lessonPosition` is an ordinal over the curriculum *at the time the
 * calendar response was computed*, if the admin reorders sections,
 * inserts a lesson, or regenerates the schedule before the user clicks,
 * `N` can drift to the wrong lesson. The LMS resolver effect
 * (`apps/web/src/app/learn/[...slugs]/page.tsx`) checks `lectureId`
 * first and overrides the positional segment when they disagree, so
 * keeping the stable lecture binding in the URL self-corrects under
 * normal catalog maintenance.
 *
 * Falls back to `?lectureId=<X>` alone when `lessonPosition` is missing
 * (e.g. the session's lecture was orphaned by a regen). Returns `null`
 * only when there's no course slug at all.
 *
 * Path normalisation: `courses/` is the *page* slug convention
 * (`tenant_pages.slug`), not the *course* slug (`courses.slug`). The
 * LMS player route is `/learn/{courseSlug}` and expects the bare
 * course slug.
 */
export function buildBatchSessionLectureUrl(args: {
  courseSlug: string | null;
  lectureId: string | null;
  lessonPosition?: number | null;
}): string | null {
  if (!args.courseSlug) return null;
  const bareSlug = args.courseSlug.startsWith("courses/")
    ? args.courseSlug.slice("courses/".length)
    : args.courseSlug;
  if (!bareSlug) return null;
  const lectureQuery = args.lectureId
    ? `?lectureId=${encodeURIComponent(args.lectureId)}`
    : "";
  if (args.lessonPosition && args.lessonPosition > 0) {
    return `/learn/${bareSlug}/lesson/${args.lessonPosition}${lectureQuery}`;
  }
  if (lectureQuery) {
    return `/learn/${bareSlug}${lectureQuery}`;
  }
  return `/learn/${bareSlug}`;
}
