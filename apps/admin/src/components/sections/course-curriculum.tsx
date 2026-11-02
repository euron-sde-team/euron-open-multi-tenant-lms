"use client";

import { Button } from "@open-mtlms/core";
import type { CourseCurriculumContent, SectionConfig } from "@open-mtlms/shared";
import { BookOpen, ChevronDown, ChevronRight, Clock, Play } from "lucide-react";
import { useState } from "react";

import { EditableText } from "@/components/editor/editable-text";
import { useContentEditable } from "@/lib/contexts/edit-mode-context";
import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";
import { decodeHtmlEntities } from "@/lib/utils/text";

interface CourseCurriculumSectionProps {
  section: SectionConfig;
}

// Default content for curriculum when not provided
const defaultContent: CourseCurriculumContent = {
  headline: "Course Curriculum",
  sections: [],
};

export function CourseCurriculumSection({ section }: CourseCurriculumSectionProps) {
  const rawContent = section.content as CourseCurriculumContent | undefined;
  const content: CourseCurriculumContent = rawContent ? { ...defaultContent, ...rawContent } : defaultContent;
  const isContentEditable = useContentEditable();
  const { updateSectionContent } = useEditorStore();
  const variant = section.variant;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const handleContentUpdate = (key: keyof CourseCurriculumContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const sections = content.sections || [];
  const getSectionModules = (s: (typeof sections)[0]) => {
    if (s.modules && s.modules.length > 0) return s.modules;
    if (s.lectures && s.lectures.length > 0) {
      return [
        {
          id: `module-${s.id}-legacy`,
          title: "Content",
          order: 0,
          lectures: s.lectures,
        },
      ];
    }
    return [];
  };
  const totalLectures =
    content.totalLectures ||
    sections.reduce(
      (acc, s) =>
        acc + getSectionModules(s).reduce((mAcc, m) => mAcc + m.lectures.length, 0),
      0
    );

  const isSimple = variant === "simple";

  return (
    <section className="section-padding">
      <div className="container-custom">
        {/* Header */}
        <div className="mb-8 text-center">
          {isContentEditable ? (
            <EditableText
              value={content.headline}
              onChange={(value) => handleContentUpdate("headline", value)}
              as="h2"
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            />
          ) : (
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {content.headline}
            </h2>
          )}
          {content.subheadline && (
            <p className="mt-2 text-muted-foreground">
              {isContentEditable ? (
                <EditableText
                  value={content.subheadline}
                  onChange={(value) => handleContentUpdate("subheadline", value)}
                />
              ) : (
                content.subheadline
              )}
            </p>
          )}

          {/* Summary Stats */}
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span>{totalLectures} lectures</span>
            </div>
            {content.totalDuration && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{content.totalDuration}</span>
              </div>
            )}
          </div>
        </div>

        {/* Curriculum Sections */}
        <div className="mx-auto max-w-3xl space-y-3">
          {sections.map((curriculumSection) => {
            const isSectionExpanded = expandedSections.has(curriculumSection.id);
            const modules = getSectionModules(curriculumSection);
            const lectureCount = modules.reduce(
              (acc, m) => acc + m.lectures.length,
              0
            );

            return (
              <div
                key={curriculumSection.id}
                className="overflow-hidden rounded-lg border bg-card"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(curriculumSection.id)}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isSectionExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="font-medium">
                      {decodeHtmlEntities(curriculumSection.title)}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {modules.length} modules &bull; {lectureCount} lectures
                  </span>
                </button>

                {/* Section Content: Modules & Lectures */}
                {isSectionExpanded && (
                  <div className="border-t">
                    {modules.map((module) => {
                      const isModuleExpanded = expandedModules.has(module.id);
                      return (
                        <div key={module.id} className="border-b last:border-b-0">
                          <button
                            onClick={() => toggleModule(module.id)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 pl-4">
                              {isModuleExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm font-medium">
                                {decodeHtmlEntities(module.title)}
                              </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {module.lectures.length} lectures
                            </span>
                          </button>
                          {isModuleExpanded && (
                            <div className="bg-muted/20">
                              {module.lectures.map((lecture, lectureIndex) => (
                                <div
                                  key={lecture.id}
                                  className={cn(
                                    "flex items-center justify-between px-4 py-3 pl-12",
                                    lectureIndex !== module.lectures.length - 1 &&
                                      "border-b border-border/50"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">
                                      {lectureIndex + 1}
                                    </div>
                                    <span className="text-sm">
                                      {decodeHtmlEntities(lecture.title)}
                                    </span>
                                    {lecture.isPreview && (
                                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                        Preview
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {lecture.isPreview && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1 text-xs"
                                      >
                                        <Play className="h-3 w-3" />
                                        Watch
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Simple variant - just list all sections collapsed */}
        {isSimple && sections.length === 0 && (
          <div className="text-center text-muted-foreground">
            No curriculum sections available.
          </div>
        )}
      </div>
    </section>
  );
}
