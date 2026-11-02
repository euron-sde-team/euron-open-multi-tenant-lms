"use client";

import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@open-mtlms/core";
import { decodeHtmlEntities, type LMSSection } from "@open-mtlms/shared";
import { ChevronDown, Play, FileText } from "lucide-react";
import { memo, useCallback, useState } from "react";

export interface LessonPickerProps {
  sections: LMSSection[];
  onSelect: (lessonId: string, lessonTitle: string) => void;
  /** Lessons that already have a video mapped from this bulk upload session */
  excludeLessonIds?: Set<string>;
  selectedLessonId?: string | null;
  selectedLessonTitle?: string | null;
}

export const LessonPicker = memo(function LessonPicker({
  sections,
  onSelect,
  excludeLessonIds,
  selectedLessonId,
  selectedLessonTitle,
}: LessonPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (lessonId: string, lessonTitle: string) => {
      onSelect(lessonId, lessonTitle);
      setOpen(false);
    },
    [onSelect]
  );

  const hasLessons = sections.some((s) => s.lessons.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1 text-xs",
            selectedLessonId ? "text-primary" : ""
          )}
        >
          {selectedLessonTitle
            ? truncate(selectedLessonTitle, 20)
            : "Map to Lecture"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        {!hasLessons ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No lectures available
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto overscroll-contain p-1">
            {sections.map((section) => (
              <div key={section.id}>
                {/* Section header */}
                <div className="px-2 pb-1 pt-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {decodeHtmlEntities(section.title)}
                  </span>
                </div>

                {/* Lessons */}
                {section.lessons.map((lesson) => {
                  const hasVideo = !!lesson.video?.videoId;
                  const isExcluded = excludeLessonIds?.has(lesson.id) ?? false;
                  const isCurrent = selectedLessonId === lesson.id;

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                        isCurrent
                          ? "bg-primary/10 text-primary"
                          : isExcluded
                            ? "text-muted-foreground/50 hover:bg-muted/50"
                            : "text-foreground hover:bg-muted"
                      )}
                      onClick={() => handleSelect(lesson.id, lesson.title)}
                    >
                      {hasVideo ? (
                        <Play className="h-3 w-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">{decodeHtmlEntities(lesson.title)}</span>
                      {hasVideo && (
                        <span className="shrink-0 text-[10px] text-muted-foreground/50">
                          has video
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}
