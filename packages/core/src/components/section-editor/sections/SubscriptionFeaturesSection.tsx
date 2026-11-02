"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, SubscriptionFeaturesContent } from "@open-mtlms/shared";
import { Sparkles, ArrowRight } from "lucide-react";

import { cn } from "../../../lib/utils";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

interface SubscriptionFeaturesSectionProps {
  section: SectionConfig;
}

export function SubscriptionFeaturesSection({ section }: SubscriptionFeaturesSectionProps) {
  const content = section.content as SubscriptionFeaturesContent;
  const { EditableText, isEditMode, updateSectionContent } = useSectionEditor();
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof SubscriptionFeaturesContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleCategoryUpdate = (catIndex: number, key: string, value: unknown) => {
    const newCategories = [...(content.categories || [])];
    newCategories[catIndex] = { ...newCategories[catIndex], [key]: value };
    handleContentUpdate("categories", newCategories);
  };

  const handleItemUpdate = (catIndex: number, itemIndex: number, key: string, value: string) => {
    const newCategories = [...(content.categories || [])];
    const newItems = [...(newCategories[catIndex].items || [])];
    newItems[itemIndex] = { ...newItems[itemIndex], [key]: value };
    newCategories[catIndex] = { ...newCategories[catIndex], items: newItems };
    handleContentUpdate("categories", newCategories);
  };

  // Alternating accent colors for category cards
  const accentStyles = [
    { dot: "bg-primary", border: "group-hover:border-primary/40", glow: "group-hover:shadow-primary/5" },
    { dot: "bg-violet-500", border: "group-hover:border-violet-500/40", glow: "group-hover:shadow-violet-500/5" },
    { dot: "bg-amber-500", border: "group-hover:border-amber-500/40", glow: "group-hover:shadow-amber-500/5" },
    { dot: "bg-emerald-500", border: "group-hover:border-emerald-500/40", glow: "group-hover:shadow-emerald-500/5" },
    { dot: "bg-rose-500", border: "group-hover:border-rose-500/40", glow: "group-hover:shadow-rose-500/5" },
  ];

  return (
    <section
      className={cn(
        "relative overflow-hidden px-4 py-20 sm:px-6 sm:py-24 md:py-28 lg:px-8",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      {/* Subtle background grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <EditableLabel value={content.badgeLabel} fallback="Everything you get" onChange={(v) => handleContentUpdate("badgeLabel", v)} />
          </div>
          <EditableText
            value={content.headline}
            onChange={(value) => handleContentUpdate("headline", value)}
            styleKey="headline"
            as="h2"
            className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl"
          />
          {content.subheadline && (
            <div className="mt-4 sm:mt-5">
              <EditableText
                value={content.subheadline}
                onChange={(value) => handleContentUpdate("subheadline", value)}
                styleKey="subheadline"
                as="p"
                className="text-base leading-relaxed text-muted-foreground sm:text-lg"
              />
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="mt-16 space-y-20 sm:mt-20">
          {content.categories?.map((category, catIndex) => {
            const accent = accentStyles[catIndex % accentStyles.length];
            return (
              <div key={category.id || catIndex}>
                {/* Category header */}
                <div className="mb-8 flex items-center gap-3 sm:mb-10">
                  <div className={cn("h-8 w-1 rounded-full", accent.dot)} />
                  <div>
                    <h3 className="text-lg font-bold sm:text-xl">
                      {isEditMode ? (
                        <EditableText
                          value={category.label}
                          onChange={(value) => handleCategoryUpdate(catIndex, "label", value)}
                        />
                      ) : (
                        category.label
                      )}
                    </h3>
                    {category.subtitle && (
                      <div className="mt-1">
                        <EditableText
                          value={category.subtitle}
                          onChange={(value) => handleCategoryUpdate(catIndex, "subtitle", value)}
                          as="p"
                          className="text-sm text-muted-foreground"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Feature items, modern card grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {category.items?.map((item, itemIndex) => (
                    <div
                      key={item.id || itemIndex}
                      className={cn(
                        "group relative rounded-2xl border bg-card p-6 transition-all duration-300",
                        "hover:-translate-y-0.5 hover:shadow-xl",
                        accent.border,
                        accent.glow,
                      )}
                    >
                      {/* Numbered badge */}
                      <div className="mb-4 flex items-center gap-3">
                        <span className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white",
                          accent.dot,
                        )}>
                          {String(itemIndex + 1).padStart(2, "0")}
                        </span>
                        <EditableText
                          value={item.title}
                          onChange={(value) => handleItemUpdate(catIndex, itemIndex, "title", value)}
                          as="h4"
                          className="text-sm font-bold leading-snug sm:text-base"
                        />
                      </div>
                      {item.description && (
                        <div className="pl-11">
                          <EditableText
                            value={item.description}
                            onChange={(value) => handleItemUpdate(catIndex, itemIndex, "description", value)}
                            as="p"
                            className="text-xs leading-relaxed text-muted-foreground sm:text-sm"
                          />
                        </div>
                      )}
                      {/* Hover arrow indicator */}
                      <div className="pointer-events-none absolute right-4 top-6 opacity-0 transition-opacity duration-300 group-hover:opacity-60">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
