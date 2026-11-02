"use client";

import type { CourseCurriculumContent, SectionConfig } from "@open-mtlms/shared";
import { BookOpen, ChevronDown, ChevronRight, Clock, Play } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const variant = section.variant;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

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
        { id: `module-${s.id}-legacy`, title: "Content", order: 0, lectures: s.lectures },
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
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{content.headline}</h2>
          {content.subheadline && (
            <p className="text-muted-foreground mt-2">{content.subheadline}</p>
          )}

          {/* Summary Stats */}
          <div className="text-muted-foreground mt-4 flex items-center justify-center gap-6 text-sm">
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
              <div key={curriculumSection.id} className="bg-card overflow-hidden rounded-lg border">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(curriculumSection.id)}
                  className="hover:bg-muted/50 flex w-full items-center justify-between p-4 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isSectionExpanded ? (
                      <ChevronDown className="text-muted-foreground h-5 w-5" />
                    ) : (
                      <ChevronRight className="text-muted-foreground h-5 w-5" />
                    )}
                    <span className="font-medium">{curriculumSection.title}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">
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
                            className="hover:bg-muted/30 flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
                          >
                            <div className="flex items-center gap-3 pl-4">
                              {isModuleExpanded ? (
                                <ChevronDown className="text-muted-foreground h-4 w-4" />
                              ) : (
                                <ChevronRight className="text-muted-foreground h-4 w-4" />
                              )}
                              <span className="text-sm font-medium">{module.title}</span>
                            </div>
                            <span className="text-muted-foreground text-sm">
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
                                    <div className="bg-muted flex h-6 w-6 items-center justify-center rounded-full text-xs">
                                      {lectureIndex + 1}
                                    </div>
                                    <span className="text-sm">{lecture.title}</span>
                                    {lecture.isPreview && (
                                      <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs">
                                        Preview
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
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
          <div className="text-muted-foreground text-center">No curriculum sections available.</div>
        )}
      </div>
    </section>
  );
}
