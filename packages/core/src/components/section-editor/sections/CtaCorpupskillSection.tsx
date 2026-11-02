"use client";

import type {
  CtaCorpupskillContent,
  TrustBadge,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Trash2 } from "lucide-react";
import * as LucideIcons from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface CtaCorpupskillSectionProps {
  section: SectionConfig;
}

export function CtaCorpupskillSection({ section }: CtaCorpupskillSectionProps) {
  const { isEditMode, EditableText, EditableMedia, updateSectionContent, LinkComponent } = useSectionEditor();
  const content = section.content as CtaCorpupskillContent;
  const trustBadges = content.trustBadges ?? [];

  const handleContentUpdate = (key: keyof CtaCorpupskillContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleBadgeUpdate = (index: number, updates: Partial<TrustBadge>) => {
    const newBadges = [...trustBadges];
    newBadges[index] = { ...newBadges[index], ...updates };
    handleContentUpdate("trustBadges", newBadges);
  };

  const addBadge = () => {
    handleContentUpdate("trustBadges", [
      ...trustBadges,
      { id: `tb-${Date.now()}`, icon: "star", text: "New Badge" },
    ]);
  };

  const removeBadge = (index: number) => {
    if (trustBadges.length <= 1) return;
    handleContentUpdate("trustBadges", trustBadges.filter((_: TrustBadge, i: number) => i !== index));
  };

  const handleCtaClick = (href: string) => {
    if (href.startsWith("#")) {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const hasBgImage = Boolean(content.backgroundImage);
  const showPhotoLayer = hasBgImage || isEditMode;

  return (
    <section className="relative overflow-hidden py-20 text-white sm:py-24 md:py-32">
      {/* Background: photo + overlay (hero-style) or solid bar */}
      {showPhotoLayer ? (
        <>
          <div className="absolute inset-0 min-h-[280px] sm:min-h-[360px]">
            {isEditMode ? (
              <EditableMedia
                image={content.backgroundImage}
                imageAlt={content.backgroundImageAlt ?? "CTA background"}
                onImageChange={(src, alt) => {
                  handleContentUpdate("backgroundImage", src);
                  handleContentUpdate("backgroundImageAlt", alt);
                }}
                onVideoChange={() => {}}
                className="h-full w-full object-cover"
                aspectRatio="video"
                placeholder="Click to add CTA background image"
                recommendedAspectRatio="16:9"
                sectionContext={{
                  sectionType: section.type,
                  headline: content.headline,
                  description: content.description,
                }}
              />
            ) : hasBgImage ? (
              <img
                src={content.backgroundImage}
                alt={content.backgroundImageAlt ?? ""}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/85"
            aria-hidden
          />
        </>
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-b from-neutral-900 to-black"
          aria-hidden
        />
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-12">
        {/* Headline */}
        <h2 className="mb-8 text-4xl font-black leading-none sm:mb-12 sm:text-5xl md:text-6xl lg:text-8xl">
          <EditableText
            value={content.headline}
            onChange={(v) => handleContentUpdate("headline", v)}
            as="span"
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => handleTextStyleChange("headline", s)}
          />
        </h2>

        {/* Description */}
        {(content.description || isEditMode) && (
          <p
            className="mx-auto mb-12 max-w-3xl text-lg text-white/80 sm:mb-16 sm:text-xl md:text-2xl"
          >
            <EditableText
              value={content.description || ""}
              onChange={(v) => handleContentUpdate("description", v)}
              as="span"
              placeholder="Add a description..."
              multiline
            />
          </p>
        )}

        {/* CTA Button */}
        {content.primaryCta && !content.primaryCta.hidden && (
          <div className="mb-12 flex flex-col items-center gap-6 sm:mb-16 sm:flex-row sm:justify-center">
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
                className="px-10 py-5 text-lg font-bold text-white transition-all hover:opacity-90 sm:px-12 sm:py-6 sm:text-xl"
                style={{ background: "hsl(var(--primary))" }}
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
                  <span onClick={() => handleCtaClick(content.primaryCta!.href)}>
                    {content.primaryCta.text}
                  </span>
                ) : (
                  <LinkComponent href={content.primaryCta.href}>
                    {content.primaryCta.text}
                  </LinkComponent>
                )}
              </button>
            </EditableClickable>
          </div>
        )}

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-8 text-white/75 sm:gap-12">
          {trustBadges.map((badge, index) => {
            const iconName = (badge.icon || "star")
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join("") as keyof typeof LucideIcons;
            const IconComp = (LucideIcons[iconName] as React.ComponentType<{ className?: string }>) || LucideIcons.Star;

            return (
              <div key={badge.id} className="relative flex items-center gap-3">
                {isEditMode && trustBadges.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBadge(index)}
                    className="absolute right-2 top-3 z-10 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
                <IconComp className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="font-semibold">
                  <EditableText
                    value={badge.text}
                    onChange={(v) => handleBadgeUpdate(index, { text: v })}
                    as="span"
                  />
                </span>
              </div>
            );
          })}
        </div>

        {isEditMode && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={addBadge}
              className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              <Plus className="h-4 w-4" /> Add Badge
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
