"use client";

import { useToast } from "@open-mtlms/core";
import {
  CourseProvider,
  ModernTemplate,
  type CourseEditCallbacks,
  type CourseInstructor,
  type CourseReviewItem,
  type CourseRatingSummary,
  type TemplatePriceParts,
} from "@open-mtlms/course-templates";
import { formatMoney, getCurrencySymbol, resolveCourseRating } from "@open-mtlms/shared";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CourseAISectionKey,
  CourseMetadata,
  GeneratedCourseContent,
  ThumbnailContext,
} from "@/lib/api/course-ai";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import { useCategories } from "@/lib/hooks/use-categories";
import { useCourseInstructors } from "@/lib/hooks/use-course-instructors";
import { useCurrencySettings } from "@/lib/hooks/use-currency-settings";
import { useInstructors } from "@/lib/hooks/use-instructors";
import { useCourseStore } from "@/lib/stores/course-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { buildEditorPreviewPriceParts } from "@/lib/utils/price-fields";

import {
  SyllabusModal,
  MentorModal,
  CategoryModal,
  FAQModal,
  PricingModal,
  OfferingsModal,
  ThumbnailPickerModal,
  LanguageModal,
  CourseRecommendationModal,
  AIGenerateModal,
} from "./modals";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

interface CourseEditorContainerProps {
  /** LMS course id for fetching reviews (when course is linked to LMS) */
  lmsCourseId?: string | null;
}

export function CourseEditorContainer({ lmsCourseId }: CourseEditorContainerProps = {}) {
  const {
    courseData,
    isEditMode,
    updateBasicInfo,
    updateMedia,
    saveToHistory,
    setMode,
    updateSettings,
    updateSectionLabels,
  } = useCourseStore();
  const { selectedTenantId, selectedTenant } = useTenantStore();
  const { data: categoriesData } = useCategories(selectedTenantId ?? undefined);
  const { data: instructorsData } = useInstructors(selectedTenantId ?? undefined);
  const { data: courseInstructorsData } = useCourseInstructors(lmsCourseId ?? undefined);
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isThumbnailModalOpen, setIsThumbnailModalOpen] = useState(false);
  const [reviewsData, setReviewsData] = useState<{
    ratings: CourseReviewItem[];
    ratingSummary: CourseRatingSummary;
  } | null>(null);
  const [aiModalSectionKey, setAiModalSectionKey] = useState<CourseAISectionKey | null>(null);
  const aiAuthoringEnabled = useAiAuthoringEnabled();

  useEffect(() => {
    if (!lmsCourseId) {
      setReviewsData(null);
      return;
    }
    let cancelled = false;
    coursesLmsApi
      .getCourseReviews(lmsCourseId)
      .then((data) => {
        if (cancelled) return;
        const list = (data.reviews || []).map((r) => ({
          id: r.id,
          userId: r.tenant_member_id,
          userName: "User",
          rating: r.rating,
          review: r.review_text ?? undefined,
          createdAt: r.created_at,
        }));
        const sum = data.summary || { average: 0, count: 0 };
        const dist = (data.reviews || []).reduce(
          (acc: { 1: number; 2: number; 3: number; 4: number; 5: number }, r: { rating: number }) => {
            const k = Math.min(5, Math.max(1, r.rating)) as 1 | 2 | 3 | 4 | 5;
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          },
          { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        );
        setReviewsData({
          ratings: list,
          ratingSummary: {
            averageRating: sum.average ?? 0,
            totalRatings: sum.count ?? 0,
            ratingDistribution: dist,
          },
        });
      })
      .catch(() => setReviewsData(null));
    return () => {
      cancelled = true;
    };
  }, [lmsCourseId]);

  const categories = useMemo(
    () =>
      (categoriesData?.categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.iconUrl ?? undefined,
      })),
    [categoriesData?.categories]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use course theme's dark colors when: admin is in dark mode, OR course theme is dark-themed (e.g. Midnight)
  const isDarkTheme = courseData.theme?.id === "midnight" || courseData.theme?.id === "midnight-dark";
  const isDarkMode = isDarkTheme || (mounted && resolvedTheme === "dark");

  // Transform courseData to match CourseDisplayData (merge reviews when available).
  // Admin-authored hero rating always wins; the LMS review summary is only the
  // fallback. Mirrors the public page so the preview matches what learners see.
  // adminRatingOverride/adminRatingCountOverride: raw store values for edit inputs
  const courseDisplayData = useMemo(() => {
    const resolved = resolveCourseRating(
      courseData.rating,
      courseData.ratingTotalCount,
      reviewsData?.ratingSummary
    );
    return {
      ...courseData,
      ...(reviewsData && {
        ratings: reviewsData.ratings,
        ratingSummary: {
          averageRating: resolved.rating ?? 0,
          totalRatings: resolved.ratingTotalCount ?? 0,
        },
      }),
      rating: resolved.rating,
      ratingTotalCount: resolved.ratingTotalCount,
      adminRatingOverride: courseData.rating,
      adminRatingCountOverride: courseData.ratingTotalCount,
    };
  }, [courseData, reviewsData]);

  // Transform instructors from IDs to full objects
  const instructors: CourseInstructor[] = useMemo(() => {
    // Prefer live data from course_instructors junction table (includes socials)
    if (courseInstructorsData && courseInstructorsData.length > 0) {
      return courseInstructorsData.map((ci) => {
        const socialLinks: Array<{ platform: string; url: string }> = [];
        if (ci.linkedin_url) socialLinks.push({ platform: "linkedin", url: ci.linkedin_url });
        if (ci.twitter_url) socialLinks.push({ platform: "twitter", url: ci.twitter_url });
        if (ci.github_url) socialLinks.push({ platform: "github", url: ci.github_url });
        if (ci.youtube_url) socialLinks.push({ platform: "youtube", url: ci.youtube_url });
        if (ci.website_url) socialLinks.push({ platform: "website", url: ci.website_url });
        if (ci.facebook_url) socialLinks.push({ platform: "facebook", url: ci.facebook_url });
        if (ci.instagram_url) socialLinks.push({ platform: "instagram", url: ci.instagram_url });
        return {
          id: ci.instructor_id,
          name: ci.name,
          role: ci.expertise ?? "",
          avatar: ci.profile_url ?? undefined,
          bio: ci.bio ?? undefined,
          socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
        };
      });
    }
    // Fallback to page config instructor IDs matched against tenant instructor list
    const ids = courseData.instructorIds || [];
    const list = instructorsData?.instructors ?? [];
    return ids
      .map((id) => list.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => i !== undefined)
      .map((i) => ({
        id: i.id,
        name: i.name,
        role: i.expertise ?? "",
        avatar: i.profileUrl ?? undefined,
        bio: i.bio ?? undefined,
      }));
  }, [courseData.instructorIds, instructorsData?.instructors, courseInstructorsData]);

  // Build thumbnail context for AI generation with course details
  const thumbnailContext: ThumbnailContext = useMemo(() => {
    const firstInstructor = instructors[0];
    return {
      mentorName: firstInstructor?.name,
      courseMode: courseData.mode,
      organizationName: selectedTenant?.tenant_name || undefined,
      instructorNames: instructors.map((i) => i.name),
      batchLanguage: courseData.languages?.[0] || courseData.language || undefined,
    };
  }, [instructors, courseData.mode, selectedTenant?.tenant_name, courseData.languages, courseData.language]);

  // Build course metadata for AI generation context
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

  // Create callbacks that map to Zustand store actions
  const { data: currencySettings } = useCurrencySettings();

  // Editor preview pricing: the admin sees the FULL price book (primary =
  // tenant default currency, every other configured price on the muted
  // "Also priced" line). Buyers get a single geo-resolved price instead;
  // this never affects the storefront. Returns null when no price book
  // exists yet so templates fall back to the legacy INR/USD math.
  const previewPriceParts = useMemo<TemplatePriceParts | null>(() => {
    if (courseData.purchaseMode !== "PAID") return null;
    return buildEditorPreviewPriceParts(courseData.prices, currencySettings?.currencies, {
      getCurrencySymbol,
      formatMoney,
    });
  }, [courseData.purchaseMode, courseData.prices, currencySettings]);

  const callbacks: CourseEditCallbacks = useMemo(
    () => ({
      onEditTitle: (title: string) => {
        updateBasicInfo({ title });
      },
      onEditSubtitle: (subTitle: string) => {
        updateBasicInfo({ subTitle });
      },
      onEditDescription: (description: string) => {
        updateBasicInfo({ description });
      },
      onEditDuration: (duration: string) => {
        updateBasicInfo({ duration });
      },
      onEditMode: (mode) => {
        setMode(mode);
      },
      onEditDifficulty: (difficulty) => {
        updateSettings({ difficulty });
      },
      onEditLearningOutcomes: (outcomes: string[]) => {
        saveToHistory();
        useCourseStore.setState((state) => ({
          courseData: { ...state.courseData, learningOutcomes: outcomes },
          isDirty: true,
        }));
      },
      onEditPrerequisites: (prerequisites: string[]) => {
        saveToHistory();
        useCourseStore.setState((state) => ({
          courseData: { ...state.courseData, prerequisites },
          isDirty: true,
        }));
      },
      onEditThumbnail: () => {
        setIsThumbnailModalOpen(true);
      },
      onEditSyllabus: () => setActiveModal("syllabus"),
      onEditFAQ: () => setActiveModal("faq"),
      onEditRecommendations: () => setActiveModal("recommendations"),
      onEditPrice: () => setActiveModal("pricing"),
      onEditOfferings: () => setActiveModal("offerings"),
      onEditInstructors: () => setActiveModal("mentor"),
      onEditCategories: () => setActiveModal("category"),
      onEditLanguages: () => setActiveModal("language"),
      onEditSectionLabels: (updates) => {
        updateSectionLabels(updates);
      },
      onToggleSectionVisibility: (sectionKey) => {
        useCourseStore.getState().toggleSectionVisibility(sectionKey);
      },
      onEditRating: (rating, ratingTotalCount) => {
        useCourseStore.getState().updateRating(rating, ratingTotalCount);
      },
      onGenerateWithAI: aiAuthoringEnabled ? (sectionKey: CourseAISectionKey) => {
        if (!courseData.title?.trim()) {
          toast({
            title: "Course title required",
            description: "Please enter a course title before using AI generation.",
            variant: "destructive",
          });
          return;
        }
        setAiModalSectionKey(sectionKey);
      } : undefined,
      priceParts: previewPriceParts,
    }),
    [updateBasicInfo, saveToHistory, setMode, updateSettings, updateSectionLabels, courseData.title, previewPriceParts, aiAuthoringEnabled]
  );

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

      // Thumbnail handling: store base64 data URLs in Zustand store.
      // Actual S3 upload happens in page.tsx handleSave (converts base64 → S3 before persisting).
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

  // Handle thumbnail modal selection (keys for save, URLs for display)
  const handleThumbnailSelect = useCallback(
    async (payload: {
      thumbnailKey?: string | null;
      secondaryThumbnailKey?: string | null;
      previewKey?: string | null;
      thumbnailUrl: string;
      secondaryThumbnailUrl: string;
      previewUrl?: string;
    }) => {
      updateMedia({
        webThumbnailUrl: payload.thumbnailUrl,
        mobileThumbnailUrl: payload.secondaryThumbnailUrl,
        previewUrl: payload.previewUrl,
        thumbnailKey: payload.thumbnailKey,
        secondaryThumbnailKey: payload.secondaryThumbnailKey,
        previewKey: payload.previewKey,
      });

      // Auto-save thumbnail keys to LMS course immediately so it's mapped without requiring a manual Save
      if (lmsCourseId) {
        try {
          await coursesLmsApi.updateCourse(lmsCourseId, {
            thumbnailKey: payload.thumbnailKey ?? undefined,
            secondaryThumbnailKey: payload.secondaryThumbnailKey ?? undefined,
            previewKey: payload.previewKey ?? undefined,
          });
        } catch {
          // Non-critical: thumbnail is in store, user can still save manually
        }
      }
    },
    [updateMedia, lmsCourseId]
  );

  // Apply course theme CSS variables via scoped stylesheet (higher specificity than admin globals)
  const lightColors = courseData.theme?.colors?.light;
  const darkColors = courseData.theme?.colors?.dark;

  useEffect(() => {
    if (!lightColors) return;
    const styleId = "course-editor-theme";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const pick = (dk: string | undefined, lt: string) =>
      isDarkMode && dk ? dk : lt;

    // In dark mode, when theme lacks dark.primary, use foreground (white) instead of light.primary (blue)
    // so accent elements (breadcrumbs, icons, checkmarks) render white instead of blue
    const primary = isDarkMode
      ? (darkColors?.primary ?? darkColors?.foreground ?? lightColors.primary)
      : lightColors.primary;
    const primaryForeground = isDarkMode
      ? (darkColors?.primaryForeground ?? darkColors?.background ?? lightColors.primaryForeground)
      : lightColors.primaryForeground;

    const vars = `
        --primary: ${primary};
        --primary-foreground: ${primaryForeground};
        --secondary: ${pick(darkColors?.secondary, lightColors.secondary)};
        --secondary-foreground: ${pick(darkColors?.secondaryForeground, lightColors.secondaryForeground)};
        --accent: ${pick(darkColors?.accent, lightColors.accent)};
        --accent-foreground: ${pick(darkColors?.accentForeground, lightColors.accentForeground)};
        --background: ${pick(darkColors?.background, lightColors.background)};
        --foreground: ${pick(darkColors?.foreground, lightColors.foreground)};
        --card: ${pick(darkColors?.card, lightColors.card)};
        --card-foreground: ${pick(darkColors?.cardForeground, lightColors.cardForeground)};
        --muted: ${pick(darkColors?.muted, lightColors.muted)};
        --muted-foreground: ${pick(darkColors?.mutedForeground, lightColors.mutedForeground)};
        --border: ${pick(darkColors?.border, lightColors.border)};
        --input: ${pick(darkColors?.input, lightColors.input)};
        --ring: ${pick(darkColors?.ring, lightColors.ring)};`;

    // Use very high specificity to override both admin globals and LayoutWrapper injection
    styleEl.textContent = `
      html .layout-preview-wrapper .course-theme-root,
      html .layout-preview-wrapper .course-theme-root *,
      html.dark .layout-preview-wrapper .course-theme-root,
      html.dark .layout-preview-wrapper .course-theme-root * {
        ${vars}
      }
    `;

    return () => { styleEl?.remove(); };
  }, [lightColors, darkColors, isDarkMode]);

  return (
    <>
      <CourseProvider
        courseData={courseDisplayData}
        instructors={instructors}
        categories={categories}
        isEditMode={isEditMode}
        callbacks={callbacks}
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        modeReadOnly={true}
      >
        <div className="course-theme-root min-h-screen">
          <ModernTemplate />
        </div>
      </CourseProvider>

      {/* Admin-specific modals */}
      <SyllabusModal
        open={activeModal === "syllabus"}
        onOpenChange={(open) => setActiveModal(open ? "syllabus" : null)}
      />
      <MentorModal
        open={activeModal === "mentor"}
        onOpenChange={(open) => setActiveModal(open ? "mentor" : null)}
      />
      <CategoryModal
        open={activeModal === "category"}
        onOpenChange={(open) => setActiveModal(open ? "category" : null)}
      />
      <FAQModal
        open={activeModal === "faq"}
        onOpenChange={(open) => setActiveModal(open ? "faq" : null)}
      />
      <CourseRecommendationModal
        open={activeModal === "recommendations"}
        onOpenChange={(open) => setActiveModal(open ? "recommendations" : null)}
      />

      <PricingModal
        open={activeModal === "pricing"}
        onOpenChange={(open) => setActiveModal(open ? "pricing" : null)}
      />
      <OfferingsModal
        open={activeModal === "offerings"}
        onOpenChange={(open) => setActiveModal(open ? "offerings" : null)}
      />
      <LanguageModal
        open={activeModal === "language"}
        onOpenChange={(open) => setActiveModal(open ? "language" : null)}
      />
      <ThumbnailPickerModal
        open={isThumbnailModalOpen}
        onOpenChange={setIsThumbnailModalOpen}
        onSelect={handleThumbnailSelect}
        tenantId={courseData.tenantId ?? selectedTenantId ?? ""}
        courseId={courseData.id ?? null}
        currentWebImage={courseData.webThumbnailUrl || ""}
        currentMobileImage={courseData.mobileThumbnailUrl || ""}
        currentPreviewUrl={courseData.previewUrl || ""}
        courseTitle={courseData.title ?? ""}
        thumbnailContext={thumbnailContext}
        courseMetadata={courseMetadata}
      />
      <AIGenerateModal
        open={aiModalSectionKey !== null}
        onOpenChange={(open) => !open && setAiModalSectionKey(null)}
        mode="section"
        sectionKey={aiModalSectionKey ?? undefined}
        courseTitle={courseData.title || ""}
        onSuccess={handleAISuccess}
        thumbnailContext={thumbnailContext}
        courseMetadata={courseMetadata}
        lmsCourseId={lmsCourseId}
      />
    </>
  );
}
