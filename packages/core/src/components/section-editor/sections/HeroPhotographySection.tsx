"use client";

import type {
  HeroPhotographyContent,
  HeroPhotographyStat,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, Image, Play, Plus, Trash2 } from "lucide-react";

import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroPhotographySectionProps {
  section: SectionConfig;
}

export function HeroPhotographySection({ section }: HeroPhotographySectionProps) {
  const content = section.content as HeroPhotographyContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    EditableImage,
    LinkComponent,
  } = useSectionEditor();

  /** Resolve href, anchor links that target missing elements fall back to /all-courses */
  const resolveHref = (href: string) => {
    if (!href || href.startsWith("#")) return "/all-courses";
    return href;
  };

  const handleCtaClick = (href: string) => {
    if (href.startsWith("#")) {
      // Try exact match first
      const el = document.getElementById(href.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      // Fallback: find section by partial ID match (e.g. "gallery-photography")
      const keyword = href.slice(1).replace(/^section-/, "").replace(/-\d+$/, "");
      if (keyword) {
        const fallback = document.querySelector<HTMLElement>(`[id*="${keyword}"]`);
        if (fallback) {
          fallback.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
    }
  };

  const handleContentUpdate = (key: keyof HeroPhotographyContent, value: unknown) => {
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

  const handleStatUpdate = (index: number, updates: Partial<HeroPhotographyStat>) => {
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
    handleContentUpdate("stats", stats.filter((_: HeroPhotographyStat, i: number) => i !== index));
  };

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        {content.image ? (
          <img
            src={content.image}
            alt={content.imageAlt || "Hero background"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.75))",
          }}
        />
      </div>

      {/* Edit background image button, bottom-right corner */}
      {isEditMode && (
        <div className="absolute bottom-6 right-6 z-20 h-10 w-10 overflow-hidden rounded-lg" style={{ border: "2px solid rgba(255,255,255,0.5)" }}>
          <EditableImage
            src={content.image || ""}
            alt={content.imageAlt || "Hero background"}
            onChange={(src) => handleContentUpdate("image", src)}
            className="h-full w-full"
            aspectRatio="square"
            placeholder="BG"
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Headline */}
          <h1 className="whitespace-pre-line text-[clamp(3rem,8vw,8rem)] font-black uppercase leading-[0.9] tracking-tighter text-white" style={{ fontFamily: "var(--font-display, Georgia, serif)" }}>
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              as="span"
              className="text-white"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
              multiline
            />
          </h1>

          {/* Description */}
          {(content.description || isEditMode) && (
            <p className="mx-auto max-w-3xl text-base font-medium text-white/90 sm:text-xl md:text-2xl lg:text-3xl">
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add a compelling subtitle..."
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
              />
            </p>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4 pt-6 sm:gap-6 sm:pt-8">
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
                  className="inline-flex items-center gap-2 px-6 py-3 text-base font-bold uppercase tracking-wider transition-all hover:-translate-x-1 hover:-translate-y-1 sm:px-10 sm:py-5 sm:text-xl"
                  style={{
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    border: "3px solid rgba(255,255,255,0.3)",
                    boxShadow: "6px 6px 0px 0px rgba(255,255,255,0.2)",
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
                      <ArrowRight className="h-5 w-5" />
                    </>
                  ) : (
                    <LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">
                      {content.primaryCta.text}
                      <ArrowRight className="h-5 w-5" />
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
                  className="inline-flex items-center gap-2 px-6 py-3 text-base font-bold uppercase tracking-wider text-white transition-all hover:-translate-x-1 hover:-translate-y-1 sm:px-10 sm:py-5 sm:text-xl"
                  style={{
                    border: "3px solid #FFFFFF",
                    boxShadow: "6px 6px 0px 0px rgba(255,255,255,0.2)",
                    backgroundColor: "transparent",
                  }}
                >
                  {(() => {
                    const SecIcon = content.secondaryCta!.href.includes("gallery") ? Image : Play;
                    if (isEditMode) {
                      return (
                        <>
                          <SecIcon className="h-5 w-5" />
                          <EditableText
                            value={content.secondaryCta!.text}
                            onChange={(v) => handleContentUpdate("secondaryCta", { ...content.secondaryCta, text: v })}
                            as="span"
                            styleKey="secondaryCta"
                            style={content.textStyles?.secondaryCta}
                            onStyleChange={(s) => handleTextStyleChange("secondaryCta", s)}
                          />
                        </>
                      );
                    }
                    if (content.secondaryCta!.href.startsWith("#")) {
                      return (
                        <span
                          className="inline-flex cursor-pointer items-center gap-2"
                          onClick={() => handleCtaClick(content.secondaryCta!.href)}
                        >
                          <SecIcon className="h-5 w-5" />
                          {content.secondaryCta!.text}
                        </span>
                      );
                    }
                    return (
                      <LinkComponent href={content.secondaryCta!.href} className="inline-flex items-center gap-2">
                        <SecIcon className="h-5 w-5" />
                        {content.secondaryCta!.text}
                      </LinkComponent>
                    );
                  })()}
                </button>
              </EditableClickable>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-6 pt-8 sm:gap-12 sm:pt-12">
            {stats.map((stat, index) => (
              <div key={stat.id} className="relative text-white">
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => removeStat(index)}
                    className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <p className="text-3xl font-black tabular-nums sm:text-5xl">
                  <EditableText
                    value={stat.value}
                    onChange={(v) => handleStatUpdate(index, { value: v })}
                    as="span"
                  />
                </p>
                <p className="mt-1 text-sm font-medium uppercase tracking-wider text-white/70 sm:mt-2 sm:text-lg">
                  <EditableText
                    value={stat.label}
                    onChange={(v) => handleStatUpdate(index, { label: v })}
                    as="span"
                  />
                </p>
              </div>
            ))}
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={addStat} className="self-center text-white border-white/30">
                <Plus className="mr-1 h-4 w-4" /> Add Stat
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
