"use client";

import { Button, useToast } from "@open-mtlms/core";
import type { TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { defaultThemeConfig, getDefaultTenantLayout } from "@open-mtlms/ui-config";
import { ArrowLeft, Loader2, Save, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ContentSectionsPanel } from "@/components/editor/content-sections-panel";
import { DeviceFramePreview } from "@/components/editor/device-frame-preview";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { SectionPanel } from "@/components/editor/section-panel";
import { ThemePanel } from "@/components/editor/theme-panel";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { getLayoutWithHomepageLogo } from "@/lib/api/layout";
import { pagesApi } from "@/lib/api/pages";
import { tenantsApi } from "@/lib/api/tenants";
import { useSavePage } from "@/lib/hooks/use-pages";
import { type LivePreviewPayload } from "@/lib/preview-messages";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import type { Page } from "@/lib/types/page";
import { pageConfigToUpdateRequest, pageToPageConfig } from "@/lib/types/page";
import { decodeHtml } from "@/lib/utils";

// Required dark mode base fields only, optional overrides (primary, secondary, accent, etc.)
// must NOT be merged from defaults, otherwise they prevent fallback to light-mode values.
const baseDarkDefaults = {
  background: defaultThemeConfig.colors.dark.background,
  foreground: defaultThemeConfig.colors.dark.foreground,
  card: defaultThemeConfig.colors.dark.card,
  cardForeground: defaultThemeConfig.colors.dark.cardForeground,
  muted: defaultThemeConfig.colors.dark.muted,
  mutedForeground: defaultThemeConfig.colors.dark.mutedForeground,
  border: defaultThemeConfig.colors.dark.border,
  input: defaultThemeConfig.colors.dark.input,
};

// Normalize theme to ensure it has the correct structure
const normalizeTheme = (theme: unknown): ThemeConfig => {
  if (!theme || typeof theme !== "object") return defaultThemeConfig;

  const t = theme as Record<string, unknown>;

  // Check if it's the old simplified format
  if ("colorScheme" in t || "primaryColor" in t || !("colors" in t)) {
    return defaultThemeConfig;
  }

  // Check for correct structure
  const hasCorrectStructure =
    t.colors &&
    typeof t.colors === "object" &&
    "light" in (t.colors as object) &&
    t.fonts &&
    typeof t.fonts === "object" &&
    t.spacing &&
    typeof t.spacing === "object" &&
    t.borders &&
    typeof t.borders === "object";

  if (!hasCorrectStructure) return defaultThemeConfig;

  return {
    ...defaultThemeConfig,
    ...t,
    colors: {
      light: {
        ...defaultThemeConfig.colors.light,
        ...((t.colors as { light?: object })?.light || {}),
      },
      dark: { ...baseDarkDefaults, ...((t.colors as { dark?: object })?.dark || {}) },
    },
    fonts: { ...defaultThemeConfig.fonts, ...((t.fonts as object) || {}) },
    spacing: { ...defaultThemeConfig.spacing, ...((t.spacing as object) || {}) },
    borders: { ...defaultThemeConfig.borders, ...((t.borders as object) || {}) },
  } as ThemeConfig;
};

// Fetch page from API
const getPageFromApi = async (pageId: string): Promise<Page | null> => {
  try {
    const page = await pagesApi.getPage(pageId);
    // Normalize the theme
    return { ...page, theme: normalizeTheme(page.theme) };
  } catch (error) {
    console.error("Failed to fetch page from API:", error);
    return null;
  }
};

// Fetch homepage theme (global theme used for non-homepage pages)
const getHomepageTheme = async (tenantId: string): Promise<ThemeConfig | null> => {
  try {
    const homepage = await pagesApi.getHomepage(tenantId);
    return homepage?.theme ? normalizeTheme(homepage.theme) : null;
  } catch {
    return null;
  }
};

export default function PageEditorRoute() {
  const params = useParams();
  const pageId = typeof params?.id === "string" ? params.id : params?.id?.[0];
  const isNewPage = pageId === "new";
  const { toast } = useToast();

  const {
    pageConfig,
    setPageConfig,
    globalTheme,
    setGlobalTheme,
    tenantLayout,
    isThemePanelOpen,
    isContentPanelOpen,
    isEditMode,
    previewDevice,
    resetToDefault,
    initializePageConfig,
    initializeTenantLayout,
    closePanels,
    updateLayoutHeader: _updateLayoutHeader,
    updateLayoutFooter,
  } = useEditorStore();

  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const { selectedTenant } = useTenantStore();
  const savePage = useSavePage();

  const [isInitialized, setIsInitialized] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const previousPageIdRef = useRef<string | undefined>(undefined);
  // Was this page being served as custom code when we loaded it? Used to notify
  // the user when saving the template turns custom code off.
  const wasCustomCodeRef = useRef(false);

  // Reset state when pageId changes (navigating to a different page)
  useEffect(() => {
    if (previousPageIdRef.current !== pageId) {
      previousPageIdRef.current = pageId;
      setIsInitialized(false);
      setLoadError(null);
      loadingRef.current = false;
    }
  }, [pageId]);

  // Determine if this is the home page
  const isHomePage = useMemo(() => {
    return pageConfig.slug === "/" || pageConfig.slug === "home" || pageConfig.isHomePage === true;
  }, [pageConfig.slug, pageConfig.isHomePage]);

  // Determine which theme to use for rendering
  // Homepage uses its own theme; other pages use global theme (from homepage), theme changeable only from home page
  const effectiveTheme = useMemo(() => {
    if (isHomePage) return pageConfig.theme;
    return globalTheme || pageConfig.theme;
  }, [isHomePage, globalTheme, pageConfig.theme]);

  // Payload posted into the live device-preview iframe (/preview/live) so the
  // SE/14/iPad/Pro frames render the editor's CURRENT state, same code, real
  // data, live edits, as the Desktop inline preview, in a real device viewport.
  const livePreviewPayload = useMemo<LivePreviewPayload>(
    () => ({
      sections: pageConfig.sections,
      theme: effectiveTheme,
      layout: tenantLayout,
      slug: pageConfig.slug,
      isHomePage,
      layoutOverrides: pageConfig.layoutOverrides,
    }),
    [
      pageConfig.sections,
      effectiveTheme,
      tenantLayout,
      pageConfig.slug,
      isHomePage,
      pageConfig.layoutOverrides,
    ],
  );

  // Initialize tenant layout from the tenant-level API (not from page sections)
  useEffect(() => {
    if (tenantLayout) return; // Already loaded

    const tenantId = selectedTenant?.tenant_id || pageConfig.tenantId;
    if (!tenantId) return;

    (async () => {
      try {
        // Fetch layout enriched with homepage logo (global logo from homepage)
        const layout = await getLayoutWithHomepageLogo(tenantId);
        const fullLayout: TenantLayout = {
          ...layout,
          id: layout.id ?? `layout-${tenantId}`,
          tenantId,
          createdAt: layout.createdAt ?? new Date().toISOString(),
          updatedAt: layout.updatedAt ?? new Date().toISOString(),
        };
        initializeTenantLayout(fullLayout);
      } catch {
        // Fallback to default if API fails
        const tenantIdFallback = tenantId || "demo-tenant";
        const defaultLayout = getDefaultTenantLayout(tenantIdFallback);
        const fullLayout: TenantLayout = {
          ...defaultLayout,
          id: `layout-${tenantIdFallback}`,
          tenantId: tenantIdFallback,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        initializeTenantLayout(fullLayout);
      }
    })();
  }, [tenantLayout, selectedTenant, pageConfig.tenantId, initializeTenantLayout]);

  // Load page data from API
  const loadPage = useCallback(async () => {
    if (!pageId || isNewPage || loadingRef.current) return;

    loadingRef.current = true;
    try {
      const page = await getPageFromApi(pageId);
      if (page) {
        wasCustomCodeRef.current = page.renderMode === "CUSTOM_CODE";
        const config = pageToPageConfig(page);

        const pageIsHomePage =
          config.slug === "/" || config.slug === "home" || config.isHomePage === true;
        if (!pageIsHomePage && page.tenantId) {
          const homepageTheme = await getHomepageTheme(page.tenantId);
          if (homepageTheme) setGlobalTheme(homepageTheme);
        } else {
          setGlobalTheme(null);
        }
        initializePageConfig(config);

        // Layout is now loaded from tenants API (see useEffect above),
        // but keep backward compat: if page has embedded layout and tenant layout isn't loaded yet, use it
        if (config.layout && !tenantLayout) {
          initializeTenantLayout(config.layout);
        }

        setIsInitialized(true);
      } else {
        setLoadError("Page not found");
      }
    } catch (error) {
      console.error("Failed to load page:", error);
      setLoadError("Failed to load page");
    } finally {
      loadingRef.current = false;
    }
  }, [
    pageId,
    isNewPage,
    initializePageConfig,
    initializeTenantLayout,
    setGlobalTheme,
    tenantLayout,
  ]);

  // Load existing page or reset to default for new page
  useEffect(() => {
    if (isNewPage) {
      resetToDefault();
      setIsInitialized(true);
    } else if (pageId && !isInitialized && !loadError) {
      loadPage();
    }
  }, [pageId, isNewPage, isInitialized, loadError, loadPage, resetToDefault]);

  // Handle save - with guard against duplicate calls
  const handleSave = useCallback(async () => {
    // Guard against duplicate calls
    if (savePage.isPending) {
      console.log("Save already in progress, ignoring duplicate call");
      return;
    }

    if (isNewPage) {
      toast({
        title: "Info",
        description: "Please use the 'Create Page' button to save a new page.",
      });
      return;
    }

    if (!pageId) return;

    const tenantId = selectedTenant?.tenant_id || pageConfig.tenantId;

    // Save layout to tenant-level API (not embedded in page sections)
    if (tenantLayout && tenantId) {
      try {
        await tenantsApi.updateLayout(tenantId, tenantLayout);
        console.log("[handleSave] Tenant layout saved to /tenants/:id/layout");
      } catch (error) {
        console.error("[handleSave] Failed to save tenant layout:", error);
        toast({
          title: "Warning",
          description: "Layout changes may not have been saved.",
          variant: "destructive",
        });
      }
    }

    // Save page content WITHOUT embedding layout in sections
    const updateData = pageConfigToUpdateRequest({
      ...pageConfig,
      // No layout embedding, layout is saved at tenant level
    });

    // Saving in the template editor is an explicit choice to use the section
    // template, so switch the page off custom code (render_mode -> SECTIONS).
    // The saved custom HTML is kept; this is harmless for normal pages that are
    // already on SECTIONS.
    updateData.renderMode = "SECTIONS";

    // Non-home pages: don't save theme to current page (theme is global from homepage)
    if (!isHomePage) delete updateData.theme;

    savePage.mutate(
      { pageId, data: updateData },
      {
        onSuccess: async () => {
          // When editing non-homepage, persist theme changes to homepage (global theme)
          if (!isHomePage && globalTheme && tenantId) {
            try {
              const homepage = await pagesApi.getHomepage(tenantId);
              if (homepage) {
                await pagesApi.updatePage(homepage.id, { theme: globalTheme });
              }
            } catch (err) {
              console.error("Failed to save theme to homepage:", err);
              toast({
                title: "Warning",
                description: "Page saved, but theme changes may not have been applied site-wide.",
                variant: "destructive",
              });
            }
          }
          if (wasCustomCodeRef.current) {
            // This page had been served as custom code; saving the template
            // switched it back. Make that explicit so it's never a surprise.
            wasCustomCodeRef.current = false;
            toast({
              title: "Template is now live",
              description:
                "This page was using custom code. Saving the template switched it off, so the template is what visitors see. Your custom code is still saved.",
            });
          } else {
            toast({
              title: "Saved",
              description: "Page saved successfully.",
            });
          }
        },
        onError: (error) => {
          console.error("Failed to save page:", error);
          toast({
            title: "Error",
            description: "Failed to save page. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }, [
    isNewPage,
    isHomePage,
    pageId,
    pageConfig,
    tenantLayout,
    globalTheme,
    selectedTenant,
    savePage,
    toast,
  ]);

  // Loading state
  if (!isInitialized && !isNewPage && !loadError) {
    return (
      <div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-4">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Loading page editor...</p>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{loadError}</p>
        <Button asChild>
          <Link href="/dashboard/pages">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pages
          </Link>
        </Button>
      </div>
    );
  }

  // Invalid page ID
  if (!pageId) {
    return (
      <div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Invalid page ID</p>
        <Button asChild>
          <Link href="/dashboard/pages">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pages
          </Link>
        </Button>
      </div>
    );
  }

  // Determine which right panel to show
  // Theme panel only on home page (global theme, changeable only from home)
  const showThemePanel = isHomePage && isThemePanelOpen;
  const showContentPanel = isContentPanelOpen;
  const rightPanelOpen = showThemePanel || showContentPanel;

  // Device preview dimensions
  const deviceDimensions: Record<
    string,
    { width: number; height: number; label: string } | undefined
  > = {
    iphoneSE: { width: 375, height: 667, label: "iPhone SE" },
    iphone14: { width: 390, height: 844, label: "iPhone 14" },
    ipad: { width: 768, height: 1024, label: "iPad" },
    ipadPro: { width: 1024, height: 1366, label: "iPad Pro" },
    desktop: undefined,
  };
  const activeDevice = deviceDimensions[previewDevice];
  const isDevicePreview = previewDevice !== "desktop";

  return (
    <div className="bg-background flex h-screen w-screen flex-col">
      {/* Top Toolbar */}
      <header className="bg-background shrink-0 border-b">
        <div className="flex items-center justify-between gap-3 px-4 py-2">
          {/* Left - Back button and page info */}
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link href="/dashboard/pages">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div className="hidden min-w-0 border-l pl-3 sm:block">
              <div className="flex items-center gap-2">
                {!isNewPage && isTitleEditing ? (
                  <input
                    autoFocus
                    className="text-sm font-semibold bg-transparent border-b border-primary outline-none w-48"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={() => {
                      const trimmed = titleDraft.trim();
                      if (trimmed) setPageConfig({ ...pageConfig, title: trimmed, seo: { ...pageConfig.seo, title: trimmed } });
                      setIsTitleEditing(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") { setIsTitleEditing(false); }
                    }}
                  />
                ) : (
                  <h1
                    className={`max-w-[180px] truncate whitespace-nowrap text-sm font-semibold ${!isNewPage ? "cursor-pointer hover:text-primary" : ""}`}
                    title={isNewPage ? "New Page" : decodeHtml(pageConfig.title)}
                    onClick={() => {
                      if (!isNewPage) {
                        setTitleDraft(decodeHtml(pageConfig.title));
                        setIsTitleEditing(true);
                      }
                    }}
                  >
                    {isNewPage ? "New Page" : decodeHtml(pageConfig.title)}
                  </h1>
                )}
                {isHomePage && (
                  <span className="text-primary text-xs font-medium">
                    Home
                  </span>
                )}
              </div>
              <p className="text-muted-foreground max-w-[180px] truncate text-xs">
                {isNewPage ? "Create a new page" : pageConfig.slug}
              </p>
            </div>
          </div>

          {/* Center - Editor tools */}
          <div className="flex shrink-0 items-center gap-2">
            <EditorToolbar isHomePage={isHomePage} />
          </div>

          {/* Right - Save button */}
          <Button onClick={handleSave} disabled={savePage.isPending || isNewPage} size="sm" className="shrink-0">
            {savePage.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </header>

      {/* Main Editor Area - overflow-hidden for proper scroll containment */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Preview/Edit Canvas */}
        <main
          className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 ${
            rightPanelOpen ? "mr-0 sm:mr-80" : "mr-0"
          } ${isDevicePreview ? "bg-muted/40" : ""}`}
        >
          {isDevicePreview && activeDevice ? (
            /* Device preview auto-scales the fixed-size iframe to fit the canvas
               (fit-to-window), so the whole device is visible without scrolling. */
            <DeviceFramePreview
              src="/preview/live"
              label={activeDevice.label}
              width={activeDevice.width}
              height={activeDevice.height}
              postMessagePayload={livePreviewPayload}
            />
          ) : (
            /* Inline editor/preview (desktop) */
            <div className={`min-h-full w-full ${isEditMode ? "bg-muted/30" : "bg-background"}`}>
              <div className={isEditMode ? "w-full py-4 pl-4 pr-8" : ""}>
                <LayoutWrapper
                  layout={tenantLayout}
                  theme={effectiveTheme}
                  layoutOverrides={
                    pageConfig.slug === "login"
                      ? { hideHeader: true, hideFooter: true, hideTopBar: true, hideSidebar: true }
                      : pageConfig.slug === "blog" || pageConfig.slug.startsWith("blog/")
                        ? {
                            ...pageConfig.layoutOverrides,
                            hideHeader: true,
                            hideTopBar: true,
                            hideSidebar: true,
                          }
                        : pageConfig.layoutOverrides
                  }
                  isHomePage={isHomePage}
                  isEditing={isEditMode}
                  sidebarTopOffset={56}
                  onFooterUpdate={(updates) => {
                    updateLayoutFooter(updates);
                  }}
                >
                  <SectionRenderer
                    sections={pageConfig.sections}
                    theme={effectiveTheme}
                    editMode={isEditMode}
                  />
                </LayoutWrapper>
              </div>
            </div>
          )}
        </main>

        {/* Theme Panel (Right Sidebar) - Per-page theme settings for all pages */}
        <aside
          className={`bg-background absolute inset-y-0 right-0 z-30 w-full transform border-l shadow-lg transition-transform duration-300 ease-in-out sm:w-80 ${
            showThemePanel ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Theme Settings</h2>
              <Button variant="ghost" size="icon" onClick={closePanels}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ThemePanel isHomePage={isHomePage} />
            </div>
          </div>
        </aside>

        {/* Content Panel (Right Sidebar) - show/hide catalog listings */}
        <aside
          className={`bg-background absolute inset-y-0 right-0 z-30 w-full transform border-l shadow-lg transition-transform duration-300 ease-in-out sm:w-80 ${
            showContentPanel ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Content Sections</h2>
              <Button variant="ghost" size="icon" onClick={closePanels}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {showContentPanel && <ContentSectionsPanel />}
            </div>
          </div>
        </aside>

        {/* Overlay when right panels are open - responsive for mobile */}
        {rightPanelOpen && (
          <div className="absolute inset-0 z-20 bg-black/20 lg:hidden" onClick={closePanels} />
        )}

        {/* Add Section modal */}
        <SectionPanel />
      </div>
    </div>
  );
}
