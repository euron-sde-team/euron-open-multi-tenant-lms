"use client";

import { Button, useToast } from "@open-mtlms/core";
import type { PageConfig, SectionConfig, SectionType, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { defaultThemeConfig, getDefaultContent, getDefaultTenantLayout } from "@open-mtlms/ui-config";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DeviceFramePreview } from "@/components/editor/device-frame-preview";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { SectionPanel } from "@/components/editor/section-panel";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { getLayoutWithHomepageLogo } from "@/lib/api/layout";
import { pagesApi } from "@/lib/api/pages";
import { tenantSubscriptionsApi } from "@/lib/api/tenant-subscriptions";
import { useTenantWebUrl } from "@/lib/hooks/use-tenant-domain-url";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useTenantStore } from "@/lib/stores/tenant-store";

// ─── Default Subscription Sections ────────────────────────────────────────────
const SUBSCRIPTION_SECTION_ORDER: SectionType[] = [
  "subscription-hero",
  "subscription-features",
  "subscription-comparison",
  "subscription-pricing",
  "subscription-faq",
  "subscription-cta",
];

function createDefaultSections(): SectionConfig[] {
  const now = new Date().toISOString();
  return SUBSCRIPTION_SECTION_ORDER.map((type, index) => {
    let content: Record<string, unknown> = {};
    try {
      content = (getDefaultContent(type) as Record<string, unknown>) ?? {};
    } catch {
      /* use empty */
    }
    return {
      id: `sub-${type}`,
      type,
      variant: "default",
      order: index,
      visible: true,
      deleted: false,
      content,
      settings: {},
      createdAt: now,
      updatedAt: now,
    };
  });
}

// ─── Theme normalizer (same as page editor) ──────────────────────────────────
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

const normalizeTheme = (theme: unknown): ThemeConfig => {
  if (!theme || typeof theme !== "object") return defaultThemeConfig;
  const t = theme as Record<string, unknown>;
  if ("colorScheme" in t || "primaryColor" in t || !("colors" in t)) return defaultThemeConfig;
  const ok =
    t.colors && typeof t.colors === "object" && "light" in (t.colors as object) &&
    t.fonts && typeof t.fonts === "object" &&
    t.spacing && typeof t.spacing === "object" &&
    t.borders && typeof t.borders === "object";
  if (!ok) return defaultThemeConfig;
  return {
    ...defaultThemeConfig,
    ...t,
    colors: {
      light: { ...defaultThemeConfig.colors.light, ...((t.colors as { light?: object })?.light || {}) },
      dark: { ...baseDarkDefaults, ...((t.colors as { dark?: object })?.dark || {}) },
    },
    fonts: { ...defaultThemeConfig.fonts, ...((t.fonts as object) || {}) },
    spacing: { ...defaultThemeConfig.spacing, ...((t.spacing as object) || {}) },
    borders: { ...defaultThemeConfig.borders, ...((t.borders as object) || {}) },
  } as ThemeConfig;
};

// Fetch homepage theme for consistent styling
const getHomepageTheme = async (tenantId: string): Promise<ThemeConfig | null> => {
  try {
    const homepage = await pagesApi.getHomepage(tenantId);
    return homepage?.theme ? normalizeTheme(homepage.theme) : null;
  } catch {
    return null;
  }
};

// ─── Editor ───────────────────────────────────────────────────────────────────
export default function SubscriptionEditorPage() {
  const { toast } = useToast();
  const { selectedTenant } = useTenantStore();
  const tenantId = selectedTenant?.tenant_id ?? "";

  const {
    pageConfig,
    tenantLayout,
    globalTheme,
    setGlobalTheme,
    isEditMode,
    previewDevice,
    initializePageConfig,
    initializeTenantLayout,
    updateLayoutFooter,
  } = useEditorStore();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const iframeUrl = useTenantWebUrl("/subscriptions");

  // Effective theme: always use global (homepage) theme
  const effectiveTheme = useMemo(() => globalTheme || pageConfig.theme, [globalTheme, pageConfig.theme]);

  // ── Load tenant layout ──────────────────────────────────────────────────────
  useEffect(() => {
    if (tenantLayout || !tenantId) return;
    (async () => {
      try {
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
        const defaultLayout = getDefaultTenantLayout(tenantId);
        initializeTenantLayout({
          ...defaultLayout,
          id: `layout-${tenantId}`,
          tenantId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    })();
  }, [tenantLayout, tenantId, initializeTenantLayout]);

  // ── Load subscription page config ───────────────────────────────────────────
  const loadSubscriptionPage = useCallback(async () => {
    if (loadingRef.current || !tenantId) return;
    loadingRef.current = true;
    try {
      // Load saved config from API
      const savedSections = await tenantSubscriptionsApi.getPageConfig();
      let sections: SectionConfig[];
      if (savedSections && Array.isArray(savedSections) && savedSections.length > 0) {
        sections = savedSections as SectionConfig[];
        // Reconcile: restore any missing default sections
        const defaults = createDefaultSections();
        const existingTypes = new Set(sections.map((s) => s.type));
        const missing = defaults.filter((d) => !existingTypes.has(d.type));
        if (missing.length > 0) {
          sections = [...sections, ...missing.map((s, i) => ({ ...s, order: sections.length + i }))];
        }
      } else {
        sections = createDefaultSections();
      }

      // Load homepage theme
      const homepageTheme = await getHomepageTheme(tenantId);
      if (homepageTheme) setGlobalTheme(homepageTheme);

      const now = new Date().toISOString();
      initializePageConfig({
        id: "subscription-page",
        tenantId,
        slug: "subscriptions",
        title: "Subscribe Page",
        sections,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      } as PageConfig);

      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to load subscription page:", error);
      setLoadError("Failed to load subscription page configuration");
    } finally {
      loadingRef.current = false;
    }
  }, [tenantId, initializePageConfig, setGlobalTheme]);

  useEffect(() => {
    if (!isInitialized && !loadError) {
      loadSubscriptionPage();
    }
  }, [isInitialized, loadError, loadSubscriptionPage]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await tenantSubscriptionsApi.updatePageConfig(pageConfig.sections);
      toast({ title: "Saved", description: "Subscribe page saved successfully." });
    } catch (error) {
      console.error("Failed to save subscription page:", error);
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, pageConfig.sections, toast]);

  // ── Loading / Error states ──────────────────────────────────────────────────
  if (!isInitialized && !loadError) {
    return (
      <div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-4">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Loading subscribe page editor...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-background flex h-screen w-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{loadError}</p>
        <Button asChild>
          <Link href="/dashboard/subscriptions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Subscriptions
          </Link>
        </Button>
      </div>
    );
  }

  // Device preview dimensions
  const deviceDimensions: Record<string, { width: number; height: number; label: string } | undefined> = {
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
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left - Back button */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/subscriptions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div className="hidden border-l pl-3 sm:block">
              <h1 className="text-sm font-semibold">Subscribe Page</h1>
              <p className="text-muted-foreground text-xs">/subscriptions</p>
            </div>
          </div>

          {/* Center - Editor tools */}
          <div className="flex items-center gap-2">
            <EditorToolbar isHomePage={false} />
          </div>

          {/* Right - Save button */}
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </header>

      {/* Main Editor Area */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main
          className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${isDevicePreview ? "bg-muted/40" : ""}`}
        >
          {isDevicePreview && activeDevice ? (
            /* Auto-scale the fixed-size iframe to fit the canvas (fit-to-window). */
            <DeviceFramePreview
              src={iframeUrl}
              label={activeDevice.label}
              width={activeDevice.width}
              height={activeDevice.height}
            />
          ) : (
            <div className={`min-h-full w-full ${isEditMode ? "bg-muted/30" : "bg-background"}`}>
              <div className={isEditMode ? "w-full py-4 pl-4 pr-8" : ""}>
                <LayoutWrapper
                  layout={tenantLayout}
                  theme={effectiveTheme}
                  layoutOverrides={{ hideHeader: true, hideFooter: true, hideTopBar: true, hideSidebar: true }}
                  isEditing={isEditMode}
                  sidebarTopOffset={56}
                  onFooterUpdate={(updates) => updateLayoutFooter(updates)}
                >
                  <SectionRenderer
                    sections={pageConfig.sections}
                    theme={effectiveTheme}
                    editMode={isEditMode}
                    disableDeleteDuplicate={true}
                  />
                </LayoutWrapper>
              </div>
            </div>
          )}
        </main>

        {/* Add Section modal */}
        <SectionPanel />
      </div>
    </div>
  );
}
