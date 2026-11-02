"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  CtaPhotographyContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, Shield } from "lucide-react";

import { cn } from "../../../lib/utils";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface CtaPhotographySectionProps {
  section: SectionConfig;
}

export function CtaPhotographySection({ section }: CtaPhotographySectionProps) {
  const { isEditMode, EditableText, updateSectionContent, LinkComponent } = useSectionEditor();
  const content = section.content as CtaPhotographyContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  /** Resolve href, anchor links fall back to /all-courses */
  const resolveHref = (href: string) => {
    if (!href || href.startsWith("#")) return "/all-courses";
    return href;
  };

  const handleContentUpdate = (key: keyof CtaPhotographyContent, value: unknown) => {
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
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-muted",
      )}
      style={{
        borderTop: "3px solid hsl(var(--foreground))",
      }}
    >
      <div className="mx-auto max-w-[1440px] px-4 text-center sm:px-6 lg:px-8">
        {/* Headline */}
        <h2
          className="text-[clamp(2rem,7vw,6rem)] font-black uppercase tracking-tighter leading-[0.9]"
          style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
        >
          <EditableText
            value={content.headline}
            onChange={(v) => handleContentUpdate("headline", v)}
            as="span"
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => handleTextStyleChange("headline", s)}
          />
          {(content.headlineAccent || isEditMode) && (
            <>
              <br />
              <EditableText
                value={content.headlineAccent || ""}
                onChange={(v) => handleContentUpdate("headlineAccent", v)}
                as="span"
                placeholder="Accent text..."
              />
            </>
          )}
        </h2>

        {/* Description */}
        {(content.description || isEditMode) && (
          <p className="mx-auto mt-4 max-w-3xl text-base font-medium text-muted-foreground sm:mt-6 sm:text-xl md:text-2xl">
            <EditableText
              value={content.description || ""}
              onChange={(v) => handleContentUpdate("description", v)}
              as="span"
              placeholder="Add description..."
            />
          </p>
        )}

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap justify-center gap-6">
          {content.primaryCta && !content.primaryCta.hidden && (
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
              slotLabel="Primary Button"
            >
              <button
                type="button"
                className="inline-flex items-center gap-2 px-7 py-4 text-lg font-bold uppercase tracking-wider transition-all hover:-translate-x-1 hover:-translate-y-1 sm:px-12 sm:py-6 sm:text-2xl"
                style={{
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  border: "3px solid hsl(var(--foreground))",
                  boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
                }}
              >
                {isEditMode ? (
                  <>
                    <EditableText
                      value={content.primaryCta.text}
                      onChange={(v) => handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })}
                      as="span"
                      styleKey="primaryCta"
                      style={content.textStyles?.primaryCta}
                      onStyleChange={(s) => handleTextStyleChange("primaryCta", s)}
                    />
                    <ArrowRight className="h-6 w-6" />
                  </>
                ) : (
                  <LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">
                    {content.primaryCta.text}
                    <ArrowRight className="h-6 w-6" />
                  </LinkComponent>
                )}
              </button>
            </EditableClickable>
          )}
          {content.secondaryCta && !content.secondaryCta.hidden && (
            <EditableClickable
              href={content.secondaryCta.href}
              onHrefChange={(href) =>
                handleContentUpdate("secondaryCta", { ...content.secondaryCta, href })
              }
              hidden={content.secondaryCta.hidden}
              onHiddenChange={(hidden) =>
                handleContentUpdate("secondaryCta", { ...content.secondaryCta, hidden })
              }
              isEditing={isEditMode}
              slotLabel="Secondary Button"
            >
              <button
                type="button"
                className="inline-flex items-center gap-2 px-7 py-4 text-lg font-bold uppercase tracking-wider transition-all hover:-translate-x-1 hover:-translate-y-1 sm:px-12 sm:py-6 sm:text-2xl"
                style={{
                  backgroundColor: "hsl(var(--background))",
                  color: "hsl(var(--foreground))",
                  border: "3px solid hsl(var(--foreground))",
                  boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
                }}
              >
                {isEditMode ? (
                  <EditableText
                    value={content.secondaryCta.text}
                    onChange={(v) => handleContentUpdate("secondaryCta", { ...content.secondaryCta, text: v })}
                    as="span"
                    styleKey="secondaryCta"
                    style={content.textStyles?.secondaryCta}
                    onStyleChange={(s) => handleTextStyleChange("secondaryCta", s)}
                  />
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
          <p className="mt-8 text-lg text-muted-foreground">
            <Shield className="mr-2 inline-block h-5 w-5" />
            <EditableText
              value={content.guaranteeText || ""}
              onChange={(v) => handleContentUpdate("guaranteeText", v)}
              as="span"
              placeholder="Guarantee text..."
            />
          </p>
        )}
      </div>
    </section>
  );
}
