// Tenant terminology resolver.
//
// A tenant renames content types from Settings → Navigation (e.g. the "Bundles"
// nav item becomes "Certificate Courses"). Those labels are the single source of
// truth for how a content type is called across the student portal, so instead
// of a separate terminology config we derive the term for each content type from
// the sidebar nav labels the tenant already edits.
//
// Given the tenant's sidebar nav items, `resolveContentTerms()` returns a term
// (singular + plural) per content type: the nav label becomes the plural and the
// singular is auto-derived, falling back to sensible defaults when a tenant has
// not renamed (or hidden) that nav item.

import type { SidebarNavItem } from "../types/layout";

export type ContentTermKey =
  | "course"
  | "bundle"
  | "testSeries"
  | "book"
  | "batch";

export interface ContentTerm {
  /** Singular form, e.g. "Certificate Course". Used in buttons/headings. */
  singular: string;
  /** Plural form, e.g. "Certificate Courses". Used in list headings/tabs. */
  plural: string;
}

export type ContentTerms = Record<ContentTermKey, ContentTerm>;

/** Built-in labels used when a tenant has not renamed a content type. */
export const DEFAULT_CONTENT_TERMS: ContentTerms = {
  course: { singular: "Course", plural: "Courses" },
  bundle: { singular: "Bundle", plural: "Bundles" },
  testSeries: { singular: "Test Series", plural: "Test Series" },
  book: { singular: "Book", plural: "Books" },
  batch: { singular: "Batch", plural: "Batches" },
};

/**
 * Route roots that identify a nav item as a given content type. A nav item
 * matches a content type when its href equals or starts with one of these
 * roots. Order within a list is preference order (first match wins).
 */
const CONTENT_TERM_ROUTES: Record<ContentTermKey, string[]> = {
  course: ["/all-courses", "/self-paced", "/courses"],
  bundle: ["/bundles"],
  testSeries: ["/test-series"],
  book: ["/books"],
  batch: ["/batches"],
};

/** Secondary signal: entitlement feature keys that map to a content type. */
const CONTENT_TERM_FEATURE_KEYS: Partial<Record<ContentTermKey, string[]>> = {
  course: ["self_paced_courses", "courses"],
  bundle: ["bundles"],
  testSeries: ["test_series"],
  book: ["books"],
  batch: ["batches"],
};

/**
 * Derive a singular form from a plural label. Handles the common English cases
 * plus "… Series" (invariant) so a renamed "Certificate Courses" → "Certificate
 * Course" and "Test Series" stays "Test Series".
 */
export function singularizeTerm(plural: string): string {
  const p = plural.trim();
  if (!p) return p;
  // "Test Series" / "… Series" is already singular-safe.
  if (/series$/i.test(p)) return p;
  // Categories → Category, Stories → Story
  if (/[^aeiou]ies$/i.test(p)) return p.replace(/ies$/i, "y");
  // Classes → Class, Boxes → Box (…ses/…xes/…ches/…shes)
  if (/(ss|x|ch|sh)es$/i.test(p)) return p.replace(/es$/i, "");
  // Courses → Course, Books → Book
  if (/s$/i.test(p)) return p.replace(/s$/i, "");
  return p;
}

function normalizeHref(href: string | undefined): string {
  if (!href) return "";
  // Strip origin, query and trailing slash so "/bundles/" and "/bundles?x=1"
  // both match the "/bundles" root.
  const path = href.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0];
  return path.replace(/\/+$/, "") || "/";
}

function flattenNavItems(
  items: SidebarNavItem[] | undefined | null,
  acc: SidebarNavItem[] = [],
): SidebarNavItem[] {
  if (!items) return acc;
  for (const item of items) {
    acc.push(item);
    if (item.children?.length) flattenNavItems(item.children, acc);
  }
  return acc;
}

function matchNavItem(
  key: ContentTermKey,
  flat: SidebarNavItem[],
): SidebarNavItem | undefined {
  const featureKeys = CONTENT_TERM_FEATURE_KEYS[key] ?? [];
  // Prefer an exact feature-key match (most reliable), then href root match.
  const byFeature = flat.find(
    (i) => i.featureKey && featureKeys.includes(i.featureKey),
  );
  if (byFeature) return byFeature;
  const roots = CONTENT_TERM_ROUTES[key];
  return flat.find((i) => {
    const href = normalizeHref(i.href);
    return roots.some((root) => href === root || href.startsWith(root + "/"));
  });
}

/**
 * Resolve the terminology for every content type from the tenant's sidebar nav
 * items. Any type without a matching (and non-empty-labelled) nav item keeps its
 * default label.
 */
export function resolveContentTerms(
  navItems: SidebarNavItem[] | undefined | null,
): ContentTerms {
  const flat = flattenNavItems(navItems);
  const out = {} as ContentTerms;
  (Object.keys(DEFAULT_CONTENT_TERMS) as ContentTermKey[]).forEach((key) => {
    const match = matchNavItem(key, flat);
    const label = match?.label?.trim();
    if (label) {
      // A nav label of "All Courses" names the PAGE, not the content type.
      // Taking it verbatim as the plural fed headings that compose their own
      // "All"/"My" prefix, the /all-courses title is `All ${plural}`, which
      // rendered as "All All Courses" with the subtitle "Explore our all
      // courses." And "All Courses" IS the default nav label, so every tenant
      // who never renamed it saw the stutter. Strip a leading "All " when
      // deriving the term; the guard keeps a label that is literally just
      // "All" from collapsing to an empty term.
      const cleaned = label.replace(/^all\s+/i, "").trim() || label;
      out[key] = { plural: cleaned, singular: singularizeTerm(cleaned) };
    } else {
      out[key] = DEFAULT_CONTENT_TERMS[key];
    }
  });
  return out;
}

/**
 * Return the tenant's label for the sidebar nav item pointing at `href`, or
 * `fallback` when there is no matching item (or its label is blank). Used to
 * drive a page's heading/title from whatever the tenant renamed that nav item
 * to, e.g. renaming "Live Courses" to "Live Batches" retitles the /live page.
 * Matching is exact on the normalized path (origin/query/trailing-slash removed).
 */
export function navLabelByHref(
  navItems: SidebarNavItem[] | undefined | null,
  href: string,
  fallback: string,
): string {
  const target = normalizeHref(href);
  const match = flattenNavItems(navItems).find(
    (i) => normalizeHref(i.href) === target,
  );
  return match?.label?.trim() || fallback;
}
