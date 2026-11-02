"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, BookX, Lock, ArrowLeft } from "lucide-react";
import type {
  LMSCourseData,
  LMSLesson,
  LMSRating,
  LMSRatingSummary,
  LMSResource,
  ThemeConfig,
  TenantLayout,
  CourseLanguage,
} from "@open-mtlms/shared";
import { DEFAULT_LMS_SETTINGS } from "@open-mtlms/shared";
import {
  ClassicLMS,
  LMSProvider,
  LMSProgressProvider,
  type LMSVideoPlayback,
} from "@open-mtlms/lms-templates";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { AccessDenied } from "@/components/access-denied";
import { CourseLocked } from "@/components/course-locked";
import { FullPageQuiz } from "@/components/quiz/FullPageQuiz";
import { useToast } from "@/components/ui/use-toast";
import { apiGet, apiPost, ApiError } from "@/lib/api/api-client";
import { generateCertificate } from "@/lib/api/certificates";
import { decodeHtmlEntities } from "@/lib/utils";
import { getProgress, markLectureComplete, markLessonComplete, getCourseAnalytics, type UserCourseAnalytics } from "@/lib/api/progress";
import { useWatchTracker } from "@/hooks/use-watch-tracker";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import CourseVideoAnalytics from "@/components/analytics/CourseVideoAnalytics";

const ENROLLMENT_REQUIRED_MSG =
  "Enroll in this course to leave reviews and track your progress.";

/**
 * Resolve a lesson id to its lecture id (the backend's lectures.id). The
 * playback route is lecture-scoped; the video id itself is read server side.
 */
function findLectureIdByLessonId(
  sections: LMSCourseData["sections"] | undefined,
  lessonId: string
): string | null {
  if (!sections) return null;
  for (const section of sections) {
    for (const lesson of section.lessons) {
      if (lesson.id === lessonId) {
        return (lesson as { lectureId?: string }).lectureId ?? null;
      }
    }
  }
  return null;
}

// ------- ROUTE PARSING -------
function parseLearnSlugs(slugs: string[]): { courseSlug: string; lessonNum: number } {
  const lessonIndex = slugs.indexOf("lesson");
  if (lessonIndex >= 0 && lessonIndex < slugs.length - 1) {
    const courseSlug = slugs.slice(0, lessonIndex).join("/");
    const lessonNum = parseInt(slugs[lessonIndex + 1], 10) || 1;
    return { courseSlug, lessonNum };
  }
  return { courseSlug: slugs.join("/"), lessonNum: 1 };
}

// ------- API HELPERS -------

const API_URL = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL) || "http://localhost:5096/api/v1";


type FetchResult =
  | {
      lmsData: LMSCourseData;
      theme: ThemeConfig | null;
      layout: TenantLayout | null;
      hasAccess: boolean;
      /** Enrollment valid_till (ISO). Null = no course-level expiry to show. */
      accessExpiresAt: string | null;
      blockedBy?: BlockedBy;
    }
  | {
      error: "not_found" | "not_published" | "no_lms_data" | "network_error";
    };

/** SEQUENTIAL COURSES: set only when a prerequisite course is what's blocking. */
interface BlockedBy {
  id: string;
  title: string;
  slug: string;
  done: number;
  total: number;
}

/** Build video config from lecture (video_key + video_provider only; no video_url). */
function buildVideoFromLecture(
  lecture: Record<string, unknown> | null | undefined
): { provider: "youtube" | "evs" | "hls" | "mp4"; videoId: string } | undefined {
  const videoKey = lecture?.video_key as string | null | undefined;
  const videoProvider = lecture?.video_provider as string | null | undefined;
  if (!videoKey || !String(videoKey).trim()) return undefined;
  const key = String(videoKey).trim();
  const ytRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

  if (videoProvider === "YOUTUBE") {
    const ytMatch = key.match(ytRegex);
    return { provider: "youtube", videoId: ytMatch ? ytMatch[1] : key };
  }
  if (videoProvider === "EVS") return { provider: "evs", videoId: key };
  if (videoProvider === "HLS") return { provider: "hls", videoId: key };
  if (videoProvider === "MP4") return { provider: "mp4", videoId: key };
  // Fallback: detect from key
  const ytMatch = key.match(ytRegex);
  if (ytMatch) return { provider: "youtube", videoId: ytMatch[1] };
  if (/^[a-zA-Z0-9_-]{11}$/.test(key)) return { provider: "youtube", videoId: key };
  if (/^https?:\/\//i.test(key)) {
    return { provider: /\.m3u8(\?|$)/i.test(key) ? "hls" : "mp4", videoId: key };
  }
  return { provider: "evs", videoId: key };
}

// ------- LESSON RESOURCES -------

/** Per-lesson resource shape served by the learner-api course payload */
interface ServerLessonResource {
  id: string;
  type: "PDF" | "LINK" | "TEXT" | "IMAGE" | "GITHUB";
  title: string;
  url?: string | null;
  content?: string | null;
  downloadable: boolean;
  sort_order: number;
}

const SERVER_RESOURCE_TYPE_MAP: Record<string, string> = {
  PDF: "pdf",
  LINK: "link",
  TEXT: "text",
  IMAGE: "image",
  GITHUB: "github",
};

/** Map a server resource into the LMSResource shape consumed by the templates. */
function mapServerResource(
  res: ServerLessonResource,
  index: number
): LMSResource {
  return {
    id: res.id || `res-server-${index}`,
    title: res.title || res.url?.split("/").pop() || "Resource",
    // "image" is rendered by @open-mtlms/lms-templates; the @open-mtlms/shared
    // LMSResourceType union doesn't include it yet, hence the cast.
    type: (SERVER_RESOURCE_TYPE_MAP[res.type] ?? "link") as LMSResource["type"],
    url: res.url || undefined,
    content: res.content || undefined,
    order: res.sort_order ?? index,
    downloadable: !!res.downloadable,
  };
}

/**
 * Fetch the tenant layout from the homepage template API.
 */
async function fetchTenantLayout(): Promise<{ layout: TenantLayout | null; theme: ThemeConfig | null }> {
  try {
    const base = API_URL.replace(/\/$/, "");
    const response = await fetch(`${base}/template?slug=home`, {
      headers: {
        "X-Tenant-Host": typeof window !== "undefined" ? window.location.host : "",
      },
    });

    if (!response.ok) return { layout: null, theme: null };

    const json = await response.json();
    if (!json.success || !json.data) return { layout: null, theme: null };

    return {
      layout: json.data.layout || null,
      theme: json.data.theme || null,
    };
  } catch {
    return { layout: null, theme: null };
  }
}

/**
 * Fetch a published course's full LMS tree from the learner-api by slug.
 * Includes auth token when available so has_access is correct for enrolled users.
 */
async function fetchCoursePageBySlug(courseSlug: string): Promise<FetchResult> {
  try {
    const bareSlug = courseSlug.startsWith("courses/")
      ? courseSlug.slice("courses/".length)
      : courseSlug;

    const headers: Record<string, string> = {
      "X-Tenant-Host": typeof window !== "undefined" ? window.location.host : "",
    };
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("authToken") || localStorage.getItem("auth_token")
        : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `${API_URL}/courses/by-slug/${encodeURIComponent(bareSlug)}`,
      { headers }
    );

    if (!response.ok) {
      if (response.status === 404) return { error: "not_found" };
      return { error: "network_error" };
    }

    const json = await response.json();
    if (!json.success || !json.data) return { error: "not_found" };

    const {
      course,
      sections: rawSections,
      faqs,
      theme: pageTheme,
      lms_template_id,
      lms_settings,
      has_access: hasAccess = false,
      access_expires_at: accessExpiresAt = null,
      blocked_by: blockedBy,
    } = json.data;

    if (!rawSections || rawSections.length === 0) {
      return { error: "no_lms_data" };
    }

    const lmsSections = rawSections.map(
      (section: Record<string, unknown>) => {
        const lessonsArr = section.lessons as Array<{
          lesson: Record<string, unknown>;
          lecture: Record<string, unknown> | null;
          assignment?: {
            id: string;
            title: string;
            instructions: string | null;
            content_type: string;
            max_score: number;
            due_date: string | null;
            pdf_url: string | null;
          } | null;
          quiz?: {
            id: string;
            title: string;
            instructions: string | null;
            max_score: number;
            pass_percentage: number;
            due_date: string | null;
            question_count?: number;
          } | null;
          resources?: ServerLessonResource[];
        }>;

        return {
          id: section.id,
          title: section.title,
          order: section.sort_order ?? 0,
          lessons: (lessonsArr || []).map((item) => {
            const rawType = (item.lesson.type as string) || "LECTURE";
            const upperType = rawType.toUpperCase();
            const title = (item.lesson.title as string) || "";
            const isAssignmentByType = upperType === "ASSIGNMENT";
            const isAssignmentByTitle = /^assignment\s/i.test(title.trim());
            const isQuizByType = upperType === "QUIZ";
            // PDF / LINK / TEXT / IMAGE are standalone content lesson types: the
            // body is the lesson's single resource, rendered in the main area.
            const isContentType =
              upperType === "PDF" ||
              upperType === "LINK" ||
              upperType === "TEXT" ||
              upperType === "IMAGE";
            const lessonType = isQuizByType
              ? "QUIZ"
              : isAssignmentByType || isAssignmentByTitle
                ? "ASSIGNMENT"
                : isContentType
                  ? (upperType as "PDF" | "LINK" | "TEXT" | "IMAGE")
                  : "LECTURE";
            const assignment = item.assignment ?? null;
            const quiz = item.quiz ?? null;
            // Per-lesson rich resources served by the learner-api. They sit on
            // the lesson ITEM ({lesson, lecture, ..., resources}), not inside
            // the lesson row itself.
            const serverResources = (item.resources || []).map(
              mapServerResource
            );
            // Legacy fallback: old courses only expose lecture.resource_links
            const legacyLinkResources =
              serverResources.length > 0
                ? []
                : (
                    (item.lecture?.resource_links as string[] | undefined) ||
                    []
                  ).map((url: string, index: number) => ({
                    id: `res-${item.lesson.id}-${index}-${url.slice(-12)}`,
                    title: url.split("/").pop() || url,
                    type: "link" as const,
                    url,
                    order: index,
                    downloadable: false,
                  }));
            const lectureResources = [
              ...serverResources,
              ...legacyLinkResources,
            ];
            const pdfResource =
              assignment?.pdf_url && lessonType === "ASSIGNMENT"
                ? [
                    {
                      id: `res-${item.lesson.id}-assignment-pdf`,
                      title: "Assignment Attachment",
                      type: "pdf" as const,
                      url: assignment.pdf_url,
                      order: 0,
                      downloadable: true,
                    },
                  ]
                : [];
            const assignmentOrPlaceholder =
              assignment ??
              (lessonType === "ASSIGNMENT"
                ? {
                    id: "",
                    title: title,
                    instructions: null as string | null,
                    content_type: "TEXT" as const,
                    max_score: 0,
                    due_date: null as string | null,
                    pdf_url: null as string | null,
                  }
                : null);

            const quizOrPlaceholder =
              quiz ??
              (lessonType === "QUIZ"
                ? {
                    id: "",
                    title: title,
                    instructions: null as string | null,
                    max_score: 0,
                    pass_percentage: 0,
                    due_date: null as string | null,
                    question_count: 0,
                  }
                : null);

            // Content lessons (PDF/LINK/TEXT/IMAGE) carry their body in the
            // single lesson resource (resources[0]). Surface it on `content`
            // so the template renders it in the main lesson area.
            const bodyResource = (item.resources || [])[0];
            const content =
              isContentType && bodyResource
                ? {
                    type: lessonType as "PDF" | "LINK" | "TEXT" | "IMAGE",
                    url: bodyResource.url ?? null,
                    content: bodyResource.content ?? null,
                    downloadable: !!bodyResource.downloadable,
                    title: bodyResource.title || title || null,
                  }
                : undefined;

            return {
              id: item.lesson.id,
              title: item.lesson.title,
              order: item.lesson.sort_order ?? 0,
              duration: item.lecture?.duration || "",
              description: item.lecture?.summary || assignment?.instructions || quiz?.instructions || "",
              lectureId: (item.lecture as { id?: string } | null)?.id,
              lessonType: lessonType as
                | "LECTURE"
                | "ASSIGNMENT"
                | "QUIZ"
                | "PDF"
                | "LINK"
                | "TEXT"
                | "IMAGE",
              assignmentId: assignment?.id,
              assignment: lessonType === "ASSIGNMENT" ? assignmentOrPlaceholder : undefined,
              quizId: quiz?.id,
              quiz: lessonType === "QUIZ" ? quizOrPlaceholder : undefined,
              resources: [...pdfResource, ...lectureResources],
              content,
              video: lessonType === "LECTURE" ? buildVideoFromLecture(item.lecture) : undefined,
            };
          }),
          resources: [],
        };
      }
    );

    const rawValidityDays = (course as { validity_days?: number | null }).validity_days;
    const fullLmsData: LMSCourseData = {
      course: {
        id: course.id,
        title: course.title,
        subTitle: course.subtitle || "",
        slug: course.slug,
        description: course.description || "",
        duration: course.duration || "",
        mode: course.mode || "SELF_PACED",
        type: "NORMAL",
        difficulty: (course.difficulty as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "NONE") || "NONE",
        purchaseMode: course.purchase_mode || "PAID",
        status: "PUBLISHED",
        validityDays: rawValidityDays === undefined ? 365 : rawValidityDays,
        language: ((course.language as string[] | undefined)?.[0] || "English") as CourseLanguage,
        weight: 0,
        isYoungCourse: false,
        individualPricing: false,
        webPriceINR: Number(course.price_inr) || 0,
        mobilePriceINR: 0,
        webPriceUSD: Number(course.price_usd) || 0,
        mobilePriceUSD: 0,
        webDiscount: Number(course.discount_inr) || 0,
        mobileDiscount: 0,
        webThumbnailUrl: course.thumbnail_url || "",
        mobileThumbnailUrl: "",
        previewUrl: course.preview_url || "",
        learningOutcomes: course.learning_outcomes || [],
        prerequisites: course.prerequisites || [],
        sections: [],
        offerings: [],
        faqs: (faqs || []).map(
          (f: Record<string, unknown>) => ({
            question: f.question,
            answer: f.answer,
          })
        ),
        recommendations: [],
        instructorIds: [],
        categoryIds: [],
        theme: null as unknown as LMSCourseData["course"]["theme"],
      },
      sections: lmsSections,
      templateId: lms_template_id || "classic",
      // Bare settings only. The course-scoped OTP / posters / status
      // closures are layered on inside the React component (so they can
      // dispatch setHasAccess(false) on a 403 and look up lectureId by
      // videoId without dragging React state into this helper).
      // Merge the course's lms_settings OVER the defaults, never replace them.
      // lms_settings is a partial column (it may hold only syllabusAutoSync /
      // requiredWatchPercent), so replacing dropped enableCertificate et al. to
      // undefined, which hid the "Get Certificate" button at 100% completion.
      settings: {
        // Merge under defaults so settings added after a course was saved
        // are defined for older courses too.
        ...DEFAULT_LMS_SETTINGS,
        ...(lms_settings || {}),
      },
    };


    return {
      lmsData: fullLmsData,
      theme: (pageTheme as ThemeConfig) || null,
      layout: null, // Layout comes from fetchTenantLayout
        hasAccess: !!hasAccess,
      accessExpiresAt: typeof accessExpiresAt === "string" ? accessExpiresAt : null,
      blockedBy: blockedBy as BlockedBy | undefined,
    };
  } catch (error) {
    console.error("[learn] Error fetching course:", error);
    return { error: "network_error" };
  }
}


// ------- ERROR STATE TYPE -------
type ErrorState = "not_found" | "not_published" | "no_lms_data" | "network_error" | null;

// ------- MAIN COMPONENT -------

export default function LearnPage() {
  const params = useParams();
  const router = useRouter();
  const { member } = useUserAuthStore();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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

  const rawSlugs = params.slugs as string[];
  const { courseSlug, lessonNum } = useMemo(() => parseLearnSlugs(rawSlugs), [rawSlugs]);
  // Optional `?lectureId=<X>` deep-link target. The batch calendar
  // primarily routes via the LMS-native `/learn/{slug}/lesson/{N}`
  // (server-computed position), but if `lessonPosition` was missing
  // from the calendar payload (e.g. the session's lecture was orphaned
  // by a regen) the calendar falls back to this query param. Matches
  // `lessons[i].lectureId`; if no match, the resolver falls through to
  // the URL's positional segment.
  const searchParams = useSearchParams();
  const lectureIdParam = searchParams?.get("lectureId") ?? null;

  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<ErrorState>(null);
  const [courseData, setCourseData] = useState<LMSCourseData | null>(null);
  const [courseTheme, setCourseTheme] = useState<ThemeConfig | null>(null);
  const [tenantLayout, setTenantLayout] = useState<TenantLayout | null>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);
  const [blockedBy, setBlockedBy] = useState<BlockedBy | undefined>();
  // True while a 403 re-check is still deciding "locked vs revoked". Holds the
  // access gate on the loader so it never flashes <AccessDenied> (which starts a
  // redirect-to-sales countdown) before blockedBy arrives and CourseLocked wins.
  const [resolvingAccess, setResolvingAccess] = useState(false);
  // progress = saved resume position, watched = furthest point reached (both
  // seconds, as the server had them when the page loaded).
  const [lessonProgress, setLessonProgress] = useState<
    Record<string, { completed: boolean; progress?: number; watched?: number }>
  >({});
  const [ratings, setRatings] = useState<LMSRating[]>([]);
  const [ratingSummary, setRatingSummary] = useState<LMSRatingSummary | undefined>();
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);
  const [userAnalytics, setUserAnalytics] = useState<UserCourseAnalytics | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const analyticsLoadedRef = useRef(false);
  const [assignmentOverrides, setAssignmentOverrides] = useState<
    Record<string, { id: string; title: string; instructions: string | null; content_type: string; max_score: number; due_date: string | null; pdf_url: string | null }>
  >({});
  const [quizOverrides, setQuizOverrides] = useState<
    Record<string, { id: string; title: string; instructions: string | null; max_score: number; pass_percentage: number; due_date: string | null; question_count?: number }>
  >({});

  // Fallback: fetch assignment for ASSIGNMENT lessons when course API didn't return it (e.g. learner-api not restarted)
  useEffect(() => {
    if (!courseData || !hasAccess || !courseData.course.id) return;
    const allLessons = courseData.sections.flatMap((s) => s.lessons);
    const toFetch = allLessons.filter((l) => {
      const lt = (l as { lessonType?: string }).lessonType;
      const a = (l as { assignment?: { id?: string } | null }).assignment;
      return lt === "ASSIGNMENT" && (!a || !a.id);
    });
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const lesson of toFetch) {
        if (cancelled) return;
        try {
          const courseId = courseData.course.id;
          if (!courseId || !lesson.id) continue;
          const list = await apiGet<Array<{ id: string }>>(
            `/assignments?course_id=${encodeURIComponent(courseId)}&lesson_id=${encodeURIComponent(lesson.id)}`
          );
          if (Array.isArray(list) && list.length > 0 && list[0]) {
            const detail = await apiGet<{
              id: string;
              title: string;
              instructions: string | null;
              content_type: string;
              max_score: number;
              due_date: string | null;
              pdf_url?: string | null;
            }>(`/assignments/${list[0].id}`);
            if (!cancelled && detail) {
              setAssignmentOverrides((prev) => ({
                ...prev,
                [lesson.id]: {
                  id: detail.id,
                  title: detail.title,
                  instructions: detail.instructions,
                  content_type: detail.content_type,
                  max_score: detail.max_score,
                  due_date: detail.due_date,
                  pdf_url: detail.pdf_url ?? null,
                },
              }));
            }
          }
        } catch {
          /* ignore */
        }
      }
    })();
    return () => { cancelled = true; };
  }, [courseData, hasAccess]);

  // Fallback: fetch quiz for QUIZ lessons when course API didn't return it
  useEffect(() => {
    if (!courseData || !hasAccess || !courseData.course.id) return;
    const allLessons = courseData.sections.flatMap((s) => s.lessons);
    const toFetch = allLessons.filter((l) => {
      const lt = (l as { lessonType?: string }).lessonType;
      const q = (l as { quiz?: { id?: string } | null }).quiz;
      return (lt === "QUIZ" || lt === "quiz") && (!q || !q.id);
    });
    if (toFetch.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const lesson of toFetch) {
        if (cancelled) return;
        try {
          const courseId = courseData.course.id;
          if (!courseId || !lesson.id) continue;
          const list = await apiGet<Array<{ id: string; title: string; instructions: string | null; max_score: number; pass_percentage: number; due_date: string | null; question_count?: number }>>(
            `/quizzes?course_id=${encodeURIComponent(courseId)}&lesson_id=${encodeURIComponent(lesson.id)}`
          );
          if (Array.isArray(list) && list.length > 0 && list[0]) {
            if (!cancelled) {
              setQuizOverrides((prev) => ({
                ...prev,
                [lesson.id]: {
                  id: list[0].id,
                  title: list[0].title,
                  instructions: list[0].instructions,
                  max_score: list[0].max_score,
                  pass_percentage: list[0].pass_percentage,
                  due_date: list[0].due_date,
                  question_count: list[0].question_count,
                },
              }));
            }
          }
        } catch {
          /* ignore */
        }
      }
    })();
    return () => { cancelled = true; };
  }, [courseData, hasAccess]);

  // Load course data + tenant layout only when course changes (not when lesson changes)
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setErrorState(null);
      setCourseData(null);

      try {
        // Fetch course data and tenant layout in parallel
        const [courseResult, layoutResult] = await Promise.all([
          fetchCoursePageBySlug(courseSlug),
          fetchTenantLayout(),
        ]);

        // Set tenant layout & theme (from homepage)
        setTenantLayout(layoutResult.layout);

        if ("error" in courseResult) {
          setErrorState(courseResult.error);
          // Still set theme from layout for error pages
          if (layoutResult.theme) setCourseTheme(layoutResult.theme);
          return;
        }

        const {
          lmsData,
          theme,
          hasAccess: fetchedHasAccess,
          accessExpiresAt: fetchedAccessExpiresAt,
          blockedBy: fetchedBlockedBy,
        } = courseResult;
        const courseId = lmsData.course.id;
        setCourseData(lmsData);
        setHasAccess(fetchedHasAccess);
        setAccessExpiresAt(fetchedAccessExpiresAt);
        setBlockedBy(fetchedBlockedBy);
        // Use course-specific theme if available, else homepage theme
        setCourseTheme(theme || layoutResult.theme);
        // currentLessonId is set by the sync effect below when courseData is ready

        // Load progress: from API when enrolled, else from localStorage
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("authToken") || localStorage.getItem("auth_token")
            : null;
        if (fetchedHasAccess && token && courseId) {
          try {
            const { progress } = await getProgress(courseId);
            // The server keys progress rows by lecture_id for videos,
            // assignment_id for assignments and quiz_id for quizzes, map all
            // three back to lesson ids or assignment/quiz completions are
            // dropped on reload (locks reappear in sequential courses).
            const lectureToLesson = new Map<string, string>();
            for (const section of lmsData.sections) {
              for (const lesson of section.lessons) {
                const l = lesson as {
                  lectureId?: string;
                  assignmentId?: string;
                  quizId?: string;
                  lessonType?: string;
                };
                if (l.lectureId) lectureToLesson.set(l.lectureId, lesson.id);
                if (l.assignmentId) lectureToLesson.set(l.assignmentId, lesson.id);
                if (l.quizId) lectureToLesson.set(l.quizId, lesson.id);
                // Content lessons surface progress keyed by their own lesson id
                // (server sends lecture_id = lesson_id), so map id → id.
                if (
                  l.lessonType === "PDF" ||
                  l.lessonType === "LINK" ||
                  l.lessonType === "TEXT" ||
                  l.lessonType === "IMAGE"
                ) {
                  lectureToLesson.set(lesson.id, lesson.id);
                }
              }
            }
            const next: Record<string, { completed: boolean; progress?: number }> = {};
            for (const p of progress) {
              const lessonId = lectureToLesson.get(p.lecture_id);
              if (!lessonId) continue;
              const entry: { completed: boolean; progress?: number; watched?: number } = {
                completed: !!p.completed,
              };
              if (p.last_position_seconds && p.last_position_seconds > 0) {
                entry.progress = p.last_position_seconds;
              }
              if (p.watched_duration && p.watched_duration > 0) {
                entry.watched = p.watched_duration;
              }
              next[lessonId] = entry;
            }
            setLessonProgress(next);
          } catch {
            const stored = localStorage.getItem(`lms-progress-${courseSlug}`);
            if (stored) {
              try {
                setLessonProgress(JSON.parse(stored));
              } catch {
                /* ignore */
              }
            }
          }
        } else {
          const storedProgress = localStorage.getItem(`lms-progress-${courseSlug}`);
          if (storedProgress) {
            try {
              setLessonProgress(JSON.parse(storedProgress));
            } catch {
              /* ignore */
            }
          }
        }

        // Load reviews for this course
        try {
          const data = await apiGet<{ reviews?: Array<{ id: string; tenant_member_id: string; member_name: string | null; member_avatar_url: string | null; rating: number; review_text: string | null; created_at: string }>; summary?: { average?: number; count?: number } }>(`/courses/${courseId}/reviews`);
          const list = (data.reviews || []).map((r) => ({
            id: r.id,
            userId: r.tenant_member_id,
            userName: r.member_name || "User",
            userAvatar: r.member_avatar_url || undefined,
            rating: r.rating,
            review: r.review_text ?? undefined,
            createdAt: r.created_at,
          }));
          setRatings(list);
          const sum = data.summary || {};
          const dist = (data.reviews || []).reduce((acc: { 1: number; 2: number; 3: number; 4: number; 5: number }, r: { rating: number }) => {
            const k = Math.min(5, Math.max(1, r.rating)) as 1 | 2 | 3 | 4 | 5;
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as { 1: number; 2: number; 3: number; 4: number; 5: number });
          setRatingSummary({
            averageRating: sum.average ?? 0,
            totalRatings: sum.count ?? 0,
            ratingDistribution: dist,
          });
        } catch {
          /* ignore reviews load */
        }

      } catch (error) {
        console.error("Failed to load course:", error);
        setErrorState("network_error");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [courseSlug]); // Only refetch when course changes; lesson changes are handled below

  // Resolve which lesson should be active when the curriculum becomes
  // available. Single effect (rather than two) so the lesson is set exactly
  // once per mount, no flash of lesson 1 before jumping to a deep-link
  // target.
  //
  // Priority:
  //   1. `?lectureId=…` deep-link (used by batch calendar entries). When it
  //      matches a lesson we silently replace the URL with the canonical
  //      `/learn/:slug/lesson/:N` form so refresh and the popstate handler
  //      below stay consistent, `replaceState` doesn't fire a Next.js
  //      navigation, so `useSearchParams` keeps the original value but the
  //      browser shows the clean URL.
  //   2. The path's `lesson/:N` positional index.
  //   3. First lesson as a fallback.
  useEffect(() => {
    if (!courseData) return;
    const allLessons = courseData.sections.flatMap((s) => s.lessons);
    if (allLessons.length === 0) return;

    // Try the `?lectureId` deep-link first. The batch calendar's
    // primary deep-link is now positional (`/learn/{slug}/lesson/{N}`),
    // so this branch only fires when the calendar payload lacked
    // `lessonPosition`, the fallback path. On success we replace the
    // URL with the canonical `/lesson/N` form so refreshes + the
    // popstate handler stay consistent.
    if (lectureIdParam) {
      const idx = allLessons.findIndex(
        (l) => (l as { lectureId?: string }).lectureId === lectureIdParam
      );
      if (idx >= 0) {
        setCurrentLessonId(allLessons[idx].id);
        if (typeof window !== "undefined") {
          window.history.replaceState(
            null,
            "",
            `/learn/${courseSlug}/lesson/${idx + 1}`
          );
        }
        return;
      }
    }

    // No lectureId match, use the URL's positional segment. Without
    // `/lesson/N` the default is lesson 1.
    const positional = lessonNum - 1;
    setCurrentLessonId(
      positional >= 0 && positional < allLessons.length
        ? allLessons[positional].id
        : allLessons[0].id
    );
  }, [courseData, lectureIdParam, lessonNum, courseSlug]);

  // Handle browser back/forward (popstate) - parse URL and sync lesson
  useEffect(() => {
    if (!courseData) return;
    const handlePopState = () => {
      const pathParts = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean) : [];
      const slugs = pathParts.slice(1);
      const { lessonNum: num } = parseLearnSlugs(slugs);
      const allLessons = courseData.sections.flatMap((s) => s.lessons);
      const idx = num - 1;
      if (idx >= 0 && idx < allLessons.length) {
        setCurrentLessonId(allLessons[idx].id);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [courseData]);

  // Derived data
  const { currentLesson, currentSection, previousLesson, nextLesson, allLessons } = useMemo(() => {
    if (!courseData || !currentLessonId) {
      return {
        currentLesson: null,
        currentSection: null,
        previousLesson: null,
        nextLesson: null,
        allLessons: [],
      };
    }
    const allLessons = courseData.sections.flatMap((s) => s.lessons);
    const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);
    let currentLesson = allLessons[currentIndex] || null;
    // Merge assignment override when course API didn't return it (or returned placeholder)
    if (currentLesson && (currentLesson as { lessonType?: string }).lessonType === "ASSIGNMENT") {
      const override = assignmentOverrides[currentLesson.id];
      const existing = (currentLesson as { assignment?: { id?: string } | null }).assignment;
      if (override && (!existing || !existing.id)) {
        currentLesson = { ...currentLesson, assignment: override };
      }
    }
    // Merge quiz override when course API didn't return it (or returned placeholder)
    if (currentLesson && ((currentLesson as { lessonType?: string }).lessonType === "QUIZ" || (currentLesson as { lessonType?: string }).lessonType === "quiz")) {
      const override = quizOverrides[currentLesson.id];
      const existing = (currentLesson as { quiz?: { id?: string } | null }).quiz;
      if (override && (!existing || !existing.id)) {
        currentLesson = { ...currentLesson, quizId: override.id, quiz: override };
      }
    }
    let currentSection = null;
    for (const section of courseData.sections) {
      if (section.lessons.some((l) => l.id === currentLessonId)) {
        currentSection = section;
        break;
      }
    }
    return {
      currentLesson,
      currentSection,
      previousLesson: currentIndex > 0 ? allLessons[currentIndex - 1] : null,
      nextLesson: currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null,
      allLessons,
    };
  }, [courseData, currentLessonId, assignmentOverrides, quizOverrides]);

  const overallProgress = useMemo(() => {
    if (!allLessons.length) return 0;
    const completed = Object.values(lessonProgress).filter((p) => p.completed).length;
    return Math.round((completed / allLessons.length) * 100);
  }, [allLessons, lessonProgress]);

  const userRating = useMemo(
    () => (member ? ratings.find((r) => r.userId === member.id) ?? null : null),
    [ratings, member]
  );

  // Resume: stamp `startTime` (where the player seeks on mount) and
  // `furthestWatched` (how far a sequential course lets the learner skip ahead)
  // into the lesson's video config.
  //
  // Both are worked out when the learner enters a lesson, from where they
  // actually got to in it during this page visit, else the server's saved
  // values, and then held for the visit, so re-renders during playback never
  // yank the learner back. They are worked out once more if the saved progress
  // arrives after the lesson was entered (the course renders before progress
  // loads), but only while nothing has played yet. Before this, the first
  // lesson of every page load locked in "no resume" before progress arrived,
  // so coming back to a video always started it at 0, and a sequential course
  // then blocked skipping back to where the learner was.
  //
  // These MUST live above any conditional `return` below or React throws
  // "Rendered more hooks than during the previous render" when error /
  // access-denied / loading branches short-circuit the render.
  const livePositionsRef = useRef<Record<string, { position: number; furthest: number }>>({});
  const resumeVisitRef = useRef<{
    lessonId: string | null;
    played: boolean;
    hadSaved: boolean;
    startTime?: number;
    furthest: number;
  }>({ lessonId: null, played: false, hadSaved: false, furthest: 0 });
  const currentLessonWithResume = useMemo(() => {
    if (!currentLesson) return currentLesson;
    const lessonId = currentLesson.id;
    if (!lessonId) return currentLesson;
    const visit = resumeVisitRef.current;
    const entering = visit.lessonId !== lessonId;
    const lectureId = (currentLesson as { lectureId?: string }).lectureId;
    const lessonAny = currentLesson as {
      video?: { startTime?: number; duration?: number; furthestWatched?: number };
    } & typeof currentLesson;
    if (!lectureId || !lessonAny.video) {
      // Still a new visit: coming back to a video after a quiz or reading
      // lesson must work its resume out again, not reuse the old visit's.
      if (entering) {
        resumeVisitRef.current = { lessonId, played: false, hadSaved: false, furthest: 0 };
      }
      return currentLesson;
    }

    const saved = lessonProgress[lessonId];
    if (entering || (!visit.played && !visit.hadSaved && saved)) {
      const live = livePositionsRef.current[lessonId];
      const resumeAt = live?.position ?? saved?.progress ?? 0;
      const duration = lessonAny.video.duration ?? 0;
      // Only seek when resume is meaningful: between 5s and (duration - 10s).
      const wantsSeek =
        resumeAt >= 5 && (duration === 0 || resumeAt <= duration - 10);
      resumeVisitRef.current = {
        lessonId,
        played: entering ? false : visit.played,
        hadSaved: Boolean(saved),
        startTime: wantsSeek ? Math.floor(resumeAt) : undefined,
        furthest: Math.floor(
          Math.max(live?.furthest ?? 0, saved?.watched ?? 0, saved?.progress ?? 0, resumeAt)
        ),
      };
    }

    const { startTime, furthest } = resumeVisitRef.current;
    if (startTime === undefined && furthest <= 0) return currentLesson;
    return {
      ...currentLesson,
      video: {
        ...lessonAny.video,
        ...(startTime !== undefined ? { startTime } : {}),
        ...(furthest > 0 ? { furthestWatched: furthest } : {}),
      },
    };
  }, [currentLesson, lessonProgress]);

  const handleLessonChange = useCallback(
    (lesson: LMSLesson) => {
      setCurrentLessonId(lesson.id);
      const lessonIndex = allLessons.findIndex((l) => l.id === lesson.id) + 1;
      const newUrl = `/learn/${courseSlug}/lesson/${lessonIndex}`;
      window.history.pushState(null, "", newUrl);
    },
    [courseSlug, allLessons]
  );

  const handleMarkComplete = useCallback(
    async (lessonId?: string) => {
      const targetLessonId = lessonId ?? currentLessonId;
      if (!targetLessonId || !courseData?.course?.id) return;
      const targetLesson = allLessons.find((l) => l.id === targetLessonId);
      const lectureId = (targetLesson as { lectureId?: string } | undefined)?.lectureId;
      const lessonType = (targetLesson as { lessonType?: string } | undefined)?.lessonType;
      // Content lessons (PDF/LINK/TEXT/IMAGE) have no lectureId, they persist
      // completion through a lesson-scoped endpoint instead of the lecture path.
      const isContentLesson =
        lessonType === "PDF" ||
        lessonType === "LINK" ||
        lessonType === "TEXT" ||
        lessonType === "IMAGE";
      const isCurrentlyCompleted = lessonProgress[targetLessonId]?.completed ?? false;
      const newCompleted = !isCurrentlyCompleted;
      const newProgress = {
        ...lessonProgress,
        [targetLessonId]: { ...lessonProgress[targetLessonId], completed: newCompleted },
      };
      setLessonProgress(newProgress);
      localStorage.setItem(`lms-progress-${courseSlug}`, JSON.stringify(newProgress));
      if (hasAccess && member && (isContentLesson || lectureId)) {
        // watched_duration is now tracked by the heartbeat-based useWatchTracker;
        // mark-complete only flips the boolean.
        try {
          if (isContentLesson) {
            await markLessonComplete(
              courseData.course.id,
              targetLessonId,
              newCompleted
            );
          } else if (lectureId) {
            await markLectureComplete(
              courseData.course.id,
              lectureId,
              newCompleted
            );
          }
        } catch (err) {
          setLessonProgress(lessonProgress);
          localStorage.setItem(`lms-progress-${courseSlug}`, JSON.stringify(lessonProgress));
          const status = (err as import("@/lib/api/api-client").ApiError).status;
          if (status === 403) {
            toast({ title: "Enrollment required", description: ENROLLMENT_REQUIRED_MSG, variant: "destructive" });
          }
          throw err;
        }
      }
    },
    [
      currentLessonId,
      allLessons,
      lessonProgress,
      courseSlug,
      courseData?.course?.id,
      hasAccess,
      member,
      toast,
    ]
  );

  // ------- WATCH TRACKING -------
  // Wire the watch-session tracker to the player's onProgress / onEnded events.
  // The tracker handles heartbeat batching, resume position, drop-off telemetry,
  // and end-of-session cleanup. Local lesson-progress UI state still flips via
  // handleMarkComplete; the tracker complements it (auto-complete @90% watched).
  const trackerLectureId = (currentLesson as { lectureId?: string } | null)?.lectureId ?? null;
  const trackerCourseId = courseData?.course?.id ?? null;
  const trackerEnabled = Boolean(hasAccess && member && trackerLectureId && trackerCourseId);
  // Auto-complete must flip lessonProgress by lessonId, not lectureId.
  // lessonProgress is keyed by lesson.id everywhere else (overall % counter,
  // resume lookup, mark-complete button). Resolve the lesson for the lecture
  // the tracker reports, NOT the one playing now: the end-of-video response
  // lands after autoplay has moved on, and reading the current lecture ticked
  // the next lesson instead of the one just finished (until a refresh).
  const handleAutoCompleted = useCallback(
    (completedLectureId: string) => {
      const lesson = allLessons.find(
        (l) => (l as { lectureId?: string }).lectureId === completedLectureId
      );
      const targetLessonId = lesson?.id;
      if (!targetLessonId) return;
      setLessonProgress((prev) => {
        if (prev[targetLessonId]?.completed) return prev;
        return { ...prev, [targetLessonId]: { ...prev[targetLessonId], completed: true } };
      });
    },
    [allLessons]
  );
  const watchTracker = useWatchTracker({
    courseId: trackerCourseId,
    lectureId: trackerLectureId,
    enabled: trackerEnabled,
    onCompleted: handleAutoCompleted,
  });

  const handleVideoProgress = useCallback(
    (currentTime: number, duration: number) => {
      watchTracker.onProgress(currentTime, duration);

      // Remember where the learner is in this video for the rest of the page
      // visit, so going to another lesson and back resumes here.
      const lessonId = currentLessonId;
      if (!lessonId || !Number.isFinite(currentTime) || currentTime < 0) return;
      const visit = resumeVisitRef.current;
      const seed = visit.lessonId === lessonId ? Math.max(visit.furthest, visit.startTime ?? 0) : 0;
      if (visit.lessonId === lessonId) visit.played = true;
      const prev = livePositionsRef.current[lessonId];
      const reached = Math.max(prev?.furthest ?? 0, seed);
      // The furthest point only advances by playing. A jump far past it (a skip
      // the sequential lock is about to snap back) must not become the new
      // ceiling the next time this video opens.
      const natural = currentTime <= Math.max(reached, prev?.position ?? 0) + 5;
      livePositionsRef.current[lessonId] = {
        position: currentTime,
        furthest: natural ? Math.max(reached, currentTime) : reached,
      };
    },
    [watchTracker, currentLessonId]
  );

  // Sequential course: a locked lesson was tapped (sidebar or Next). Say why,
  // instead of a tap that does nothing and reads as "the quiz won't open".
  const handleLockedLessonClick = useCallback(
    (_lesson: LMSLesson, blockingLesson: LMSLesson | null) => {
      const blockingTitle = blockingLesson ? decodeHtmlEntities(blockingLesson.title) : "";
      toast({
        title: "This lesson is locked",
        description: blockingTitle
          ? `Finish "${blockingTitle}" to unlock it. Lessons in this course open in order.`
          : "Finish the previous lesson to unlock it. Lessons in this course open in order.",
      });
    },
    [toast]
  );

  const handleVideoEnded = useCallback(() => {
    watchTracker.onEnded();
    if (!courseData?.settings.autoPlayNext || !nextLesson) return;
    // Respect sequential progress: only auto-advance if the current lesson is
    // already completed (watch tracker auto-completes at 90%, so reaching
    // video-end almost always satisfies this in practice).
    if (
      courseData.settings.requireSequential &&
      currentLessonId &&
      !lessonProgress[currentLessonId]?.completed
    ) {
      return;
    }
    handleLessonChange(nextLesson);
  }, [courseData, nextLesson, handleLessonChange, watchTracker, currentLessonId, lessonProgress]);

  const courseId = courseData?.course?.id;

  // Mark access revoked when any course-scoped player API returns 403.
  // Ref-stored so we can use it inside closures the template captures
  // long-term (settings.getVideoPlayback) without forcing the template
  // to re-render every time hasAccess flips.
  const handleAccessRevoked = useCallback(() => {
    setHasAccess(false);
    // A 403 from a player API tells us access is gone, but not WHY. Now that a
    // prerequisite-locked course also 403s (the lock is enforced in
    // ensureEnrolled, which every content call goes through), "revoked" and
    // "locked" arrive here looking identical, and they need different screens.
    // Ask the server which it is rather than guessing.
    //
    // Do NOT clear blockedBy up front. If we already know this course is
    // prerequisite-locked (the initial load set it), blanking it here would drop
    // the gate to <AccessDenied> for the render between now and the re-check
    // returning, a visible flash of the wrong screen, mid-redirect-countdown.
    // Instead mark access as "resolving" so the gate holds on the loader until
    // the server answers.
    if (!courseId) return;
    setResolvingAccess(true);
    apiGet<{ has_access: boolean; blocked_by?: BlockedBy }>(
      `/courses/${courseId}/access-status`
    )
      .then((data) => {
        if (!data.has_access) setBlockedBy(data.blocked_by);
      })
      .catch(() => {
        // Couldn't reach the server. Fall back to whatever we already knew.
        // if that's nothing, <AccessDenied> is the safe default.
      })
      .finally(() => setResolvingAccess(false));
  }, [courseId]);
  const handleAccessRevokedRef = useRef(handleAccessRevoked);
  useEffect(() => {
    handleAccessRevokedRef.current = handleAccessRevoked;
  }, [handleAccessRevoked]);

  // Layer the course-scoped playback closure on top of the base settings
  // returned by the fetch. It can't be built inside fetchCoursePageBySlug
  // because it needs to flip hasAccess on 403, and it needs the current
  // `sections` to resolve lessonId -> lectureId.
  const courseDataWithSettings = useMemo<LMSCourseData | null>(() => {
    if (!courseData || !courseId) return courseData;
    const sections = courseData.sections;
    const settings = {
      ...courseData.settings,
      getVideoPlayback: async (lessonId: string): Promise<LMSVideoPlayback> => {
        const lectureId = findLectureIdByLessonId(sections, lessonId);
        if (!lectureId) throw new Error("Lecture not found for lesson");
        try {
          // The server runs the enrollment check and reads the video id from
          // the lecture row; nothing about the video is sent from here.
          return await apiPost<LMSVideoPlayback>(
            `/courses/${courseId}/lectures/${lectureId}/playback`,
            {}
          );
        } catch (err) {
          if (err instanceof ApiError && err.status === 403) {
            handleAccessRevokedRef.current();
          }
          throw err;
        }
      },
    };
    return { ...courseData, settings };
  }, [courseData, courseId]);

  // Re-check access on lecture change + when the tab becomes visible.
  // Catches the "admin revoked while the user was on this page" case
  // without polling. The OTP gate above is the hard stop; this is the
  // UX hint that flips the AccessDenied screen the moment access goes
  // away rather than waiting for the next play click.
  useEffect(() => {
    if (!courseId || !hasAccess || !member) return;
    let cancelled = false;
    const check = async () => {
      try {
        const data = await apiGet<{
          has_access: boolean;
          reason?: string;
          blocked_by?: BlockedBy;
        }>(`/courses/${courseId}/access-status`);
        if (!cancelled && !data.has_access) {
          // Carry blocked_by across. Without it a re-check that finds the
          // course locked would flip hasAccess=false with no blocker, and the
          // gate below would fall through to <AccessDenied>, which tells a
          // learner who already OWNS this course to go buy it, then redirects
          // them to the sales page. Same denial, wrong screen.
          setBlockedBy(data.blocked_by);
          setHasAccess(false);
        }
      } catch {
        // Network errors don't revoke access; the OTP gate will catch
        // a real revoke on the next play attempt.
      }
    };
    check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [courseId, currentLessonId, hasAccess, member]);

  const handleSubmitRating = useCallback(
    async (rating: number, review?: string) => {
      if (!courseId) return;
      try {
        const newReview = await apiPost<{ id: string; tenant_member_id: string; rating: number; review_text: string | null; created_at: string }>(
          `/courses/${courseId}/reviews`,
          { rating, review_text: review ?? null }
        );
        setRatings((prev) => [
          {
            id: newReview.id,
            userId: newReview.tenant_member_id,
            userName: "User",
            rating: newReview.rating,
            review: newReview.review_text ?? undefined,
            createdAt: newReview.created_at,
          },
          ...prev,
        ]);
        setRatingSummary((prev) => {
          const count = (prev?.totalRatings ?? 0) + 1;
          const sum = (prev?.averageRating ?? 0) * (count - 1) + rating;
          const star = Math.min(5, Math.max(1, Math.round(rating))) as 1 | 2 | 3 | 4 | 5;
          const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ...prev?.ratingDistribution };
          dist[star] = (dist[star] ?? 0) + 1;
          return {
            averageRating: Math.round((sum / count) * 10) / 10,
            totalRatings: count,
            ratingDistribution: dist,
          };
        });
      } catch (e) {
        const status = (e as import("@/lib/api/api-client").ApiError).status;
        if (status === 403) {
          toast({ title: "Enrollment required", description: ENROLLMENT_REQUIRED_MSG, variant: "destructive" });
        }
        throw e;
      }
    },
    [courseId, toast]
  );

  const handleBack = useCallback(() => {
    // The dedicated course landing page lives at `/courses/[slug]/page.tsx`.
    // Pushing to `/${courseSlug}` (e.g. `/python-live-bootcamp`) instead
    // resolves to the catch-all `app/[...slug]/page.tsx` which renders the
    // generic tenant page lookup, visually a different (wrong) template.
    // `courseSlug` from `parseLearnSlugs` may or may not include a stray
    // `courses/` prefix depending on how the URL was constructed, so
    // normalise to the bare slug before composing the destination.
    const bareSlug = courseSlug.startsWith("courses/")
      ? courseSlug.slice("courses/".length)
      : courseSlug;
    router.push(`/courses/${bareSlug}`);
  }, [courseSlug, router]);

  const fetchPdfBlobUrl = useCallback(
    async (assignmentId: string): Promise<string | null> => {
      try {
        const { axiosInstance } = await import("@/lib/api/api-client");
        const res = await axiosInstance.get<Blob>(`/assignments/${assignmentId}/pdf`, {
          responseType: "blob",
        });
        const blob = res.data;
        if (!blob || blob.size === 0) return null;
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    },
    []
  );

  const fetchAssignmentDetail = useCallback(
    async (assignmentId: string) => {
      const { getAssignmentDetail } = await import("@/lib/api/assignments");
      return getAssignmentDetail(assignmentId);
    },
    []
  );

  const fetchQuizDetail = useCallback(
    async (quizId: string, includeCorrect = false) => {
      const { getQuizDetail } = await import("@/lib/api/quizzes");
      return getQuizDetail(quizId, includeCorrect);
    },
    []
  );

  const onStartQuizAttempt = useCallback(
    async (quizId: string) => {
      const { startAttempt } = await import("@/lib/api/quizzes");
      await startAttempt(quizId);
    },
    []
  );

  const onSubmitQuizAttempt = useCallback(
    async (
      quizId: string,
      answers: Array<{ question_id: string; option_id: string }>
    ) => {
      const { submitAttempt } = await import("@/lib/api/quizzes");
      await submitAttempt(quizId, answers);
      toast({ title: "Success", description: "Quiz submitted successfully." });
      // Backend marks quiz progress complete on ANY submission, mirror it
      // locally so sequential gating unlocks without a reload (same as the
      // assignment handler below).
      if (currentLessonId && courseSlug) {
        setLessonProgress((prev) => {
          const next = { ...prev, [currentLessonId]: { completed: true } };
          localStorage.setItem(`lms-progress-${courseSlug}`, JSON.stringify(next));
          return next;
        });
      }
    },
    [toast, currentLessonId, courseSlug]
  );

  const onMarkQuizComplete = useCallback(
    async (quizId: string) => {
      const { markQuizComplete } = await import("@/lib/api/quizzes");
      await markQuizComplete(quizId);
      toast({ title: "Success", description: "Quiz marked as complete." });
      // Update local lesson progress so sidebar shows complete
      if (currentLessonId && courseSlug) {
        setLessonProgress((prev) => {
          const next = { ...prev, [currentLessonId]: { completed: true } };
          localStorage.setItem(`lms-progress-${courseSlug}`, JSON.stringify(next));
          return next;
        });
      }
    },
    [toast, currentLessonId, courseSlug]
  );

  const onSubmitAssignment = useCallback(
    async (assignmentId: string, data: { file?: File; text_content?: string }) => {
      const { submitAssignment } = await import("@/lib/api/assignments");
      await submitAssignment(assignmentId, data);
      toast({ title: "Success", description: "Assignment submitted successfully." });
      // Submission auto-completes the lesson server-side. Mirror that in local
      // lesson progress (same as onMarkQuizComplete) so sequential gating
      // unlocks the next lesson without a page reload.
      if (currentLessonId && courseSlug) {
        setLessonProgress((prev) => {
          const next = { ...prev, [currentLessonId]: { completed: true } };
          localStorage.setItem(`lms-progress-${courseSlug}`, JSON.stringify(next));
          return next;
        });
      }
    },
    [toast, currentLessonId, courseSlug]
  );

  const handleGenerateCertificate = useCallback(async () => {
    if (!courseData?.course?.id) return;
    setIsGeneratingCertificate(true);
    try {
      const result = await generateCertificate(courseData.course.id);
      sessionStorage.setItem(`cert-${result.certificateNumber}`, JSON.stringify({
        certificateNumber: result.certificateNumber,
        templateId: result.templateId,
        courseTitle: result.courseTitle,
        firstName: result.firstName,
        lastName: result.lastName,
        formattedIssuedAt: result.formattedIssuedAt,
        logoUrl: result.logoUrl,
        verifyUrl: result.verifyUrl,
        directorName: result.directorName,
        directorTitle: result.directorTitle,
        tenantName: result.tenantName,
        issuedAt: result.issuedAt,
        design: result.design,
        hoursText: result.hoursText,
        lessonsCompleted: result.lessonsCompleted,
        quizzesPassed: result.quizzesPassed,
        finalScore: result.finalScore,
        testSeriesTitle: result.testSeriesTitle,
        signatureUrl: result.signatureUrl,
        expiryText: result.expiryText,
      }));
      router.push(`/certificate/${result.certificateNumber}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to generate certificate";
      toast({ title: "Certificate Error", description: msg, variant: "destructive" });
    } finally {
      setIsGeneratingCertificate(false);
    }
  }, [courseData?.course?.id, toast, router]);

  // Org-level social links (fetched once)
  const [orgSocialLinks, setOrgSocialLinks] = useState<{ platform: string; url: string }[] | undefined>();
  useEffect(() => {
    const base = API_URL.replace(/\/$/, "");
    const host = typeof window !== "undefined" ? window.location.host : "";
    fetch(`${base}/org/social-links`, { headers: { "X-Tenant-Host": host } })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!json?.success || !json.data) return;
        const sl = json.data as Record<string, string | undefined>;
        const mapped: { platform: string; url: string }[] = [];
        if (sl.twitter) mapped.push({ platform: "twitter", url: sl.twitter });
        if (sl.linkedin) mapped.push({ platform: "linkedin", url: sl.linkedin });
        if (sl.youtube) mapped.push({ platform: "youtube", url: sl.youtube });
        if (sl.facebook) mapped.push({ platform: "facebook", url: sl.facebook });
        if (mapped.length > 0) setOrgSocialLinks(mapped);
      })
      .catch(() => {/* best effort */});
  }, []);

  // Social links: prefer org-level, fall back to footer
  const socialLinks = useMemo(() => {
    if (orgSocialLinks && orgSocialLinks.length > 0) return orgSocialLinks;
    const links = tenantLayout?.footer?.socialLinks;
    if (!links || links.length === 0) return undefined;
    return links
      .filter((l) => ["facebook", "twitter", "youtube", "linkedin"].includes(l.platform?.toLowerCase()))
      .map((l) => ({ platform: l.platform.toLowerCase(), url: l.url }));
  }, [orgSocialLinks, tenantLayout]);

  // Fetch analytics once when course is loaded and user has access
  useEffect(() => {
    if (!analyticsLoadedRef.current && courseData?.course?.id && hasAccess) {
      analyticsLoadedRef.current = true;
      setIsAnalyticsLoading(true);
      getCourseAnalytics(courseData.course.id)
        .then((data) => setUserAnalytics(data))
        .catch(() => {/* analytics fetch is best-effort */})
        .finally(() => setIsAnalyticsLoading(false));
    }
  }, [courseData?.course?.id, hasAccess]);

  // ------- LOADING / SSR STATE -------
  if (!mounted) return null;

  if (isLoading) {
    return (
      <LayoutWrapper layout={tenantLayout} theme={courseTheme} layoutOverrides={{ hideFooter: true }}>
        <div className="bg-background flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="text-primary h-10 w-10 animate-spin" />
            <p className="text-muted-foreground text-sm font-medium">Loading course...</p>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  // ------- ERROR STATES -------
  if (errorState) {
    // Special "coming soon" layout for no_lms_data
    if (errorState === "no_lms_data") {
      return (
        <LayoutWrapper layout={tenantLayout} theme={courseTheme} layoutOverrides={{ hideFooter: true }}>
          <div className="bg-background flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12">
            {/* Animated hero section */}
            <div className="relative mb-10">
              <div className="bg-primary/10 absolute -inset-4 animate-pulse rounded-full blur-xl" />
              <div className="bg-card border-border relative flex h-24 w-24 items-center justify-center rounded-2xl border shadow-lg">
                <svg className="text-primary h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>

            <h1 className="text-foreground mb-3 text-center text-3xl font-bold tracking-tight">
              Content Coming Soon
            </h1>
            <p className="text-foreground/70 mb-10 max-w-md text-center text-base leading-relaxed">
              The instructor is crafting this course with care. The lessons and materials will be available shortly.
            </p>

            {/* Animated skeleton cards */}
            <div className="mb-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
              {[
                { label: "Lessons & lectures", icon: "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" },
                { label: "Quizzes & assignments", icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
                { label: "Downloadable resources", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
                { label: "Interactive content", icon: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="border-border bg-card group relative overflow-hidden rounded-xl border p-5 shadow-sm"
                >
                  {/* Shimmer effect */}
                  <div
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent"
                    style={{
                      animation: `shimmer 3s ease-in-out ${i * 0.5}s infinite`,
                    }}
                  />
                  <div className="relative flex items-start gap-4">
                    <div className="bg-primary/15 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                      <svg className="text-primary h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={item.icon} />
                      </svg>
                    </div>
                    <div className="flex-1 space-y-2.5">
                      <p className="text-foreground text-sm font-semibold">{item.label}</p>
                      <div className="space-y-2">
                        <div className="bg-foreground/10 h-2 w-full animate-pulse rounded-full" />
                        <div className="bg-foreground/10 h-2 w-3/4 animate-pulse rounded-full" style={{ animationDelay: `${i * 200}ms` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress indicator */}
            <div className="mb-8 flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-primary relative inline-flex h-3 w-3 rounded-full" />
              </div>
              <span className="text-foreground/60 text-sm font-medium">Work in progress</span>
            </div>

            <button
              onClick={() => router.push("/")}
              className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Browse Other Courses
            </button>

            <style jsx>{`
              @keyframes shimmer {
                0% { transform: translateX(-100%); }
                50% { transform: translateX(100%); }
                100% { transform: translateX(100%); }
              }
            `}</style>
          </div>
        </LayoutWrapper>
      );
    }

    const errorContent = {
      not_found: {
        icon: <BookX className="text-muted-foreground/40 h-16 w-16" />,
        title: "Course Not Found",
        description: "The course you're looking for doesn't exist or may have been removed.",
      },
      not_published: {
        icon: <Lock className="text-muted-foreground/40 h-16 w-16" />,
        title: "Course Not Available",
        description: "This course is currently not published. Please check back later.",
      },
      network_error: {
        icon: <BookX className="text-muted-foreground/40 h-16 w-16" />,
        title: "Unable to Load Course",
        description:
          "We couldn't connect to the server. Please check your internet connection and try again.",
      },
    }[errorState as "not_found" | "not_published" | "network_error"];

    if (!errorContent) return null;

    return (
      <LayoutWrapper layout={tenantLayout} theme={courseTheme} layoutOverrides={{ hideFooter: true }}>
        <div className="bg-background flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4">
          {errorContent.icon}
          <div className="max-w-md text-center">
            <h1 className="text-foreground text-2xl font-bold">{errorContent.title}</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {errorContent.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Home
            </button>
            {errorState === "network_error" && (
              <button
                onClick={() => window.location.reload()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  // ------- NO DATA STATE -------
  if (!courseData || !currentLesson) {
    return (
      <LayoutWrapper layout={tenantLayout} theme={courseTheme} layoutOverrides={{ hideFooter: true }}>
        <div className="bg-background flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4">
          <BookX className="text-muted-foreground/40 h-16 w-16" />
          <div className="max-w-md text-center">
            <h1 className="text-foreground text-2xl font-bold">Lesson Not Found</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Could not find the requested lesson. The course content may have changed.
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Home
          </button>
        </div>
      </LayoutWrapper>
    );
  }

  // ------- ACCESS GATE -------
  // Two different denials, two different screens. A learner blocked by a
  // prerequisite has already PAID for this course, <AccessDenied> would tell
  // them to go enrol and bounce them to the sales page, which is a dead end.
  // Send them to the course that actually unblocks them instead.
  if (courseData && !hasAccess && blockedBy) {
    return (
      <LayoutWrapper layout={tenantLayout} theme={courseTheme} layoutOverrides={{ hideFooter: true }}>
        <CourseLocked title={courseData.course.title} blockedBy={blockedBy} />
      </LayoutWrapper>
    );
  }

  // Access is gone but a re-check is still deciding whether it's a lock or a
  // revoke. Hold on the loader rather than flashing <AccessDenied>, otherwise a
  // prerequisite-locked course briefly shows "you need to enrol" and starts a
  // redirect to the sales page before CourseLocked takes over.
  if (courseData && !hasAccess && resolvingAccess) {
    return (
      <LayoutWrapper layout={tenantLayout} theme={courseTheme} layoutOverrides={{ hideFooter: true }}>
        <div className="bg-background flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="text-primary h-10 w-10 animate-spin" />
        </div>
      </LayoutWrapper>
    );
  }

  if (courseData && !hasAccess) {
    const bareSlug = courseSlug.startsWith("courses/")
      ? courseSlug.slice("courses/".length)
      : courseSlug;
    return (
      <LayoutWrapper layout={tenantLayout} theme={courseTheme} layoutOverrides={{ hideFooter: true }}>
        <AccessDenied
          title={courseData.course.title}
          type="course"
          redirectUrl={`/courses/${bareSlug}`}
        />
      </LayoutWrapper>
    );
  }

  // ------- RENDER TEMPLATE -------
  const templateProps = {
    courseData: courseDataWithSettings ?? courseData,
    // The useMemo above is computed at the top of the component (must be.
    // hooks can't sit below conditional returns), so its type is `LMSLesson
    // | null`. By the time we build `templateProps` we've already returned
    // for `!currentLesson`, so the non-null assertion is safe.
    currentLesson: currentLessonWithResume as LMSLesson,
    currentSectionId: currentSection?.id,
    previousLesson,
    nextLesson,
    lessonProgress,
    overallProgress,
    currentUserId: member?.id ?? undefined,
    ratings,
    ratingSummary,
    userRating,
    onLessonChange: handleLessonChange,
    onLockedLessonClick: handleLockedLessonClick,
    onMarkComplete: handleMarkComplete,
    onVideoProgress: handleVideoProgress,
    onVideoEnded: handleVideoEnded,
    onSubmitRating: handleSubmitRating,
    onBack: handleBack,
    // Embedded course + video analytics for the "Your Progress" modal, scoped
    // to the current course.
    analyticsSlot: courseData?.course?.id ? (
      <CourseVideoAnalytics courseId={courseData.course.id} embedded />
    ) : undefined,
    fetchPdfBlobUrl,
    fetchAssignmentDetail,
    onSubmitAssignment,
    hasAccess,
    fetchQuizDetail,
    onStartQuizAttempt,
    onSubmitQuizAttempt,
    onMarkQuizComplete,
    onGenerateCertificate: handleGenerateCertificate,
    onCertificateUnavailable: (reason: string) => {
      toast({ title: "Certificate Not Available", description: reason, variant: "destructive" });
    },
    isGeneratingCertificate,
    // Social links & analytics
    socialLinks,
    userAnalytics,
    isAnalyticsLoading,
    // "Access till <date>" badge in the top bar. Gated on hasAccess for
    // clarity even though the AccessDenied branches render before this.
    accessExpiresAt: hasAccess ? accessExpiresAt : null,
  };

  // Wrap with LayoutWrapper to get homepage header + sidebar.
  // Hide footer since LMS is an immersive experience.
  // Disable main scroll so ClassicLMS can manage its own scrolling.
  return (
    <LayoutWrapper 
      layout={tenantLayout} 
      theme={courseTheme} 
      layoutOverrides={{ hideFooter: true, disableMainScroll: true }}
    >
      <LMSProvider courseData={courseDataWithSettings ?? courseData} initialLessonId={currentLessonId || undefined}>
        <LMSProgressProvider
          courseId={courseSlug}
          totalLessons={allLessons.length}
          storageKey={`lms-progress-${courseSlug}`}
        >
          <ClassicLMS {...templateProps} />
          {/* Full-page quiz overlay for quiz lessons */}
          {(() => {
            const isQuizLesson =
              currentLesson &&
              ((currentLesson as { lessonType?: string }).lessonType === "QUIZ" ||
                (currentLesson as { lessonType?: string }).lessonType === "quiz");
            const quizId =
              (currentLesson as { quizId?: string } | null)?.quizId ||
              (currentLesson as { quiz?: { id?: string } } | null)?.quiz?.id;
            if (!isQuizLesson || !quizId || !hasAccess) return null;
            return (
              <FullPageQuiz
                quizId={quizId}
                quizTitle={currentLesson?.title ?? "Quiz"}
                courseTitle={courseData.course.title}
                hasAccess={hasAccess}
                onClose={() => {
                  // Navigate to next lesson if available, otherwise previous
                  if (nextLesson) {
                    handleLessonChange(nextLesson);
                  } else if (previousLesson) {
                    handleLessonChange(previousLesson);
                  }
                }}
                onQuizComplete={() => {
                  if (currentLessonId && courseSlug) {
                    setLessonProgress((prev: Record<string, { completed: boolean; progress?: number }>) => {
                      const next = { ...prev, [currentLessonId]: { completed: true } };
                      localStorage.setItem(
                        `lms-progress-${courseSlug}`,
                        JSON.stringify(next)
                      );
                      return next;
                    });
                  }
                }}
              />
            );
          })()}
        </LMSProgressProvider>
      </LMSProvider>
    </LayoutWrapper>
  );
}
