import type { AvailableRoute, AvailableRoutesResponse } from "../types/link";
import type { SectionConfig, SectionType } from "../types/section";
import { generateId } from "./id";

/**
 * Normalize path for comparison (ensure leading slash, no trailing slash for root)
 */
function normalizePath(path: string): string {
  const p = path?.trim() || "";
  if (!p) return "/";
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return withSlash === "/" ? "/" : withSlash.replace(/\/+$/, "") || "/";
}

/**
 * Build a set of available paths from routes
 */
function getAvailablePathSet(routes: AvailableRoute[]): Set<string> {
  const set = new Set<string>();
  for (const r of routes) {
    set.add(normalizePath(r.path));
  }
  return set;
}

/**
 * Filter sections to remove footer links whose href is not in available routes.
 * Used when applying templates or adding sections - only show footer links that exist in the tenant's web.
 */
export function filterSectionsFooterLinksByAvailableRoutes(
  sections: SectionConfig[],
  availableRoutes: AvailableRoutesResponse | null | undefined
): SectionConfig[] {
  if (!availableRoutes) return sections;

  const routes = [...(availableRoutes.internal ?? []), ...(availableRoutes.system ?? [])];
  const pathSet = getAvailablePathSet(routes);

  return sections.map((section) => {
    const content = section.content as Record<string, unknown> | undefined;
    if (!content || typeof content !== "object") return section;

    const href = content.footerLinkHref as string | undefined;
    if (!href || typeof href !== "string") return section;

    const normalizedHref = normalizePath(href);
    if (pathSet.has(normalizedHref)) return section;

    const { footerLinkText, footerLinkHref, ...rest } = content;
    return {
      ...section,
      content: { ...rest, footerLinkText: undefined, footerLinkHref: undefined },
    };
  });
}

/**
 * Filter content object to remove footer links whose href is not in available routes.
 * Used when adding a section with default content - only include footer links that exist.
 */
export function filterContentFooterLinksByAvailableRoutes(
  content: Record<string, unknown>,
  availableRoutes: AvailableRoutesResponse | null | undefined
): Record<string, unknown> {
  if (!availableRoutes) return content;

  const href = content.footerLinkHref as string | undefined;
  if (!href || typeof href !== "string") return content;

  const routes = [...(availableRoutes.internal ?? []), ...(availableRoutes.system ?? [])];
  const pathSet = getAvailablePathSet(routes);
  const normalizedHref = normalizePath(href);
  if (pathSet.has(normalizedHref)) return content;

  const { footerLinkText, footerLinkHref, ...rest } = content;
  return { ...rest, footerLinkText: undefined, footerLinkHref: undefined };
}

/**
 * Check if section has custom background color (light or dark mode)
 * When true, section components should use bg-transparent so the wrapper's background shows
 */
export function hasCustomSectionBackground(section: SectionConfig): boolean {
  const s = section.settings ?? {};
  return !!(s.backgroundColor || s.backgroundColorDark);
}

/**
 * Create a new section config with default values
 */
export function createSectionConfig(
  type: SectionType,
  variant: string,
  content: unknown,
  order: number
): SectionConfig {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    type,
    variant,
    order,
    visible: true,
    deleted: false,
    content,
    settings: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Reorder sections array after moving a section
 */
export function reorderSections(
  sections: SectionConfig[],
  fromIndex: number,
  toIndex: number
): SectionConfig[] {
  const result = [...sections];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);

  // Update order property for all sections
  return result.map((section, index) => ({
    ...section,
    order: index,
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Get visible sections sorted by order
 */
export function getVisibleSections(sections: SectionConfig[]): SectionConfig[] {
  return sections
    .filter((section) => section.visible && !section.deleted)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all sections including hidden but not deleted
 */
export function getAllActiveSections(sections: SectionConfig[]): SectionConfig[] {
  return sections.filter((section) => !section.deleted).sort((a, b) => a.order - b.order);
}

/**
 * Deep clone a section with a new ID
 */
export function cloneSection(section: SectionConfig): SectionConfig {
  const now = new Date().toISOString();
  return {
    ...JSON.parse(JSON.stringify(section)),
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
}
