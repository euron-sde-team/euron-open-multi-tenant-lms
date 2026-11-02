"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  HeroExamprepContent,
  HeroExamprepStat,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, Award, Plus, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroExamprepSectionProps {
  section: SectionConfig;
}

export function HeroExamprepSection({ section }: HeroExamprepSectionProps) {
  const content = section.content as HeroExamprepContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    EditableMedia,
    LinkComponent,
  } = useSectionEditor();

  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof HeroExamprepContent, value: unknown) => {
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

  const handleStatUpdate = (index: number, updates: Partial<HeroExamprepStat>) => {
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
    handleContentUpdate("stats", stats.filter((_: HeroExamprepStat, i: number) => i !== index));
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
        "relative grid min-h-[100svh] items-center overflow-hidden pt-16 pb-16 md:pt-24 md:pb-20",
        hasCustomBg && "bg-transparent",
      )}
      style={
        !hasCustomBg
          ? {
              background:
                "linear-gradient(to bottom right, hsl(var(--primary) / 0.06), hsl(var(--background)), hsl(var(--ring) / 0.06))",
            }
          : undefined
      }
    >
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-[3%] top-[8%] h-72 w-72 rounded-full blur-3xl"
          style={{ background: "hsl(var(--primary) / 0.08)" }}
        />
        <div
          className="absolute bottom-[8%] right-[3%] h-96 w-96 rounded-full blur-3xl"
          style={{ background: "hsl(var(--ring) / 0.06)" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 sm:gap-12 lg:grid-cols-2">
          {/* Text content */}
          <div className="min-w-0 text-center lg:text-left">
            {/* Badge */}
            {(content.badge || isEditMode) && (
              <div className="flex justify-center lg:justify-start">
                <div
                  className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2"
                  style={{ background: "hsl(var(--primary) / 0.1)" }}
                >
                  <Award className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    <EditableText
                      value={content.badge || ""}
                      onChange={(v) => handleContentUpdate("badge", v)}
                      as="span"
                      placeholder="Badge text..."
                    />
                  </span>
                </div>
              </div>
            )}

            {/* Headline */}
            <h1 className="break-words text-[clamp(1.75rem,5vw,3.5rem)] font-bold leading-tight">
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
                  {" "}
                  <span className="text-primary">
                    <EditableText
                      value={content.headlineAccent || ""}
                      onChange={(v) => handleContentUpdate("headlineAccent", v)}
                      as="span"
                      placeholder="Accent text..."
                    />
                  </span>
                </>
              )}
            </h1>

            {/* Description */}
            {(content.description || isEditMode) && (
              <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:mt-6 sm:text-lg md:text-xl lg:mx-0">
                <EditableText
                  value={content.description || ""}
                  onChange={(v) => handleContentUpdate("description", v)}
                  as="span"
                  placeholder="Add a description..."
                  styleKey="description"
                  style={content.textStyles?.description}
                  onStyleChange={(s) => handleTextStyleChange("description", s)}
                  multiline
                />
              </p>
            )}

            {/* CTA */}
            {content.primaryCta && !content.primaryCta.hidden && (
              <div className="mt-6 flex flex-col items-center gap-4 sm:mt-8 sm:flex-row sm:justify-center lg:justify-start">
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
                    className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold shadow-lg transition-all hover:scale-105 hover:shadow-xl sm:px-8 sm:py-4"
                    style={{
                      background: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
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

          {/* Hero image, visible on all screen sizes */}
          <div className="order-first lg:order-last">
            <div className="relative mx-auto max-w-md sm:max-w-lg lg:max-w-none">
              <div
                className="absolute -inset-4 rounded-2xl blur-2xl"
                style={{
                  background:
                    "linear-gradient(to right, hsl(var(--primary) / 0.2), hsl(var(--ring) / 0.2))",
                }}
              />
              <div className="relative overflow-hidden rounded-2xl shadow-2xl">
                <EditableMedia
                  image={content.image}
                  imageAlt={content.imageAlt || "Hero image"}
                  onImageChange={(src, alt) => {
                    handleContentUpdate("image", src);
                    handleContentUpdate("imageAlt", alt);
                  }}
                  onVideoChange={() => {}}
                  className="aspect-square w-full object-cover"
                  aspectRatio="square"
                  placeholder="Click to add hero image"
                  lockedAspectRatio="1:1"
                  recommendedAspectRatio="1:1"
                  sectionContext={{
                    sectionType: section.type,
                    headline: content.headline,
                    description: content.description,
                    badge: content.badge,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats row - not in the original HTML hero but keeping for template flexibility */}
        {stats.length > 0 && (
          <div className="mt-12 flex flex-wrap justify-center gap-8 lg:justify-start lg:gap-12">
            {stats.map((stat, index) => (
              <div key={stat.id} className="relative text-center">
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => removeStat(index)}
                    className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <p className="text-3xl font-bold text-primary sm:text-4xl">
                  <EditableText
                    value={stat.value}
                    onChange={(v) => handleStatUpdate(index, { value: v })}
                    as="span"
                  />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <EditableText
                    value={stat.label}
                    onChange={(v) => handleStatUpdate(index, { label: v })}
                    as="span"
                  />
                </p>
              </div>
            ))}
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={addStat} className="self-center">
                <Plus className="mr-1 h-4 w-4" /> Add Stat
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
