"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Button,
  cn,
  Label,
  Separator,
  Switch,
  useToast,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@open-mtlms/core";
import { formatDuration } from "@open-mtlms/lms-templates";
import { DEFAULT_LMS_SETTINGS, generateGoogleFontsUrl } from "@open-mtlms/shared";
import type { LMSLesson, LMSSection, LMSSettings, LMSVideoConfig, ThemeConfig } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import {
  AlignLeft,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  ClipboardCheck,
  ClipboardList,
  GripVertical,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Play,
  Plus,
  Redo2,
  Save,
  Settings,
  Star,
  Trash2,
  Undo2,
  Video,
  X,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ContentLessonPanel, ResourceManager, LMSSettingsPanel, VideoConfigPanel, AssignmentConfigPanel } from "@/components/lms-editor";
import {
  curriculumDropAnimation,
  DragHandle,
  makeLessonDndId,
  makeSectionDndId,
  parseDndId,
  SectionDropZone,
  SortableItemWrapper,
} from "@/components/lms-editor/sortable-curriculum";
import { assignmentsApi } from "@/lib/api/assignments";
import { ApiError } from "@/lib/api/axios";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import { pagesApi } from "@/lib/api/pages";
import { quizzesApi } from "@/lib/api/quizzes";
import { uploadApi } from "@/lib/api/upload";
import { useToggleCoursePublish } from "@/lib/hooks/use-courses";
import { useTenantWebUrl } from "@/lib/hooks/use-tenant-domain-url";
import { useLMSStore } from "@/lib/stores/lms-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import {
  apiSectionToStoreSectionSingle,
  apiLessonWithLectureToStoreLesson,
  getVideoProvider,
  videoConfigToSyncKeys,
} from "@/lib/utils/lms-mapper";
import { extractCourseSlug } from "@/lib/utils/slug";

// Tab type
type TabId = "overview" | "ratings";

/** Standalone content lesson types (one lesson_resources row each). */
type ContentLessonType = "PDF" | "LINK" | "TEXT" | "IMAGE";
const CONTENT_LESSON_TYPES: ContentLessonType[] = ["PDF", "LINK", "TEXT", "IMAGE"];
const isContentLessonType = (
  t: string | undefined
): t is ContentLessonType =>
  CONTENT_LESSON_TYPES.includes(t as ContentLessonType);

// ------- THEME HELPERS (same pattern as page editor + LayoutWrapper) -------

function normalizeTheme(theme: unknown): ThemeConfig {
  if (!theme || typeof theme !== "object") return defaultThemeConfig;
  const t = theme as Record<string, unknown>;
  if ("colorScheme" in t || "primaryColor" in t || !("colors" in t)) return defaultThemeConfig;
  const hasCorrectStructure =
    t.colors && typeof t.colors === "object" && "light" in (t.colors as object) &&
    t.fonts && typeof t.fonts === "object" &&
    t.spacing && typeof t.spacing === "object" &&
    t.borders && typeof t.borders === "object";
  if (!hasCorrectStructure) return defaultThemeConfig;
  const themeLight = (t.colors as { light?: Record<string, string> })?.light || {};
  const themeDark = (t.colors as { dark?: Record<string, string> })?.dark || {};
  const mergedLight = { ...defaultThemeConfig.colors.light, ...themeLight };
  return {
    ...defaultThemeConfig,
    ...t,
    colors: {
      light: mergedLight,
      dark: {
        ...defaultThemeConfig.colors.dark,
        ...themeDark,
        // When theme dark doesn't define primary, use light.primary so chosen theme color (e.g. green) shows in dark mode
        primary: themeDark.primary ?? mergedLight.primary,
        primaryForeground: themeDark.primaryForeground ?? mergedLight.primaryForeground,
      },
    },
    fonts: { ...defaultThemeConfig.fonts, ...((t.fonts as object) || {}) },
    spacing: { ...defaultThemeConfig.spacing, ...((t.spacing as object) || {}) },
    borders: { ...defaultThemeConfig.borders, ...((t.borders as object) || {}) },
  } as ThemeConfig;
}

async function getHomepageTheme(tenantId: string): Promise<ThemeConfig | null> {
  try {
    const homepage = await pagesApi.getHomepage(tenantId);
    if (homepage) {
      return normalizeTheme(homepage.theme);
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch homepage theme:", error);
    return null;
  }
}

function themeToCssVariables(theme: ThemeConfig): Record<string, string> {
  const { colors, fonts, spacing, borders } = theme;
  return {
    "--primary": colors.light.primary,
    "--primary-foreground": colors.light.primaryForeground,
    "--secondary": colors.light.secondary,
    "--secondary-foreground": colors.light.secondaryForeground,
    "--accent": colors.light.accent,
    "--accent-foreground": colors.light.accentForeground,
    "--background": colors.light.background,
    "--foreground": colors.light.foreground,
    "--muted": colors.light.muted,
    "--muted-foreground": colors.light.mutedForeground,
    "--card": colors.light.card,
    "--card-foreground": colors.light.cardForeground,
    "--popover": colors.light.card,
    "--popover-foreground": colors.light.cardForeground,
    "--border": colors.light.border,
    "--input": colors.light.input,
    "--ring": colors.light.ring,
    "--destructive": colors.light.destructive,
    "--destructive-foreground": colors.light.destructiveForeground,
    "--success": colors.light.success,
    "--success-foreground": colors.light.successForeground,
    "--warning": colors.light.warning,
    "--warning-foreground": colors.light.warningForeground,
    "--font-heading": fonts.heading,
    "--font-body": fonts.body,
    "--font-heading-weight": fonts.headingWeight,
    "--font-body-weight": fonts.bodyWeight,
    "--section-padding-y": spacing.sectionPaddingY,
    "--section-padding-x": spacing.sectionPaddingX,
    "--container-max-width": spacing.containerMaxWidth,
    "--gap": spacing.gap,
    "--gap-lg": spacing.gapLg,
    "--radius": borders.radius,
    "--radius-sm": borders.radiusSm,
    "--radius-md": borders.radiusMd,
    "--radius-lg": borders.radiusLg,
    "--radius-full": borders.radiusFull,
  };
}

function darkModeToCssVariables(theme: ThemeConfig): Record<string, string> {
  const { colors } = theme;
  const light = colors.light;
  const dark = colors.dark;

  // When theme lacks dark.primary, use light.primary so chosen theme color (e.g. green) shows in dark mode
  const primary = dark.primary ?? light.primary;
  const primaryForeground = dark.primaryForeground ?? light.primaryForeground;

  return {
    "--background": dark.background,
    "--foreground": dark.foreground,
    "--card": dark.card,
    "--card-foreground": dark.cardForeground,
    "--popover": dark.card,
    "--popover-foreground": dark.cardForeground,
    "--muted": dark.muted,
    "--muted-foreground": dark.mutedForeground,
    "--border": dark.border,
    "--input": dark.input,
    "--primary": primary,
    "--primary-foreground": primaryForeground,
    "--secondary": dark.secondary ?? light.secondary,
    "--secondary-foreground": dark.secondaryForeground ?? light.secondaryForeground,
    "--accent": dark.accent ?? light.accent,
    "--accent-foreground": dark.accentForeground ?? light.accentForeground,
    "--ring": dark.ring ?? light.ring,
    "--destructive": dark.destructive ?? light.destructive,
    "--destructive-foreground": dark.destructiveForeground ?? light.destructiveForeground,
  };
}

function injectThemeStyles(theme: ThemeConfig) {
  const styleId = "lms-editor-theme";
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  const lightVars = themeToCssVariables(theme);
  const darkVars = darkModeToCssVariables(theme);
  const lightCss = Object.entries(lightVars).map(([key, value]) => `${key}: ${value};`).join("\n      ");
  const darkCss = Object.entries(darkVars).map(([key, value]) => `${key}: ${value};`).join("\n      ");
  styleEl.textContent = `
    .lms-editor-themed {
      ${lightCss}
    }
    .dark .lms-editor-themed {
      ${darkCss}
    }
  `;

  // Load Google Fonts for the theme
  const fontLinkId = "lms-editor-google-fonts";
  let fontLink = document.getElementById(fontLinkId) as HTMLLinkElement | null;
  if (!fontLink) {
    fontLink = document.createElement("link");
    fontLink.id = fontLinkId;
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);
  }
  fontLink.href = generateGoogleFontsUrl({ heading: theme.fonts.heading, body: theme.fonts.body });
}

/**
 * Admin editor preview for a lecture video. YouTube and MP4 play inline; EVS
 * and HLS sources are signed or streamed for learners, so the editor shows
 * the configured source instead of minting a playback session.
 */
function LMSEditorVideoPreview({
  video,
  isEditMode,
  onEditClick,
}: {
  video: LMSVideoConfig;
  isEditMode: boolean;
  onEditClick: () => void;
}) {
  const provider = getVideoProvider(video);
  return (
    <>
      {provider === "youtube" ? (
        <iframe
          src={`https://www.youtube.com/embed/${video.videoId}?rel=0&modestbranding=1`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : provider === "mp4" ? (
        <video src={video.videoId} controls className="absolute inset-0 h-full w-full bg-black" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 px-6 text-center text-slate-300">
          <Video className="h-12 w-12 text-slate-400" />
          <p className="text-base font-medium">{provider === "hls" ? "HLS stream" : "EVS video"}</p>
          <p className="max-w-full truncate font-mono text-xs text-slate-400">{video.videoId}</p>
          <p className="text-xs text-slate-500">Plays in the learner view.</p>
        </div>
      )}
      {isEditMode && (
        <button
          onClick={onEditClick}
          title="Change video"
          className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs font-medium text-white opacity-70 shadow-lg backdrop-blur-md transition-opacity hover:opacity-100"
        >
          <Video className="h-4 w-4" />
          Change video
        </button>
      )}
    </>
  );
}

export default function LMSEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const courseId = (params?.id as string) ?? "";
  const { selectedTenantId } = useTenantStore();
  const togglePublish = useToggleCoursePublish();
  const themeLoadedRef = useRef(false);

  // Store selectors
  const hasHydrated = useLMSStore((state) => state._hasHydrated);
  const lmsData = useLMSStore((state) => state.lmsData);
  const previewUrl = useTenantWebUrl(
    lmsData?.course?.slug ? `/learn/${lmsData.course.slug}/lesson/1` : ""
  );
  const currentLessonId = useLMSStore((state) => state.currentLessonId);
  const currentSectionId = useLMSStore((state) => state.currentSectionId);
  const isDirty = useLMSStore((state) => state.isDirty);
  const isLoading = useLMSStore((state) => state.isLoading);
  const isEditMode = useLMSStore((state) => state.isEditMode);
  const history = useLMSStore((state) => state.history);
  const navigateToLesson = useLMSStore((state) => state.navigateToLesson);
  const _addSection = useLMSStore((state) => state.addSection);
  const addSectionFromServer = useLMSStore((state) => state.addSectionFromServer);
  const updateSection = useLMSStore((state) => state.updateSection);
  const removeSection = useLMSStore((state) => state.removeSection);
  const reorderSections = useLMSStore((state) => state.reorderSections);
  const setSectionOrder = useLMSStore((state) => state.setSectionOrder);
  const setLessonOrder = useLMSStore((state) => state.setLessonOrder);
  const moveLessonAcrossSections = useLMSStore((state) => state.moveLessonAcrossSections);
  const setSections = useLMSStore((state) => state.setSections);
  const _addLesson = useLMSStore((state) => state.addLesson);
  const addLessonToSection = useLMSStore((state) => state.addLessonToSection);
  const updateLesson = useLMSStore((state) => state.updateLesson);
  const removeLesson = useLMSStore((state) => state.removeLesson);
  const reorderLessons = useLMSStore((state) => state.reorderLessons);
  const _setTemplate = useLMSStore((state) => state.setTemplate);
  const updateSettings = useLMSStore((state) => state.updateSettings);
  const setLessonVideo = useLMSStore((state) => state.setLessonVideo);
  const toggleEditMode = useLMSStore((state) => state.toggleEditMode);
  const undo = useLMSStore((state) => state.undo);
  const redo = useLMSStore((state) => state.redo);
  const saveToHistory = useLMSStore((state) => state.saveToHistory);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showVideoConfig, setShowVideoConfig] = useState(false);
  const [showAssignmentConfig, setShowAssignmentConfig] = useState(false);
  const [assignmentConfigTitle, setAssignmentConfigTitle] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState<string | null>(null);
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);
  const [hoveredLessonId, setHoveredLessonId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [lmsCourseId, setLmsCourseId] = useState<string | null>(null);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // "save" | "add-section" | "add-lesson" | "section:id" | "lesson:id" etc.

  // ===== Drag-and-drop state =====
  // Active dnd id while a drag is in progress (e.g. "section:abc" or "lesson:xyz");
  // used to render the floating DragOverlay preview.
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // Snapshot of sections taken at onDragStart; used to roll back optimistic
  // state on save failure (transient or 409). One snapshot per drag.
  const dragSnapshotRef = useRef<LMSSection[] | null>(null);
  // Timer for auto-expand-on-hover: when a lesson is dragged over a collapsed
  // section, we expand it after 600ms so it becomes a valid drop target.
  const expandTimerRef = useRef<{ sectionId: string; timeout: ReturnType<typeof setTimeout> } | null>(null);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // ------- LOAD HOMEPAGE THEME & INJECT CSS VARIABLES -------
  useEffect(() => {
    if (!selectedTenantId || themeLoadedRef.current) return;
    themeLoadedRef.current = true;
    (async () => {
      try {
        const theme = await getHomepageTheme(selectedTenantId);
        if (theme) injectThemeStyles(theme);
      } catch (error) {
        console.warn("Failed to load homepage theme:", error);
      }
    })();
    return () => {
      const el = document.getElementById("lms-editor-theme");
      el?.remove();
    };
  }, [selectedTenantId]);

  // ------- RESOLVE LMS COURSE ID + PUBLISH STATUS -------
  useEffect(() => {
    if (!courseId) return;
    (async () => {
      try {
        const page = await pagesApi.getPage(courseId);
        const slug = extractCourseSlug(page.slug);
        if (slug) {
          const lmsCourse = await coursesLmsApi.getCourseBySlug(slug);
          if (lmsCourse) {
            setLmsCourseId(lmsCourse.id);
            setIsPublished(lmsCourse.status === "PUBLISHED");
            return;
          }
        }
        setIsPublished(page.isPublished ?? false);
      } catch {
        // Silently fail
      }
    })();
  }, [courseId]);

  // Temp-to-real ID mapping for resolving stale closures
  const idMappingRef = useRef<Map<string, string>>(new Map());

  // Auto-persist any unpersisted sections/lessons on editor mount
  const hasAutoPersistedRef = useRef(false);
  useEffect(() => {
    if (!lmsCourseId || !lmsData || hasAutoPersistedRef.current) return;

    const hasTempIds = lmsData.sections.some(
      (s) => s.id.startsWith("lms-section-") || s.lessons.some((l) => l.id.startsWith("lms-lesson-"))
    );
    if (!hasTempIds) return;

    hasAutoPersistedRef.current = true;

    (async () => {
      try {
        for (const section of lmsData.sections) {
          let realSectionId = section.id;

          if (section.id.startsWith("lms-section-")) {
            const created = await coursesLmsApi.createSection(lmsCourseId, {
              title: section.title,
              sort_order: section.order,
            });
            const mapped = apiSectionToStoreSectionSingle(created, section.order);
            updateSection(section.id, { id: created.id, title: mapped.title, order: mapped.order, lessons: [] });
            idMappingRef.current.set(section.id, created.id);
            realSectionId = created.id;
          }

          for (let i = 0; i < section.lessons.length; i++) {
            const les = section.lessons[i];
            if (!les.id.startsWith("lms-lesson-")) continue;

            const lessonPayload = {
              title: les.title,
              type: (les.lessonType === "quiz" ? "QUIZ" : les.lessonType === "assignment" ? "ASSIGNMENT" : "LECTURE") as "LECTURE" | "QUIZ" | "ASSIGNMENT",
              sort_order: i,
              is_preview: les.isFreePreview ?? false,
            };
            const createdLesson = await coursesLmsApi.createLesson(lmsCourseId, realSectionId, lessonPayload);
            let createdLecture = null;
            if (lessonPayload.type === "LECTURE") {
              createdLecture = await coursesLmsApi.createLecture(lmsCourseId, createdLesson.id, {
                title: les.title,
                duration: les.duration ?? null,
                resource_links: (les.resources?.map((r) => r.url).filter((u): u is string => Boolean(u))) ?? [],
              });
            }
            updateLesson(realSectionId, les.id, { id: createdLesson.id, lectureId: createdLecture?.id });
            idMappingRef.current.set(les.id, createdLesson.id);
          }
        }
      } catch (e) {
        console.error("Auto-persist failed:", e);
      }
    })();
  }, [lmsCourseId, lmsData, updateSection, updateLesson]);

  // Computed values
  const allLessons = useMemo(() => {
    if (!lmsData) return [];
    return lmsData.sections.flatMap((s) => s.lessons);
  }, [lmsData]);

  const currentLesson = useMemo(() => {
    if (!lmsData || !currentLessonId) return null;
    for (const section of lmsData.sections) {
      const lesson = section.lessons.find((l) => l.id === currentLessonId);
      if (lesson) return lesson;
    }
    return null;
  }, [lmsData, currentLessonId]);

  const currentLessonIndex = useMemo(() => {
    if (!currentLessonId) return -1;
    return allLessons.findIndex((l) => l.id === currentLessonId);
  }, [allLessons, currentLessonId]);

  const previousLesson = useMemo(() => {
    if (currentLessonIndex <= 0) return null;
    return allLessons[currentLessonIndex - 1];
  }, [allLessons, currentLessonIndex]);

  const nextLesson = useMemo(() => {
    if (currentLessonIndex < 0 || currentLessonIndex >= allLessons.length - 1) return null;
    return allLessons[currentLessonIndex + 1];
  }, [allLessons, currentLessonIndex]);

  // Tabs available for the current lesson. Overview is video-only; content
  // lessons render their editor in the main panel, so they only get Review
  // (when enabled), or no tab strip at all.
  // Computed BEFORE the loading guard below so hook order stays stable.
  const tabSettings = lmsData?.settings || DEFAULT_LMS_SETTINGS;
  const isVideoLessonType =
    !isContentLessonType(currentLesson?.lessonType) &&
    currentLesson?.lessonType !== "assignment" &&
    currentLesson?.lessonType !== "quiz";

  const lessonTabs = useMemo(
    () => [
      ...(isVideoLessonType
        ? [{ id: "overview" as TabId, label: "Overview", icon: FileText }]
        : []),
      ...(tabSettings.enableRatings
        ? [{ id: "ratings" as TabId, label: "Review", icon: Star }]
        : []),
    ],
    [
      isVideoLessonType,
      tabSettings.enableRatings,
    ]
  );

  // Keep activeTab valid: if the current tab isn't available for this lesson
  // (e.g. Overview on a content lesson),
  // fall back to the first available tab.
  useEffect(() => {
    if (lessonTabs.length === 0) return;
    if (!lessonTabs.some((t) => t.id === activeTab)) {
      setActiveTab(lessonTabs[0].id);
    }
  }, [lessonTabs, activeTab]);

  // Expand current section by default
  useEffect(() => {
    if (currentSectionId) {
      setExpandedSections((prev) => {
        if (prev.has(currentSectionId)) return prev;
        return new Set([...prev, currentSectionId]);
      });
    }
  }, [currentSectionId]);

  // Redirect if no LMS data loaded
  useEffect(() => {
    if (hasHydrated && !isLoading && !lmsData) {
      router.push(`/dashboard/courses/${courseId}/lms`);
    }
  }, [hasHydrated, isLoading, lmsData, courseId, router]);

  // Show LMS scrollbar only while actively scrolling (excellent UX)
  useEffect(() => {
    const timeouts = new Map<EventTarget, ReturnType<typeof setTimeout>>();
    const SCROLLBAR_VISIBLE_MS = 800;
    const handleScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      if (!el?.classList?.contains("scrollbar-lms")) return;
      el.classList.add("scrollbar-lms-visible");
      const prev = timeouts.get(el);
      if (prev) clearTimeout(prev);
      timeouts.set(
        el,
        setTimeout(() => {
          el.classList.remove("scrollbar-lms-visible");
          timeouts.delete(el);
        }, SCROLLBAR_VISIBLE_MS)
      );
    };
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
    };
  }, []);

  // Resolve LMS course ID (for singular API calls)
  const resolveLmsCourseId = useCallback(async (): Promise<string | null> => {
    if (lmsCourseId) return lmsCourseId;
    const page = await pagesApi.getPage(courseId);
    const slug = extractCourseSlug(page.slug);
    if (!slug) return null;
    const found = await coursesLmsApi.getCourseBySlug(slug);
    if (found) {
      setLmsCourseId(found.id);
      return found.id;
    }
    return null;
  }, [courseId, lmsCourseId]);

  // Eagerly resolve the actual course ID on mount (needed for API calls)
  useEffect(() => {
    if (!courseId || lmsCourseId) return;
    resolveLmsCourseId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Save: persist only template and settings (singular update; no bulk curriculum sync)
  const handleSave = useCallback(async () => {
    if (isSaving || !lmsData) return;
    setIsSaving(true);
    setActionLoading("save");
    try {
      const courseIdLms = await resolveLmsCourseId();
      if (!courseIdLms) {
        toast({ title: "Error", description: "No LMS course linked. Please create the course first.", variant: "destructive" });
        return;
      }
      await coursesLmsApi.updateCourse(courseIdLms, {
        lmsTemplateId: lmsData.templateId || "classic",
        lmsSettings: lmsData.settings ?? {},
      });
      toast({ title: "Saved", description: "Template and settings saved." });
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
      setActionLoading(null);
    }
  }, [courseId, lmsData, isSaving, resolveLmsCourseId, toast]);

  // Handle publish toggle
  const handleTogglePublish = useCallback(() => {
    setIsTogglingPublish(true);
    togglePublish.mutate(
      { courseId: lmsCourseId || courseId, isPublished: !isPublished, pageId: courseId },
      {
        onSuccess: () => {
          setIsPublished(!isPublished);
          setIsTogglingPublish(false);
          toast({ title: "Success", description: isPublished ? "Course unpublished." : "Course published successfully." });
        },
        onError: (error) => {
          setIsTogglingPublish(false);
          console.error("Failed to toggle publish:", error);
          toast({ title: "Error", description: "Failed to update course status.", variant: "destructive" });
        },
      }
    );
  }, [courseId, lmsCourseId, isPublished, togglePublish, toast]);

  // Section/Lesson CRUD handlers (singular API then store update)
  const handleAddSection = useCallback(async () => {
    if (!lmsData) return;
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) {
      toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
      return;
    }
    setActionLoading("add-section");
    try {
      const sectionNum = lmsData.sections.length + 1;
      const created = await coursesLmsApi.createSection(courseIdLms, {
        title: `Section ${sectionNum}`,
        sort_order: lmsData.sections.length,
      });
      const mapped = apiSectionToStoreSectionSingle(created, lmsData.sections.length);
      addSectionFromServer(mapped);
      toast({ title: "Section added" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to add section.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [lmsData, resolveLmsCourseId, addSectionFromServer, toast]);

  const handleAddLesson = useCallback(async (sectionId: string) => {
    if (!lmsData) return;
    const section = lmsData.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) {
      toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
      return;
    }
    setActionLoading(`add-lesson:${sectionId}`);
    try {
      let effectiveSectionId = sectionId;
      const isClientSection = sectionId.startsWith("lms-section-");

      if (isClientSection) {
        const created = await coursesLmsApi.createSection(courseIdLms, {
          title: section.title,
          sort_order: section.order,
        });
        const mapped = apiSectionToStoreSectionSingle(created, section.order);
        updateSection(sectionId, { id: created.id, title: mapped.title, order: mapped.order, lessons: [] });
        for (let i = 0; i < section.lessons.length; i++) {
          const les = section.lessons[i];
          const lessonPayload = {
            title: les.title,
            type: (les.lessonType === "quiz" ? "QUIZ" : les.lessonType === "assignment" ? "ASSIGNMENT" : "LECTURE") as "LECTURE" | "QUIZ" | "ASSIGNMENT",
            sort_order: i,
            is_preview: les.isFreePreview ?? false,
          };
          const createdLesson = await coursesLmsApi.createLesson(courseIdLms, created.id, lessonPayload);
          let createdLecture = null;
          if (lessonPayload.type === "LECTURE") {
            createdLecture = await coursesLmsApi.createLecture(courseIdLms, createdLesson.id, {
              title: les.title,
              duration: les.duration ?? null,
              resource_links: (les.resources?.map((r) => r.url).filter((u): u is string => Boolean(u))) ?? [],
            });
          }
          const lessonMapped = apiLessonWithLectureToStoreLesson(createdLesson, createdLecture, i);
          addLessonToSection(created.id, lessonMapped);
        }
        effectiveSectionId = created.id;
      }

      const lessonNum = section.lessons.length + 1;
      const title = `Lesson ${lessonNum}`;
      const createdLesson = await coursesLmsApi.createLesson(courseIdLms, effectiveSectionId, {
        title,
        type: "LECTURE",
        sort_order: section.lessons.length,
        is_preview: false,
      });
      const createdLecture = await coursesLmsApi.createLecture(courseIdLms, createdLesson.id, {
        title,
        duration: null,
        resource_links: [],
        summary: null,
      });
      const mapped = apiLessonWithLectureToStoreLesson(createdLesson, createdLecture, section.lessons.length);
      addLessonToSection(effectiveSectionId, mapped);
      toast({ title: "Lesson added" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to add lesson.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [lmsData, resolveLmsCourseId, addLessonToSection, updateSection, toast]);

  const handleAddAssignment = useCallback(async (sectionId: string) => {
    if (!lmsData) return;
    const section = lmsData.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) {
      toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
      return;
    }
    setActionLoading(`add-lesson:${sectionId}`);
    try {
      let effectiveSectionId = sectionId;
      const isClientSection = sectionId.startsWith("lms-section-");

      if (isClientSection) {
        const created = await coursesLmsApi.createSection(courseIdLms, {
          title: section.title,
          sort_order: section.order,
        });
        const mapped = apiSectionToStoreSectionSingle(created, section.order);
        updateSection(sectionId, { id: created.id, title: mapped.title, order: mapped.order, lessons: [] });
        effectiveSectionId = created.id;
      }

      const lessonNum = section.lessons.length + 1;
      const title = `Assignment ${lessonNum}`;
      const createdLesson = await coursesLmsApi.createLesson(courseIdLms, effectiveSectionId, {
        title,
        type: "ASSIGNMENT",
        sort_order: section.lessons.length,
        is_preview: false,
      });
      const createdAssignment = await assignmentsApi.create({
        title,
        course_id: courseIdLms,
        lesson_id: createdLesson.id,
        scope: "LESSON",
        instructions: null,
        max_score: 100,
      });
      const mapped: LMSLesson = {
        id: createdLesson.id,
        title: createdLesson.title,
        order: section.lessons.length,
        resources: [],
        isFreePreview: false,
        lessonType: "assignment",
        assignmentId: createdAssignment.id,
      };
      addLessonToSection(effectiveSectionId, mapped);
      navigateToLesson(createdLesson.id);
      setShowAssignmentConfig(true);
      toast({ title: "Assignment added" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to add assignment.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [lmsData, resolveLmsCourseId, addLessonToSection, updateSection, navigateToLesson, toast]);

  const handleAddQuiz = useCallback(async (sectionId: string) => {
    if (!lmsData) return;
    const section = lmsData.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) {
      toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
      return;
    }
    setActionLoading(`add-lesson:${sectionId}`);
    try {
      let effectiveSectionId = sectionId;
      const isClientSection = sectionId.startsWith("lms-section-");

      if (isClientSection) {
        const created = await coursesLmsApi.createSection(courseIdLms, {
          title: section.title,
          sort_order: section.order,
        });
        const mapped = apiSectionToStoreSectionSingle(created, section.order);
        updateSection(sectionId, { id: created.id, title: mapped.title, order: mapped.order, lessons: [] });
        effectiveSectionId = created.id;
      }

      const lessonNum = section.lessons.length + 1;
      const title = `Quiz ${lessonNum}`;
      const createdLesson = await coursesLmsApi.createLesson(courseIdLms, effectiveSectionId, {
        title,
        type: "QUIZ",
        sort_order: section.lessons.length,
        is_preview: false,
      });
      const createdQuiz = await quizzesApi.create({
        title,
        course_id: courseIdLms,
        lesson_id: createdLesson.id,
        scope: "LESSON",
        instructions: null,
        max_score: 100,
        pass_percentage: 60,
      });
      const mapped: LMSLesson = {
        id: createdLesson.id,
        title: createdLesson.title,
        order: section.lessons.length,
        resources: [],
        isFreePreview: false,
        lessonType: "quiz",
        quizId: createdQuiz.id,
      };
      addLessonToSection(effectiveSectionId, mapped);
      navigateToLesson(createdLesson.id);
      router.push(
        `/dashboard/courses/${courseId}/lms/quizzes/${createdQuiz.id}/editor`,
      );
      toast({ title: "Quiz added" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to add quiz.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [courseId, router, lmsData, resolveLmsCourseId, addLessonToSection, updateSection, navigateToLesson, toast]);

  // Add a standalone content lesson (PDF / LINK / TEXT / IMAGE). No lecture,
  // assignment, or quiz row, its single body lives in one lesson_resources row
  // created on first save inside the inline ContentLessonPanel.
  const handleAddContentLesson = useCallback(async (
    sectionId: string,
    contentType: "PDF" | "LINK" | "TEXT" | "IMAGE"
  ) => {
    if (!lmsData) return;
    const section = lmsData.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) {
      toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
      return;
    }
    setActionLoading(`add-lesson:${sectionId}`);
    try {
      let effectiveSectionId = sectionId;
      const isClientSection = sectionId.startsWith("lms-section-");

      if (isClientSection) {
        const created = await coursesLmsApi.createSection(courseIdLms, {
          title: section.title,
          sort_order: section.order,
        });
        const mapped = apiSectionToStoreSectionSingle(created, section.order);
        updateSection(sectionId, { id: created.id, title: mapped.title, order: mapped.order, lessons: [] });
        effectiveSectionId = created.id;
      }

      const labels: Record<typeof contentType, string> = {
        PDF: "PDF",
        LINK: "Embed Link",
        TEXT: "Text",
        IMAGE: "Image",
      };
      const lessonNum = section.lessons.length + 1;
      const title = `${labels[contentType]} ${lessonNum}`;
      const createdLesson = await coursesLmsApi.createLesson(courseIdLms, effectiveSectionId, {
        title,
        type: contentType,
        sort_order: section.lessons.length,
        is_preview: false,
      });
      const mapped: LMSLesson = {
        id: createdLesson.id,
        title: createdLesson.title,
        order: section.lessons.length,
        resources: [],
        isFreePreview: false,
        lessonType: contentType,
      };
      addLessonToSection(effectiveSectionId, mapped);
      navigateToLesson(createdLesson.id);
      toast({ title: `${labels[contentType]} added` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to add lesson.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [lmsData, resolveLmsCourseId, addLessonToSection, updateSection, navigateToLesson, toast]);

  const handleDeleteSection = useCallback(async (sectionId: string) => {
    const section = lmsData?.sections.find((s) => s.id === sectionId);
    if (section && section.lessons.length > 0) {
      if (!confirm(`Delete "${section.title}" and its ${section.lessons.length} lesson(s)?`)) return;
    }
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) {
      toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
      return;
    }
    setActionLoading(`delete-section:${sectionId}`);
    try {
      await coursesLmsApi.deleteSection(courseIdLms, sectionId);
      removeSection(sectionId);
      toast({ title: "Section deleted" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to delete section.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [lmsData, resolveLmsCourseId, removeSection, toast]);

  const handleDeleteLesson = useCallback(async (sectionId: string, lessonId: string) => {
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) {
      toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
      return;
    }
    setActionLoading(`delete-lesson:${lessonId}`);
    try {
      await coursesLmsApi.deleteLesson(courseIdLms, lessonId);
      removeLesson(sectionId, lessonId);
      toast({ title: "Lesson deleted" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to delete lesson.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }, [resolveLmsCourseId, removeLesson, toast]);

  // ===== Drag-and-drop handlers =====
  //
  // UX model:
  //   - onDragStart: snapshot the curriculum so we can roll back on STALE_CURRICULUM (409)
  //   - onDragOver: live optimistic cross-section transfer so the lesson visually moves
  //     between sections while still being dragged (canonical dnd-kit multi-container pattern)
  //   - onDragEnd: fire the bulk-reorder API; on transient failure keep the optimistic state
  //     and surface a non-blocking toast; on 409 roll back and tell the user
  //
  // The expandTimerRef wires "hover 600ms over a collapsed section to auto-expand it" so
  // cross-section drag into a collapsed section feels magical instead of impossible.

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Small movement threshold prevents accidental drags when the user
      // intended to click expand / open menu. Required for the row-with-handle
      // pattern to coexist with row click handlers.
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current.timeout);
      expandTimerRef.current = null;
    }
  }, []);

  const persistSectionReorder = useCallback(
    async (sectionIds: string[]) => {
      const courseIdLms = await resolveLmsCourseId();
      if (!courseIdLms) {
        toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
        return;
      }
      try {
        await coursesLmsApi.reorderSections(courseIdLms, sectionIds);
      } catch (e) {
        const snapshot = dragSnapshotRef.current;
        if (e instanceof ApiError && e.status === 409 && e.code === "STALE_CURRICULUM") {
          if (snapshot) setSections(snapshot);
          toast({
            title: "Curriculum changed elsewhere",
            description: "Refresh the page to see the latest, then try again.",
            variant: "destructive",
          });
          return;
        }
        console.error("reorderSections failed:", e);
        // Keep optimistic state (do NOT auto-revert) so the user's drag isn't
        // undone by a network blip. They can refresh or retry the drag.
        toast({
          title: "Couldn't save reorder",
          description: "Changes are kept locally. Drag again or refresh to retry.",
          variant: "destructive",
        });
      }
    },
    [resolveLmsCourseId, setSections, toast]
  );

  const persistLessonReorderInSection = useCallback(
    async (sectionId: string, lessonIds: string[]) => {
      const courseIdLms = await resolveLmsCourseId();
      if (!courseIdLms) {
        toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
        return;
      }
      try {
        await coursesLmsApi.reorderLessonsInSection(courseIdLms, sectionId, lessonIds);
      } catch (e) {
        const snapshot = dragSnapshotRef.current;
        if (e instanceof ApiError && e.status === 409 && e.code === "STALE_CURRICULUM") {
          if (snapshot) setSections(snapshot);
          toast({
            title: "Curriculum changed elsewhere",
            description: "Refresh the page to see the latest, then try again.",
            variant: "destructive",
          });
          return;
        }
        console.error("reorderLessonsInSection failed:", e);
        toast({
          title: "Couldn't save reorder",
          description: "Changes are kept locally. Drag again or refresh to retry.",
          variant: "destructive",
        });
      }
    },
    [resolveLmsCourseId, setSections, toast]
  );

  const persistLessonMove = useCallback(
    async (payload: {
      lessonId: string;
      sourceSectionId: string;
      targetSectionId: string;
      sourceLessonIds: string[];
      targetLessonIds: string[];
    }) => {
      const courseIdLms = await resolveLmsCourseId();
      if (!courseIdLms) {
        toast({ title: "Error", description: "No LMS course linked.", variant: "destructive" });
        return;
      }
      try {
        await coursesLmsApi.moveLesson(courseIdLms, payload);
      } catch (e) {
        const snapshot = dragSnapshotRef.current;
        if (e instanceof ApiError && e.status === 409 && e.code === "STALE_CURRICULUM") {
          if (snapshot) setSections(snapshot);
          toast({
            title: "Curriculum changed elsewhere",
            description: "Refresh the page to see the latest, then try again.",
            variant: "destructive",
          });
          return;
        }
        console.error("moveLesson failed:", e);
        toast({
          title: "Couldn't save move",
          description: "Changes are kept locally. Drag again or refresh to retry.",
          variant: "destructive",
        });
      }
    },
    [resolveLmsCourseId, setSections, toast]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!lmsData) return;
      // Snapshot the pre-drag curriculum so a 409 or hard failure can roll back
      // to the user's exact prior state, including any unrelated local edits.
      dragSnapshotRef.current = lmsData.sections;
      // One history entry per drag (regardless of how many onDragOver mutations
      // happen along the way). Subsequent setSections/move calls during this
      // drag do NOT push more history (they're "during" the same edit).
      saveToHistory();
      setActiveDragId(String(event.active.id));
    },
    [lmsData, saveToHistory]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || !lmsData) return;
      const activeInfo = parseDndId(active.id);
      const overInfo = parseDndId(over.id);
      // Only cross-section LESSON movement requires live state mutation here;
      // same-container sortable reorder is handled by dnd-kit's strategy and
      // committed on dragEnd.
      if (activeInfo.kind !== "lesson") return;

      const movedLessonId = activeInfo.id;
      // Locate the lesson's current section in our (already-optimistic) state
      let fromSectionId: string | null = null;
      let fromIndex = -1;
      for (const sec of lmsData.sections) {
        const idx = sec.lessons.findIndex((l) => l.id === movedLessonId);
        if (idx >= 0) {
          fromSectionId = sec.id;
          fromIndex = idx;
          break;
        }
      }
      if (!fromSectionId) return;

      // Identify the destination section + drop index
      let toSectionId: string | null = null;
      let toIndex = -1;
      if (overInfo.kind === "lesson") {
        for (const sec of lmsData.sections) {
          const idx = sec.lessons.findIndex((l) => l.id === overInfo.id);
          if (idx >= 0) {
            toSectionId = sec.id;
            toIndex = idx;
            break;
          }
        }
      } else if (overInfo.kind === "section") {
        toSectionId = overInfo.id;
        const sec = lmsData.sections.find((s) => s.id === toSectionId);
        toIndex = sec ? sec.lessons.length : 0;
      } else if (overInfo.kind === "section-drop") {
        toSectionId = overInfo.sectionId;
        toIndex = 0;
      }
      if (!toSectionId || toIndex < 0) return;

      // Auto-expand on hover for collapsed destination sections (600ms delay).
      // Lets the lesson actually transfer into a section the user can't see yet.
      if (toSectionId !== fromSectionId && !expandedSections.has(toSectionId)) {
        if (expandTimerRef.current?.sectionId !== toSectionId) {
          clearExpandTimer();
          const target = toSectionId;
          expandTimerRef.current = {
            sectionId: target,
            timeout: setTimeout(() => {
              setExpandedSections((prev) => {
                if (prev.has(target)) return prev;
                const next = new Set(prev);
                next.add(target);
                return next;
              });
              expandTimerRef.current = null;
            }, 600),
          };
        }
      } else {
        clearExpandTimer();
      }

      // Cross-section: optimistically move the lesson now. The DragOverlay
      // keeps the floating preview, so the user sees their cursor "lift" the
      // lesson out of A and visually drop it into B mid-drag.
      if (toSectionId !== fromSectionId) {
        moveLessonAcrossSections(movedLessonId, fromSectionId, toSectionId, toIndex);
        return;
      }
      // Within-section visual reorder: mutate sections via setSections (no
      // history snapshot, drag-end will commit the final order).
      if (toSectionId === fromSectionId && fromIndex !== toIndex && toIndex >= 0) {
        const newSections = lmsData.sections.map((s) => {
          if (s.id !== fromSectionId) return s;
          return { ...s, lessons: arrayMove(s.lessons, fromIndex, toIndex) };
        });
        setSections(newSections);
      }
    },
    [lmsData, expandedSections, clearExpandTimer, moveLessonAcrossSections, setSections]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      clearExpandTimer();
      const { active, over } = event;
      setActiveDragId(null);
      if (!over || !lmsData) {
        dragSnapshotRef.current = null;
        return;
      }
      const activeInfo = parseDndId(active.id);
      const overInfo = parseDndId(over.id);

      // ----- SECTION drag committed -----
      if (activeInfo.kind === "section" && overInfo.kind === "section") {
        const snapshot = dragSnapshotRef.current;
        if (!snapshot) return;
        const oldIndex = snapshot.findIndex((s) => s.id === activeInfo.id);
        const newIndex = snapshot.findIndex((s) => s.id === overInfo.id);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
          dragSnapshotRef.current = null;
          return;
        }
        const newOrder = arrayMove(snapshot, oldIndex, newIndex).map((s) => s.id);
        setSectionOrder(newOrder);
        void persistSectionReorder(newOrder).finally(() => {
          dragSnapshotRef.current = null;
        });
        return;
      }

      // ----- LESSON drag committed -----
      if (activeInfo.kind === "lesson") {
        const snapshot = dragSnapshotRef.current;
        if (!snapshot) {
          dragSnapshotRef.current = null;
          return;
        }
        // Find the moved lesson's pre-drag section (from snapshot, authoritative)
        let preDragSectionId: string | null = null;
        for (const s of snapshot) {
          if (s.lessons.some((l) => l.id === activeInfo.id)) {
            preDragSectionId = s.id;
            break;
          }
        }
        if (!preDragSectionId) {
          dragSnapshotRef.current = null;
          return;
        }
        // Find the lesson's POST-drag section (from current state, already optimistic)
        let postDragSectionId: string | null = null;
        for (const s of lmsData.sections) {
          if (s.lessons.some((l) => l.id === activeInfo.id)) {
            postDragSectionId = s.id;
            break;
          }
        }
        if (!postDragSectionId) {
          dragSnapshotRef.current = null;
          return;
        }

        if (preDragSectionId === postDragSectionId) {
          // Within-section reorder
          const sec = lmsData.sections.find((s) => s.id === postDragSectionId);
          if (!sec) {
            dragSnapshotRef.current = null;
            return;
          }
          const lessonIds = sec.lessons.map((l) => l.id);
          const snapshotIds =
            snapshot.find((s) => s.id === postDragSectionId)?.lessons.map((l) => l.id) ?? [];
          const unchanged =
            lessonIds.length === snapshotIds.length &&
            lessonIds.every((id, i) => id === snapshotIds[i]);
          if (unchanged) {
            dragSnapshotRef.current = null;
            return;
          }
          setLessonOrder(postDragSectionId, lessonIds);
          void persistLessonReorderInSection(postDragSectionId, lessonIds).finally(() => {
            dragSnapshotRef.current = null;
          });
          return;
        }

        // Cross-section move: derive source / target lesson id arrays
        // from the current (post-drag) state.
        const srcSec = lmsData.sections.find((s) => s.id === preDragSectionId);
        const tgtSec = lmsData.sections.find((s) => s.id === postDragSectionId);
        if (!srcSec || !tgtSec) {
          dragSnapshotRef.current = null;
          return;
        }
        const sourceLessonIds = srcSec.lessons.map((l) => l.id);
        const targetLessonIds = tgtSec.lessons.map((l) => l.id);
        void persistLessonMove({
          lessonId: activeInfo.id,
          sourceSectionId: preDragSectionId,
          targetSectionId: postDragSectionId,
          sourceLessonIds,
          targetLessonIds,
        }).finally(() => {
          dragSnapshotRef.current = null;
        });
        return;
      }

      dragSnapshotRef.current = null;
    },
    [
      clearExpandTimer,
      lmsData,
      setSectionOrder,
      setLessonOrder,
      persistSectionReorder,
      persistLessonReorderInSection,
      persistLessonMove,
    ]
  );

  const handleDragCancel = useCallback(() => {
    clearExpandTimer();
    setActiveDragId(null);
    const snapshot = dragSnapshotRef.current;
    if (snapshot) {
      setSections(snapshot);
      dragSnapshotRef.current = null;
    }
  }, [clearExpandTimer, setSections]);

  // Lookup the active lesson / section for the DragOverlay preview.
  const activeDragInfo = activeDragId ? parseDndId(activeDragId) : null;
  const activeDragSection =
    activeDragInfo?.kind === "section"
      ? lmsData?.sections.find((s) => s.id === activeDragInfo.id) ?? null
      : null;
  const activeDragLesson = (() => {
    if (activeDragInfo?.kind !== "lesson") return null;
    for (const s of lmsData?.sections ?? []) {
      const l = s.lessons.find((x) => x.id === activeDragInfo.id);
      if (l) return l;
    }
    return null;
  })();

  // Avoid lint warnings for the legacy single-step reorder actions; they
  // remain on the store for undo/redo replay and any non-DnD callers.
  void reorderSections;
  void reorderLessons;

  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // Video configuration (persist to API then update store)
  const handleVideoChange = useCallback(
    async (video: LMSVideoConfig | undefined) => {
      if (!currentLesson || !currentSectionId) return;
      setLessonVideo(currentSectionId, currentLesson.id, video);
      const courseIdLms = await resolveLmsCourseId();
      if (!courseIdLms) return;
      try {
        const { video_key, video_provider } = videoConfigToSyncKeys(video);
        const resource_links = (currentLesson.resources ?? []).filter((r) => r.url).map((r) => r.url!);
        await coursesLmsApi.updateLecture(courseIdLms, currentLesson.id, {
          title: currentLesson.title,
          video_key: video_key ?? null,
          video_provider: video_provider ?? null,
          duration: currentLesson.duration ?? null,
          resource_links,
        });
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to save video.", variant: "destructive" });
      }
    },
    [currentLesson, currentSectionId, resolveLmsCourseId, setLessonVideo, toast]
  );

  // Persist the lecture duration typed by the admin
  const handleLessonDurationBlur = useCallback(async () => {
    if (!currentLesson?.lectureId) return;
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) return;
    try {
      const { video_key, video_provider } = videoConfigToSyncKeys(currentLesson.video);
      await coursesLmsApi.updateLecture(courseIdLms, currentLesson.id, {
        title: currentLesson.title,
        video_key: video_key ?? null,
        video_provider: video_provider ?? null,
        duration: currentLesson.duration ?? null,
        resource_links: (currentLesson.resources ?? []).filter((r) => r.url).map((r) => r.url!),
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to save duration.", variant: "destructive" });
    }
  }, [currentLesson, resolveLmsCourseId, toast]);

  // Upload file as lecture resource (presigned S3), then add URL to resources and save
  const handleUploadLectureResource = useCallback(
    async (file: File): Promise<string | null> => {
      if (!selectedTenantId || !currentLesson) return null;
      const courseIdLms = await resolveLmsCourseId();
      if (!courseIdLms) {
        toast({ title: "Error", description: "Course not found.", variant: "destructive" });
        return null;
      }
      try {
        const publicUrl = await uploadApi.uploadLectureResource(file, {
          tenantId: selectedTenantId,
          courseId: courseIdLms,
          lessonId: currentLesson.id,
        });
        return publicUrl;
      } catch (e) {
        console.error(e);
        toast({ title: "Upload failed", description: "Could not upload file.", variant: "destructive" });
        return null;
      }
    },
    [selectedTenantId, currentLesson, resolveLmsCourseId, toast]
  );

  // Persist section title on blur
  const handleSectionTitleBlur = useCallback(
    async (sectionId: string) => {
      setEditingSectionTitle(null);
      const section = lmsData?.sections.find((s) => s.id === sectionId);
      if (!section) return;
      const courseIdLms = await resolveLmsCourseId();
      if (!courseIdLms) return;
      try {
        await coursesLmsApi.updateSection(courseIdLms, sectionId, { title: section.title });
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to save section title.", variant: "destructive" });
      }
    },
    [lmsData, resolveLmsCourseId, toast]
  );

  // Persist lesson title and lecture on blur
  const handleLessonTitleBlur = useCallback(async () => {
    setEditingLessonTitle(null);
    if (!currentLesson || !currentSectionId) return;
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) return;
    try {
      await coursesLmsApi.updateLesson(courseIdLms, currentLesson.id, { title: currentLesson.title });
      // Only LECTURE (video) lessons have a `course_lectures` row to sync. Content
      // (PDF/LINK/TEXT/IMAGE), assignment and quiz lessons have none, so calling
      // updateLecture would 404 ("Lecture not found") and surface a false "Failed
      // to save lesson" toast even though the title above already persisted.
      if (currentLesson.lectureId) {
        const { video_key, video_provider } = videoConfigToSyncKeys(currentLesson.video);
        const resource_links = (currentLesson.resources ?? []).filter((r) => r.url).map((r) => r.url!);
        await coursesLmsApi.updateLecture(courseIdLms, currentLesson.id, {
          title: currentLesson.title,
          video_key: video_key ?? null,
          video_provider: video_provider ?? null,
          duration: currentLesson.duration ?? null,
          resource_links,
        });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to save lesson.", variant: "destructive" });
    }
  }, [currentLesson, currentSectionId, resolveLmsCourseId, toast]);

  // Keep course_lessons.title in sync with assignment/quiz title.
  // Called from the assignment/quiz config modal after the assignment/quiz API save succeeds.
  // Note: course_lectures only exists for lesson.type === 'LECTURE'; assignment/quiz lessons
  // have no lecture row, so we deliberately skip updateLecture here.
  const syncLectureTitleFromModal = useCallback(async (title: string) => {
    if (!currentLessonId) return;
    const courseIdLms = await resolveLmsCourseId();
    if (!courseIdLms) return;
    try {
      await coursesLmsApi.updateLesson(courseIdLms, currentLessonId, { title });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to sync lesson title.", variant: "destructive" });
    }
  }, [currentLessonId, resolveLmsCourseId, toast]);

  // Persist settings when changed (template/settings panel)
  const handleSettingsChange = useCallback(
    async (settings: Partial<LMSSettings>) => {
      if (!lmsData) return;
      updateSettings(settings);
      const courseIdLms = await resolveLmsCourseId();
      if (!courseIdLms) return;
      try {
        await coursesLmsApi.updateCourse(courseIdLms, {
          lmsSettings: { ...lmsData.settings, ...settings },
        });
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
      }
    },
    [lmsData, resolveLmsCourseId, updateSettings, toast]
  );

  // Loading state
  if (isLoading || !lmsData) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  const settings = lmsData.settings || DEFAULT_LMS_SETTINGS;

  return (
    <div
      className="lms-editor-themed flex h-screen flex-col overflow-hidden bg-background"
    >
      {/* ════════════════════════════════════════
          FIXED TOP HEADER
         ════════════════════════════════════════ */}
      <header className="z-40 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-12 items-center justify-between px-3 sm:px-4">
          {/* Left: Back + Sidebar toggle + Title */}
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="sm" asChild className="h-8 shrink-0">
              <Link href={`/dashboard/courses/${courseId}/lms`}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </Button>

            <div className="hidden border-l pl-2 sm:block min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold truncate max-w-[200px]">{lmsData.course.title}</h1>
                <span className="shrink-0 text-xs font-medium text-primary">
                  Classic
                </span>
              </div>
              {isDirty && <span className="text-xs text-amber-500">Unsaved changes</span>}
            </div>
          </div>

          {/* Center: Editor Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-2.5 py-1.5">
              <Switch id="edit-mode" checked={isEditMode} onCheckedChange={toggleEditMode} />
              <Label htmlFor="edit-mode" className="cursor-pointer text-sm font-medium">
                {isEditMode ? "Edit" : "Preview"}
              </Label>
            </div>

            <Separator orientation="vertical" className="h-7" />

            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} title="Undo" className="h-8 w-8">
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} title="Redo" className="h-8 w-8">
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-7" />

            <Button
              variant={showSettings ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="gap-1.5"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(previewUrl, "_blank")}
              className="gap-1.5"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
          </div>

          {/* Right: Publish + Save + Right sidebar toggle */}
          <div className="flex items-center gap-2">
            <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-block ${
              isPublished
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}>
              {isPublished ? "Published" : "Draft"}
            </span>
            <Button
              variant={isPublished ? "outline" : "default"}
              size="sm"
              onClick={handleTogglePublish}
              disabled={isTogglingPublish}
              className="gap-1.5"
            >
              {isTogglingPublish ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              <span className="hidden sm:inline">{isPublished ? "Unpublish" : "Publish"}</span>
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || actionLoading === "save"}>
              {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save
            </Button>

            {/* Right sidebar toggle */}
            <button
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
              title={rightSidebarOpen ? "Close course content" : "Open course content"}
            >
              {rightSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════
          MAIN BODY (below header)
         ════════════════════════════════════════ */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ── CENTER: Scrollable video + content ── */}
        <main className="scrollbar-lms flex flex-1 flex-col overflow-y-auto">
          <div className={`min-h-full ${isEditMode ? "bg-muted/20" : "bg-background"}`}>
            {/* ===== VIDEO PLAYER AREA ===== */}
            <div
              className={
                isContentLessonType(currentLesson?.lessonType)
                  ? "w-full border-b bg-background"
                  : "group relative w-full overflow-hidden bg-black"
              }
              style={
                isContentLessonType(currentLesson?.lessonType)
                  ? undefined
                  : { aspectRatio: "16/9", maxHeight: "60vh" }
              }
            >
              {isContentLessonType(currentLesson?.lessonType) && currentLesson ? (
                // Content lessons (PDF/LINK/TEXT/IMAGE) render their editor (edit)
                // / preview (read-only) directly in the main panel slot, the same
                // slot video uses, instead of a placeholder + editor far below.
                <div className="px-4 py-5 sm:px-6 sm:py-6">
                  <ContentLessonPanel
                    key={currentLesson.id}
                    courseId={lmsCourseId}
                    lessonId={currentLesson.id}
                    type={currentLesson.lessonType as ContentLessonType}
                    onUploadFile={handleUploadLectureResource}
                    readOnly={!isEditMode}
                  />
                </div>
              ) : currentLesson?.lessonType === "assignment" ? (
                <div
                  className={`flex h-full flex-col items-center justify-center bg-slate-900 text-slate-300 ${isEditMode ? "cursor-pointer hover:bg-slate-800 transition-colors" : ""}`}
                  onClick={() => isEditMode && setShowAssignmentConfig(true)}
                >
                  <ClipboardList className="mb-3 h-14 w-14 text-slate-400" />
                  <p className="text-lg font-medium">Assignment</p>
                  {isEditMode && (
                    <p className="mt-1 text-sm text-slate-500">Click to configure title, instructions, PDF, and publish</p>
                  )}
                </div>
              ) : currentLesson?.lessonType === "quiz" ? (
                <div
                  className={`flex h-full flex-col items-center justify-center bg-slate-900 text-slate-300 ${isEditMode ? "cursor-pointer hover:bg-slate-800 transition-colors" : ""}`}
                  onClick={() => {
                    if (isEditMode && currentLesson?.quizId)
                      router.push(
                        `/dashboard/courses/${courseId}/lms/quizzes/${currentLesson.quizId}/editor`,
                      );
                  }}
                >
                  <ClipboardCheck className="mb-3 h-14 w-14 text-slate-400" />
                  <p className="text-lg font-medium">Quiz</p>
                  {isEditMode && (
                    <p className="mt-1 text-sm text-slate-500">Click to configure title, instructions, and publish</p>
                  )}
                </div>
              ) : currentLesson?.video ? (
                <LMSEditorVideoPreview
                  video={currentLesson.video}
                  isEditMode={isEditMode}
                  onEditClick={() => setShowVideoConfig(true)}
                />
              ) : isEditMode ? (
                // No video, edit mode: show inline video config
                <div className="flex h-full items-center justify-center p-6">
                  <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
                    <VideoConfigPanel
                      key={currentLessonId}
                      video={currentLesson?.video}
                      onChange={handleVideoChange}
                      compact
                    />
                  </div>
                </div>
              ) : (
                // No video, preview mode
                <div className="flex h-full flex-col items-center justify-center text-slate-400">
                  <Video className="mb-3 h-14 w-14" />
                  <p className="text-lg font-medium">No video added</p>
                </div>
              )}
            </div>

            <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 md:px-8">
              {/* ===== LESSON HEADER ===== */}
              <div className="mb-5">
                {currentLesson?.lessonType === "assignment" || currentLesson?.lessonType === "quiz" ? (
                  // Quiz/Assignment: title click opens config modal (single source of truth = assignment/quiz row)
                  <h2
                    className={`text-xl font-bold sm:text-2xl ${isEditMode ? "cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-muted/50" : ""}`}
                    onClick={() => {
                      if (!isEditMode) return;
                      if (currentLesson.lessonType === "assignment") setShowAssignmentConfig(true);
                      else if (currentLesson.quizId)
                        router.push(
                          `/dashboard/courses/${courseId}/lms/quizzes/${currentLesson.quizId}/editor`,
                        );
                    }}
                  >
                    {currentLesson?.title || <span className="text-muted-foreground/50">Click to configure...</span>}
                  </h2>
                ) : isEditMode && editingLessonTitle === currentLessonId ? (
                  <input
                    type="text"
                    value={currentLesson?.title || ""}
                    onChange={(e) => {
                      if (currentSectionId && currentLessonId) updateLesson(currentSectionId, currentLessonId, { title: e.target.value });
                    }}
                    onBlur={() => handleLessonTitleBlur()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") handleLessonTitleBlur(); }}
                    autoFocus
                    className="w-full border-b-2 border-primary bg-transparent text-xl font-bold outline-none sm:text-2xl"
                  />
                ) : (
                  <h2
                    className={`text-xl font-bold sm:text-2xl ${isEditMode ? "cursor-text rounded px-1 -mx-1 transition-colors hover:bg-muted/50" : ""}`}
                    onClick={() => isEditMode && setEditingLessonTitle(currentLessonId)}
                  >
                    {currentLesson?.title || <span className="text-muted-foreground/50">Click to add lesson title...</span>}
                  </h2>
                )}

                {/* Duration in seconds; set by the admin since linked videos are not probed. */}
                {currentLesson?.lessonType !== "assignment" &&
                  currentLesson?.lessonType !== "quiz" &&
                  !isContentLessonType(currentLesson?.lessonType) &&
                  (isEditMode ? (
                    <label className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      Duration (seconds)
                      <input
                        type="number"
                        min={0}
                        value={currentLesson?.duration ?? ""}
                        onChange={(e) => {
                          if (currentSectionId && currentLessonId) updateLesson(currentSectionId, currentLessonId, { duration: e.target.value || undefined });
                        }}
                        onBlur={() => void handleLessonDurationBlur()}
                        className="w-24 rounded border bg-background px-2 py-0.5 text-sm text-foreground"
                      />
                      {formatDuration(currentLesson?.duration) && <span>{formatDuration(currentLesson?.duration)}</span>}
                    </label>
                  ) : (
                    formatDuration(currentLesson?.duration) && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDuration(currentLesson?.duration)}
                      </p>
                    )
                  ))}
              </div>

              {/* ===== LESSON NAVIGATION (Prev/Next) ===== */}
              <div className="mb-5 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => previousLesson && navigateToLesson(previousLesson.id)}
                  disabled={!previousLesson}
                  className="gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <span className="text-xs text-muted-foreground sm:text-sm">
                  Lesson {currentLessonIndex + 1} of {allLessons.length}
                </span>
                <Button
                  size="sm"
                  onClick={() => nextLesson && navigateToLesson(nextLesson.id)}
                  disabled={!nextLesson}
                  className="gap-1.5"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* ===== TABS + CONTENT ===== Overview & QnA are video-only; the
                  whole strip is hidden when no tab applies (e.g. a content
                  lesson with ratings off). */}
              {lessonTabs.length > 0 && (
                <>
              <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
                {lessonTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* ===== TAB CONTENT ===== */}
              <div className="rounded-xl border bg-card p-5 sm:p-6">
                {/* Content lessons (PDF/LINK/TEXT/IMAGE) render their editor in the
                    main panel above, no Overview tab for them (see tab list). */}
                {activeTab === "overview" && !isContentLessonType(currentLesson?.lessonType) && (
                  <div className="space-y-6">
                    {/* Lesson Overview section */}
                    {(
                      <div className="mb-6">
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-primary underline underline-offset-8 flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            Lesson Overview
                          </h3>
                        </div>
                        {isEditMode ? (
                          <textarea
                            value={currentLesson?.description || ""}
                            onChange={(e) => {
                              if (currentSectionId && currentLessonId) updateLesson(currentSectionId, currentLessonId, { description: e.target.value });
                            }}
                            placeholder="Add a description for this lesson..."
                            className="w-full min-h-[150px] rounded-lg border bg-background p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                          />
                        ) : currentLesson?.description ? (
                          <div className="rounded-lg bg-muted/50 p-4">
                            <p className="whitespace-pre-wrap text-sm text-foreground/80">{currentLesson.description}</p>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-muted/50 p-4">
                            <p className="text-sm text-muted-foreground italic">
                              No description added yet.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resources, hidden for assignment/quiz lessons: structured resources are lesson-scoped, but these types manage their own attachments */}
                    {currentLesson?.lessonType !== "assignment" && currentLesson?.lessonType !== "quiz" && (
                    <div className="border-t pt-5">
                      <ResourceManager
                        courseId={lmsCourseId}
                        lessonId={currentLesson?.id ?? null}
                        legacyResources={currentLesson?.resources || []}
                        title={isEditMode ? "Lesson Resources" : "Resources"}
                        onUploadFile={handleUploadLectureResource}
                        readOnly={!isEditMode}
                      />
                    </div>
                    )}

                  </div>
                )}

                {activeTab === "ratings" && (
                  <div className="py-10 text-center">
                    <Star className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <h3 className="text-base font-semibold">Reviews</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">Students can rate and review the course here after publishing.</p>
                  </div>
                )}
              </div>
                </>
              )}
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR: Course Content (lesson navigation), fixed ── */}
        <aside
          className={`hidden lg:flex shrink-0 flex-col border-l bg-card/50 transition-all duration-300 overflow-hidden ${
            rightSidebarOpen ? "w-72 lg:w-80" : "w-0"
          }`}
        >
          {rightSidebarOpen && (
            <div className="flex h-full flex-col">
              <div className="shrink-0 p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Course Content</h3>
                  {isEditMode && (
                    <Button size="sm" variant="outline" onClick={handleAddSection} className="h-7 text-xs" disabled={actionLoading === "add-section" || actionLoading?.startsWith("add-lesson")}>
                      <Plus className="mr-1 h-3 w-3" />Section
                    </Button>
                  )}
                </div>
              </div>

              <div className="scrollbar-lms flex-1 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <SortableContext
                    items={lmsData.sections.map((s) => makeSectionDndId(s.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {lmsData.sections.map((section) => (
                        <SortableItemWrapper
                          key={section.id}
                          id={makeSectionDndId(section.id)}
                          disabled={!isEditMode}
                          data={{ type: "section", sectionId: section.id }}
                        >
                          {({ setNodeRef, style, attributes, listeners, isDragging }) => (
                            <div
                              ref={setNodeRef}
                              style={style}
                              className={cn(
                                "rounded-lg border bg-background transition-all",
                                hoveredSectionId === section.id && isEditMode && "ring-1 ring-primary/30",
                                isDragging && "shadow-lg ring-2 ring-primary/40"
                              )}
                              onMouseEnter={() => setHoveredSectionId(section.id)}
                              onMouseLeave={() => setHoveredSectionId(null)}
                            >
                              <div className="flex items-center gap-1.5 p-2.5 sm:p-3">
                                {isEditMode && (
                                  <DragHandle
                                    attributes={attributes}
                                    listeners={listeners}
                                    size="md"
                                    label={`Reorder section ${section.title}`}
                                  />
                                )}
                                <button onClick={() => toggleSectionExpand(section.id)} className="shrink-0 p-0.5">
                                  {expandedSections.has(section.id) ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </button>

                                {isEditMode && editingSectionTitle === section.id ? (
                                  <input
                                    type="text"
                                    value={section.title}
                                    onChange={(e) => { e.stopPropagation(); updateSection(section.id, { title: e.target.value }); }}
                                    onBlur={() => handleSectionTitleBlur(section.id)}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") handleSectionTitleBlur(section.id); }}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    className="flex-1 bg-transparent text-xs font-semibold outline-none sm:text-sm"
                                  />
                                ) : (
                                  <span
                                    className={cn(
                                      "flex-1 text-xs font-semibold sm:text-sm truncate",
                                      isEditMode ? "cursor-text hover:text-primary" : "cursor-pointer"
                                    )}
                                    onClick={(e) => {
                                      if (isEditMode) { e.stopPropagation(); setEditingSectionTitle(section.id); }
                                      else toggleSectionExpand(section.id);
                                    }}
                                  >
                                    {section.title}
                                  </span>
                                )}

                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {section.lessons.length}
                                </span>

                                {isEditMode && (
                                  <div className={cn(
                                    "flex items-center transition-opacity",
                                    hoveredSectionId === section.id ? "opacity-100" : "opacity-0"
                                  )}>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }} disabled={actionLoading === `delete-section:${section.id}`}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                )}
                              </div>

                              {expandedSections.has(section.id) && (
                                <div className="border-t px-1.5 pb-1.5 sm:px-2 sm:pb-2">
                                  <SortableContext
                                    items={section.lessons.map((l) => makeLessonDndId(l.id))}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {section.lessons.map((lesson) => (
                                      <SortableItemWrapper
                                        key={lesson.id}
                                        id={makeLessonDndId(lesson.id)}
                                        disabled={!isEditMode}
                                        data={{ type: "lesson", sectionId: section.id }}
                                      >
                                        {({ setNodeRef: setLessonRef, style: lessonStyle, attributes: lessonAttrs, listeners: lessonListeners, isDragging: lessonDragging }) => (
                                          <div
                                            ref={setLessonRef}
                                            style={lessonStyle}
                                            className={cn(
                                              "mt-0.5 flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer sm:text-sm",
                                              currentLessonId === lesson.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                              lessonDragging && "shadow-md ring-1 ring-primary/40 bg-card"
                                            )}
                                            onClick={() => navigateToLesson(lesson.id)}
                                            onMouseEnter={() => setHoveredLessonId(lesson.id)}
                                            onMouseLeave={() => setHoveredLessonId(null)}
                                          >
                                            {isEditMode && (
                                              <DragHandle
                                                attributes={lessonAttrs}
                                                listeners={lessonListeners}
                                                size="sm"
                                                label={`Reorder lesson ${lesson.title}`}
                                              />
                                            )}
                                            {lesson.lessonType === "assignment" ? (
                                              <ClipboardList className="h-3 w-3 shrink-0" />
                                            ) : lesson.lessonType === "quiz" ? (
                                              <ClipboardCheck className="h-3 w-3 shrink-0" />
                                            ) : lesson.lessonType === "PDF" ? (
                                              <FileText className="h-3 w-3 shrink-0" />
                                            ) : lesson.lessonType === "LINK" ? (
                                              <LinkIcon className="h-3 w-3 shrink-0" />
                                            ) : lesson.lessonType === "IMAGE" ? (
                                              <ImageIcon className="h-3 w-3 shrink-0" />
                                            ) : lesson.lessonType === "TEXT" ? (
                                              <AlignLeft className="h-3 w-3 shrink-0" />
                                            ) : lesson.video ? (
                                              <Play className="h-3 w-3 shrink-0" />
                                            ) : (
                                              <FileText className="h-3 w-3 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                              <span className="truncate">{lesson.title}</span>
                                            </div>
                                            {lesson.lessonType !== "assignment" && lesson.lessonType !== "quiz" && formatDuration(lesson.duration) ? (
                                              <span className="shrink-0 text-[10px] text-muted-foreground">{formatDuration(lesson.duration)}</span>
                                            ) : null}
                                            {isEditMode && hoveredLessonId === lesson.id && (
                                              <div className="flex items-center">
                                                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteLesson(section.id, lesson.id); }} disabled={actionLoading === `delete-lesson:${lesson.id}`}><Trash2 className="h-2.5 w-2.5" /></Button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </SortableItemWrapper>
                                    ))}
                                  </SortableContext>
                                  {/* Empty-section drop zone for cross-section drag */}
                                  {section.lessons.length === 0 && (
                                    <SectionDropZone sectionId={section.id} />
                                  )}
                                  {isEditMode && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-xs text-muted-foreground h-7" disabled={actionLoading === "add-section" || actionLoading?.startsWith("add-lesson")}>
                                          <Plus className="mr-1 h-3 w-3" />
                                          Add Lesson
                                          <ChevronDown className="ml-1 h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="start">
                                        <DropdownMenuItem onClick={() => handleAddLesson(section.id)}>
                                          <Video className="mr-2 h-3 w-3" />
                                          Add Video Lecture
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleAddAssignment(section.id)}>
                                          <ClipboardList className="mr-2 h-3 w-3" />
                                          Add Assignment
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleAddQuiz(section.id)}>
                                          <ClipboardCheck className="mr-2 h-3 w-3" />
                                          Add Quiz
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleAddContentLesson(section.id, "PDF")}>
                                          <FileText className="mr-2 h-3 w-3" />
                                          Add PDF
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleAddContentLesson(section.id, "LINK")}>
                                          <LinkIcon className="mr-2 h-3 w-3" />
                                          Add Embed Link
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleAddContentLesson(section.id, "TEXT")}>
                                          <AlignLeft className="mr-2 h-3 w-3" />
                                          Add Text
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleAddContentLesson(section.id, "IMAGE")}>
                                          <ImageIcon className="mr-2 h-3 w-3" />
                                          Add Image
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </SortableItemWrapper>
                      ))}

                      {lmsData.sections.length === 0 && (
                        <div className="py-6 text-center">
                          <p className="text-xs text-muted-foreground">No sections yet.</p>
                          {isEditMode && (
                            <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={handleAddSection} disabled={actionLoading === "add-section" || actionLoading?.startsWith("add-lesson")}>
                              <Plus className="mr-1 h-3 w-3" />Add First Section
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </SortableContext>

                  {/* Floating preview of whatever is being dragged */}
                  <DragOverlay dropAnimation={curriculumDropAnimation}>
                    {activeDragSection && (
                      <div className="rounded-lg border bg-card shadow-2xl ring-2 ring-primary/40 transition-transform">
                        <div className="flex items-center gap-1.5 p-2.5 sm:p-3">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex-1 text-xs font-semibold sm:text-sm truncate">
                            {activeDragSection.title}
                          </span>
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {activeDragSection.lessons.length}
                          </span>
                        </div>
                      </div>
                    )}
                    {activeDragLesson && (
                      <div className="flex items-center gap-1 rounded-md border bg-card px-2 py-1.5 text-xs shadow-2xl ring-1 ring-primary/40 sm:text-sm">
                        <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
                        {activeDragLesson.lessonType === "assignment" ? (
                          <ClipboardList className="h-3 w-3 shrink-0" />
                        ) : activeDragLesson.lessonType === "quiz" ? (
                          <ClipboardCheck className="h-3 w-3 shrink-0" />
                        ) : activeDragLesson.video ? (
                          <Play className="h-3 w-3 shrink-0" />
                        ) : (
                          <FileText className="h-3 w-3 shrink-0" />
                        )}
                        <span className="flex-1 truncate text-foreground">{activeDragLesson.title}</span>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          )}
        </aside>

        {/* ===== SETTINGS PANEL (slide-in overlay) ===== */}
        {showSettings && (
          <div className="absolute inset-0 z-20 bg-black/20" onClick={() => setShowSettings(false)} />
        )}
        <aside
          className={`absolute inset-y-0 left-0 z-30 w-80 transform border-r bg-background shadow-xl transition-transform duration-300 ease-in-out ${
            showSettings ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">LMS Settings</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="scrollbar-lms flex-1 overflow-y-auto p-4 space-y-4">
              <LMSSettingsPanel
                settings={settings}
                onChange={handleSettingsChange}
              />
            </div>
          </div>
        </aside>

      </div>

      {/* ===== VIDEO CONFIG DIALOG ===== */}
      <Dialog
        open={showVideoConfig}
        onOpenChange={setShowVideoConfig}
      >
        <DialogContent
          className="max-w-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Video Configuration</DialogTitle>
            <DialogDescription>
              Configure the video for &quot;{currentLesson?.title || "this lesson"}&quot;
            </DialogDescription>
          </DialogHeader>
          <VideoConfigPanel
            key={currentLessonId ?? undefined}
            video={currentLesson?.video}
            onChange={handleVideoChange}
            compact
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVideoConfig(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ASSIGNMENT CONFIG DIALOG ===== */}
      <Dialog
        open={showAssignmentConfig}
        onOpenChange={(open) => {
          setShowAssignmentConfig(open);
          if (!open) setAssignmentConfigTitle(null);
        }}
      >
        <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Assignment Configuration</DialogTitle>
            <DialogDescription>
              Configure &quot;{assignmentConfigTitle ?? currentLesson?.title ?? "this assignment"}&quot;
            </DialogDescription>
          </DialogHeader>
          {currentLesson?.assignmentId && lmsCourseId && (
            <AssignmentConfigPanel
              assignmentId={currentLesson.assignmentId}
              courseId={lmsCourseId}
              lessonTitle={currentLesson.title}
              onTitleChange={(title) => {
                if (currentSectionId && currentLessonId) {
                  updateLesson(currentSectionId, currentLessonId, { title });
                }
                setAssignmentConfigTitle(title);
                void syncLectureTitleFromModal(title);
              }}
              onAssignmentLoaded={(a) => setAssignmentConfigTitle(a.title)}
              compact
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentConfig(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
