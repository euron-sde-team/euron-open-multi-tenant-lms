// Batch (cohort) constants shared across admin + web apps.

export const BATCH_PAGE_SLUG_PREFIX = "batches/";

/** Resolve the tenant_pages slug for a batch, given its bare slug (e.g. "jee-2026"). */
export function getBatchPageSlug(batchSlug: string): string {
  return `${BATCH_PAGE_SLUG_PREFIX}${batchSlug}`;
}

/** Strip the page slug prefix from a route param, when callers pass the page slug. */
export function normalizeBatchSlug(slug: string): string {
  if (!slug) return slug;
  return slug.startsWith(BATCH_PAGE_SLUG_PREFIX)
    ? slug.slice(BATCH_PAGE_SLUG_PREFIX.length)
    : slug;
}

/**
 * Display label for a `batch_item_type` enum value.
 * Used wherever the item type is shown to a tenant or learner, never render
 * the raw enum literal directly in UI.
 */
export function formatBatchItemType(t: string | null | undefined): string {
  if (!t) return "";
  switch (t.toUpperCase()) {
    case "COURSE":
      return "Course";
    case "BOOK":
      return "Book";
    default:
      return titleCase(t);
  }
}

/**
 * Display label for a `course_mode` enum value (`SELF_PACED | LIVE | HYBRID`).
 * Returns an empty string for nullish input so callers can `{x && `· ${x}`}`
 * without conditionals.
 *
 * Convention: NO hyphens, NO underscores in user-facing strings, separator
 * is a single space so badges, breadcrumbs, and inline text all read the same
 * regardless of CSS transforms (e.g. `uppercase`).
 */
export function formatCourseMode(m: string | null | undefined): string {
  if (!m) return "";
  switch (m.toUpperCase()) {
    case "SELF_PACED":
      return "Self paced";
    case "LIVE":
      return "Live";
    case "HYBRID":
      return "Hybrid";
    default:
      return titleCase(m);
  }
}

/**
 * Display label for a `course_type` enum value
 * (`NORMAL | PROJECT`). NORMAL is the default "no special
 * type", we return an empty string for it so the mode badge stays primary;
 * only non-NORMAL types produce a label.
 */
export function formatCourseType(t: string | null | undefined): string {
  if (!t) return "";
  switch (t.toUpperCase()) {
    case "NORMAL":
      return "";
    case "PROJECT":
      return "Project";
    default:
      return titleCase(t);
  }
}

/**
 * Resolve the single label that best describes a course on a batch listing.
 * `course_type === "PROJECT"` takes precedence over `course_mode`; everything
 * else falls through to the mode label.
 *
 * Returns an empty string when neither field carries useful info.
 */
export function formatBatchCourseLabel(
  mode: string | null | undefined,
  courseType: string | null | undefined
): string {
  const t = (courseType ?? "").toUpperCase();
  if (t === "PROJECT") return "Project";
  return formatCourseMode(mode);
}

/**
 * Normalize any enum-style string to a space-separated, title-cased label.
 * Strips both underscores and hyphens so callers never have to worry about
 * `Self-paced` vs `Self paced` mismatches when CSS later uppercases the text.
 */
function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
