"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, StatsContent } from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

interface StatsCounterSectionProps {
  section: SectionConfig;
}

export function StatsCounterSection({ section }: StatsCounterSectionProps) {
  const content = section.content as StatsContent;
  const { EditableText, updateSectionContent } = useSectionEditor();
  const variant = section.variant;

  const handleContentUpdate = (key: keyof StatsContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleStatUpdate = (index: number, key: string, value: string) => {
    const newStats = [...(content.stats || [])];
    newStats[index] = { ...newStats[index], [key]: value };
    handleContentUpdate("stats", newStats);
  };

  const isCards = variant === "cards";
  const isLarge = variant === "large";
  const isBrandStrip = variant === "brand-strip";
  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "section-padding",
        isBrandStrip
          ? "bg-background text-foreground"
          : "text-primary-foreground",
        hasCustomBg
          ? "bg-transparent"
          : isBrandStrip
            ? "bg-background"
            : "bg-primary",
      )}
    >
      <div className="container-custom">
        {/* Header */}
        {content.headline && (
          <div className="mx-auto max-w-3xl text-center">
            <EditableText
              value={content.headline}
              onChange={(value) => handleContentUpdate("headline", value)}
              styleKey="headline"
              as="h2"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            />
          </div>
        )}

        {/* Stats */}
        <div
          className={cn(
            "grid gap-8",
            isBrandStrip
              ? "mt-8 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              : "mt-12 sm:grid-cols-2 lg:grid-cols-4",
            !content.headline && "mt-0",
          )}
        >
          {content.stats?.map((stat, index) => (
            <div
              key={stat.id || index}
              className={cn(
                "text-center",
                isCards && "rounded-lg bg-primary-foreground/10 p-6 backdrop-blur-sm",
                isBrandStrip && "opacity-60",
              )}
            >
              <div
                className={cn(
                  "font-bold",
                  isBrandStrip
                    ? "text-lg sm:text-xl"
                    : isLarge
                      ? "text-5xl sm:text-6xl"
                      : "text-4xl sm:text-5xl",
                )}
              >
                {stat.prefix}
                <EditableText
                  value={stat.value}
                  onChange={(value) => handleStatUpdate(index, "value", value)}
                  styleKey={`stat-${index}-value`}
                  className="inline"
                  inline
                />
                {stat.suffix}
              </div>
              <div
                className={cn(
                  "mt-2",
                  isBrandStrip
                    ? "text-muted-foreground text-sm"
                    : "text-primary-foreground/80",
                )}
              >
                <EditableText
                  value={stat.label}
                  onChange={(value) => handleStatUpdate(index, "label", value)}
                  styleKey={`stat-${index}-label`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
