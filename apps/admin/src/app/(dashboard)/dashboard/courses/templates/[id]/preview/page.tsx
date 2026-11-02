"use client";

import { Button, useToast } from "@open-mtlms/core";
import type { TenantLayout, ThemeConfig, CoursePageTemplateId } from "@open-mtlms/shared";
import { getDefaultCourseFormData } from "@open-mtlms/shared";
import { defaultThemeConfig, getDefaultTenantLayout } from "@open-mtlms/ui-config";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { courseTemplates } from "@/components/course-editor";
import { CourseEditorContainer } from "@/components/course-editor/CourseEditorContainer";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { getLayoutWithHomepageLogo } from "@/lib/api/layout";
import { pagesApi } from "@/lib/api/pages";
import { tenantsApi } from "@/lib/api/tenants";
import { getEducationalPlaceholderImage } from "@/lib/constants/placeholders";
import { useCourseEditorHeader } from "@/lib/contexts/course-editor-header-context";
import { useSidebarConfig } from "@/lib/hooks/use-sidebar-config";
import { useCourseStore } from "@/lib/stores/course-store";
import { useTenantSettingsStore } from "@/lib/stores/tenant-settings-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { pageToPageConfig } from "@/lib/types/page";

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
      dark: { ...defaultThemeConfig.colors.dark, ...((t.colors as { dark?: object })?.dark || {}) },
    },
    fonts: { ...defaultThemeConfig.fonts, ...((t.fonts as object) || {}) },
    spacing: { ...defaultThemeConfig.spacing, ...((t.spacing as object) || {}) },
    borders: { ...defaultThemeConfig.borders, ...((t.borders as object) || {}) },
  } as ThemeConfig;
};

// Convert global theme (ThemeConfig) to course theme format (CourseThemeConfig)
function convertToCourseTheme(globalTheme: ThemeConfig) {
  return {
    id: "preview-theme",
    name: "Preview Theme",
    description: "Theme from landing page",
    colors: {
      light: {
        primary: globalTheme.colors.light.primary,
        primaryForeground: globalTheme.colors.light.primaryForeground,
        secondary: globalTheme.colors.light.secondary,
        secondaryForeground: globalTheme.colors.light.secondaryForeground,
        accent: globalTheme.colors.light.accent,
        accentForeground: globalTheme.colors.light.accentForeground,
        background: globalTheme.colors.light.background,
        foreground: globalTheme.colors.light.foreground,
        muted: globalTheme.colors.light.muted,
        mutedForeground: globalTheme.colors.light.mutedForeground,
        card: globalTheme.colors.light.card,
        cardForeground: globalTheme.colors.light.cardForeground,
        border: globalTheme.colors.light.border,
        input: globalTheme.colors.light.input,
        ring: globalTheme.colors.light.ring,
      },
      dark: {
        background: globalTheme.colors.dark.background,
        foreground: globalTheme.colors.dark.foreground,
        card: globalTheme.colors.dark.card,
        cardForeground: globalTheme.colors.dark.cardForeground,
        muted: globalTheme.colors.dark.muted,
        mutedForeground: globalTheme.colors.dark.mutedForeground,
        border: globalTheme.colors.dark.border,
        input: globalTheme.colors.dark.input,
      },
    },
    fonts: {
      heading: globalTheme.fonts.heading,
      body: globalTheme.fonts.body,
      headingWeight: globalTheme.fonts.headingWeight,
      bodyWeight: globalTheme.fonts.bodyWeight,
    },
    borderRadius: globalTheme.borders.radius,
  };
}

export default function TemplatePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = (params?.id as string) || "modern";

  // Only Modern template is supported; redirect classic/minimal to modern
  useEffect(() => {
    if (templateId !== "modern") {
      router.replace("/dashboard/courses/templates/modern/preview");
    }
  }, [templateId, router]);

  const { selectedTenantId } = useTenantStore();
  const { setCoursePageTemplate } = useTenantSettingsStore();
  const { loadCourse, setEditMode, setPageTemplate } = useCourseStore();
  const { setHeaderContent } = useCourseEditorHeader() ?? {};
  const { data: sidebarConfig } = useSidebarConfig(selectedTenantId ?? undefined);

  const [globalTheme, setGlobalTheme] = useState<ThemeConfig>(defaultThemeConfig);
  const [tenantLayout, setTenantLayout] = useState<TenantLayout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const hasInitialized = useRef(false);

  const template = courseTemplates.find((t) => t.id === templateId);
  const isSelected = true; // Only one template; always "selected"

  // Load global theme and layout from tenant API + homepage
  useEffect(() => {
    async function loadHomepageData() {
      if (!selectedTenantId) {
        setupCourseStoreForPreview(defaultThemeConfig);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch layout (enriched with homepage logo) and the homepage in parallel
        const [layout, homepage] = await Promise.all([
          getLayoutWithHomepageLogo(selectedTenantId),
          pagesApi.getHomepage(selectedTenantId),
        ]);

        // Set tenant layout (includes logo from homepage when tenant layout lacks it)
        setTenantLayout(layout);

        let loadedTheme = defaultThemeConfig;

        if (homepage) {
          const pageConfig = pageToPageConfig(homepage);

          if (pageConfig.theme) {
            loadedTheme = normalizeTheme(pageConfig.theme);
            setGlobalTheme(loadedTheme);
          }
        }

        setupCourseStoreForPreview(loadedTheme);
      } catch (error) {
        console.error("Failed to load homepage data:", error);
        setTenantLayout(getDefaultTenantLayout(selectedTenantId || "default") as TenantLayout);
        setupCourseStoreForPreview(defaultThemeConfig);
      } finally {
        setIsLoading(false);
      }
    }

    // Helper to set up course store for preview mode
    function setupCourseStoreForPreview(theme: ThemeConfig) {
      if (hasInitialized.current) return;
      hasInitialized.current = true;

      // Get default course data with dummy content
      const defaultCourseData = getDefaultCourseFormData();

      // Apply the global theme converted to course theme format
      const courseTheme = convertToCourseTheme(theme);

      // Get a placeholder thumbnail for preview
      const placeholderThumbnail = getEducationalPlaceholderImage(
        defaultCourseData.slug || "preview-course"
      );

      // Load course with theme and thumbnail applied
      loadCourse({
        ...defaultCourseData,
        theme: courseTheme,
        // Add placeholder thumbnail for preview display
        webThumbnailUrl: placeholderThumbnail,
        mobileThumbnailUrl: placeholderThumbnail,
      });

      // Course pages use Modern template only
      setPageTemplate("modern");

      // Set edit mode to false for preview
      setEditMode(false);
    }

    loadHomepageData();
  }, [selectedTenantId, loadCourse, setPageTemplate, setEditMode]);

  // Handle template selection - save to tenant layout API
  const handleSelectTemplate = useCallback(async () => {
    if (!selectedTenantId) {
      toast({
        title: "Error",
        description: "Please select a tenant first.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Update local store immediately for UI feedback
      setCoursePageTemplate(selectedTenantId, templateId);

      // Merge with existing tenant layout
      const updatedLayout: TenantLayout = {
        ...(tenantLayout || {}),
        coursePageTemplateId: templateId as CoursePageTemplateId,
        updatedAt: new Date().toISOString(),
      } as TenantLayout;

      // Save to tenant layout API
      await tenantsApi.updateLayout(selectedTenantId, updatedLayout);
      setTenantLayout(updatedLayout);

      toast({
        title: "Template Saved",
        description: `"${template?.name}" is now your course page template and has been saved.`,
      });

      router.push("/dashboard/courses/templates");
    } catch (error) {
      console.error("Failed to save template:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template selection.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedTenantId,
    tenantLayout,
    templateId,
    template?.name,
    setCoursePageTemplate,
    router,
    toast,
  ]);

  // Use default layout if not loaded
  const effectiveLayout =
    tenantLayout || (getDefaultTenantLayout(selectedTenantId || "default") as TenantLayout);

  // Inject Back + Select Template into dashboard header
  useEffect(() => {
    if (!setHeaderContent || !template) return;
    setHeaderContent(
      <>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/courses/templates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <span className="text-muted-foreground text-sm">{template.name} Template</span>
        <Button onClick={handleSelectTemplate} disabled={isSelected || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isSelected ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Currently Selected
            </>
          ) : (
            "Select This Template"
          )}
        </Button>
      </>
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent, template, isSelected, isSaving, handleSelectTemplate]);

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Template not found</p>
        <Button asChild>
          <Link href="/dashboard/courses/templates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Templates
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground">Loading preview...</div>
          </div>
        ) : (
          <LayoutWrapper
            layout={effectiveLayout}
            theme={globalTheme}
            layoutOverrides={{ hideSidebar: true }}
            isHomePage={false}
            isEditing={false}
            sidebarTopOffset={64}
            sidebarNavItemsOverride={sidebarConfig?.items}
          >
            <div className="min-h-screen pt-6">
              <CourseEditorContainer />
            </div>
          </LayoutWrapper>
        )}
      </div>
    </div>
  );
}
