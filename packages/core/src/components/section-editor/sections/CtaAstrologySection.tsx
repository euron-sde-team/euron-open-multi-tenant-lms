"use client";

import type {
  CtaAstrologyContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, Shield } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

const CTA_BG_IMAGE = "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1600&q=80";

interface CtaAstrologySectionProps {
  section: SectionConfig;
}

export function CtaAstrologySection({ section }: CtaAstrologySectionProps) {
  const { isEditMode, EditableText, EditableImage, updateSectionContent, LinkComponent } = useSectionEditor();
  const content = section.content as CtaAstrologyContent;

  const handleCtaClick = (href: string) => {
    if (href.startsWith("#")) {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleContentUpdate = (key: keyof CtaAstrologyContent, value: unknown) => {
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
    <section className="relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <EditableImage
          src={content.backgroundImage || CTA_BG_IMAGE}
          alt=""
          onChange={(src) => handleContentUpdate("backgroundImage", src)}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Dark overlay, works for both light & dark mode readability */}
      <div className="absolute inset-0 z-[1] bg-black/65" />

      {/* Subtle primary color wash */}
      <div
        className="absolute inset-0 z-[2]"
        style={{ background: "radial-gradient(ellipse at 50% 50%, hsl(var(--primary) / 0.15) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 px-4 py-14 text-center sm:px-6 sm:py-16 md:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Headline */}
          <h2
            className="text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-[1] tracking-tight text-white"
            style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
          >
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              as="span"
              className="text-white"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
            />
            {(content.headlineAccent || isEditMode) && (
              <>
                <br />
                <span className="text-primary" style={{ textShadow: "0 0 40px hsl(var(--primary) / 0.4)" }}>
                  <EditableText
                    value={content.headlineAccent || ""}
                    onChange={(v) => handleContentUpdate("headlineAccent", v)}
                    as="span"
                    placeholder="Accent text..."
                  />
                </span>
              </>
            )}
          </h2>

          {/* Description */}
          {(content.description || isEditMode) && (
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/75 sm:mt-6 sm:text-base md:text-lg">
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add description..."
              />
            </p>
          )}

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap justify-center gap-3 sm:mt-10 sm:gap-4">
            {content.primaryCta && !content.primaryCta.hidden && (
              <EditableClickable
                href={content.primaryCta.href}
                onHrefChange={(href) => handleContentUpdate("primaryCta", { ...content.primaryCta, href })}
                hidden={content.primaryCta.hidden}
                onHiddenChange={(hidden) => handleContentUpdate("primaryCta", { ...content.primaryCta, hidden })}
                isEditing={isEditMode}
                slotLabel="Primary Button"
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-all duration-300 hover:scale-105 sm:px-9 sm:py-4 sm:text-base"
                  style={{
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    boxShadow: "0 0 24px hsl(var(--primary) / 0.4)",
                  }}
                >
                  {isEditMode ? (
                    <>
                      <EditableText value={content.primaryCta.text} onChange={(v) => handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })} as="span" />
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : content.primaryCta.href.startsWith("#") ? (
                    <span className="inline-flex items-center gap-2" onClick={() => handleCtaClick(content.primaryCta!.href)}>
                      {content.primaryCta.text} <ArrowRight className="h-4 w-4" />
                    </span>
                  ) : (
                    <LinkComponent href={content.primaryCta.href} className="inline-flex items-center gap-2">
                      {content.primaryCta.text} <ArrowRight className="h-4 w-4" />
                    </LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
            {content.secondaryCta && !content.secondaryCta.hidden && (
              <EditableClickable
                href={content.secondaryCta.href}
                onHrefChange={(href) => handleContentUpdate("secondaryCta", { ...content.secondaryCta, href })}
                hidden={content.secondaryCta.hidden}
                onHiddenChange={(hidden) => handleContentUpdate("secondaryCta", { ...content.secondaryCta, hidden })}
                isEditing={isEditMode}
                slotLabel="Secondary Button"
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/20 sm:px-9 sm:py-4 sm:text-base"
                >
                  {isEditMode ? (
                    <EditableText value={content.secondaryCta.text} onChange={(v) => handleContentUpdate("secondaryCta", { ...content.secondaryCta, text: v })} as="span" />
                  ) : (
                    <LinkComponent href={content.secondaryCta.href} className="inline-flex items-center gap-2">
                      {content.secondaryCta.text}
                    </LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
          </div>

          {/* Guarantee text */}
          {(content.guaranteeText || isEditMode) && (
            <p className="mt-7 text-xs text-white/50 sm:text-sm">
              <Shield className="mr-1.5 inline-block h-3.5 w-3.5" />
              <EditableText
                value={content.guaranteeText || ""}
                onChange={(v) => handleContentUpdate("guaranteeText", v)}
                as="span"
                placeholder="Guarantee text..."
              />
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
