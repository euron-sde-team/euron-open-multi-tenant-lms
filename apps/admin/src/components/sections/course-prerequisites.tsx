"use client";

import type { CoursePrerequisitesContent, SectionConfig } from "@open-mtlms/shared";
import { AlertCircle, CheckCircle } from "lucide-react";

import { EditableText } from "@/components/editor/editable-text";
import { useContentEditable } from "@/lib/contexts/edit-mode-context";
import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

interface CoursePrerequisitesSectionProps {
  section: SectionConfig;
}

// Default content for prerequisites when not provided
const defaultContent: CoursePrerequisitesContent = {
  headline: "Prerequisites",
  prerequisites: [],
};

export function CoursePrerequisitesSection({ section }: CoursePrerequisitesSectionProps) {
  const rawContent = section.content as CoursePrerequisitesContent | undefined;
  const content: CoursePrerequisitesContent = rawContent ? { ...defaultContent, ...rawContent } : defaultContent;
  const isContentEditable = useContentEditable();
  const { updateSectionContent } = useEditorStore();
  const variant = section.variant;

  const handleContentUpdate = (key: keyof CoursePrerequisitesContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const prerequisites = content.prerequisites || [];
  const isCompact = variant === "compact";

  return (
    <section className="section-padding">
      <div className="container-custom">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className={cn("mb-6", isCompact ? "text-left" : "text-center")}>
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
          </div>

          {/* Prerequisites List */}
          <div className={cn(
            "rounded-lg border bg-card p-6",
            isCompact && "p-4"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span className="font-medium">Before you begin</span>
            </div>
            <ul className="space-y-3">
              {prerequisites.map((prerequisite, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">{prerequisite}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
