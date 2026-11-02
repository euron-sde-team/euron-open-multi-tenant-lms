"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Award,
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Calendar,
  Video,
  Loader2,
  HelpCircle,
  ClipboardList,
  FileText,
  AlignLeft,
  Image as ImageIcon,
  Link as LinkIcon,
  BarChart3,
  Facebook,
  Twitter,
  Youtube,
  Linkedin,
  Trophy,
  Target,
  Flame,
  Lock,
} from "lucide-react";
import type { LMSCourseData, LMSLesson, LMSRating, LMSRatingSummary } from "../types";
import { useLessonVideo } from "../lib/use-lesson-video";
import type { LessonTabId } from "../components/Overview/LessonTabs";
import { VideoPlayer } from "../components/VideoPlayer/VideoPlayer";
import {
  AssignmentContent,
  type AssignmentData,
} from "../components/AssignmentContent/AssignmentContent";
import {
  QuizContent,
  type QuizData,
} from "../components/QuizContent/QuizContent";
import {
  ContentLessonView,
  type ContentLessonBody,
} from "../components/ContentLesson/ContentLessonView";
import { LessonTabs } from "../components/Overview/LessonTabs";
import { LessonOverview } from "../components/Overview/LessonOverview";
import { ResourceList } from "../components/Resources/ResourceList";
import { CourseRating } from "../components/Rating/CourseRating";
import { MarkComplete } from "../components/Progress/MarkComplete";
import { ProgressBar } from "../components/Progress/ProgressBar";
import { cn, decodeHtmlEntities, formatDuration } from "../lib/utils";

/* ── Scrollbar-on-scroll: hide scrollbar by default, reveal on active scroll ── */
const SCROLLBAR_HIDE_DELAY = 800;

/**
 * Inline <style> that hides scrollbars for [data-lms-scroll] elements
 * and reveals them when [data-lms-scroll="visible"].
 * Embedded in the component so it works regardless of how the host app loads CSS.
 */
const LMS_SCROLLBAR_STYLE = `
[data-lms-scroll]{scrollbar-width:thin;scrollbar-color:transparent transparent}
[data-lms-scroll]::-webkit-scrollbar{width:6px;height:6px}
[data-lms-scroll]::-webkit-scrollbar-track{background:transparent}
[data-lms-scroll]::-webkit-scrollbar-thumb{background:transparent;border-radius:9999px;transition:background .15s ease}
[data-lms-scroll]::-webkit-scrollbar-corner{background:transparent}
[data-lms-scroll="visible"]{scrollbar-color:rgba(128,128,128,.35) transparent}
[data-lms-scroll="visible"]::-webkit-scrollbar-thumb{background:rgba(128,128,128,.35)}
[data-lms-scroll="visible"]::-webkit-scrollbar-thumb:hover{background:rgba(128,128,128,.55)}
`.trim();

/** Hook: attaches scroll listener to a ref; toggles data-lms-scroll between "" and "visible". */
function useLmsScrollReveal() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (el.getAttribute("data-lms-scroll") !== "visible") {
      el.setAttribute("data-lms-scroll", "visible");
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      el.setAttribute("data-lms-scroll", "");
      timerRef.current = null;
    }, SCROLLBAR_HIDE_DELAY);
  }, []);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return onScroll;
}

interface ClassicLMSProps {
  courseData: LMSCourseData;
  currentLesson: LMSLesson;
  currentSectionId?: string;
  previousLesson: LMSLesson | null;
  nextLesson: LMSLesson | null;
  lessonProgress?: Record<string, { completed: boolean; progress?: number }>;
  overallProgress?: number;
  currentUserId?: string;
  ratings?: LMSRating[];
  ratingSummary?: LMSRatingSummary;
  userRating?: LMSRating | null;
  onLessonChange?: (lesson: LMSLesson) => void;
  /**
   * A locked lesson (sequential course) was tapped, from the sidebar or the
   * Next button. `blockingLesson` is the first unfinished lesson holding the
   * rest back. Without this the tap does nothing, so learners read a locked
   * quiz as one that "won't open".
   */
  onLockedLessonClick?: (lesson: LMSLesson, blockingLesson: LMSLesson | null) => void;
  onMarkComplete?: (lessonId: string) => Promise<void>;
  onVideoProgress?: (currentTime: number, duration: number) => void;
  onVideoEnded?: () => void;
  onSubmitRating?: (rating: number, review?: string) => Promise<void>;
  onBack?: () => void;
  className?: string;
  /** Slot for rendering course + video analytics inside the "Your Progress" modal */
  analyticsSlot?: React.ReactNode;
  /** Fetches PDF as blob URL for same-origin iframe (avoids S3 X-Frame-Options) */
  fetchPdfBlobUrl?: (assignmentId: string) => Promise<string | null>;
  /** Fetches assignment detail (includes submission status) */
  fetchAssignmentDetail?: (assignmentId: string) => Promise<AssignmentData>;
  /** Submits assignment (PDF or text/link) */
  onSubmitAssignment?: (
    assignmentId: string,
    data: { file?: File; text_content?: string }
  ) => Promise<void>;
  /** Whether user has access (enrolled) - submission only shown when true */
  hasAccess?: boolean;
  /** Fetches quiz detail (includes questions, attempt) */
  fetchQuizDetail?: (quizId: string, includeCorrect?: boolean) => Promise<QuizData>;
  /** Starts quiz attempt */
  onStartQuizAttempt?: (quizId: string) => Promise<void>;
  /** Submits quiz answers */
  onSubmitQuizAttempt?: (
    quizId: string,
    answers: Array<{ question_id: string; option_id: string }>
  ) => Promise<void>;
  /** Marks quiz complete for progress */
  onMarkQuizComplete?: (quizId: string) => Promise<void>;
  /** Handler for generating/downloading certificate */
  onGenerateCertificate?: () => void;
  /** Loading state for certificate generation */
  isGeneratingCertificate?: boolean;
  /** Called when certificate is clicked but not available (course incomplete) */
  onCertificateUnavailable?: (reason: string) => void;
  /** Social links to display in the header */
  socialLinks?: { platform: string; url: string }[];
  /** User analytics data for the course */
  userAnalytics?: LMSUserAnalytics | null;
  /** Loading state for analytics */
  isAnalyticsLoading?: boolean;
  /**
   * When the member's course access expires (enrollment valid_till, ISO
   * string). Shown as an "Access till <date>" badge in the top bar. Null or
   * absent means there is nothing to show (lifetime enrollment, subscription
   * access, or unknown).
   */
  accessExpiresAt?: string | null;
}

/** User-level analytics for a course */
export interface LMSUserAnalytics {
  /** Total time spent in seconds */
  totalTimeSpent: number;
  /** Time spent per lesson in seconds */
  lessonTimeSpent?: Record<string, number>;
  /** Number of completed lessons */
  completedLessons: number;
  /** Total lessons */
  totalLessons: number;
  /** Progress percentage */
  progressPercent: number;
  /** Quiz scores: [{ quizTitle, score, maxScore, percentage }] */
  quizScores?: Array<{
    quizTitle: string;
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  /** Assignment scores */
  assignmentScores?: Array<{
    assignmentTitle: string;
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  /** Current streak (consecutive days) */
  currentStreak: number;
  /** Last active date ISO string */
  lastActiveAt?: string;
  /** Course start date ISO string */
  startedAt?: string;
  /** Course completion date ISO string */
  completedAt?: string;
  /** Lessons completed per day for chart: [{ date, count }] */
  dailyActivity?: Array<{ date: string; count: number }>;
}

/**
 * Classic LMS Template: Two-panel layout (no own header).
 *
 * The parent page is expected to provide header & left sidebar via LayoutWrapper.
 * This template only renders:
 *   - Scrollable center: Video + lesson title + tabs (Overview/Review) + prev/next
 *   - Fixed right sidebar: Lesson navigation list
 *
 * Layout:
 * +---------------------------------------------+---------------+
 * |                                             |               |
 * |    Video Player (16:9)                      |  Lesson Nav   |
 * |                                             |  (Right)      |
 * |    Lesson Title + Mark Complete             |               |
 * |    Tabs: Overview | Review                  |  - Section 1  |
 * |    Tab Content                              |    Lesson 1   |
 * |                                             |    Lesson 2   |
 * |    Prev / Next                              |  - Section 2  |
 * |                                             |    Lesson 3   |
 * +---------------------------------------------+---------------+
 *  Scrollable (Y)                                Fixed
 */
export function ClassicLMS({
  courseData,
  currentLesson,
  currentSectionId,
  previousLesson,
  nextLesson,
  lessonProgress = {},
  overallProgress = 0,
  currentUserId,
  ratings = [],
  ratingSummary,
  userRating,
  onLessonChange,
  onLockedLessonClick,
  onMarkComplete,
  onVideoProgress,
  onVideoEnded,
  onSubmitRating,
  onBack,
  className,
  analyticsSlot,
  fetchPdfBlobUrl,
  fetchAssignmentDetail,
  onSubmitAssignment,
  hasAccess = true,
  fetchQuizDetail,
  onStartQuizAttempt,
  onSubmitQuizAttempt,
  onMarkQuizComplete,
  onGenerateCertificate,
  isGeneratingCertificate,
  onCertificateUnavailable,
  socialLinks,
  userAnalytics,
  isAnalyticsLoading,
  accessExpiresAt,
}: ClassicLMSProps) {
  const [activeTab, setActiveTab] = useState<LessonTabId>("overview");
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  // "Aug 31, 2027", alphabetic month, numeric day and year. An absent or
  // unparseable date renders nothing rather than "Invalid Date".
  const accessExpiryLabel = (() => {
    if (!accessExpiresAt) return null;
    const d = new Date(accessExpiresAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  })();
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(currentSectionId ? [currentSectionId] : [])
  );
  const [isMobile, setIsMobile] = useState(false);
  const hasSetMobileTab = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const { settings, sections } = courseData;

  // Standalone content lesson (PDF/LINK/TEXT/IMAGE), rendered in the main
  // lesson area instead of the video player.
  const contentBody = currentLesson.content as ContentLessonBody | undefined;
  // Keyed on lessonType alone (not contentBody) so an empty content lesson still
  // routes to ContentLessonView, which shows a type-aware "coming soon", rather
  // than falling through to the video player's generic "Video Coming Soon".
  const isContentLesson =
    currentLesson.lessonType === "PDF" ||
    currentLesson.lessonType === "LINK" ||
    currentLesson.lessonType === "TEXT" ||
    currentLesson.lessonType === "IMAGE";
  const isCurrentCompleted =
    lessonProgress[currentLesson.id]?.completed ?? false;

  // Scroll-reveal handler for LMS scrollable areas
  const handleLmsScroll = useLmsScrollReveal();

  // Resolve EVS / HLS / MP4 playback through the learner API (YouTube passes through).
  const videoToShow = useLessonVideo(currentLesson, settings);

  // Build available tabs: Content (mobile only, first) | Overview | Resources | Review.
  // Overview is video-only (content lessons show their body in the main slot
  // instead of an Overview tab).
  const isVideoLesson =
    !isContentLesson &&
    currentLesson.lessonType !== "QUIZ" &&
    currentLesson.lessonType !== "quiz" &&
    currentLesson.lessonType !== "ASSIGNMENT" &&
    currentLesson.lessonType !== "assignment";
  const baseTabs: LessonTabId[] = [];
  if (isVideoLesson) baseTabs.push("overview");
  baseTabs.push("resources");
  if (settings.enableRatings) baseTabs.push("ratings");
  const availableTabs: LessonTabId[] = isMobile ? ["content", ...baseTabs] : baseTabs;

  // On mobile, default to Content tab when it becomes available
  useEffect(() => {
    if (isMobile && !hasSetMobileTab.current) {
      setActiveTab("content");
      hasSetMobileTab.current = true;
    }
  }, [isMobile]);

  // Keep the active tab valid: when resizing to desktop (Content is mobile-only)
  // or when the current tab isn't available for this lesson (e.g. Overview on a
  // content lesson), fall back to the first available non-content tab.
  useEffect(() => {
    if (availableTabs.length === 0) return;
    const invalid =
      !availableTabs.includes(activeTab) ||
      (!isMobile && activeTab === "content");
    if (invalid) {
      setActiveTab(availableTabs.find((t) => t !== "content") ?? availableTabs[0]);
    }
  }, [availableTabs, isMobile, activeTab]);

  // When opening Content tab on mobile, expand all sections for easy browsing
  const prevContentTabRef = useRef(false);
  useEffect(() => {
    if (isMobile && activeTab === "content" && sections.length > 0 && !prevContentTabRef.current) {
      setExpandedSections(new Set(sections.map((s) => s.id)));
      prevContentTabRef.current = true;
    }
    if (activeTab !== "content") prevContentTabRef.current = false;
  }, [isMobile, activeTab, sections]);

  // Calculate stats
  const allLessons = sections.flatMap((s) => s.lessons);
  const totalLessons = allLessons.length;
  const completedLessons = Object.values(lessonProgress).filter((p) => p.completed).length;

  // Sequential progress: when enabled, lock every lesson that follows the first
  // not-yet-completed one. The first lesson is always unlocked.
  // `blockingLesson` is the unfinished lesson the locks start after.
  const { lockedLessonIds, blockingLesson } = useMemo(() => {
    const locked = new Set<string>();
    if (!settings.requireSequential) return { lockedLessonIds: locked, blockingLesson: null };
    for (let i = 1; i < allLessons.length; i++) {
      const prev = allLessons[i - 1];
      if (!lessonProgress[prev.id]?.completed) {
        for (let j = i; j < allLessons.length; j++) locked.add(allLessons[j].id);
        return { lockedLessonIds: locked, blockingLesson: prev };
      }
    }
    return { lockedLessonIds: locked, blockingLesson: null };
  }, [allLessons, lessonProgress, settings.requireSequential]);

  const isNextLocked = !!nextLesson && lockedLessonIds.has(nextLesson.id);

  const handleLessonClick = useCallback(
    (lesson: LMSLesson) => {
      if (lockedLessonIds.has(lesson.id)) {
        onLockedLessonClick?.(lesson, blockingLesson);
        return;
      }
      onLessonChange?.(lesson);
    },
    [onLessonChange, onLockedLessonClick, lockedLessonIds, blockingLesson]
  );

  const handlePrevious = useCallback(() => {
    // Previous is always reachable (already-unlocked sequence behind the user)
    if (previousLesson) onLessonChange?.(previousLesson);
  }, [previousLesson, onLessonChange]);

  const handleNext = useCallback(() => {
    if (!nextLesson) return;
    if (lockedLessonIds.has(nextLesson.id)) {
      onLockedLessonClick?.(nextLesson, blockingLesson);
      return;
    }
    onLessonChange?.(nextLesson);
  }, [nextLesson, onLessonChange, onLockedLessonClick, lockedLessonIds, blockingLesson]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  // ── Lesson List Panel (used in right sidebar & mobile drawer) ──
  //
  // IMPORTANT: This is a render helper, NOT a component. Defining a component
  // inline inside `ClassicLMS` would give it a new function identity on every
  // parent re-render: React would treat each render as a different component
  // type, unmount the subtree, and reset the scrollable list's `scrollTop` to
  // 0. That caused the "sidebar scrolls back to top whenever I click a lesson"
  // bug. By calling this as a plain function (`renderLessonListPanel(...)`)
  // instead of rendering `<LessonListPanel />`, its JSX is inlined directly at
  // the call site, so React sees stable positions/types and the scrollable
  // container keeps its scroll offset across re-renders.
  const renderLessonListPanel = (compact = false) => (
    // min-h-0 flex-1 (not h-full): fill the parent flex column via flex sizing,
    // which is a DEFINITE height, so the shrink-0 certificate card at the bottom
    // stays inside bounds. With h-full (height:100%) against a flex-stretched
    // parent, the height wasn't definite and the pinned card overflowed below
    // the viewport, getting clipped by the aside's overflow-hidden.
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Progress header, hidden entirely when progress tracking is disabled */}
      {settings.enableProgress && (
        <div className="shrink-0 border-b px-3 py-3">
          <div className="text-foreground/70 mb-2 flex items-center justify-between text-xs">
            <span>Progress</span>
            <span>
              {completedLessons}/{totalLessons} lessons
            </span>
          </div>
          <ProgressBar value={overallProgress} size="sm" />
        </div>
      )}

      {/* Sections & lessons. min-h-0 lets this flex-1 list shrink below its
          content height so it actually scrolls, without it the list grows to
          fit every lesson and pushes the shrink-0 footer below the panel's
          bounds, where overflow-hidden clips it (cropped bottom lessons). */}
      <div data-lms-scroll="" onScroll={handleLmsScroll} className="min-h-0 flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.id} className="border-b last:border-b-0">
            <button
              onClick={() => toggleSection(section.id)}
              className="text-foreground hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors"
            >
              <ChevronDown
                className={cn(
                  "text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform",
                  expandedSections.has(section.id) ? "rotate-0" : "-rotate-90"
                )}
              />
              <span className="flex-1 truncate">{decodeHtmlEntities(section.title)}</span>
              {settings.enableProgress && (
                <span className="bg-muted text-foreground/70 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  {section.lessons.filter((l) => lessonProgress[l.id]?.completed).length}/
                  {section.lessons.length}
                </span>
              )}
            </button>

            {expandedSections.has(section.id) && (
              <div className="pb-1">
                {section.lessons.map((lesson) => {
                  const isActive = lesson.id === currentLesson.id;
                  const isDone = lessonProgress[lesson.id]?.completed;
                  const isLocked = lockedLessonIds.has(lesson.id);

                  return (
                    <div
                      key={lesson.id}
                      role="button"
                      tabIndex={0}
                      aria-disabled={isLocked || undefined}
                      title={isLocked ? "Finish the previous lesson to unlock this one" : undefined}
                      onClick={() => handleLessonClick(lesson)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleLessonClick(lesson);
                        }
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 px-4 py-2 text-left text-xs transition-colors",
                        isLocked
                          ? "text-muted-foreground/60 cursor-not-allowed"
                          : "cursor-pointer",
                        !isLocked && isActive
                          ? "bg-primary/10 text-foreground font-medium"
                          : !isLocked && "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {/* Status icon, lock takes precedence, then completion, then lesson type */}
                      {isLocked ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/60" />
                      ) : isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500 mt-0.5" />
                      ) : lesson.lessonType === "quiz" || lesson.lessonType === "QUIZ" ? (
                        <HelpCircle className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isActive ? "text-foreground" : "text-amber-500")} />
                      ) : lesson.lessonType === "assignment" || lesson.lessonType === "ASSIGNMENT" ? (
                        <ClipboardList className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isActive ? "text-foreground" : "text-blue-500")} />
                      ) : lesson.lessonType === "PDF" ? (
                        <FileText className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isActive ? "text-foreground" : "text-red-500")} />
                      ) : lesson.lessonType === "TEXT" ? (
                        <AlignLeft className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isActive ? "text-foreground" : "text-muted-foreground")} />
                      ) : lesson.lessonType === "IMAGE" ? (
                        <ImageIcon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isActive ? "text-foreground" : "text-emerald-500")} />
                      ) : lesson.lessonType === "LINK" ? (
                        <LinkIcon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isActive ? "text-foreground" : "text-blue-500")} />
                      ) : isActive ? (
                        <Play className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      ) : (
                        <Video className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", "text-muted-foreground")} />
                      )}
                      <span className="flex-1 min-w-0 break-words">{decodeHtmlEntities(lesson.title)}</span>
                      {settings.enableProgress && !settings.requireSequential && onMarkComplete && !isLocked && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="shrink-0"
                        >
                          <MarkComplete
                            isCompleted={isDone}
                            onToggle={() => onMarkComplete(lesson.id)}
                            variant="icon"
                            size="sm"
                            showLabel={false}
                          />
                        </div>
                      )}
                      {!compact && formatDuration(lesson.duration) && (
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          {formatDuration(lesson.duration)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Certificate badge, kept INSIDE the scroll area (not a pinned footer)
            so it's always reachable by scrolling and never clipped at the
            viewport edge. */}
        {courseData.settings.enableCertificate && overallProgress >= 100 && (
          <div className="border-t bg-green-50 p-3 dark:bg-green-950/30">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-xs font-medium text-green-700 dark:text-green-300">
                  Course Completed!
                </p>
                <p className="text-[10px] text-green-600 dark:text-green-400">Certificate ready</p>
              </div>
              {onGenerateCertificate && (
                <button
                  onClick={onGenerateCertificate}
                  disabled={isGeneratingCertificate}
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  {isGeneratingCertificate ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Award className="h-3 w-3" />
                  )}
                  {isGeneratingCertificate ? "Generating..." : "Get Certificate"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "bg-background relative flex h-full min-h-0 flex-1 flex-col overflow-hidden ",
        className
      )}
    >
      {/* Inline scrollbar styles – ensures they apply regardless of host CSS pipeline */}
      <style dangerouslySetInnerHTML={{ __html: LMS_SCROLLBAR_STYLE }} />

      {/* ════════════════════════════════════════
          COMPACT TOP BAR (lesson info + controls) - hidden on mobile
         ════════════════════════════════════════ */}
      <div className="hidden lg:block bg-background/95 supports-[backdrop-filter]:bg-background/60 z-30 shrink-0 border-b backdrop-blur">
        <div className="flex h-11 items-center justify-between px-3 sm:px-4">
          {/* Left: Back + course title */}
          <div className="flex min-w-0 items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            )}
            {onBack && <div className="bg-border h-4 w-px" />}
            <h1 className="text-foreground truncate text-sm font-medium">
              {decodeHtmlEntities(courseData.course.title)}
            </h1>
          </div>

          {/* Right: Social icons + Analytics + Certificate + Sidebar toggle */}
          <div className="flex items-center gap-1.5">
            {/* Social icons */}
            {socialLinks && socialLinks.length > 0 && (
              <>
                <div className="flex items-center gap-0.5">
                  {socialLinks.map((link) => {
                    const Icon = link.platform === "facebook" ? Facebook
                      : link.platform === "twitter" ? Twitter
                      : link.platform === "youtube" ? Youtube
                      : link.platform === "linkedin" ? Linkedin
                      : null;
                    if (!Icon || !link.url) return null;
                    return (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors"
                        title={link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
                <div className="bg-border mx-0.5 h-4 w-px" />
              </>
            )}

            {/* Access expiry, only when the enrollment has an end date */}
            {accessExpiryLabel && (
              <>
                <span
                  title={`Your access to this course is valid till ${accessExpiryLabel}`}
                  className="text-muted-foreground inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium"
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>Access till {accessExpiryLabel}</span>
                </span>
                <div className="bg-border mx-0.5 h-4 w-px" />
              </>
            )}

            {/* Analytics button */}
            <button
              onClick={() => setShowAnalyticsModal(true)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              title="View your course analytics"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Analytics</span>
            </button>

            {/* Certificate button */}
            {courseData.settings.enableCertificate && (
              <button
                onClick={() => {
                  if (isGeneratingCertificate) return;
                  if (overallProgress < 100) {
                    const remaining = totalLessons - completedLessons;
                    onCertificateUnavailable?.(
                      `Complete all lessons to earn your certificate. You have ${remaining} lesson${remaining !== 1 ? "s" : ""} remaining (${overallProgress}% done).`
                    );
                    return;
                  }
                  onGenerateCertificate?.();
                }}
                disabled={isGeneratingCertificate}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  overallProgress >= 100
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {isGeneratingCertificate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Award className="h-3.5 w-3.5" />
                )}
                <span>Certificate</span>
              </button>
            )}

            <div className="bg-border mx-0.5 h-4 w-px" />

            {/* Sidebar toggle */}
            <button
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1.5 transition-colors"
              title={rightSidebarOpen ? "Close lesson list" : "Open lesson list"}
            >
              {rightSidebarOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          MAIN BODY
         ════════════════════════════════════════ */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* ── CENTER: Content area ── */}
        <div className="relative min-h-0 flex-1">
          <main data-lms-scroll="" onScroll={handleLmsScroll} className="absolute inset-0 overflow-y-auto bg-background">
            {/* Video Player or "Video Coming Soon" placeholder */}
            <div className="px-3 pt-3 sm:px-4 sm:pt-4">
            {isContentLesson ? (
              <ContentLessonView
                content={
                  contentBody ?? {
                    type: currentLesson.lessonType as ContentLessonBody["type"],
                  }
                }
                lessonTitle={currentLesson.title}
                isCompleted={isCurrentCompleted}
                hasNext={!!nextLesson}
                onMarkComplete={
                  onMarkComplete
                    ? () => onMarkComplete(currentLesson.id)
                    : undefined
                }
                showMarkComplete={settings.enableProgress}
                className="w-full"
              />
            ) : (currentLesson.lessonType === "QUIZ" || currentLesson.lessonType === "quiz") && currentLesson.quiz ? (
              <QuizContent
                quiz={currentLesson.quiz}
                fetchQuizDetail={fetchQuizDetail}
                onStartAttempt={onStartQuizAttempt}
                onSubmitAttempt={onSubmitQuizAttempt}
                onMarkComplete={onMarkQuizComplete}
                hasAccess={hasAccess}
                aspectRatio={isMobile ? 4 / 3 : 2.35}
                className="w-full"
              />
            ) : (currentLesson.lessonType === "ASSIGNMENT" && currentLesson.assignment) ? (
              <AssignmentContent
                assignment={currentLesson.assignment}
                fetchPdfBlobUrl={fetchPdfBlobUrl}
                fetchAssignmentDetail={fetchAssignmentDetail}
                onSubmitAssignment={onSubmitAssignment}
                hasAccess={hasAccess}
                aspectRatio={isMobile ? 4 / 3 : 2.35}
                className="w-full"
              />
            ) : (
              <VideoPlayer
                video={videoToShow ?? { provider: "youtube", videoId: "" }}
                onProgress={onVideoProgress}
                onEnded={onVideoEnded}
                className="w-full rounded-lg overflow-hidden"
                aspectRatio={isMobile ? 4 / 3 : 2.35}
                // A finished video is already counted; let the learner move
                // around it freely when they come back to it.
                restrictForwardSeek={settings.requireSequential && !isCurrentCompleted}
              />
            )}
            </div>

            {/* Main Content Container */}
            <div className="bg-background w-full px-4 py-5 sm:px-6">
              {/* Lesson Header + Prev/Next on same line - title wraps, no overlap */}
              <div className="flex flex-row items-start justify-between gap-3 sm:gap-4 mb-6 flex-nowrap">
                {/* Lesson Name - left, wraps to 2nd line when long, never overlaps buttons */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <h2 className="text-foreground text-xl font-bold leading-tight break-words sm:text-2xl">
                    {decodeHtmlEntities(currentLesson.title)}
                  </h2>
                  {formatDuration(currentLesson.duration) && (
                    <p className="text-muted-foreground mt-1 text-sm">{formatDuration(currentLesson.duration)}</p>
                  )}
                  {/* Mobile/tablet: the compact top bar (where the expiry
                      badge lives on desktop) is hidden below lg, so surface
                      the expiry here instead. */}
                  {accessExpiryLabel && (
                    <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs lg:hidden">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Access till {accessExpiryLabel}</span>
                    </p>
                  )}
                </div>

                {/* Prev + Next - right side, never shrink */}
                <div className="flex items-center gap-1 shrink-0 flex-shrink-0">
                  <button
                    onClick={handlePrevious}
                    disabled={!previousLesson}
                    title={previousLesson ? `Previous: ${decodeHtmlEntities(previousLesson.title)}` : "No previous lesson"}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                      "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50",
                      "disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!nextLesson}
                    aria-disabled={isNextLocked || undefined}
                    title={
                      !nextLesson
                        ? "Course completed"
                        : isNextLocked
                          ? "Finish this lesson to unlock the next one"
                          : `Next: ${decodeHtmlEntities(nextLesson.title)}`
                    }
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      isNextLocked && "cursor-not-allowed opacity-50 hover:bg-primary"
                    )}
                  >
                    <span className="hidden sm:inline">Next</span>
                    {isNextLocked ? <Lock className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

                {/* Tabs: Overview | Review */}
                <LessonTabs
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  tabs={availableTabs}
                  variant="default"
                >
                  <div className="py-4">
                    {activeTab === "content" && (
                      <div className="lg:hidden min-h-[200px]">
                        {renderLessonListPanel(true)}
                      </div>
                    )}
                    {activeTab === "overview" && (
                      <LessonOverview
                        lesson={currentLesson}
                      />
                    )}

                    {activeTab === "resources" && (
                      <ResourceList
                        resources={currentLesson.resources || []}
                        title="Lesson Resources"
                        variant="default"
                      />
                    )}

                    {activeTab === "ratings" && (
                      <CourseRating
                        summary={ratingSummary}
                        ratings={ratings}
                        userRating={userRating}
                        onSubmit={onSubmitRating}
                        showReviews
                      />
                    )}
                  </div>
                </LessonTabs>
              </div>
          </main>
        </div>

        {/* ── RIGHT SIDEBAR (Desktop): Lesson Navigation, fixed ── */}
        <aside
          className={cn(
            "bg-background hidden shrink-0 flex-col overflow-hidden border-l transition-all duration-300 lg:flex",
            rightSidebarOpen ? "w-64 xl:w-72" : "w-0"
          )}
        >
          {rightSidebarOpen && (
            <>
              <div className="flex shrink-0 items-center justify-between border-b px-3 py-2.5">
                <h2 className="text-foreground text-xs font-semibold uppercase tracking-wider">
                  Course Content
                </h2>
                <button
                  onClick={() => setRightSidebarOpen(false)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md p-1 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {renderLessonListPanel()}
            </>
          )}
        </aside>
      </div>

      {/* ════════════════════════════════════════
          ANALYTICS MODAL
         ════════════════════════════════════════ */}
      {showAnalyticsModal && (
        <CourseAnalyticsModal
          analytics={userAnalytics ?? null}
          isLoading={isAnalyticsLoading}
          courseName={decodeHtmlEntities(courseData.course.title) || "Course"}
          overallProgress={overallProgress}
          completedLessons={completedLessons}
          totalLessons={totalLessons}
          analyticsSlot={analyticsSlot}
          onClose={() => setShowAnalyticsModal(false)}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Course Analytics Modal, beautiful, detailed user course stats
   ════════════════════════════════════════════════════════════════ */

function formatDate(iso?: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface CourseAnalyticsModalProps {
  analytics: LMSUserAnalytics | null;
  isLoading?: boolean;
  courseName: string;
  overallProgress: number;
  completedLessons: number;
  totalLessons: number;
  /** Slot for the embedded course + video analytics (scoped to this course) */
  analyticsSlot?: React.ReactNode;
  onClose: () => void;
}

function CourseAnalyticsModal({
  analytics,
  isLoading,
  courseName,
  overallProgress,
  completedLessons,
  totalLessons,
  analyticsSlot,
  onClose,
}: CourseAnalyticsModalProps) {
  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const timeSpent = analytics?.totalTimeSpent ?? 0;
  const streak = analytics?.currentStreak ?? 0;
  const quizScores = analytics?.quizScores ?? [];
  const assignmentScores = analytics?.assignmentScores ?? [];
  const avgQuizScore = quizScores.length > 0
    ? Math.round(quizScores.reduce((sum, q) => sum + q.percentage, 0) / quizScores.length)
    : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="bg-background relative mx-3 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl sm:mx-4">
        {/* Header */}
        <div className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-foreground truncate text-base font-semibold sm:text-lg">Your Progress</h2>
              <p className="text-muted-foreground mt-0.5 truncate text-xs sm:text-sm">{courseName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-md p-1.5 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-5 sm:space-y-6">
              {/* ── Progress Ring + Stats Cards ── */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {/* Progress */}
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                  <div className="relative mx-auto mb-1.5 h-11 w-11 sm:mb-2 sm:h-14 sm:w-14">
                    <svg className="h-11 w-11 -rotate-90 sm:h-14 sm:w-14" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted" />
                      <circle
                        cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4"
                        strokeDasharray={`${(overallProgress / 100) * 150.8} 150.8`}
                        strokeLinecap="round"
                        className="text-primary"
                      />
                    </svg>
                    <span className="text-foreground absolute inset-0 flex items-center justify-center text-[10px] font-bold sm:text-xs">
                      {overallProgress}%
                    </span>
                  </div>
                  <p className="text-foreground text-xs font-semibold sm:text-sm">Progress</p>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">{completedLessons}/{totalLessons} lessons</p>
                </div>

                {/* Time Spent */}
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                  <Clock className="text-primary mb-1.5 h-4 w-4 sm:mb-2 sm:h-5 sm:w-5" />
                  <p className="text-foreground text-xs font-semibold sm:text-sm">{formatDuration(timeSpent)}</p>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">Time Spent</p>
                </div>

                {/* Streak */}
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                  <Flame className="mb-1.5 h-4 w-4 text-orange-500 sm:mb-2 sm:h-5 sm:w-5" />
                  <p className="text-foreground text-xs font-semibold sm:text-sm">{streak} day{streak !== 1 ? "s" : ""}</p>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">Streak</p>
                </div>

                {/* Avg Quiz Score */}
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                  <Target className="text-primary mb-1.5 h-4 w-4 sm:mb-2 sm:h-5 sm:w-5" />
                  <p className="text-foreground text-xs font-semibold sm:text-sm">{avgQuizScore !== null ? `${avgQuizScore}%` : "-"}</p>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">Avg Score</p>
                </div>
              </div>

              {/* ── Timeline Info ── */}
              <div className="bg-muted/30 flex flex-wrap gap-4 rounded-lg border px-4 py-2.5 sm:gap-6 sm:px-5 sm:py-3">
                <div>
                  <p className="text-muted-foreground text-[11px] uppercase tracking-wider">Started</p>
                  <p className="text-foreground text-sm font-medium">{formatDate(analytics?.startedAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px] uppercase tracking-wider">Last Active</p>
                  <p className="text-foreground text-sm font-medium">{formatDate(analytics?.lastActiveAt)}</p>
                </div>
                {analytics?.completedAt && (
                  <div>
                    <p className="text-muted-foreground text-[11px] uppercase tracking-wider">Completed</p>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">{formatDate(analytics.completedAt)}</p>
                  </div>
                )}
              </div>

              {/* ── Daily Activity Chart (simple bar chart) ── */}
              {analytics?.dailyActivity && analytics.dailyActivity.length > 0 && (
                <div>
                  <h3 className="text-foreground mb-2 text-xs font-semibold sm:mb-3 sm:text-sm">Daily Activity</h3>
                  <div className="bg-muted/30 overflow-x-auto rounded-lg border p-3 sm:p-4">
                    <div className="flex items-end gap-0.5 sm:gap-1" style={{ height: 64, minWidth: 200 }}>
                      {analytics.dailyActivity.slice(-14).map((day, i) => {
                        const maxCount = Math.max(...analytics.dailyActivity!.slice(-14).map((d) => d.count), 1);
                        const heightPct = (day.count / maxCount) * 100;
                        return (
                          <div key={i} className="flex flex-1 flex-col items-center gap-0.5 sm:gap-1">
                            <div className="w-full min-w-[3px] max-w-[20px] rounded-t sm:max-w-[24px]" style={{ height: `${Math.max(heightPct, 4)}%`, backgroundColor: day.count > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))" }} />
                            <span className="text-muted-foreground text-[7px] sm:text-[8px]">
                              {new Date(day.date).toLocaleDateString("en-US", { day: "numeric" })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Quiz Scores ── */}
              {quizScores.length > 0 && (
                <div>
                  <h3 className="text-foreground mb-2 flex items-center gap-2 text-xs font-semibold sm:mb-3 sm:text-sm">
                    <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Quiz Scores
                  </h3>
                  <div className="space-y-1.5 sm:space-y-2">
                    {quizScores.map((quiz, i) => (
                      <div key={i} className="bg-muted/30 flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
                        <span className="text-foreground min-w-0 truncate text-xs sm:text-sm">{decodeHtmlEntities(quiz.quizTitle)}</span>
                        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                          <span className="text-muted-foreground hidden text-xs sm:inline">{quiz.score}/{quiz.maxScore}</span>
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:text-xs",
                            quiz.percentage >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : quiz.percentage >= 50 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          )}>
                            {quiz.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Assignment Scores ── */}
              {assignmentScores.length > 0 && (
                <div>
                  <h3 className="text-foreground mb-2 flex items-center gap-2 text-xs font-semibold sm:mb-3 sm:text-sm">
                    <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Assignment Scores
                  </h3>
                  <div className="space-y-1.5 sm:space-y-2">
                    {assignmentScores.map((assignment, i) => (
                      <div key={i} className="bg-muted/30 flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3">
                        <span className="text-foreground min-w-0 truncate text-xs sm:text-sm">{decodeHtmlEntities(assignment.assignmentTitle)}</span>
                        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                          <span className="text-muted-foreground hidden text-xs sm:inline">{assignment.score}/{assignment.maxScore}</span>
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:text-xs",
                            assignment.percentage >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                              : assignment.percentage >= 50 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          )}>
                            {assignment.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Completion Badge ── */}
              {overallProgress >= 100 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30 sm:gap-3 sm:p-4">
                  <Trophy className="h-6 w-6 shrink-0 text-green-600 dark:text-green-400 sm:h-8 sm:w-8" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 sm:text-sm">Course Completed!</p>
                    <p className="text-[10px] text-green-600 dark:text-green-400 sm:text-xs">
                      Congratulations{analytics?.completedAt ? `, ${formatDate(analytics.completedAt)}` : ""}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Course & video analytics (embedded, scoped to this course) ── */}
              {analyticsSlot && (
                <div className="border-t pt-5">
                  <h3 className="text-foreground mb-3 text-xs font-semibold sm:text-sm">
                    Course &amp; video analytics
                  </h3>
                  {analyticsSlot}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClassicLMS;
