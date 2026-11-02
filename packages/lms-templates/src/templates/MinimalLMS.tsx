"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Home,
} from "lucide-react";
import type {
  LMSCourseData,
  LMSLesson,
  LMSRating,
  LMSRatingSummary,
} from "../types";
import { useLessonVideo } from "../lib/use-lesson-video";
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
import { LessonOverview } from "../components/Overview/LessonOverview";
import { ResourceList } from "../components/Resources/ResourceList";
import { CourseRating } from "../components/Rating/CourseRating";
import { MarkComplete } from "../components/Progress/MarkComplete";
import { ProgressBar } from "../components/Progress/ProgressBar";
import { cn, decodeHtmlEntities, formatDuration } from "../lib/utils";

interface MinimalLMSProps {
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
 * Minimal LMS Template
 *
 * Features:
 * - Hidden sidebar (hamburger menu)
 * - Full-width edge-to-edge video player
 * - Vertical scrolling sections (no tabs)
 * - Minimalist resource list
 * - Fixed bottom navigation (prev/next) with lesson titles
 * - Scroll-to-top button
 * - Clean, distraction-free reading experience
 * - Fully responsive
 */
export function MinimalLMS({
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
}: MinimalLMSProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  // routes to ContentLessonView (type-aware "coming soon") instead of the video
  // player's generic "Video Coming Soon".
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
  const hasResources = (currentLesson.resources?.length || 0) + sectionResources.length > 0;

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

  // Handle scroll for "scroll to top" button
  useEffect(() => {
    const handleScroll = () => {
      if (mainRef.current) {
        setShowScrollTop(mainRef.current.scrollTop > 500);
      }
    };

    const mainEl = mainRef.current;
    mainEl?.addEventListener("scroll", handleScroll);
    return () => mainEl?.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLessonClick = useCallback(
    (lesson: LMSLesson) => {
      if (lockedLessonIds.has(lesson.id)) return;
      onLessonChange?.(lesson);
      setSidebarOpen(false);
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onLessonChange, lockedLessonIds]
  );

  const handleMarkComplete = useCallback(async () => {
    await onMarkComplete?.();
  }, [onMarkComplete]);

  const handlePrevious = useCallback(() => {
    if (previousLesson) {
      onLessonChange?.(previousLesson);
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [previousLesson, onLessonChange]);

  const handleNext = useCallback(() => {
    if (!nextLesson || lockedLessonIds.has(nextLesson.id)) return;
    onLessonChange?.(nextLesson);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [nextLesson, onLessonChange, lockedLessonIds]);

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className={cn("h-screen flex flex-col bg-background", className)}>
      {/* Drawer Sidebar */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Sidebar */}
          <aside className="fixed left-0 top-0 z-50 h-full w-full sm:w-80 bg-card shadow-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold truncate">{decodeHtmlEntities(course.title)}</h2>
                {settings.enableProgress && (
                  <div className="flex items-center gap-2 mt-2">
                    <ProgressBar value={overallProgress} size="sm" className="flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {overallProgress}%
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="shrink-0 p-2 rounded-lg hover:bg-muted transition-colors ml-2"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Lessons */}
            <div data-lms-scroll="" onScroll={handleLmsScroll} className="flex-1 overflow-y-auto p-4">
              <LessonList
                sections={sections}
                activeLessonId={currentLesson.id}
                lessonProgress={lessonProgress}
                onLessonClick={handleLessonClick}
                showDurations={false}
                lockedLessonIds={lockedLessonIds}
              />
            </div>

            {/* Back Button */}
            {onBack && (
              <div className="p-4 border-t">
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Home className="h-4 w-4" />
                  <span>Back to Course</span>
                </button>
              </div>
            )}
          </aside>
        </>
      )}

      {/* Main Scrollable Content */}
      <main ref={mainRef} data-lms-scroll="" onScroll={handleLmsScroll} className="flex-1 overflow-y-auto">
        {/* Video/Assignment - Full Width; player, assignment PDF, content lesson, or "Video Coming Soon" placeholder */}
        <div className={cn("w-full", isContentLesson ? "bg-background" : "bg-black")}>
          {isContentLesson ? (
            <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
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
            </div>
          ) : (currentLesson.lessonType === "QUIZ" || currentLesson.lessonType === "quiz") && currentLesson.quiz ? (
            <QuizContent
              quiz={currentLesson.quiz}
              fetchQuizDetail={fetchQuizDetail}
              onStartAttempt={onStartQuizAttempt}
              onSubmitAttempt={onSubmitQuizAttempt}
              onMarkComplete={onMarkQuizComplete}
              hasAccess={hasAccess}
              aspectRatio={isMobile ? 4 / 3 : 16 / 9}
              className="w-full max-w-none"
            />
          ) : currentLesson.lessonType === "ASSIGNMENT" && currentLesson.assignment ? (
            <AssignmentContent
              assignment={currentLesson.assignment}
              fetchPdfBlobUrl={fetchPdfBlobUrl}
              fetchAssignmentDetail={fetchAssignmentDetail}
              onSubmitAssignment={onSubmitAssignment}
              hasAccess={hasAccess}
              aspectRatio={isMobile ? 4 / 3 : 16 / 9}
              className="w-full max-w-none"
            />
          ) : (
            <VideoPlayer
              video={lessonVideo ?? { provider: "youtube", videoId: "" }}
              onProgress={onVideoProgress}
              onEnded={onVideoEnded}
              aspectRatio={isMobile ? 4 / 3 : 16 / 9}
              restrictForwardSeek={settings.requireSequential}
              className="w-full max-w-none"
            />
          )}
        </div>

        {/* Content Sections - Vertical Layout, no tabs */}
        <div className="w-full max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-8 sm:space-y-12">
          {/* Header with Menu Toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 sm:mb-4"
              >
                <Menu className="h-4 w-4" />
                <span>Course Content</span>
              </button>
              <h1 className="text-xl font-bold leading-tight sm:text-2xl md:text-3xl">
                {decodeHtmlEntities(currentLesson.title)}
              </h1>
              {formatDuration(currentLesson.duration) && (
                <p className="text-muted-foreground mt-1 sm:mt-2 text-sm">
                  {formatDuration(currentLesson.duration)}
                </p>
              )}
            </div>

            {/* Mark Complete, hidden in sequential mode (completion must come
                from finishing the lesson, not a manual toggle) */}
            {settings.enableProgress && !settings.requireSequential && (
              <div className="shrink-0">
                <MarkComplete
                  isCompleted={isCompleted}
                  onToggle={handleMarkComplete}
                  variant="icon"
                  size="lg"
                />
              </div>
            )}
          </div>

          {/* Overview Section */}
          <section>
            <LessonOverview
              lesson={currentLesson}
            />
          </section>

          {/* Resources Section */}
          {hasResources && (
            <section>
              <h2 className="text-lg font-semibold mb-3 sm:text-xl sm:mb-4">Resources</h2>
              <ResourceList
                resources={currentLesson.resources || []}
                sectionResources={sectionResources}
                variant="compact"
                showSearch={false}
                showTypeFilter={false}
              />
            </section>
          )}


          {/* Ratings Section */}
          {settings.enableRatings && (
            <section>
              <CourseRating
                summary={ratingSummary}
                ratings={ratings}
                userRating={userRating}
                onSubmit={onSubmitRating}
                showReviews
                maxReviews={3}
              />
            </section>
          )}

          {/* Spacer for bottom nav */}
          <div className="h-16 sm:h-20" />
        </div>
      </main>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed right-3 bottom-20 z-40 p-2.5 sm:p-3 rounded-full bg-card shadow-lg border hover:bg-muted transition-colors sm:right-4 sm:bottom-24"
          aria-label="Scroll to top"
        >
          <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      )}

      {/* Fixed Bottom Navigation */}
      <nav className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2">
          <button
            onClick={handlePrevious}
            disabled={!previousLesson}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors min-w-0",
              "hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed",
              "sm:px-4 sm:py-2"
            )}
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <div className="text-left hidden sm:block min-w-0 max-w-[100px] md:max-w-[150px]">
              <span className="text-xs text-muted-foreground block">Previous</span>
              {previousLesson && (
                <span className="text-sm font-medium break-words line-clamp-2 block">
                  {decodeHtmlEntities(previousLesson.title)}
                </span>
              )}
            </div>
          </button>

          {/* Progress Indicator */}
          {settings.enableProgress && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-1.5 w-16 sm:w-24 md:w-32 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {overallProgress}%
              </span>
            </div>
          )}

          <button
            onClick={handleNext}
            disabled={!nextLesson || isNextLocked}
            title={
              !nextLesson
                ? "Course completed"
                : isNextLocked
                  ? "Mark this lesson complete to unlock the next one"
                  : undefined
            }
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors min-w-0",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "sm:px-4 sm:py-2"
            )}
          >
            <div className="text-right hidden sm:block min-w-0 max-w-[100px] md:max-w-[150px]">
              <span className="text-xs opacity-80 block">Next</span>
              {nextLesson && (
                <span className="text-sm font-medium break-words line-clamp-2 block">
                  {decodeHtmlEntities(nextLesson.title)}
                </span>
              )}
            </div>
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
          </button>
        </div>
      </nav>
    </div>
  );
}

export default MinimalLMS;
