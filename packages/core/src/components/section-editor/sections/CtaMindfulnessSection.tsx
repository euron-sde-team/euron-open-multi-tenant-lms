"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { CtaMindfulnessContent, SectionConfig, TextStyle } from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface CtaMindfulnessSectionProps {
  section: SectionConfig;
}

export function CtaMindfulnessSection({ section }: CtaMindfulnessSectionProps) {
  const content = section.content as CtaMindfulnessContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();

  const handleContentUpdate = (key: keyof CtaMindfulnessContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "relative overflow-hidden py-16 sm:py-20 md:py-28 lg:py-40",
        hasCustomBg && "bg-transparent"
      )}
    >
      {/* Background, nature image with minimal dark scrim for readability */}
      {!hasCustomBg && (
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1920&q=80"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      <div className="container-custom relative z-10 text-center">
        {/* Badge */}
        {(content.badge || isEditMode) && (
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm sm:mb-8 sm:px-6 sm:py-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/80" />
            <span className="text-white/90">
              <EditableText
                value={content.badge ?? ""}
                onChange={(v) => handleContentUpdate("badge", v)}
                as="span"
                className="text-xs font-semibold sm:text-sm"
                placeholder="Badge text..."
              />
            </span>
          </div>
        )}

        {/* Headline */}
        <div className="text-white">
          <EditableText
            value={content.headline}
            onChange={(v) => handleContentUpdate("headline", v)}
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => handleTextStyleChange("headline", s)}
            as="h2"
            className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-[4.5rem]"
          />
        </div>

        {(content.headlineAccent || isEditMode) && (
          <div className="text-white/80">
            <EditableText
              value={content.headlineAccent ?? ""}
              onChange={(v) => handleContentUpdate("headlineAccent", v)}
              styleKey="headlineAccent"
              style={content.textStyles?.headlineAccent}
              onStyleChange={(s) => handleTextStyleChange("headlineAccent", s)}
              as="span"
              className="block text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-[4.5rem]"
              placeholder="Accent text..."
            />
          </div>
        )}

        {/* Description */}
        {(content.description || isEditMode) && (
          <div className="mt-4 text-white/90 sm:mt-6 lg:mt-8">
            <EditableText
              value={content.description ?? ""}
              onChange={(v) => handleContentUpdate("description", v)}
              styleKey="description"
              style={content.textStyles?.description}
              onStyleChange={(s) => handleTextStyleChange("description", s)}
              as="p"
              className="mx-auto max-w-3xl text-base font-light leading-relaxed sm:text-lg md:text-xl lg:text-2xl"
              multiline
              placeholder="Add a description..."
            />
          </div>
        )}

        {/* CTA Button */}
        {content.primaryCta && !content.primaryCta.hidden && (
          <div className="mt-8 sm:mt-10 lg:mt-14">
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
              <button className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-gray-900 shadow-lg transition-all duration-300 hover:scale-105 hover:bg-white/95 sm:gap-3 sm:px-10 sm:py-4 sm:text-lg md:px-14 md:py-5 md:text-xl">
                {isEditMode ? (
                  <EditableText
                    value={content.primaryCta.text}
                    onChange={(v) =>
                      handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })
                    }
                  />
                ) : (
                  <LinkComponent
                    href={content.primaryCta.href}
                    className="inline-flex items-center gap-3"
                  >
                    {content.primaryCta.text}
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3.333 8h9.334M8.667 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </LinkComponent>
                )}
              </button>
            </EditableClickable>
          </div>
        )}
      </div>
    </section>
  );
}
