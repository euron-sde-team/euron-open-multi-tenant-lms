"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { CourseOfferingsContent, SectionConfig } from "@open-mtlms/shared";
import {
  Award,
  BookOpen,
  Code,
  Download,
  FileText,
  Headphones,
  Infinity,
  MessageCircle,
  MonitorPlay,
  Smartphone,
  Video,
} from "lucide-react";

import { EditableText } from "@/components/editor/editable-text";
import { useContentEditable } from "@/lib/contexts/edit-mode-context";
import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

interface CourseOfferingsSectionProps {
  section: SectionConfig;
}

// Icon mapping for offerings
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  video: Video,
  download: Download,
  certificate: Award,
  lifetime: Infinity,
  mobile: Smartphone,
  project: Code,
  live: MonitorPlay,
  support: Headphones,
  quiz: FileText,
  assignment: BookOpen,
  code: Code,
  document: FileText,
};

// Default content for offerings when not provided
const defaultContent: CourseOfferingsContent = {
  headline: "What's Included",
  offerings: [],
};

export function CourseOfferingsSection({ section }: CourseOfferingsSectionProps) {
  const rawContent = section.content as CourseOfferingsContent | undefined;
  const content: CourseOfferingsContent = rawContent ? { ...defaultContent, ...rawContent } : defaultContent;
  const isContentEditable = useContentEditable();
  const { updateSectionContent } = useEditorStore();
  const variant = section.variant;

  const handleContentUpdate = (key: keyof CourseOfferingsContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const offerings = content.offerings || [];
  const isCompact = variant === "compact";
  const isList = variant === "list";
  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "section-padding",
        hasCustomBg ? "bg-transparent" : "bg-muted/30"
      )}
    >
      <div className="container-custom">
        {/* Header */}
        <div className={cn("mb-8", isCompact ? "text-left" : "text-center")}>
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

        {/* Offerings Grid */}
        {!isList && offerings.length > 0 && (
          <div className={cn(
            "grid gap-4",
            isCompact 
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" 
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
          )}>
            {offerings.map((offering) => {
              const IconComponent = iconMap[offering.icon] || MessageCircle;
              
              return (
                <div
                  key={offering.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg bg-card p-4",
                    isCompact ? "flex-row" : "flex-col text-center"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center rounded-full bg-primary/10",
                    isCompact ? "h-8 w-8" : "h-12 w-12"
                  )}>
                    <IconComponent className={cn(
                      "text-primary",
                      isCompact ? "h-4 w-4" : "h-6 w-6"
                    )} />
                  </div>
                  <span className={cn(
                    "text-muted-foreground",
                    isCompact ? "text-sm" : "text-sm"
                  )}>
                    {offering.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* List variant */}
        {isList && offerings.length > 0 && (
          <div className="mx-auto max-w-2xl space-y-3">
            {offerings.map((offering) => {
              const IconComponent = iconMap[offering.icon] || MessageCircle;
              
              return (
                <div
                  key={offering.id}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-foreground">{offering.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
