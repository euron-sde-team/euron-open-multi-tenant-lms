"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Menu,
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  LMSCourseData,
  LMSLesson,
  LMSRating,
  LMSRatingSummary,
} from "../types";
import { useLessonVideo } from "../lib/use-lesson-video";
import type { LessonTabId } from "../components/Overview/LessonTabs";
import { LessonList } from "../components/Navigation/LessonList";
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

interface ModernLMSProps {
  /** Course data */
  courseData: LMSCourseData;
  /** Current lesson being viewed */
  currentLesson: LMSLesson;
  /** Current section */
  currentSectionId?: string;
  /** Previous lesson */
  previousLesson: LMSLesson | null;
  /** Next lesson */
  nextLesson: LMSLesson | null;
  /** Progress data by lesson ID */
  lessonProgress?: Record<string, { completed: boolean; progress?: number }>;
  /** Overall progress percentage */
  overallProgress?: number;
  /** Current user ID */
  currentUserId?: string;
  /** Q&A data */
  /** Ratings data */
  ratings?: LMSRating[];
  /** Rating summary */
  ratingSummary?: LMSRatingSummary;
  /** User's rating */
  userRating?: LMSRating | null;
  /** Callbacks */
  onLessonChange?: (lesson: LMSLesson) => void;
  onMarkComplete?: () => Promise<void>;
  onVideoProgress?: (currentTime: number, duration: number) => void;
  onVideoEnded?: () => void;
  onSubmitRating?: (rating: number, review?: string) => Promise<void>;
  onBack?: () => void;
  /** Additional class name */
  className?: string;
  /** Fetches PDF as blob URL for same-origin iframe */
  fetchPdfBlobUrl?: (assignmentId: string) => Promise<string | null>;
  /** Fetches assignment detail (includes submission) */
  fetchAssignmentDetail?: (assignmentId: string) => Promise<AssignmentData>;
  /** Submits assignment */
  onSubmitAssignment?: (assignmentId: string, data: { file?: File; text_content?: string }) => Promise<void>;
  /** Whether user has access (enrolled) */
  hasAccess?: boolean;
  /** Fetches quiz detail */
  fetchQuizDetail?: (quizId: string, includeCorrect?: boolean) => Promise<QuizData>;
  /** Starts quiz attempt */
  onStartQuizAttempt?: (quizId: string) => Promise<void>;
  /** Submits quiz answers */
  onSubmitQuizAttempt?: (quizId: string, answers: Array<{ question_id: string; option_id: string }>) => Promise<void>;
  /** Marks quiz complete */
  onMarkQuizComplete?: (quizId: string) => Promise<void>;
}

/**
 * Modern LMS Template
 *
 * Features:
 * - Floating sidebar (can be toggled) with rounded corners
 * - Video player centered with theater mode toggle
 * - Pill-style tabs with icons
 * - Card-based resource display
 * - Inline lesson rating widget
 * - Gradient accent top bar
 * - Fully responsive
 */
export function ModernLMS({
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
  onMarkComplete,
  onVideoProgress,
  onVideoEnded,
  onSubmitRating,
  onBack,
  className,
  fetchPdfBlobUrl,
  fetchAssignmentDetail,
  onSubmitAssignment,
  hasAccess = true,
  fetchQuizDetail,
  onStartQuizAttempt,
  onSubmitQuizAttempt,
  onMarkQuizComplete,
}: ModernLMSProps) {
  const [activeTab, setActiveTab] = useState<LessonTabId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const handleLmsScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (el.getAttribute("data-lms-scroll") !== "visible") el.setAttribute("data-lms-scroll", "visible");
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => { el.setAttribute("data-lms-scroll", ""); scrollTimerRef.current = null; }, 800);
  }, []);
  useEffect(() => () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); }, []);

  const { settings, sections, course } = courseData;
  const isCompleted = lessonProgress[currentLesson.id]?.completed ?? false;

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
  // Resolve EVS / HLS / MP4 playback through the learner API (YouTube passes through).
  const lessonVideo = useLessonVideo(currentLesson, settings);

  // Get current section resources
  const currentSection = sections.find(
    (s) => s.id === currentSectionId || s.lessons.some((l) => l.id === currentLesson.id)
  );
  const sectionResources = currentSection?.resources || [];

  // Sequential progress: lock every lesson that follows the first not-yet-completed one
  const allLessons = useMemo(() => sections.flatMap((s) => s.lessons), [sections]);
  const lockedLessonIds = useMemo(() => {
    const locked = new Set<string>();
    if (!settings.requireSequential) return locked;
    for (let i = 1; i < allLessons.length; i++) {
      const prev = allLessons[i - 1];
      if (!lessonProgress[prev.id]?.completed) {
        for (let j = i; j < allLessons.length; j++) locked.add(allLessons[j].id);
        break;
      }
    }
    return locked;
  }, [allLessons, lessonProgress, settings.requireSequential]);
  const isNextLocked = !!nextLesson && lockedLessonIds.has(nextLesson.id);

  // Build available tabs based on settings. Overview is video-only
  // (content lessons show their body in the main slot instead of an Overview tab).
  const isVideoLesson =
    !isContentLesson &&
    currentLesson.lessonType !== "QUIZ" &&
    currentLesson.lessonType !== "quiz" &&
    currentLesson.lessonType !== "ASSIGNMENT" &&
    currentLesson.lessonType !== "assignment";
  const availableTabs: LessonTabId[] = [];
  if (isVideoLesson) availableTabs.push("overview");
  if (currentLesson.resources?.length > 0 || sectionResources.length > 0) {
    availableTabs.push("resources");
  }
  if (settings.enableRatings) {
    availableTabs.push("ratings");
  }

  // Keep the active tab valid: if the current tab isn't available for this lesson
  // (e.g. Overview on a content lesson), fall back to the first available tab.
  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  const handleLessonClick = useCallback(
    (lesson: LMSLesson) => {
      if (lockedLessonIds.has(lesson.id)) return;
      onLessonChange?.(lesson);
      setSidebarOpen(false);
    },
    [onLessonChange, lockedLessonIds]
  );

  const handleMarkComplete = useCallback(async () => {
    await onMarkComplete?.();
  }, [onMarkComplete]);

  const handlePrevious = useCallback(() => {
    if (previousLesson) {
      onLessonChange?.(previousLesson);
    }
  }, [previousLesson, onLessonChange]);

  const handleNext = useCallback(() => {
    if (!nextLesson || lockedLessonIds.has(nextLesson.id)) return;
    onLessonChange?.(nextLesson);
  }, [nextLesson, onLessonChange, lockedLessonIds]);

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* Gradient Accent Top Bar */}
      <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/50" />

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-3 h-14 sm:px-4 md:px-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors hidden sm:block"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0 hidden sm:block">
              <h1 className="font-semibold truncate text-sm md:text-base max-w-[200px] md:max-w-xs lg:max-w-md">
                {decodeHtmlEntities(course.title)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Progress */}
            {settings.enableProgress && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {overallProgress}%
                </span>
                <ProgressBar value={overallProgress} size="sm" className="w-24" />
              </div>
            )}

            {/* Theater Mode Toggle */}
            {currentLesson.video && (
              <button
                onClick={() => setTheaterMode(!theaterMode)}
                className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label={theaterMode ? "Exit theater mode" : "Theater mode"}
              >
                {theaterMode ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Floating Sidebar */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Sidebar Panel - Floating with rounded corners on desktop */}
          <aside
            className={cn(
              "fixed z-50 h-full bg-card shadow-xl overflow-hidden flex flex-col",
              "left-0 top-0 w-full sm:w-80",
              "sm:left-4 sm:top-4 sm:bottom-4 sm:h-auto sm:rounded-xl sm:border"
            )}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold truncate">{decodeHtmlEntities(course.title)}</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Progress */}
            {settings.enableProgress && (
              <div className="px-4 py-3 border-b">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{overallProgress}%</span>
                </div>
                <ProgressBar value={overallProgress} size="sm" />
              </div>
            )}

            {/* Lessons */}
            <div data-lms-scroll="" onScroll={handleLmsScroll} className="flex-1 overflow-y-auto p-4">
              <LessonList
                sections={sections}
                activeLessonId={currentLesson.id}
                lessonProgress={lessonProgress}
                onLessonClick={handleLessonClick}
                lockedLessonIds={lockedLessonIds}
              />
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <main
        className={cn(
          "transition-all duration-300",
          theaterMode ? "px-0" : "max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8"
        )}
      >
        {/* Video/Assignment Section - player, assignment PDF, or "Video Coming Soon" placeholder */}
        <div
          className={cn(
            "my-4 sm:my-6 transition-all duration-300",
            theaterMode && "my-0"
          )}
        >
          {isContentLesson ? (
            <ContentLessonView
              content={
                contentBody ?? {
                  type: currentLesson.lessonType as ContentLessonBody["type"],
                }
              }
              lessonTitle={currentLesson.title}
              isCompleted={isCompleted}
              hasNext={!!nextLesson}
              onMarkComplete={handleMarkComplete}
              showMarkComplete={settings.enableProgress}
            />
          ) : (currentLesson.lessonType === "QUIZ" || currentLesson.lessonType === "quiz") && currentLesson.quiz ? (
            <QuizContent
              quiz={currentLesson.quiz}
              fetchQuizDetail={fetchQuizDetail}
              onStartAttempt={onStartQuizAttempt}
              onSubmitAttempt={onSubmitQuizAttempt}
              onMarkComplete={onMarkQuizComplete}
              hasAccess={hasAccess}
              aspectRatio={isMobile ? 4 / 3 : 16 / 9}
              className={cn(
                "rounded-lg sm:rounded-xl shadow-lg",
                theaterMode && "rounded-none max-w-none"
              )}
            />
          ) : currentLesson.lessonType === "ASSIGNMENT" && currentLesson.assignment ? (
            <AssignmentContent
              assignment={currentLesson.assignment}
              fetchPdfBlobUrl={fetchPdfBlobUrl}
              fetchAssignmentDetail={fetchAssignmentDetail}
              onSubmitAssignment={onSubmitAssignment}
              hasAccess={hasAccess}
              aspectRatio={isMobile ? 4 / 3 : 16 / 9}
              className={cn(
                "rounded-lg sm:rounded-xl shadow-lg",
                theaterMode && "rounded-none max-w-none"
              )}
            />
          ) : (
            <VideoPlayer
              video={lessonVideo ?? { provider: "youtube", videoId: "" }}
              onProgress={onVideoProgress}
              onEnded={onVideoEnded}
              aspectRatio={isMobile ? 4 / 3 : 16 / 9}
              restrictForwardSeek={settings.requireSequential}
              className={cn(
                "rounded-lg sm:rounded-xl shadow-lg",
                theaterMode && "rounded-none max-w-none"
              )}
            />
          )}
        </div>

        {/* Content Section */}
        <div className={cn(
          "py-4 sm:py-6 space-y-4 sm:space-y-6",
          theaterMode && "max-w-6xl mx-auto px-3 sm:px-4"
        )}>
          {/* Lesson Header + Prev/Next on same line - title wraps, no overlap */}
          <div className="flex flex-row items-start justify-between gap-3 sm:gap-4 flex-nowrap">
            {/* Lesson Name - left, wraps to 2nd line when long, never overlaps buttons */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <h2 className="text-xl font-bold leading-tight break-words sm:text-2xl">
                  {decodeHtmlEntities(currentLesson.title)}
                </h2>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Sequential mode: completion comes only from actually finishing
                      the lesson (video 90% watched, quiz/assignment submitted).
                      a manual toggle would let students skip the entire chain. */}
                  {settings.enableProgress && !settings.requireSequential && (
                    <MarkComplete
                      isCompleted={isCompleted}
                      onToggle={handleMarkComplete}
                      variant="button"
                    />
                  )}
                </div>
              </div>
              {formatDuration(currentLesson.duration) && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatDuration(currentLesson.duration)}
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
                disabled={!nextLesson || isNextLocked}
                title={
                  !nextLesson
                    ? "Course completed"
                    : isNextLocked
                      ? "Mark this lesson complete to unlock the next one"
                      : `Next: ${decodeHtmlEntities(nextLesson.title)}`
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Tabs with Pills Style, hidden when no tab applies (e.g. a content
              lesson with no resources and ratings off). */}
          {availableTabs.length > 0 && (
          <LessonTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={availableTabs}
            variant="pills"
          >
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <LessonOverview
                lesson={currentLesson}
              />
            )}

            {/* Resources Tab - Card Style */}
            {activeTab === "resources" && (
              <ResourceList
                resources={currentLesson.resources || []}
                sectionResources={sectionResources}
                title="Resources"
                variant="card"
                showSearch
                showTypeFilter
              />
            )}


            {/* Ratings Tab */}
            {activeTab === "ratings" && (
              <CourseRating
                summary={ratingSummary}
                ratings={ratings}
                userRating={userRating}
                onSubmit={onSubmitRating}
                showReviews
              />
            )}
          </LessonTabs>
          )}
        </div>
      </main>
    </div>
  );
}

export default ModernLMS;
