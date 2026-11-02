"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  CtaExamprepContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight } from "lucide-react";

import { cn } from "../../../lib/utils";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface CtaExamprepSectionProps {
  section: SectionConfig;
}

export function CtaExamprepSection({ section }: CtaExamprepSectionProps) {
  const { isEditMode, EditableText, updateSectionContent, LinkComponent } = useSectionEditor();
  const content = section.content as CtaExamprepContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof CtaExamprepContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleCtaClick = (href: string) => {
    if (href.startsWith("#")) {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden py-16 md:py-20",
        hasCustomBg && "bg-transparent",
      )}
      style={
        !hasCustomBg
          ? { background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--ring)))" }
          : undefined
      }
    >
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <div className="absolute left-0 top-0 h-96 w-96 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        {/* Headline */}
        <h2 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl lg:text-5xl">
          <EditableText
            value={content.headline}
            onChange={(v) => handleContentUpdate("headline", v)}
            as="span"
            className="text-white"
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => handleTextStyleChange("headline", s)}
          />
        </h2>

        {/* Description */}
        {(content.description || isEditMode) && (
          <p className="mx-auto mt-6 max-w-2xl text-base text-white/80 sm:text-lg md:text-xl">
            <EditableText
              value={content.description || ""}
              onChange={(v) => handleContentUpdate("description", v)}
              as="span"
              className="text-white/80"
              placeholder="Add a description..."
              styleKey="description"
              style={content.textStyles?.description}
              onStyleChange={(s) => handleTextStyleChange("description", s)}
            />
          </p>
        )}

        {/* CTA */}
        {content.primaryCta && !content.primaryCta.hidden && (
          <div className="mt-8">
            <EditableClickable
              href={content.primaryCta.href}
              onHrefChange={(href) =>
                handleContentUpdate("primaryCta", { ...content.primaryCta, href })
              }
              hidden={content.primaryCta.hidden}
              onHiddenChange={(hidden) =>
                handleContentUpdate("primaryCta", { ...content.primaryCta, hidden })
              }
              isEditing={isEditMode}
              slotLabel="CTA Button"
            >
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg px-8 py-4 text-base font-semibold shadow-xl transition-all hover:scale-105"
                style={{
                  background: "hsl(var(--background))",
                  color: "hsl(var(--primary))",
                }}
              >
                {isEditMode ? (
                  <EditableText
                    value={content.primaryCta.text}
                    onChange={(v) =>
                      handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })
                    }
                    as="span"
                  />
                ) : content.primaryCta.href.startsWith("#") ? (
                  <span
                    className="inline-flex items-center gap-2"
                    onClick={() => handleCtaClick(content.primaryCta!.href)}
                  >
                    {content.primaryCta.text}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                ) : (
                  <LinkComponent href={content.primaryCta.href} className="inline-flex items-center gap-2">
                    {content.primaryCta.text}
                    <ArrowRight className="h-4 w-4" />
                  </LinkComponent>
                )}
                {isEditMode && <ArrowRight className="h-4 w-4" />}
              </button>
            </EditableClickable>
          </div>
        )}
      </div>
    </section>
  );
}
