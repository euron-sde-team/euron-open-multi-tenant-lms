"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { RoadmapMindfulnessContent, SectionConfig } from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { RoadmapMindfulnessSection } from "./RoadmapMindfulnessSection";

interface LearningPathsExamprepSectionProps {
  section: SectionConfig;
}

export function LearningPathsExamprepSection({ section }: LearningPathsExamprepSectionProps) {
  const content = section.content as RoadmapMindfulnessContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const sectionWithHiddenCta: SectionConfig = {
    ...section,
    content: {
      ...content,
      primaryCta: content.primaryCta
        ? { ...content.primaryCta, hidden: true }
        : undefined,
    },
  };

  return (
    <div
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            background: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <RoadmapMindfulnessSection section={sectionWithHiddenCta} />
        </div>
      </div>
    </div>
  );
}
