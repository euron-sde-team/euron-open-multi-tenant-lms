"use client";

import { useState, useMemo } from "react";
import { BookOpen, ChevronRight, ChevronDown, Play, PlayCircle } from "lucide-react";
import type { CourseSectionData } from "@open-mtlms/shared";
import { formatClockDuration, normalizeSectionModules } from "@open-mtlms/shared";
import { cn, decodeHtmlEntities } from "../lib/utils";
import { useCourseData } from "../context";

interface CourseCurriculumProps {
  sections: CourseSectionData[];
  className?: string;
  variant?: "accordion" | "compact";
}

export function CourseCurriculum({
  sections,
  className,
  variant = "accordion",
}: CourseCurriculumProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  // Supplied by the host app; absent in the editor, where nothing is playable.
  const { onPreviewPlay } = useCourseData();

  const sectionsWithModules = useMemo(
    () => sections.map((s) => normalizeSectionModules(s)),
    [sections]
  );

  const totalLectures = useMemo(
    () =>
      sectionsWithModules.reduce(
        (acc, s) =>
          acc + s.modules.reduce((mAcc, m) => mAcc + m.lectures.length, 0),
        0
      ),
    [sectionsWithModules]
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };


  if (sectionsWithModules.length === 0) {
    return (
      <section className={cn("", className)}>
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: "hsl(var(--card-foreground))" }}
          >
            <BookOpen className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
            Course Content
          </h2>
        </div>
        <div
          className="rounded-xl border overflow-hidden p-8 text-center"
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" style={{ color: "hsl(var(--muted-foreground))" }} />
          <p style={{ color: "hsl(var(--muted-foreground))" }}>No course content added yet</p>
        </div>
      </section>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("space-y-2", className)}>
        {sectionsWithModules.map((section, idx) => {
          const lectureCount = section.modules.reduce(
            (acc, m) => acc + m.lectures.length,
            0
          );
          return (
            <div
              key={section.id}
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "hsl(var(--card))" }}
            >
              <div className="flex items-center gap-4 p-4">
                <span
                  className="text-sm font-bold opacity-50"
                  style={{ color: "hsl(var(--primary))" }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <p className="font-medium" style={{ color: "hsl(var(--card-foreground))" }}>
                    {decodeHtmlEntities(section.title)}
                  </p>
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {lectureCount} lessons
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section className={cn("", className)}>
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-xl font-bold flex items-center gap-2"
          style={{ color: "hsl(var(--card-foreground))" }}
        >
          <BookOpen className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
          Course Content
        </h2>
        <div className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          {sectionsWithModules.length} sections &bull; {totalLectures} lectures
        </div>
      </div>

      <div>
        {sectionsWithModules.map((section, index) => {
          const lectureCount = section.modules.reduce(
            (acc: number, m: { lectures: unknown[] }) => acc + m.lectures.length,
            0,
          );
          const isExpanded = expandedSections.has(section.id);
          return (
            <div
              key={section.id}
              className="border-b last:border-b-0"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <button
                className="w-full flex items-center gap-3 py-4 text-left"
                onClick={() => toggleSection(section.id)}
              >
                <span
                  className="text-xs font-bold shrink-0 w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ color: "hsl(var(--primary))", backgroundColor: "hsl(var(--primary) / 0.08)" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ color: "hsl(var(--card-foreground))" }}>
                    {decodeHtmlEntities(section.title)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {lectureCount} lectures
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
                )}
              </button>
              {isExpanded && (
                <div className="pb-4 pl-9 space-y-3">
                  {section.modules.map((module) => (
                    <div key={module.id}>
                      {section.modules.length > 1 && (
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {decodeHtmlEntities(module.title)}
                        </p>
                      )}
                      <div>
                        {module.lectures.map((lecture) => {
                          const preview = lecture.previewVideo;
                          const canPlay = Boolean(preview?.videoKey && onPreviewPlay);
                          // Stored as a count of seconds; a reader wants a clock.
                          const duration = formatClockDuration(lecture.duration);
                          return (
                            <div
                              key={lecture.id}
                              className="flex items-center gap-2.5 py-1.5"
                            >
                              <Play className="h-3 w-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                              <span className="min-w-0 flex-1 break-words text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                                {decodeHtmlEntities(lecture.title)}
                              </span>
                              {/* Free sample. The whole reason for this feature:
                                  someone who has not signed up can watch a real
                                  lesson before deciding to buy. */}
                              {canPlay && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onPreviewPlay?.({
                                      videoKey: preview!.videoKey,
                                      title:
                                        preview!.title ||
                                        decodeHtmlEntities(lecture.title),
                                    })
                                  }
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80"
                                  style={{
                                    color: "hsl(var(--primary))",
                                    backgroundColor: "hsl(var(--primary) / 0.1)",
                                  }}
                                >
                                  <PlayCircle className="h-3 w-3" />
                                  Preview
                                </button>
                              )}
                              {duration && (
                                <span className="shrink-0 text-xs tabular-nums" style={{ color: "hsl(var(--muted-foreground))" }}>
                                  {duration}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
