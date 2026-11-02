"use client";

import type { CourseLearningOutcomesContent, SectionConfig } from "@open-mtlms/shared";
import { CheckCircle2 } from "lucide-react";

import { EditableText } from "@/components/editor/editable-text";
import { useContentEditable } from "@/lib/contexts/edit-mode-context";
import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

interface CourseLearningOutcomesSectionProps {
  section: SectionConfig;
}

// Default content for learning outcomes when not provided
const defaultContent: CourseLearningOutcomesContent = {
  headline: "What You'll Learn",
  outcomes: [],
};

export function CourseLearningOutcomesSection({ section }: CourseLearningOutcomesSectionProps) {
  const rawContent = section.content as CourseLearningOutcomesContent | undefined;
  const content: CourseLearningOutcomesContent = rawContent ? { ...defaultContent, ...rawContent } : defaultContent;
  const isContentEditable = useContentEditable();
  const { updateSectionContent } = useEditorStore();
  const variant = section.variant;

  const handleContentUpdate = (key: keyof CourseLearningOutcomesContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const outcomes = content.outcomes || [];
  const isGrid = variant === "grid";
  const isCompact = variant === "compact";

  return (
    <section className="section-padding">
      <div className="container-custom">
        {/* Header */}
        <div className={cn("mb-8", isCompact ? "text-left mb-4" : "text-center")}>
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

        {/* Outcomes */}
        <div className={cn(
          "mx-auto",
          isGrid ? "max-w-4xl" : "max-w-3xl"
        )}>
          {isGrid ? (
            // Grid Layout
            <div className="grid gap-4 sm:grid-cols-2">
              {outcomes.map((outcome, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-lg border bg-card p-4"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500 mt-0.5" />
                  <span className="text-foreground">{outcome}</span>
                </div>
              ))}
            </div>
          ) : (
            // List Layout
            <div className={cn(
              "rounded-lg border bg-card",
              isCompact ? "p-4" : "p-6"
            )}>
              <ul className={cn("space-y-3", isCompact && "space-y-2")}>
                {outcomes.map((outcome, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className={cn(
                      "shrink-0 text-green-500 mt-0.5",
                      isCompact ? "h-4 w-4" : "h-5 w-5"
                    )} />
                    <span className={cn(
                      "text-foreground",
                      isCompact && "text-sm"
                    )}>
                      {outcome}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
