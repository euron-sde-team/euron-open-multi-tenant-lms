"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
  useToast,
} from "@open-mtlms/core";
import {
  filterSectionsFooterLinksByAvailableRoutes,
  TEMPLATE_CATEGORIES,
} from "@open-mtlms/shared";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Grid3X3,
  LayoutTemplate,
  Loader2,
  Monitor,
  Search,
  Smartphone,
  Tablet,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ensureContentSections } from "@/components/editor/content-sections-config";
import type { PageTemplate } from "@/lib/data/page-templates";
import { getTemplatesByPageCategory } from "@/lib/data/page-templates";
import { useAvailableRoutesQuery } from "@/lib/hooks/use-available-routes";
import { useCreatePage, useSavePage } from "@/lib/hooks/use-pages";
import { useTenantStore } from "@/lib/stores/tenant-store";
import type { Page } from "@/lib/types/page";

import {
  TemplatePreviewCard,
  type ViewportMode,
} from "./template-preview-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AllTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tenant ID for creating/replacing pages */
  tenantId: string | null;
  /** Existing home page if one already exists (undefined = no home page yet) */
  existingHomePage: Page | undefined;
  /** Called after successful create/replace with the page ID */
  onComplete: (pageId: string) => void;
}

type FilterMode = "all" | "general" | string; // string = productCategory id

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AllTemplatesModal({
  open,
  onOpenChange,
  tenantId,
  existingHomePage,
  onComplete,
}: AllTemplatesModalProps) {
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterMode>("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportMode>("desktop");

  // Confirmation step: which template the user clicked on
  const [pendingTemplate, setPendingTemplate] = useState<PageTemplate | null>(null);

  const createPage = useCreatePage();
  const savePage = useSavePage();
  const { data: availableRoutes } = useAvailableRoutesQuery(tenantId ?? undefined);
  const selectedTenant = useTenantStore((s) => s.selectedTenant);

  const isApplying = createPage.isPending || savePage.isPending;

  // Reset state when modal closes
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSearchQuery("");
        setActiveFilter("all");
        setSelectedSubCategory(null);
        setPendingTemplate(null);
        setViewport("desktop");
      }
      onOpenChange(next);
    },
    [onOpenChange]
  );

  const homeTemplates = useMemo(() => getTemplatesByPageCategory("home"), []);

  const filteredTemplates = useMemo(() => {
    let templates = homeTemplates;

    if (activeFilter !== "all") {
      templates = templates.filter((t) => t.productCategory === activeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }

    return templates;
  }, [homeTemplates, activeFilter, searchQuery]);

  // Get sub-categories for the active template category filter (4 categories, empty subCategories)
  const activeSubCategories = useMemo(() => {
    if (activeFilter === "all") return [];
    const category = TEMPLATE_CATEGORIES.find((c) => c.id === activeFilter);
    return category?.subCategories ?? [];
  }, [activeFilter]);

  // Helper to get category badge label
  const getCategoryLabel = (template: PageTemplate) => {
    if (!template.productCategory) return template.category;
    const cat = TEMPLATE_CATEGORIES.find((c) => c.id === template.productCategory);
    return cat?.name ?? template.category;
  };

  // Apply the selected template, create or replace
  const handleApplyTemplate = () => {
    if (!pendingTemplate || !tenantId) return;

    const filteredSections = filterSectionsFooterLinksByAvailableRoutes(
      pendingTemplate.sections,
      availableRoutes
    );

    // Guarantee every catalog listing (courses, books, test series, …) exists on
    // the page so no published content is orphaned by a template that omitted it.
    // Missing ones are appended (visible); empty ones show "Coming soon"; tenants
    // hide unwanted ones from the Content panel.
    const sectionsWithContent = ensureContentSections(filteredSections);

    // The home page's title / SEO title is the tenant's BRAND (it drives the
    // browser-tab name), NOT the design template's marketing name, otherwise
    // applying "Finance & Trading" would rename the tenant's tab to that. Keep
    // the tenant brand (falling back to any existing home title, then "Home").
    const homeTitle =
      selectedTenant?.tenant_name?.trim() ||
      existingHomePage?.title?.trim() ||
      "Home";

    // Layout is stored at the tenant level, no need to embed in sections
    const templateData = {
      title: homeTitle,
      sections: sectionsWithContent,
      theme: pendingTemplate.theme,
      seo: {
        ...pendingTemplate.seo,
        title: homeTitle,
      },
    };

    if (existingHomePage) {
      // Replace existing home page
      savePage.mutate(
        { pageId: existingHomePage.id, data: templateData },
        {
          onSuccess: () => {
            toast({
              title: "Home page updated",
              description: `Applied "${pendingTemplate.name}" template successfully.`,
            });
            const pageId = existingHomePage.id;
            handleOpenChange(false);
            onComplete(pageId);
          },
          onError: () => {
            toast({
              title: "Error",
              description: "Failed to update the home page. Please try again.",
              variant: "destructive",
            });
          },
        }
      );
    } else {
      // Create new home page
      createPage.mutate(
        { ...templateData, tenantId, slug: "home" },
        {
          onSuccess: (page) => {
            toast({
              title: "Home page created",
              description: `Applied "${pendingTemplate.name}" template successfully.`,
            });
            handleOpenChange(false);
            onComplete(page.id);
          },
          onError: (error: unknown) => {
            const errMsg = error instanceof Error ? error.message : String(error);
            const isConflict = errMsg.includes("409") || errMsg.includes("already exists");
            toast({
              title: isConflict ? "Page Already Exists" : "Error",
              description: isConflict
                ? "A home page was just created. Please refresh and try again."
                : "Failed to create the home page. Please try again.",
              variant: "destructive",
            });
          },
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {pendingTemplate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPendingTemplate(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <DialogTitle className="text-xl">
                {pendingTemplate ? "Confirm Template" : "All Templates"}
              </DialogTitle>
            </div>
          </div>
          {!pendingTemplate && (
            <div className="relative mt-2">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
        </DialogHeader>

        {/* ---------------------------------------------------------------- */}
        {/* Confirmation step, shown when a template is selected            */}
        {/* ---------------------------------------------------------------- */}
        {pendingTemplate ? (
          <div className="flex flex-1 items-center justify-center overflow-auto p-8">
            <div className="w-full max-w-lg space-y-6">
              {/* Template info */}
              <div className="space-y-3 text-center">
                <div className="bg-muted mx-auto flex h-20 w-20 items-center justify-center rounded-xl">
                  <LayoutTemplate className="text-muted-foreground/40 h-10 w-10" />
                </div>
                <h3 className="text-xl font-semibold">{pendingTemplate.name}</h3>
                <p className="text-muted-foreground text-sm">
                  {pendingTemplate.description}
                </p>
                <p className="text-muted-foreground/60 text-xs">
                  {pendingTemplate.sections.length} section
                  {pendingTemplate.sections.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Warning / info banner */}
              {existingHomePage ? (
                <div className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-3 rounded-lg border p-4">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-300">
                      This will replace your current home page
                    </p>
                    <p className="text-amber-700 dark:text-amber-400">
                      Your existing page &ldquo;{existingHomePage.title}&rdquo; will be
                      overwritten with the new template. You can always change it
                      again later in the editor.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-green-500/30 bg-green-50 dark:bg-green-950/20 flex items-start gap-3 rounded-lg border p-4">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-green-800 dark:text-green-300">
                      This will create your home page
                    </p>
                    <p className="text-green-700 dark:text-green-400">
                      A new landing page will be created at{" "}
                      <code className="bg-green-100 dark:bg-green-900/40 rounded px-1 py-0.5 text-xs">
                        /
                      </code>{" "}
                      using this template. You can customize it in the editor.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPendingTemplate(null)}
                  disabled={isApplying}
                >
                  Back to Templates
                </Button>
                <Button onClick={handleApplyTemplate} disabled={isApplying || !tenantId}>
                  {isApplying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {existingHomePage ? "Apply & Replace" : "Apply Template"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* -------------------------------------------------------------- */
          /* Template browsing, sidebar + main grid                        */
          /* -------------------------------------------------------------- */
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 shrink-0 border-r">
              <ScrollArea className="h-full">
                <div className="space-y-1 p-4">
                  <SidebarItem
                    label="All Templates"
                    icon={<Grid3X3 className="h-4 w-4" />}
                    active={activeFilter === "all"}
                    count={homeTemplates.length}
                    onClick={() => {
                      setActiveFilter("all");
                      setSelectedSubCategory(null);
                    }}
                  />

                  {TEMPLATE_CATEGORIES.length > 0 && (
                    <>
                      <div className="my-3 border-b" />
                      <p className="text-muted-foreground mb-2 px-2 text-xs font-medium uppercase tracking-wider">
                        By Category
                      </p>

                      {TEMPLATE_CATEGORIES.map((category, idx) => {
                    const count = homeTemplates.filter(
                      (t) => t.productCategory === category.id
                    ).length;
                    return (
                      <SidebarItem
                        key={category.id}
                        label={category.name}
                        active={activeFilter === category.id}
                        count={count}
                        index={idx + 1}
                        onClick={() => {
                          setActiveFilter(category.id);
                          setSelectedSubCategory(null);
                        }}
                      />
                    );
                  })}
                    </>
                  )}
                </div>
              </ScrollArea>
            </aside>

            {/* Main content */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-4 p-6">
                  {/* Sub-category chips */}
                  {activeSubCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={selectedSubCategory === null ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setSelectedSubCategory(null)}
                      >
                        All
                      </Badge>
                      {activeSubCategories.map((sub) => (
                        <Badge
                          key={sub.id}
                          variant={selectedSubCategory === sub.id ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() =>
                            setSelectedSubCategory(
                              selectedSubCategory === sub.id ? null : sub.id
                            )
                          }
                        >
                          {sub.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Results count + viewport toggle */}
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                      {filteredTemplates.length} template
                      {filteredTemplates.length !== 1 ? "s" : ""} found
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

                  {/* Template grid */}
                  {filteredTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <LayoutTemplate className="text-muted-foreground/40 mb-4 h-12 w-12" />
                      <p className="text-muted-foreground">No templates match your search.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {/* key excludes viewport: toggling devices resizes the
                          live iframes in place instead of reloading all of them */}
                      {filteredTemplates.map((template) => (
                        <TemplatePreviewCard
                          key={template.id}
                          template={template}
                          categoryLabel={getCategoryLabel(template)}
                          viewport={viewport}
                          onClick={() => setPendingTemplate(template)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
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
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {index}
            </span>
          ) : null)}
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`text-xs tabular-nums ${
          active ? "text-primary" : "text-muted-foreground/60"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

