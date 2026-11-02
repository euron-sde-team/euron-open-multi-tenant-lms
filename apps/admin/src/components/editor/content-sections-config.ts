import type { SectionConfig, SectionType } from "@open-mtlms/shared";
import { createSectionConfig } from "@open-mtlms/shared";
import { sectionRegistry } from "@open-mtlms/ui-config";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  Grid3X3,
  type LucideIcon,
  Package,
} from "lucide-react";

/**
 * Canonical set of "content listing" sections, the storefront blocks that pull
 * a tenant's real catalog (courses, books, etc). Every template should be able
 * to surface all of these; the Content manager panel lets a tenant show/hide
 * each one regardless of which listings the chosen template happened to include.
 *
 * `type` + `defaultVariant` feed the existing editor-store addSection(); the
 * shared ContentListingSection renders any of them theme-aware, so no template
 * edits are needed. Labels/icons mirror the section registry.
 */
export interface ContentSectionDef {
  type: string;
  defaultVariant: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const CONTENT_SECTION_DEFS: ContentSectionDef[] = [
  { type: "all-courses-listing", defaultVariant: "scroll", label: "All Courses", description: "Every published course", icon: GraduationCap },
  { type: "self-paced-courses-listing", defaultVariant: "scroll", label: "Self-Paced Courses", description: "On-demand recorded courses", icon: BookOpen },
  { type: "books-listing", defaultVariant: "scroll", label: "Books", description: "Published e-books", icon: BookOpen },
  { type: "bundles-listing", defaultVariant: "scroll", label: "Bundles", description: "Packaged offerings", icon: Package },
  { type: "categories-listing", defaultVariant: "grid", label: "Categories", description: "Browse by topic", icon: Grid3X3 },
  { type: "test-series-listing", defaultVariant: "scroll", label: "Test Series", description: "Exams & practice tests", icon: ClipboardList },
];

/**
 * A page section counts as "this content type" if its type contains the base
 * (minus the "-listing" suffix). Covers niche-themed variants like
 * "courses-listing-examprep" / "books-listing-govtexam" so we never double-add.
 */
export function sectionMatchesContentType(
  sectionType: string,
  def: ContentSectionDef,
): boolean {
  const base = def.type.replace(/-listing$/, "");
  return sectionType.includes(base) && sectionType.includes("listing");
}

/**
 * Ensure every catalog listing is present on a page's sections. Any content type
 * not already represented is appended (visible), so applying a template never
 * leaves a tenant's courses/books/etc. with nowhere to render. Existing sections
 * (incl. hidden ones) are left untouched, this only ADDS what's missing.
 *
 * Appended at the end, after the template's own sections, preserving their order.
 * Empty listings render a "Coming soon" state; tenants hide unwanted ones via the
 * Content panel. Pure function, returns a new array, mutates nothing.
 */
export function ensureContentSections(
  sections: SectionConfig[],
): SectionConfig[] {
  const missing = CONTENT_SECTION_DEFS.filter(
    (def) =>
      !sections.some(
        (s) => !s.deleted && sectionMatchesContentType(s.type, def),
      ),
  );
  if (missing.length === 0) return sections;

  let order = sections.length;
  const injected = missing
    .map((def) => {
      const registry = sectionRegistry[def.type as keyof typeof sectionRegistry];
      if (!registry) return null; // unknown type, skip rather than break
      return createSectionConfig(
        def.type as SectionType,
        def.defaultVariant,
        registry.defaultContent,
        order++,
      );
    })
    .filter((s): s is SectionConfig => s !== null);

  return [...sections, ...injected];
}
