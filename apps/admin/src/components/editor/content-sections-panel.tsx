"use client";

import { Switch } from "@open-mtlms/core";
import type { SectionType } from "@open-mtlms/shared";
import { filterContentFooterLinksByAvailableRoutes } from "@open-mtlms/shared";
import { sectionRegistry } from "@open-mtlms/ui-config";

import { useAvailableRoutesQuery } from "@/lib/hooks/use-available-routes";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { cn } from "@/lib/utils";

import {
  CONTENT_SECTION_DEFS,
  type ContentSectionDef,
  sectionMatchesContentType,
} from "./content-sections-config";

/**
 * Content manager, one place to show/hide every catalog listing (courses,
 * books, test series, …) on the current page, independent of which listings the
 * chosen template shipped with.
 *
 * - Toggle ON  → if a matching section exists, make it visible; else add it.
 * - Toggle OFF → hide the matching section (kept in config; reversible).
 *
 * Reuses the existing store actions and the theme-aware ContentListingSection,
 * so nothing about the template or its design is modified.
 */
export function ContentSectionsPanel() {
  const { pageConfig, addSection, updateSection } = useEditorStore();
  const { selectedTenantId } = useTenantStore();
  const { data: availableRoutes } = useAvailableRoutesQuery(
    selectedTenantId ?? undefined,
  );

  // Resolve current state for a content type from the live page sections.
  const resolve = (def: ContentSectionDef) => {
    const section = pageConfig.sections.find(
      (s) => !s.deleted && sectionMatchesContentType(s.type, def),
    );
    return {
      section,
      present: !!section,
      // A freshly-added or template section is visible unless explicitly hidden.
      on: !!section && section.visible !== false,
    };
  };

  const handleToggle = (def: ContentSectionDef, next: boolean) => {
    const { section } = resolve(def);

    if (next) {
      if (section) {
        // Re-show an existing (hidden) section.
        updateSection(section.id, { visible: true });
        return;
      }
      // Add a new listing with its registry default content (footer links
      // filtered to routes that exist, mirroring the Add Section panel).
      const registry =
        sectionRegistry[def.type as keyof typeof sectionRegistry];
      const defaultContent = registry?.defaultContent as
        | Record<string, unknown>
        | undefined;
      const contentOverride =
        defaultContent && "footerLinkHref" in defaultContent
          ? filterContentFooterLinksByAvailableRoutes(
              defaultContent,
              availableRoutes,
            )
          : undefined;
      // Append at the bottom of the page (after the last section) instead of the
      // top, a newly-enabled listing above the hero would be jarring. The store
      // treats a missing afterSectionId as "insert at index 0", so we pass the
      // last live section explicitly.
      const liveSections = pageConfig.sections.filter((s) => !s.deleted);
      const afterSectionId = liveSections[liveSections.length - 1]?.id;
      addSection(
        def.type as SectionType,
        def.defaultVariant,
        afterSectionId,
        contentOverride,
      );
      return;
    }

    // Turn OFF → hide (never destructive; keeps the section + its edits).
    if (section) updateSection(section.id, { visible: false });
  };

  return (
    <div className="flex flex-col">
      <div className="border-primary/20 bg-primary/5 mx-3 mt-3 rounded-lg border px-3 py-2.5">
        <p className="text-foreground text-xs font-medium">
          Turn a section on to show it on your page.
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          A section only appears once you’ve published content for it, an empty
          section stays hidden (even when turned on) and shows up automatically
          the moment its first item goes live.
        </p>
      </div>
      <ul className="flex flex-col gap-1 px-2 pb-4">
        {CONTENT_SECTION_DEFS.map((def) => {
          const { present, on } = resolve(def);
          const Icon = def.icon;
          return (
            <li
              key={def.type}
              className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-medium">
                  {def.label}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {present && !on ? "Hidden" : def.description}
                </span>
              </span>
              <Switch
                checked={on}
                onCheckedChange={(next) => handleToggle(def, next)}
                aria-label={`${on ? "Hide" : "Show"} ${def.label}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
