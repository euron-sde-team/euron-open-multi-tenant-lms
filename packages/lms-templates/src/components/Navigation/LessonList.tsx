"use client";

import React from "react";
import type { LMSSection, LMSLesson } from "../../types";
import { SectionAccordion } from "./SectionAccordion";
import { cn } from "../../lib/utils";

interface LessonListProps {
  /** Course sections with lessons */
  sections: LMSSection[];
  /** Currently active lesson ID */
  activeLessonId?: string;
  /** Progress data by lesson ID */
  lessonProgress?: Record<string, { completed: boolean; progress?: number }>;
  /** Called when lesson is clicked */
  onLessonClick?: (lesson: LMSLesson) => void;
  /** Show lesson durations */
  showDurations?: boolean;
  /** Show lesson status icons */
  showStatus?: boolean;
  /** Expand all sections by default */
  expandAll?: boolean;
  /** Lesson IDs that are locked (used for sequential progress enforcement) */
  lockedLessonIds?: Set<string>;
  /** Additional class name */
  className?: string;
}

export function LessonList({
  sections,
  activeLessonId,
  lessonProgress = {},
  onLessonClick,
  showDurations = true,
  showStatus = true,
  expandAll = false,
  lockedLessonIds,
  className,
}: LessonListProps) {
  if (sections.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <p className="text-sm text-muted-foreground">No lessons available</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {sections.map((section) => (
        <SectionAccordion
          key={section.id}
          section={section}
          activeLessonId={activeLessonId}
          lessonProgress={lessonProgress}
          onLessonClick={onLessonClick}
          defaultExpanded={expandAll}
          showDurations={showDurations}
          showStatus={showStatus}
          lockedLessonIds={lockedLessonIds}
        />
      ))}
    </div>
  );
}

export default LessonList;
