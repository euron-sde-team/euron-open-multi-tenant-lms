"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  SectionConfig,
  AboutUsHeroContent,
  AboutUsHeroStat,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

interface AboutUsHeroSectionProps {
  section: SectionConfig;
}

export function AboutUsHeroSection({ section }: AboutUsHeroSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as AboutUsHeroContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof AboutUsHeroContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const stats = content.stats ?? [];

  const handleStatUpdate = (index: number, updates: Partial<AboutUsHeroStat>) => {
    const newStats = [...stats];
    newStats[index] = { ...newStats[index], ...updates };
    handleContentUpdate("stats", newStats);
  };

  const addStat = () => {
    handleContentUpdate("stats", [
      ...stats,
      { id: `stat-${Date.now()}`, value: "0+", label: "New Stat" },
    ]);
  };

  const removeStat = (index: number) => {
    if (stats.length <= 1) return;
    handleContentUpdate("stats", stats.filter((_, i) => i !== index));
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden py-16 md:py-20",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      {/* Decorative radial gradients */}
      <div className="pointer-events-none absolute -right-20 -top-28 h-[400px] w-[400px] rounded-full bg-primary/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-[300px] w-[300px] rounded-full bg-primary/[0.04] blur-3xl" />

      <div className="container-custom relative text-center">
        {/* Headline */}
        <h1 className="text-[clamp(2.375rem,6vw,3.5rem)] font-bold leading-tight tracking-tight">
          <EditableText
            value={content.headline}
            onChange={(v) => handleContentUpdate("headline", v)}
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => handleTextStyleChange("headline", s)}
            as="span"
          />{" "}
          {(content.highlightText || isEditMode) && (
            <span className="text-primary">
              <EditableText
                value={content.highlightText ?? ""}
                onChange={(v) => handleContentUpdate("highlightText", v)}
                styleKey="highlightText"
                style={content.textStyles?.highlightText}
                onStyleChange={(s) => handleTextStyleChange("highlightText", s)}
                as="span"
               
              />
            </span>
          )}
        </h1>

        {/* Decorative line */}
        <div className="mx-auto mb-6 mt-4 h-[3px] w-14 rounded-full bg-primary" />

        {/* Description */}
        <p className="mx-auto max-w-[620px] text-[17px] leading-relaxed text-muted-foreground">
          <EditableText
            value={content.description}
            onChange={(v) => handleContentUpdate("description", v)}
            styleKey="description"
            style={content.textStyles?.description}
            onStyleChange={(s) => handleTextStyleChange("description", s)}
            multiline
          />
        </p>

        {/* Stats row */}
        {(stats.length > 0 || isEditMode) && (
          <div className="mt-10 flex flex-wrap justify-center gap-8 md:gap-14">
            {stats.map((stat, i) => (
              <div key={stat.id} className="group/stat relative text-center">
                {isEditMode && stats.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStat(i)}
                    className="absolute -right-1 -top-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/stat:opacity-100"
                    title="Remove stat"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <div className="text-4xl font-bold">
                  <EditableText
                    value={stat.value}
                    onChange={(v) => handleStatUpdate(i, { value: v })}
                    as="span"
                    placeholder="0"
                  />
                </div>
                <div className="mt-1 text-sm font-medium text-muted-foreground">
                  <EditableText
                    value={stat.label}
                    onChange={(v) => handleStatUpdate(i, { label: v })}
                    as="span"
                   
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {isEditMode && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" onClick={addStat}>
              <Plus className="mr-2 h-4 w-4" />
              Add Stat
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
