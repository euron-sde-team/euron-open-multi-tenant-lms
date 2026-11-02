"use client";

import { Button, Separator, Switch, useToast } from "@open-mtlms/core";
import type { CourseType, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { getDefaultCourseFormData } from "@open-mtlms/shared";
import { defaultThemeConfig, getDefaultTenantLayout } from "@open-mtlms/ui-config";
import { ArrowLeft, Eye, Link2, Loader2, Save, Pencil, Sparkles, ListTree } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CourseEditorContainer } from "@/components/course-editor/CourseEditorContainer";
import { AIGenerateModal } from "@/components/course-editor/modals/AIGenerateModal";
import { CourseUrlModal } from "@/components/course-editor/modals/CourseUrlModal";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import type { CourseAISectionKey, CourseMetadata, GeneratedCourseContent, ThumbnailContext } from "@/lib/api/course-ai";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import { getLayoutWithHomepageLogo } from "@/lib/api/layout";
import { pagesApi } from "@/lib/api/pages";
import { uploadApi } from "@/lib/api/upload";
import { getEducationalPlaceholderImage } from "@/lib/constants/placeholders";
import { useCourseEditorHeader } from "@/lib/contexts/course-editor-header-context";
import { useCategories } from "@/lib/hooks/use-categories";
import { useInstructors } from "@/lib/hooks/use-instructors";
import { useSidebarConfig } from "@/lib/hooks/use-sidebar-config";
import { useCourseStore } from "@/lib/stores/course-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { pageToPageConfig } from "@/lib/types/page";
import {
  pageToCourseFormData,
  courseFormDataToUpdateRequest,
  courseThemeToThemeConfig,
  lmsFullToCourseFormData,
} from "@/lib/utils/course-converter";
import { legacyToPrices } from "@/lib/utils/price-fields";
import { extractCourseSlug } from "@/lib/utils/slug";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

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
    id: "global-theme",
    name: "Global Theme",
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

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export default function CourseEditorPage() {
  const params = useParams();
  const { toast } = useToast();
  const courseId = (params?.id as string) ?? "";

  const { selectedTenantId } = useTenantStore();
  const {
    loadCourse,
    setEditMode,
    setPageTemplate,
    courseData,
    isEditMode,
    isDirty,
    updateBasicInfo,
    updateMedia,
    saveToHistory,
  } = useCourseStore();
  const { setHeaderContent } = useCourseEditorHeader() ?? {};
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const { data: categoriesData } = useCategories(selectedTenantId ?? undefined);
  const { data: instructorsData } = useInstructors(selectedTenantId ?? undefined);
  const { data: sidebarConfig } = useSidebarConfig(selectedTenantId ?? undefined);

  const categoriesForConverter = useMemo(
    () =>
      (categoriesData?.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.iconUrl ?? undefined,
      })),
    [categoriesData?.categories]
  );
  const instructorsForConverter = useMemo(
    () =>
      (instructorsData?.instructors ?? []).map((i) => ({
        id: i.id,
        name: i.name,
        role: i.expertise ?? "",
        bio: i.bio ?? undefined,
        avatar: i.profileUrl ?? undefined,
      })),
    [instructorsData?.instructors]
  );
  const validCategoryIds = useMemo(
    () => new Set((categoriesData?.categories ?? []).map((c) => c.id)),
    [categoriesData?.categories]
  );

  // Build thumbnail context + course metadata for "Generate All" AI modal
  // Only include instructors actually mapped to this course (via instructorIds)
  const courseInstructors = useMemo(() => {
    const ids = courseData.instructorIds || [];
    if (ids.length === 0) return [];
    return instructorsForConverter.filter((i) => ids.includes(i.id));
  }, [courseData.instructorIds, instructorsForConverter]);

  const thumbnailContext: ThumbnailContext = useMemo(() => {
    const firstInstructor = courseInstructors[0];
    return {
      mentorName: firstInstructor?.name,
      courseMode: courseData.mode,
      organizationName: undefined, // tenant name not easily accessible here; CourseEditorContainer handles it
      instructorNames: courseInstructors.map((i) => i.name),
      batchLanguage: courseData.languages?.[0] || courseData.language || undefined,
    };
  }, [courseInstructors, courseData.mode, courseData.languages, courseData.language]);

  const courseMetadata: CourseMetadata = useMemo(() => {
    const categoryNames = (categoriesData?.categories ?? [])
      .filter((c) => courseData.categoryIds?.includes(c.id))
      .map((c) => c.name);

    return {
      subTitle: courseData.subTitle || undefined,
      description: courseData.description || undefined,
      difficulty: courseData.difficulty || undefined,
      duration: courseData.duration || undefined,
      categoryNames: categoryNames.length > 0 ? categoryNames : undefined,
      learningOutcomes: courseData.learningOutcomes?.length ? courseData.learningOutcomes : undefined,
    };
  }, [courseData.subTitle, courseData.description, courseData.difficulty, courseData.duration, courseData.categoryIds, courseData.learningOutcomes, categoriesData?.categories]);

  const [globalTheme, setGlobalTheme] = useState<ThemeConfig>(defaultThemeConfig);
  const [originalTheme, setOriginalTheme] = useState<ThemeConfig | undefined>();
  const [tenantLayout, setTenantLayout] = useState<TenantLayout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lmsCourseId, setLmsCourseId] = useState<string | null>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const hasInitialized = useRef(false);

  // Load course and homepage data
  useEffect(() => {
    async function loadData() {
      if (!selectedTenantId || !courseId || hasInitialized.current) {
        if (!selectedTenantId) {
          setLoadError("Please select a tenant first");
          setIsLoading(false);
        }
        return;
      }

      hasInitialized.current = true;
      setIsLoading(true);
      setLoadError(null);

      try {
        // 1. Fetch layout (enriched with homepage logo) and homepage for theme in parallel
        const [loadedLayout, homepage] = await Promise.all([
          getLayoutWithHomepageLogo(selectedTenantId),
          pagesApi.getHomepage(selectedTenantId),
        ]);

        setTenantLayout(loadedLayout);

        let loadedTheme = defaultThemeConfig;

        if (homepage) {
          const pageConfig = pageToPageConfig(homepage);

          if (pageConfig.theme) {
            loadedTheme = normalizeTheme(pageConfig.theme);
            setGlobalTheme(loadedTheme);
          }
        }

        // 2. Fetch the course page (for slug, theme, page id)
        const coursePage = await pagesApi.getPage(courseId);
        setOriginalTheme(coursePage.theme);

        const pageInfo = {
          id: coursePage.id,
          tenantId: coursePage.tenantId,
          slug: coursePage.slug,
          createdAt: coursePage.createdAt,
          updatedAt: coursePage.updatedAt,
        };

        // 3. Build course form data from page (for sections/template/theme)
        const fromPage = pageToCourseFormData(coursePage);
        const defaults = getDefaultCourseFormData();
        let courseFormData = {
          ...defaults,
          ...fromPage,
          id: pageInfo.id,
          tenantId: pageInfo.tenantId,
          slug: pageInfo.slug,
          createdAt: pageInfo.createdAt,
          updatedAt: pageInfo.updatedAt,
        };

        // 4. Overlay LMS course metadata (pricing, description, etc.) if course exists
        const courseSlugForLms = extractCourseSlug(coursePage.slug);
        const lmsCourse = courseSlugForLms
          ? await coursesLmsApi.getCourseBySlug(courseSlugForLms)
          : null;

        if (lmsCourse) {
          setLmsCourseId(lmsCourse.id);

          // Load the admin's syllabus preference (DB-backed in lms_settings).
          const persistedSettings =
            (lmsCourse.lmsSettings as Record<string, unknown> | null) ?? {};
          lmsSettingsRef.current = persistedSettings;
          setAutoSyncSyllabus(persistedSettings.syllabusAutoSync === true);

          // Fetch persisted course instructors from DB
          const courseInstructors = await coursesLmsApi.getCourseInstructors(lmsCourse.id);
          const dbInstructorIds = courseInstructors.map((ci) => ci.instructor_id);

          // Overlay DB fields onto the page-derived form data
          courseFormData = {
            ...courseFormData,
            title: lmsCourse.title || courseFormData.title,
            subTitle: lmsCourse.subtitle || courseFormData.subTitle,
            description: lmsCourse.description || courseFormData.description,
            duration: lmsCourse.duration || courseFormData.duration,
            mode: (lmsCourse.mode as typeof courseFormData.mode) || courseFormData.mode,
            difficulty:
              (lmsCourse.difficulty as typeof courseFormData.difficulty) || courseFormData.difficulty,
            type: (lmsCourse.courseType as CourseType) || courseFormData.type,
            language:
              Array.isArray(lmsCourse.language) && lmsCourse.language[0]
                ? (lmsCourse.language[0] as typeof courseFormData.language)
                : courseFormData.language,
            languages:
              Array.isArray(lmsCourse.language) && lmsCourse.language.length > 0
                ? lmsCourse.language
                : (courseFormData.languages ?? ["English"]),
            learningOutcomes: lmsCourse.learningOutcomes?.length
              ? lmsCourse.learningOutcomes
              : courseFormData.learningOutcomes,
            prerequisites: lmsCourse.prerequisites?.length
              ? lmsCourse.prerequisites
              : courseFormData.prerequisites,
            webThumbnailUrl: lmsCourse.thumbnailUrl || courseFormData.webThumbnailUrl,
            mobileThumbnailUrl:
              lmsCourse.secondaryThumbnailUrl ||
              lmsCourse.thumbnailUrl ||
              courseFormData.mobileThumbnailUrl,
            previewUrl: lmsCourse.previewUrl || courseFormData.previewUrl,
            thumbnailKey: lmsCourse.thumbnailKey ?? courseFormData.thumbnailKey,
            secondaryThumbnailKey:
              lmsCourse.secondaryThumbnailKey ?? courseFormData.secondaryThumbnailKey,
            previewKey: lmsCourse.previewKey ?? courseFormData.previewKey,
            rating:
              courseFormData.rating ??
              (lmsCourse.averageRating != null ? lmsCourse.averageRating : undefined),
            ratingTotalCount:
              courseFormData.ratingTotalCount ??
              (lmsCourse.totalRatings != null ? lmsCourse.totalRatings : undefined),
            validityDays:
              lmsCourse.validityDays !== undefined
                ? lmsCourse.validityDays
                : (courseFormData.validityDays ?? 365),
            purchaseMode:
              (lmsCourse.purchaseMode as typeof courseFormData.purchaseMode) ||
              courseFormData.purchaseMode,
            webPriceINR: lmsCourse.priceInr
              ? Number(lmsCourse.priceInr)
              : courseFormData.webPriceINR,
            mobilePriceINR: lmsCourse.priceInr
              ? Number(lmsCourse.priceInr)
              : courseFormData.mobilePriceINR,
            webPriceUSD: lmsCourse.priceUsd
              ? Number(lmsCourse.priceUsd)
              : courseFormData.webPriceUSD,
            mobilePriceUSD: lmsCourse.priceUsd
              ? Number(lmsCourse.priceUsd)
              : courseFormData.mobilePriceUSD,
            webDiscount: lmsCourse.discountInr
              ? Number(lmsCourse.discountInr)
              : courseFormData.webDiscount,
            mobileDiscount: lmsCourse.discountUsd
              ? Number(lmsCourse.discountUsd)
              : courseFormData.mobileDiscount,
            prices: lmsCourse.prices?.length
              ? lmsCourse.prices
              : courseFormData.prices?.length
                ? courseFormData.prices
                : legacyToPrices(
                    lmsCourse.priceInr,
                    lmsCourse.priceUsd,
                    lmsCourse.discountInr,
                    lmsCourse.discountUsd
                  ),
            // Override instructor IDs with DB source of truth
            instructorIds: dbInstructorIds.length > 0
              ? dbInstructorIds
              : (courseFormData.instructorIds ?? []).filter((id) => !id.startsWith("mentor-")),
          };
        } else {
          setLmsCourseId(null);
        }

        // 4. Apply global theme to course (converted to course theme format)
        const courseTheme = convertToCourseTheme(loadedTheme);

        // 5. Get placeholder thumbnail if none exists
        const placeholderThumbnail = getEducationalPlaceholderImage(
          courseFormData.slug || courseId
        );

        // 6. Load course into store
        loadCourse({
          ...courseFormData,
          theme: courseTheme,
          webThumbnailUrl: courseFormData.webThumbnailUrl || placeholderThumbnail,
          mobileThumbnailUrl: courseFormData.mobileThumbnailUrl || placeholderThumbnail,
        });

        // 7. Course detail pages use the Modern template only
        setPageTemplate("modern");

        // 8. Enable edit mode
        setEditMode(true);

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load course:", error);
        setLoadError("Failed to load course. Please try again.");
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedTenantId, courseId, loadCourse, setPageTemplate, setEditMode]);

  // Reset initialization and LMS link when course ID (page) changes
  useEffect(() => {
    hasInitialized.current = false;
    setLmsCourseId(null);
  }, [courseId]);

  // Handle save: persist to page (for landing) and to LMS tables when linked
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      // Upload any base64 thumbnail data URLs to S3 before saving
      const tenantId = courseData.tenantId ?? selectedTenantId ?? "";
      const pageCourseId = courseData.id ?? null;

      if (courseData.webThumbnailUrl?.startsWith("data:") && tenantId && pageCourseId) {
        try {
          const file = dataUrlToFile(courseData.webThumbnailUrl, "thumbnail-web.jpg");
          const result = await uploadApi.uploadCourseThumbnail(file, {
            type: "course_thumbnail", tenantId, courseId: pageCourseId, slot: "web",
          });
          updateMedia({
            webThumbnailUrl: result.url,
            thumbnailKey: result.key,
          });
          // Update courseData reference for the rest of this save
          courseData.webThumbnailUrl = result.url;
          courseData.thumbnailKey = result.key;
        } catch {
          // Continue saving even if thumbnail upload fails
        }
      }

      if (courseData.mobileThumbnailUrl?.startsWith("data:") && tenantId && pageCourseId) {
        try {
          const file = dataUrlToFile(courseData.mobileThumbnailUrl, "thumbnail-mobile.jpg");
          const result = await uploadApi.uploadCourseThumbnail(file, {
            type: "course_thumbnail", tenantId, courseId: pageCourseId, slot: "mobile",
          });
          updateMedia({
            mobileThumbnailUrl: result.url,
            secondaryThumbnailKey: result.key,
          });
          // Update courseData reference for the rest of this save
          courseData.mobileThumbnailUrl = result.url;
          courseData.secondaryThumbnailKey = result.key;
        } catch {
          // Continue saving even if thumbnail upload fails
        }
      }

      const updateRequest = courseFormDataToUpdateRequest(
        courseData,
        originalTheme,
        categoriesForConverter,
        instructorsForConverter
      );
      await pagesApi.updatePage(courseId, updateRequest);

      const slugForLms = extractCourseSlug(courseData.slug) || courseData.slug;
      let courseIdLms = lmsCourseId;
      if (!courseIdLms) {
        const created = await coursesLmsApi.createCourse({
          title: courseData.title,
          slug: slugForLms,
          mode: courseData.mode,
          difficulty: courseData.difficulty ?? "NONE",
          description: courseData.description,
          subtitle: courseData.subTitle,
          duration: courseData.duration,
          learning_outcomes: courseData.learningOutcomes,
          prerequisites: courseData.prerequisites,
          validity_days: courseData.validityDays === undefined ? 365 : courseData.validityDays,
          price_inr: courseData.purchaseMode === "PAID" ? String(courseData.webPriceINR) : null,
          price_usd: courseData.purchaseMode === "PAID" ? String(courseData.webPriceUSD) : null,
          discount_inr: courseData.webDiscount ? String(courseData.webDiscount) : null,
          discount_usd: courseData.mobileDiscount ? String(courseData.mobileDiscount) : null,
          prices: courseData.purchaseMode === "PAID" ? courseData.prices : undefined,
          purchase_mode: courseData.purchaseMode,
          language: (courseData.languages?.length
            ? courseData.languages
            : courseData.language
              ? [courseData.language]
              : ["English"]) as string[],
        });
        courseIdLms = created.id;
        setLmsCourseId(created.id);
      } else {
        await coursesLmsApi.updateCourse(courseIdLms, {
          title: courseData.title,
          slug: slugForLms,
          description: courseData.description ?? undefined,
          subtitle: courseData.subTitle ?? undefined,
          duration: courseData.duration ?? undefined,
          learningOutcomes: courseData.learningOutcomes,
          prerequisites: courseData.prerequisites,
          priceInr: courseData.purchaseMode === "PAID" ? String(courseData.webPriceINR) : null,
          priceUsd: courseData.purchaseMode === "PAID" ? String(courseData.webPriceUSD) : null,
          discountInr: courseData.webDiscount ? String(courseData.webDiscount) : null,
          discountUsd: courseData.mobileDiscount ? String(courseData.mobileDiscount) : null,
          prices: courseData.purchaseMode === "PAID" ? courseData.prices : undefined,
          purchaseMode: courseData.purchaseMode,
          categoryIds: (() => {
            const ids = (courseData.categoryIds ?? []).filter((id) => validCategoryIds.has(id));
            return ids.length ? ids : undefined;
          })(),
          language: (courseData.languages?.length
            ? courseData.languages
            : courseData.language
              ? [courseData.language]
              : ["English"]) as string[],
          thumbnailKey: courseData.thumbnailKey ?? undefined,
          secondaryThumbnailKey: courseData.secondaryThumbnailKey ?? undefined,
          previewKey: courseData.previewKey ?? undefined,
          validityDays: courseData.validityDays === undefined ? 365 : courseData.validityDays,
          difficulty: courseData.difficulty ?? "NONE",
        });
      }

      if (courseIdLms) {
        // Sync FAQs and instructors in parallel
        await Promise.all([
          coursesLmsApi.syncFaqs(
            courseIdLms,
            courseData.faqs.map((faq, i) => ({
              question: faq.question,
              answer: faq.answer,
              sort_order: i,
            }))
          ),
          coursesLmsApi.syncCourseInstructors(
            courseIdLms,
            courseData.instructorIds ?? []
          ),
        ]);
        // Curriculum is NOT synced here: it is only updated from the LMS curriculum editor
        // (dashboard/courses/[id]/lms/editor). This page edits the landing page + course metadata only.
      }

      toast({
        title: "Saved",
        description: "Course saved successfully.",
      });
    } catch (error) {
      console.error("Failed to save course:", error);
      toast({
        title: "Error",
        description: "Failed to save course. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    courseId,
    courseData,
    originalTheme,
    lmsCourseId,
    isSaving,
    toast,
    categoriesForConverter,
    instructorsForConverter,
    validCategoryIds,
    selectedTenantId,
    updateMedia,
  ]);

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setEditMode(!isEditMode);
  }, [isEditMode]);

  // Handle AI button click
  const handleAIClick = useCallback(() => {
    if (!courseData.title?.trim()) {
      toast({
        title: "Course title required",
        description: "Please enter a course title before using AI generation.",
        variant: "destructive",
      });
      return;
    }
    setIsAIModalOpen(true);
  }, [courseData.title, toast]);

  // Handle AI generation success - apply generated data to store
  const handleAISuccess = useCallback(
    (data: GeneratedCourseContent, sections: CourseAISectionKey[]) => {
      saveToHistory();

      if (data.subTitle && sections.includes("subtitle")) {
        updateBasicInfo({ subTitle: data.subTitle });
      }

      if (data.description && sections.includes("description")) {
        updateBasicInfo({ description: data.description });
      }

      if (data.learningOutcomes && sections.includes("learningOutcomes")) {
        useCourseStore.setState((state) => ({
          courseData: { ...state.courseData, learningOutcomes: data.learningOutcomes! },
          isDirty: true,
        }));
      }

      if (data.prerequisites && sections.includes("requirements")) {
        useCourseStore.setState((state) => ({
          courseData: { ...state.courseData, prerequisites: data.prerequisites! },
          isDirty: true,
        }));
      }

      if (data.sections && sections.includes("curriculum")) {
        const normalizedSections = data.sections.map((s, si) => ({
          id: `section-${Date.now()}-${si}-${Math.random().toString(36).slice(2, 9)}`,
          title: s.title,
          order: s.order,
          modules: s.modules.map((m, mi) => ({
            id: `module-${Date.now()}-${si}-${mi}-${Math.random().toString(36).slice(2, 9)}`,
            title: m.title,
            order: m.order,
            lectures: m.lectures.map((l, li) => ({
              id: `lecture-${Date.now()}-${si}-${mi}-${li}-${Math.random().toString(36).slice(2, 9)}`,
              title: l.title,
              order: l.order,
              duration: l.duration,
            })),
          })),
        }));
        useCourseStore.setState((state) => ({
          courseData: { ...state.courseData, sections: normalizedSections },
          isDirty: true,
        }));
      }

      if (data.offerings && sections.includes("offerings")) {
        const normalizedOfferings = data.offerings.map((o, i) => ({
          id: `offering-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
          icon: o.icon,
          text: o.text,
        }));
        useCourseStore.setState((state) => ({
          courseData: { ...state.courseData, offerings: normalizedOfferings },
          isDirty: true,
        }));
      }

      if (data.faqs && sections.includes("faqs")) {
        const normalizedFaqs = data.faqs.map((f, i) => ({
          id: `faq-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
          question: f.question,
          answer: f.answer,
        }));
        useCourseStore.setState((state) => ({
          courseData: { ...state.courseData, faqs: normalizedFaqs },
          isDirty: true,
        }));
      }

      if (sections.includes("thumbnails")) {
        if (data.webThumbnailDataUrl || data.mobileThumbnailDataUrl) {
          updateMedia({
            webThumbnailUrl: data.webThumbnailDataUrl || courseData.webThumbnailUrl,
            mobileThumbnailUrl: data.mobileThumbnailDataUrl || courseData.mobileThumbnailUrl,
            thumbnailKey: null,
            secondaryThumbnailKey: null,
          });
        }
      }
    },
    [saveToHistory, updateBasicInfo, updateMedia, courseData.webThumbnailUrl, courseData.mobileThumbnailUrl]
  );

  // Pull the real LMS curriculum into the landing syllabus so the two never
  // drift apart. The save path regenerates the syllabus section from these
  // sections, so the learner-facing syllabus matches the actual course.
  const [isSyncingCurriculum, setIsSyncingCurriculum] = useState(false);
  // Per-course preference: when ON, the landing syllabus auto-syncs from the LMS
  // curriculum on open, so staff never have to click "Sync syllabus" repeatedly.
  const [autoSyncSyllabus, setAutoSyncSyllabus] = useState(false);
  const syllabusAutoSyncedRef = useRef(false);
  // Current course lms_settings JSON, kept so the preference write merges into
  // it (never clobbering other settings like requiredWatchPercent). The initial
  // value is read from the course on load (see getCourseBySlug below).
  const lmsSettingsRef = useRef<Record<string, unknown>>({});

  // Core sync (no UI feedback): pull the LMS curriculum into the landing syllabus.
  const syncSyllabusFromCurriculum = useCallback(async () => {
    if (!lmsCourseId) return;
    const full = await coursesLmsApi.getCourseFull(lmsCourseId);
    const cd = useCourseStore.getState().courseData;
    // Only the sections are consumed; pageInfo just satisfies the converter.
    const formData = lmsFullToCourseFormData(full, {
      id: cd.id ?? "",
      tenantId: cd.tenantId ?? "",
      slug: cd.slug ?? "",
      createdAt: cd.createdAt,
      updatedAt: cd.updatedAt,
    });
    useCourseStore.getState().syncSectionsFromLms(formData.sections);
  }, [lmsCourseId]);

  // The single control: turning it ON syncs the syllabus from the curriculum now
  // AND keeps it synced on every open (no separate manual button needed).
  const toggleAutoSyncSyllabus = useCallback(
    async (on: boolean) => {
      if (!lmsCourseId) {
        toast({
          title: "Save the course first",
          description:
            "Save this page once so its curriculum exists, then set this preference.",
          variant: "destructive",
        });
        return;
      }
      const prev = autoSyncSyllabus;
      setAutoSyncSyllabus(on);
      // Claim this load's auto-sync synchronously when enabling: the state flip
      // re-runs the open-effect below, and without this the effect would fire a
      // second sync (double fetch + two undo entries) because the ref is still
      // false when it re-evaluates. The handler does the one sync itself.
      if (on) syllabusAutoSyncedRef.current = true;
      setIsSyncingCurriculum(true);
      try {
        // Persist the admin preference on the course row (merged into
        // lms_settings so other settings are preserved). This is DB-backed, so
        // it holds per-course for every admin/device.
        const merged = { ...lmsSettingsRef.current, syllabusAutoSync: on };
        await coursesLmsApi.updateCourse(lmsCourseId, { lmsSettings: merged });
        lmsSettingsRef.current = merged;
        if (on) {
          await syncSyllabusFromCurriculum();
          toast({
            title: "Syllabus auto-sync on",
            description:
              "The landing syllabus now follows the LMS curriculum and re-syncs each time you open this page, just Save to publish.",
          });
        } else {
          toast({
            title: "Syllabus auto-sync off",
            description: "The syllabus stays as you set it (custom).",
          });
        }
      } catch (err) {
        setAutoSyncSyllabus(prev); // revert the switch if the save failed
        toast({
          title: "Could not save the preference",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSyncingCurriculum(false);
      }
    },
    [lmsCourseId, autoSyncSyllabus, toast, syncSyllabusFromCurriculum]
  );

  // Auto-sync on open when the toggle is on (once per load), so the landing
  // syllabus always reflects the current curriculum without a manual click.
  useEffect(() => {
    if (
      !autoSyncSyllabus ||
      !lmsCourseId ||
      isLoading ||
      syllabusAutoSyncedRef.current
    ) {
      return;
    }
    syllabusAutoSyncedRef.current = true;
    syncSyllabusFromCurriculum().catch(() => undefined);
  }, [autoSyncSyllabus, lmsCourseId, isLoading, syncSyllabusFromCurriculum]);

  // Inject Back, Preview, AI, Save into main header; clear on unmount
  useEffect(() => {
    if (!setHeaderContent || isLoading || loadError) return;
    setHeaderContent(
      <>
        <span className="text-muted-foreground text-sm">
          {courseData.title || "Untitled Course"}
          {isDirty && <span className="text-warning ml-1">•</span>}
        </span>
        <Button variant="outline" size="sm" onClick={toggleEditMode} className="gap-2">
          {isEditMode ? (
            <>
              <Eye className="h-4 w-4" />
              Preview
            </>
          ) : (
            <>
              <Pencil className="h-4 w-4" />
              Edit
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsUrlModalOpen(true)}
          disabled={isSaving}
          className="gap-2"
          title="Change the page URL"
        >
          <Link2 className="h-4 w-4" />
          URL
        </Button>
        <Separator orientation="vertical" className="h-5" />
        {aiAuthoringEnabled && (
          <Button variant="outline" size="sm" onClick={handleAIClick} className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI
          </Button>
        )}
        <div
          className="flex items-center gap-1.5"
          title="When on, the landing syllabus is pulled from the LMS curriculum now and stays in sync every time you open this page"
        >
          {isSyncingCurriculum ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : (
            <ListTree className="text-muted-foreground h-4 w-4" />
          )}
          <span className="text-muted-foreground hidden text-xs lg:inline">
            Auto-sync syllabus
          </span>
          <Switch
            checked={autoSyncSyllabus}
            onCheckedChange={toggleAutoSyncSyllabus}
            disabled={isSyncingCurriculum}
            aria-label="Auto-sync syllabus with curriculum"
          />
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </>
    );
    return () => setHeaderContent(null);
  }, [
    setHeaderContent,
    isLoading,
    loadError,
    courseData.title,
    isDirty,
    isEditMode,
    isSaving,
    handleSave,
    toggleEditMode,
    handleAIClick,
    aiAuthoringEnabled,
    isSyncingCurriculum,
    autoSyncSyllabus,
    toggleAutoSyncSyllabus,
  ]);

  // Use default layout if not loaded
  const effectiveLayout =
    tenantLayout || (getDefaultTenantLayout(selectedTenantId || "default") as TenantLayout);

  // Use course theme for LayoutWrapper so colors align with course (not admin default blue)
  const effectiveTheme = courseThemeToThemeConfig(courseData.theme, globalTheme);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <Loader2 className="text-primary mb-4 h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Loading course editor...</p>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p className="text-destructive mb-4">{loadError}</p>
        <Button asChild>
          <Link href="/dashboard/courses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Courses
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen flex-col">
        {/* Content: Back/Preview/AI/Save are in dashboard header via CourseEditorHeaderSlot */}
        <div className="flex-1 overflow-auto">
          <LayoutWrapper
            layout={effectiveLayout}
            theme={effectiveTheme}
            isHomePage={false}
            isEditing={false}
            sidebarTopOffset={64}
            sidebarNavItemsOverride={sidebarConfig?.items}
          >
            <div className="min-h-screen pt-6">
              <CourseEditorContainer lmsCourseId={lmsCourseId} />
            </div>
          </LayoutWrapper>
        </div>
      </div>

      {/* AI Generation Modal */}
      <AIGenerateModal
        open={isAIModalOpen}
        onOpenChange={setIsAIModalOpen}
        mode="all"
        courseTitle={courseData.title || ""}
        onSuccess={handleAISuccess}
        thumbnailContext={thumbnailContext}
        courseMetadata={courseMetadata}
        lmsCourseId={lmsCourseId}
      />

      {/* Page URL (slug) editor */}
      <CourseUrlModal
        open={isUrlModalOpen}
        onOpenChange={setIsUrlModalOpen}
        lmsCourseId={lmsCourseId}
        disabled={isSaving}
      />
    </>
  );
}
