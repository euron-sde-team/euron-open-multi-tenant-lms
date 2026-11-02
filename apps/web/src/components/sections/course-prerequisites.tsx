"use client";

import type { CoursePrerequisitesContent, SectionConfig } from "@open-mtlms/shared";
import { AlertCircle, CheckCircle } from "lucide-react";

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
  const variant = section.variant;

  const prerequisites = content.prerequisites || [];
  const isCompact = variant === "compact";

  return (
    <section className="section-padding">
      <div className="container-custom">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className={cn("mb-6", isCompact ? "text-left" : "text-center")}>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{content.headline}</h2>
            {content.subheadline && (
              <p className="text-muted-foreground mt-2">{content.subheadline}</p>
            )}
          </div>

          {/* Prerequisites List */}
          <div className={cn("bg-card rounded-lg border p-6", isCompact && "p-4")}>
            <div className="mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <span className="font-medium">Before you begin</span>
            </div>
            <ul className="space-y-3">
              {prerequisites.map((prerequisite, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
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
