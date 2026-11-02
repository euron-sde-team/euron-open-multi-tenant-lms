"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  PanelRightClose,
  PanelRightOpen,
  Menu,
  X,
  BookOpen,
  Award,
  Clock,
  FileText,
  Download,
} from "lucide-react";
import type {
  LMSCourseData,
  LMSLesson,
  LMSResource,
  LMSSection,
} from "../../types";
import { LessonList } from "./LessonList";
import { ProgressBar } from "../Progress/ProgressBar";
import { cn, formatDuration, parseSeconds } from "../../lib/utils";

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

interface SidebarContentProps {
  sections: LMSSection[];
  totalLessons: number;
  totalDuration: number;
  showCourseInfo: boolean;
  overallProgress: number;
  activeLessonId?: string;
  lessonProgress: Record<string, { completed: boolean; progress?: number }>;
  onLessonClick?: (lesson: LMSLesson) => void;
  currentLesson?: LMSLesson;
  enableCertificate: boolean;
  onClose?: () => void;
  onScroll: (e: React.UIEvent<HTMLElement>) => void;
}

/**
 * Hoisted to module scope so its identity is stable across `CourseSidebar`
 * renders. Defining this inside the parent (the previous shape) gave it
 * a fresh function reference on every parent render, which React treats
 * as a different component type, unmounting + remounting the subtree
 * and resetting `scrollTop` on the `overflow-y-auto` lesson list. That
 * caused the "scroll snaps back to top" bug whenever lesson progress
 * updates (or any other state change) triggered a re-render upstream.
 */
function SidebarContent({
  sections,
  totalLessons,
  totalDuration,
  showCourseInfo,
  overallProgress,
  activeLessonId,
  lessonProgress,
  onLessonClick,
  currentLesson,
  enableCertificate,
  onClose,
  onScroll,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground truncate flex-1">
            Course Content
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close sidebar"
            >
              {/* Desktop: panel icon. Mobile: X icon */}
              <span className="hidden lg:inline">
                <PanelRightOpen className="h-4 w-4" />
              </span>
              <span className="lg:hidden">
                <X className="h-4 w-4" />
              </span>
            </button>
          )}
        </div>

        {/* Progress + stats */}
        {showCourseInfo && (
          <div className="mt-3 space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{overallProgress}%</span>
              </div>
              <ProgressBar value={overallProgress} size="sm" />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                <span>{totalLessons} lessons</span>
              </div>
              {totalDuration > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDuration(totalDuration)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: LMS_SCROLLBAR_STYLE }} />
      {/* Lesson list, scrollable */}
      <div
        data-lms-scroll=""
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-3"
      >
        <LessonList
          sections={sections}
          activeLessonId={activeLessonId}
          lessonProgress={lessonProgress}
          onLessonClick={onLessonClick}
        />
      </div>

      {/* Current lesson resources */}
      {currentLesson?.resources && currentLesson.resources.length > 0 && (
        <div className="flex-shrink-0 border-t p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Lesson Resources
          </h3>
          <div className="space-y-1">
            {currentLesson.resources.map((resource: LMSResource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground/80 group-hover:text-foreground">
                  {resource.title}
                </span>
                <Download className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Certificate badge */}
      {enableCertificate && overallProgress >= 100 && (
        <div className="flex-shrink-0 border-t bg-green-50 p-4 dark:bg-green-950/30">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/50">
              <Award className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Course Completed!
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Your certificate is ready
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CourseSidebarProps {
  /** Course data */
  courseData: LMSCourseData;
  /** Currently active lesson ID */
  activeLessonId?: string;
  /** Progress data by lesson ID */
  lessonProgress?: Record<string, { completed: boolean; progress?: number }>;
  /** Overall progress percentage */
  overallProgress?: number;
  /** Called when lesson is clicked */
  onLessonClick?: (lesson: LMSLesson) => void;
  /** Called when back/close is clicked */
  onBack?: () => void;
  /** Position of sidebar */
  position?: "left" | "right";
  /** Show course info header */
  showCourseInfo?: boolean;
  /** Current lesson (for showing resources in sidebar) */
  currentLesson?: LMSLesson;
  /** Additional class name */
  className?: string;
}

/**
 * Enterprise-grade course sidebar.
 *
 * Desktop (≥ lg):
 *   Fixed to the right edge of the viewport, full height.
 *   Always starts open. Toggle button collapses/expands.
 *   The main content reserves space with `lg:pr-80`.
 *
 * Mobile (< lg):
 *   Hidden by default. A floating button opens a slide-over drawer.
 */
export function CourseSidebar({
  courseData,
  activeLessonId,
  lessonProgress = {},
  overallProgress = 0,
  onLessonClick,
  onBack,
  position = "right",
  showCourseInfo = true,
  currentLesson,
  className,
}: CourseSidebarProps) {
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLmsScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (el.getAttribute("data-lms-scroll") !== "visible") el.setAttribute("data-lms-scroll", "visible");
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => { el.setAttribute("data-lms-scroll", ""); scrollTimerRef.current = null; }, 800);
  }, []);

  const { sections } = courseData;
  const isRight = position === "right";

  // Calculate total duration and lessons
  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const totalDuration = sections.reduce((acc, section) => {
    return (
      acc +
      section.lessons.reduce(
        (lessonAcc, lesson) => lessonAcc + parseSeconds(lesson.duration),
        0
      )
    );
  }, 0);

  const sharedContentProps: Omit<SidebarContentProps, "onClose"> = {
    sections,
    totalLessons,
    totalDuration,
    showCourseInfo,
    overallProgress,
    activeLessonId,
    lessonProgress,
    onLessonClick,
    currentLesson,
    enableCertificate: courseData.settings.enableCertificate ?? false,
    onScroll: handleLmsScroll,
  };

  return (
    <>
      {/* ════════════════════════════════════════════
          DESKTOP (≥ lg): Fixed sidebar on right edge
         ════════════════════════════════════════════ */}

      {/* Sidebar panel, fixed to viewport */}
      <aside
        className={cn(
          "hidden lg:flex fixed top-0 bottom-0 z-30 w-80 flex-col border-l bg-card transition-transform duration-300",
          isRight ? "right-0" : "left-0",
          desktopOpen
            ? "translate-x-0"
            : isRight
              ? "translate-x-full"
              : "-translate-x-full",
          className
        )}
      >
        <SidebarContent
          {...sharedContentProps}
          onClose={() => setDesktopOpen(false)}
        />
      </aside>

      {/* Desktop: Toggle button when sidebar is collapsed */}
      {!desktopOpen && (
        <button
          onClick={() => setDesktopOpen(true)}
          className={cn(
            "hidden lg:flex fixed top-1/2 -translate-y-1/2 z-40 items-center justify-center rounded-l-lg border border-r-0 bg-card p-2 shadow-md transition-colors hover:bg-muted",
            isRight ? "right-0" : "left-0 rounded-l-none rounded-r-lg border-l-0"
          )}
          aria-label="Open course content"
        >
          <PanelRightClose className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* ════════════════════════════════════════════
          MOBILE (< lg): Floating button + drawer
         ════════════════════════════════════════════ */}

      {/* Mobile toggle FAB */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className={cn(
            "lg:hidden fixed bottom-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90",
            isRight ? "right-4" : "left-4"
          )}
          aria-label="Open course content"
        >
          <Menu className="h-4 w-4" />
          <span>Content</span>
        </button>
      )}

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside
            className={cn(
              "absolute top-0 bottom-0 w-80 max-w-[85vw] bg-card shadow-2xl",
              isRight ? "right-0" : "left-0"
            )}
          >
            <SidebarContent
              {...sharedContentProps}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}

export default CourseSidebar;
