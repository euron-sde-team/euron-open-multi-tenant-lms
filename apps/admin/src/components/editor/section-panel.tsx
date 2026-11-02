"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
} from "@open-mtlms/core";
import {
  filterContentFooterLinksByAvailableRoutes,
  SECTION_CATEGORIES,
} from "@open-mtlms/shared";
import type { SectionType } from "@open-mtlms/shared";
import { sectionRegistry } from "@open-mtlms/ui-config";
import { Grid3X3, LayoutTemplate, Monitor, Search, Smartphone, Tablet } from "lucide-react";
import { useMemo, useState } from "react";

import { useAvailableRoutesQuery } from "@/lib/hooks/use-available-routes";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useTenantStore } from "@/lib/stores/tenant-store";

import { BASIC_SECTION_TEMPLATES } from "./basic-section-templates";
import { SectionPreviewCard, type ViewportMode } from "./section-preview-card";

// ---------------------------------------------------------------------------
// SidebarItem, shared with All Templates styling
// ---------------------------------------------------------------------------

interface SidebarItemProps {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  count: number;
  index?: number;
  onClick: () => void;
}

function SidebarItem({ label, icon, active, count, index, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      onClick={onClick}
    >
      <span className="flex items-center gap-2 truncate">
        {icon ||
          (index != null ? (
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-medium ${
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {index}
            </span>
          ) : null)}
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`text-xs tabular-nums ${active ? "text-primary" : "text-muted-foreground/60"}`}
      >
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SectionPanel: Add Section modal (wide layout like All Templates)
// Uses a minimal, curated set: one basic template per core category.
// ---------------------------------------------------------------------------

export function SectionPanel() {
  const {
    isSectionPanelOpen,
    closePanels,
    addSection,
    selectedSectionId,
    addSectionContext,
    pageConfig,
  } = useEditorStore();
  const { selectedTenantId } = useTenantStore();
  const { data: availableRoutes } = useAvailableRoutesQuery(selectedTenantId ?? undefined);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [viewport, setViewport] = useState<ViewportMode>("desktop");

  // Use addSectionContext when opened from divider +, else selectedSectionId from toolbar
  const effectiveAfterId = addSectionContext?.afterSectionId ?? selectedSectionId ?? undefined;

  const selectedSection = effectiveAfterId
    ? pageConfig.sections.find((s) => s.id === effectiveAfterId)
    : null;

  const handleAddSection = (type: SectionType, variant: string) => {
    const registry = sectionRegistry[type as keyof typeof sectionRegistry];
    const defaultContent = registry?.defaultContent as Record<string, unknown> | undefined;
    const contentOverride =
      defaultContent && "footerLinkHref" in defaultContent
        ? filterContentFooterLinksByAvailableRoutes(defaultContent, availableRoutes)
        : undefined;
    addSection(type, variant, effectiveAfterId, contentOverride);
    closePanels();
  };

  // Build grouped sections from minimal curated templates only.
  const groupedSections = useMemo(() => {
    type RegistryEntry = (typeof sectionRegistry)[keyof typeof sectionRegistry];
    const byCategory = new Map<string, { type: string; variant: string; entry: RegistryEntry }[]>();
    const seen = new Set<string>();

    for (const template of BASIC_SECTION_TEMPLATES) {
      const entry = sectionRegistry[template.type as keyof typeof sectionRegistry];
      if (!entry) continue;
      const hasVariant = entry.variants.some((v) => v.id === template.variant);
      if (!hasVariant) continue;

      const dedupeKey = `${template.type}::${template.variant}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const list = byCategory.get(template.category) ?? [];
      list.push({ type: template.type, variant: template.variant, entry });
      byCategory.set(template.category, list);
    }

    return SECTION_CATEGORIES.filter((cat) => byCategory.has(cat.id)).map((cat) => ({
      ...cat,
      sections: byCategory.get(cat.id) ?? [],
    }));
  }, []);

  // Flatten curated items for the grid.
  const allSectionItems = useMemo(() => {
    const items: {
      type: string;
      variant: string;
      sectionName: string;
      sectionDescription: string;
      categoryLabel: string;
    }[] = [];
    for (const cat of groupedSections) {
      const categoryLabel = cat.name;
      for (const { type, variant, entry } of cat.sections) {
        const selectedVariant = entry.variants.find((v) => v.id === variant);
        if (!selectedVariant) continue;
        items.push({
          type,
          variant,
          sectionName: `${entry.name}, ${selectedVariant.name}`,
          sectionDescription: selectedVariant.description || entry.description,
          categoryLabel,
        });
      }
    }
    return items;
  }, [groupedSections]);

  const filteredItems = useMemo(() => {
    let items = allSectionItems;

    if (activeFilter !== "all") {
      const cat = groupedSections.find((c) => c.id === activeFilter);
      if (cat) {
        items = items.filter((i) =>
          cat.sections.some((s) => s.type === i.type)
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.sectionName.toLowerCase().includes(q) ||
          i.sectionDescription.toLowerCase().includes(q)
      );
    }

    return items;
  }, [allSectionItems, activeFilter, searchQuery, groupedSections]);

  const totalCount = allSectionItems.length;

  return (
    <Dialog open={isSectionPanelOpen} onOpenChange={(open) => !open && closePanels()}>
      <DialogContent className="flex h-[85vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Add Section</DialogTitle>
              {selectedSection && (
                <p className="text-muted-foreground mt-0.5 text-sm font-normal">
                  Adding after:{" "}
                  <span className="font-medium capitalize text-foreground">
                    {selectedSection.type.replace(/-/g, " ")}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </DialogHeader>

        {/* Sidebar + Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 shrink-0 border-r">
            <ScrollArea className="h-full">
              <div className="space-y-1 p-4">
                <SidebarItem
                  label="All Sections"
                  icon={<Grid3X3 className="h-4 w-4" />}
                  active={activeFilter === "all"}
                  count={totalCount}
                  onClick={() => setActiveFilter("all")}
                />

                <div className="my-3 border-b" />
                <p className="text-muted-foreground mb-2 px-2 text-xs font-medium uppercase tracking-wider">
                  By Category
                </p>

                {groupedSections.map((cat, idx) => {
                  const count = cat.sections.length;
                  return (
                    <SidebarItem
                      key={cat.id}
                      label={cat.name}
                      active={activeFilter === cat.id}
                      count={count}
                      index={idx + 1}
                      onClick={() => setActiveFilter(cat.id)}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          {/* Main content */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-6">
                {/* Results count + viewport toggle */}
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    {filteredItems.length} section
                    {filteredItems.length !== 1 ? "s" : ""} found
                  </p>

                  {/* Viewport toggle */}
                  <div className="bg-muted flex items-center gap-0.5 rounded-lg p-0.5">
                    {(
                      [
                        { mode: "desktop" as const, icon: Monitor, label: "Desktop" },
                        { mode: "tablet" as const, icon: Tablet, label: "Tablet" },
                        { mode: "mobile" as const, icon: Smartphone, label: "Mobile" },
                      ] as const
                    ).map(({ mode, icon: Icon, label }) => (
                      <button
                        key={mode}
                        type="button"
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          viewport === mode
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setViewport(mode)}
                        title={label}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section grid */}
                {filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <LayoutTemplate className="text-muted-foreground/40 mb-4 h-12 w-12" />
                    <p className="text-muted-foreground">
                      No sections match &quot;{searchQuery}&quot;
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredItems.map((item) => (
                      <SectionPreviewCard
                        key={`${item.type}-${item.variant}`}
                        type={item.type}
                        variant={item.variant}
                        sectionName={item.sectionName}
                        sectionDescription={item.sectionDescription}
                        categoryLabel={item.categoryLabel}
                        viewport={viewport}
                        showAddIcon
                        onClick={() => handleAddSection(item.type as SectionType, item.variant)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
