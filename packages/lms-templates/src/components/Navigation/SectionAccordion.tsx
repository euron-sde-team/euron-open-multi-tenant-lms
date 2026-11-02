"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, FolderOpen, Lock } from "lucide-react";
import type { LMSSection, LMSLesson } from "../../types";
import { LessonStatus } from "../Progress/LessonStatus";
import { cn, formatDuration, parseSeconds } from "../../lib/utils";

interface SectionAccordionProps {
  /** Section data */
  section: LMSSection;
  /** Currently active lesson ID */
  activeLessonId?: string;
  /** Progress data by lesson ID */
  lessonProgress?: Record<string, { completed: boolean; progress?: number }>;
  /** Called when lesson is clicked */
  onLessonClick?: (lesson: LMSLesson) => void;
  /** Initially expanded */
  defaultExpanded?: boolean;
  /** Show lesson durations */
  showDurations?: boolean;
  /** Show lesson status icons */
  showStatus?: boolean;
  /** Lesson IDs that are locked by sequential progress (in addition to section.isLocked) */
  lockedLessonIds?: Set<string>;
  /** Additional class name */
  className?: string;
}

export function SectionAccordion({
  section,
  activeLessonId,
  lessonProgress = {},
  onLessonClick,
  defaultExpanded = false,
  showDurations = true,
  showStatus = true,
  lockedLessonIds,
  className,
}: SectionAccordionProps) {
  // Auto-expand if active lesson is in this section
  const hasActiveLesson = section.lessons.some((l) => l.id === activeLessonId);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || hasActiveLesson);

  // Calculate section progress
  const completedLessons = section.lessons.filter(
    (l) => lessonProgress[l.id]?.completed
  ).length;
  const totalLessons = section.lessons.length;
  const sectionProgress =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Calculate total duration (handles raw seconds, MM:SS, HH:MM:SS).
  const totalDuration = section.lessons.reduce(
    (acc, lesson) => acc + parseSeconds(lesson.duration),
    0
  );

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {/* Section Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-3 p-3 text-left",
          "hover:bg-muted/50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50"
        )}
      >
        {/* Expand/Collapse Icon */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Section Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <h3 className="font-medium text-sm truncate">{section.title}</h3>
            {section.isLocked && (
              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>
              {completedLessons}/{totalLessons} lessons
            </span>
            {showDurations && totalDuration > 0 && (
              <>
                <span>•</span>
                <span>{formatDuration(totalDuration)}</span>
              </>
            )}
          </div>
        </div>

        {/* Section Progress */}
        {totalLessons > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  sectionProgress >= 100 ? "bg-green-500" : "bg-primary"
                )}
                style={{ width: `${sectionProgress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-8">
              {sectionProgress}%
            </span>
          </div>
        )}
      </button>

      {/* Lessons List */}
      {isExpanded && (
        <div className="border-t bg-muted/20">
          {section.lessons.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {section.lessons.map((lesson) => {
                const isActive = lesson.id === activeLessonId;
                const progress = lessonProgress[lesson.id];
                const isCompleted = progress?.completed ?? false;
                const lessonProgressPercent = progress?.progress ?? 0;
                const isSequentiallyLocked = lockedLessonIds?.has(lesson.id) ?? false;
                const isLocked =
                  (section.isLocked && !lesson.isFreePreview) || isSequentiallyLocked;

                return (
                  <li key={lesson.id}>
                    <button
                      onClick={() => {
                        if (isLocked) return;
                        onLessonClick?.(lesson);
                      }}
                      disabled={isLocked}
                      title={
                        isSequentiallyLocked
                          ? "Complete the previous lesson to unlock this one"
                          : undefined
                      }
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left",
                        "hover:bg-muted/50 transition-colors",
                        "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        isActive && "bg-primary/5 border-l-2 border-primary"
                      )}
                    >
                      {/* Status Icon */}
                      {showStatus && (
                        <LessonStatus
                          isCompleted={isCompleted}
                          isActive={isActive}
                          isLocked={isLocked}
                          isFreePreview={lesson.isFreePreview}
                          lessonType={lesson.lessonType}
                          progress={lessonProgressPercent}
                          size="sm"
                          variant="icon"
                        />
                      )}

                      {/* Lesson Info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm truncate",
                            isActive && "font-medium text-foreground",
                            isCompleted && !isActive && "text-muted-foreground"
                          )}
                        >
                          {lesson.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {showDurations && formatDuration(lesson.duration) && (
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(lesson.duration)}
                            </span>
                          )}
                          {lesson.isFreePreview && (
                            <span className="text-xs text-primary font-medium">
                              Free
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No lessons in this section
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default SectionAccordion;
