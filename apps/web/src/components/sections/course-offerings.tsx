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
  const variant = section.variant;

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
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{content.headline}</h2>
          {content.subheadline && (
            <p className="text-muted-foreground mt-2">{content.subheadline}</p>
          )}
        </div>

        {/* Offerings Grid */}
        {!isList && offerings.length > 0 && (
          <div
            className={cn(
              "grid gap-4",
              isCompact ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
            )}
          >
            {offerings.map((offering) => {
              const IconComponent = iconMap[offering.icon] || MessageCircle;

              return (
                <div
                  key={offering.id}
                  className={cn(
                    "bg-card flex items-center gap-3 rounded-lg p-4",
                    isCompact ? "flex-row" : "flex-col text-center"
                  )}
                >
                  <div
                    className={cn(
                      "bg-primary/10 flex items-center justify-center rounded-full",
                      isCompact ? "h-8 w-8" : "h-12 w-12"
                    )}
                  >
                    <IconComponent
                      className={cn("text-primary", isCompact ? "h-4 w-4" : "h-6 w-6")}
                    />
                  </div>
                  <span className={cn("text-muted-foreground", isCompact ? "text-sm" : "text-sm")}>
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
                  className="bg-card flex items-center gap-4 rounded-lg border p-4"
                >
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                    <IconComponent className="text-primary h-5 w-5" />
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
