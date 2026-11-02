"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { SectionConfig, PrivacyUsHeroContent, TextStyle } from "@open-mtlms/shared";
import { Calendar } from "lucide-react";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

interface PrivacyUsHeroSectionProps {
  section: SectionConfig;
}

export function PrivacyUsHeroSection({ section }: PrivacyUsHeroSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as PrivacyUsHeroContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof PrivacyUsHeroContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden py-14 md:py-16",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-28 -top-28 h-[420px] w-[420px] rounded-full bg-primary/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -left-24 h-[500px] w-[500px] rounded-full bg-accent/[0.04] blur-3xl" />

      <div className="container-custom relative text-center">
        <h1 className="text-[clamp(2.2rem,5vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight">
          <EditableText
            value={content.headline}
            onChange={(v) => handleContentUpdate("headline", v)}
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => handleTextStyleChange("headline", s)}
            as="span"
          />{" "}
          {(content.highlightText || isEditMode) && (
            <span className="italic text-primary">
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

        <p className="mx-auto mt-4 max-w-lg text-[clamp(1rem,2vw,1.1rem)] leading-relaxed text-muted-foreground">
          <EditableText
            value={content.description}
            onChange={(v) => handleContentUpdate("description", v)}
            styleKey="description"
            style={content.textStyles?.description}
            onStyleChange={(s) => handleTextStyleChange("description", s)}
            multiline
          />
        </p>

        {/* Last updated + version */}
        {(content.lastUpdated || content.version || isEditMode) && (
          <div className="mt-5 flex items-center justify-center gap-3 text-sm text-muted-foreground">
            {(content.lastUpdated || isEditMode) && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>Last updated: </span>
                <EditableText
                  value={content.lastUpdated ?? ""}
                  onChange={(v) => handleContentUpdate("lastUpdated", v)}
                  as="span"
                 
                />
              </span>
            )}
            {content.lastUpdated && content.version && (
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            )}
            {(content.version || isEditMode) && (
              <span>
                <span>Version </span>
                <EditableText
                  value={content.version ?? ""}
                  onChange={(v) => handleContentUpdate("version", v)}
                  as="span"
                  placeholder="1.0"
                />
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
