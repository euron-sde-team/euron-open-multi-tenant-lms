"use client";

import type {
  HeroPhotographyContent,
  HeroPhotographyStat,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, Dumbbell, Play, Zap } from "lucide-react";
import type { CSSProperties } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroFitnessSectionProps {
  section: SectionConfig;
}

/**
 * Fitness hero, a bold, high-energy full-bleed archetype: a dark image with a
 * dynamic gradient, animated diagonal "speed" streaks, a pulsing energy ring,
 * a punchy uppercase headline, and a chunky stats bar. Deliberately distinct
 * from the warm Cooking split hero. Theme colors via HSL vars.
 */
export function HeroFitnessSection({ section }: HeroFitnessSectionProps) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, EditableImage, LinkComponent } =
    useSectionEditor();

  const resolveHref = (href: string) =>
    !href || href.startsWith("#") ? "/all-courses" : href;
  const update = (key: keyof HeroPhotographyContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const stats = content.stats ?? [];
  const enter = (i: number): CSSProperties =>
    isEditMode ? {} : { animation: "fitFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both", animationDelay: `${i * 0.1}s` };

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden">
      <style>{`
        @keyframes fitFadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
        @keyframes fitStreak { 0% { transform: translateX(-120%) skewX(-18deg); opacity: 0; } 40% { opacity: 0.6; } 100% { transform: translateX(220%) skewX(-18deg); opacity: 0; } }
        @keyframes fitPulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.25); opacity: 0; } }
        @keyframes fitBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>

      {/* Background image */}
      <div className="absolute inset-0 z-0">
        {content.image ? (
          <img src={content.image} alt={content.imageAlt || "Fitness hero"} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ backgroundColor: "hsl(var(--muted))" }} />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(105deg, hsl(var(--primary) / 0.92) 0%, hsl(var(--primary) / 0.6) 42%, rgba(0,0,0,0.55) 100%)" }}
        />
      </div>

      {/* Animated diagonal energy streaks */}
      {!isEditMode && (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute h-[3px] w-1/3 rounded-full"
              style={{
                top: `${20 + i * 26}%`,
                background: "linear-gradient(90deg, transparent, hsl(var(--accent)), transparent)",
                animation: `fitStreak ${3.4 + i}s ease-in-out ${i * 1.1}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {isEditMode && (
        <div className="absolute bottom-6 right-6 z-20 h-10 w-10 overflow-hidden rounded-lg border-2 border-white/60">
          <EditableImage
            src={content.image || ""}
            alt={content.imageAlt || "Fitness hero"}
            onChange={(src) => update("image", src)}
            className="h-full w-full"
            aspectRatio="square"
            placeholder="BG"
          />
        </div>
      )}

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-accent-foreground"
            style={{ backgroundColor: "hsl(var(--accent) / 0.9)", ...enter(0) }}
          >
            <Zap className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Train. Transform. Repeat."} onChange={(v) => update("eyebrow", v)} as="span" />
          </span>

          <h1
            className="mt-5 text-5xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl"
            style={enter(1)}
          >
            <EditableText
              value={content.headline}
              onChange={(v) => update("headline", v)}
              as="span"
              className="text-white"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
              multiline
            />
          </h1>

          {(content.description || isEditMode) && (
            <p className="mt-5 max-w-xl text-lg text-white/90 sm:text-xl" style={enter(2)}>
              <EditableText
                value={content.description || ""}
                onChange={(v) => update("description", v)}
                as="span"
                placeholder="Add a compelling subtitle..."
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
              />
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-4" style={enter(3)}>
            {content.primaryCta && !content.primaryCta.hidden && (
              <EditableClickable
                href={content.primaryCta.href}
                onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })}
                hidden={content.primaryCta.hidden}
                onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })}
                isEditing={isEditMode}
                slotLabel="Primary Button"
              >
                <button
                  type="button"
                  className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold uppercase tracking-wide shadow-xl transition-transform hover:scale-105"
                  style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }}
                >
                  {isEditMode ? (
                    <>
                      <EditableText
                        value={content.primaryCta.text}
                        onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })}
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
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
            {content.secondaryCta && !content.secondaryCta.hidden && (
              <EditableClickable
                href={content.secondaryCta.href}
                onHrefChange={(href) => update("secondaryCta", { ...content.secondaryCta, href })}
                hidden={content.secondaryCta.hidden}
                onHiddenChange={(hidden) => update("secondaryCta", { ...content.secondaryCta, hidden })}
                isEditing={isEditMode}
                slotLabel="Secondary Button"
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-white px-8 py-4 text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
                >
                  <Play className="h-5 w-5" />
                  {isEditMode ? (
                    <EditableText
                      value={content.secondaryCta.text}
                      onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })}
                      as="span"
                      styleKey="secondaryCta"
                      style={content.textStyles?.secondaryCta}
                      onStyleChange={(s) => handleTextStyleChange("secondaryCta", s)}
                    />
                  ) : (
                    <LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
          </div>

          {/* Stats bar */}
          {stats.length > 0 && (
            <div className="mt-12 flex flex-wrap gap-x-10 gap-y-6" style={enter(4)}>
              {stats.map((stat: HeroPhotographyStat, i: number) => (
                <div key={stat.id} className="relative">
                  {!isEditMode && (
                    <span
                      className="absolute -left-3 -top-3 h-8 w-8 rounded-full"
                      style={{ backgroundColor: "hsl(var(--accent))", animation: "fitPulse 2.6s ease-out infinite", animationDelay: `${i * 0.4}s` }}
                    />
                  )}
                  <div className="relative text-3xl font-black text-white sm:text-4xl">
                    <EditableText
                      value={stat.value}
                      onChange={(v) => {
                        const next = [...stats];
                        next[i] = { ...next[i], value: v };
                        update("stats", next);
                      }}
                      as="span"
                    />
                  </div>
                  <div className="text-sm font-semibold uppercase tracking-wider text-white/70">
                    <EditableText
                      value={stat.label}
                      onChange={(v) => {
                        const next = [...stats];
                        next[i] = { ...next[i], label: v };
                        update("stats", next);
                      }}
                      as="span"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating energy badge */}
      <div
        className="absolute right-8 top-1/3 z-10 hidden h-24 w-24 items-center justify-center rounded-2xl shadow-2xl lg:flex"
        style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))", animation: isEditMode ? undefined : "fitBob 4s ease-in-out infinite" }}
      >
        <Dumbbell className="h-10 w-10" />
      </div>
    </section>
  );
}
