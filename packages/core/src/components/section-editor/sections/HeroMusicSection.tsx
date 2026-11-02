"use client";

import type {
  HeroPhotographyContent,
  HeroPhotographyStat,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, Headphones, Music, Play } from "lucide-react";
import type { CSSProperties } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroMusicSectionProps {
  section: SectionConfig;
}

const NOTES = [
  { top: "16%", left: "12%", size: 26, delay: 0 },
  { top: "24%", right: "14%", size: 32, delay: 0.8 },
  { top: "62%", left: "8%", size: 22, delay: 1.4 },
  { top: "68%", right: "10%", size: 28, delay: 0.4 },
];
const EQ_BARS = Array.from({ length: 28 });

/**
 * Music hero, a centered, dark "studio" archetype: a deep gradient, drifting
 * music notes, glowing orbs, and a signature animated equalizer bar row along
 * the bottom. Distinct from the Cooking split and Fitness full-bleed heroes.
 */
export function HeroMusicSection({ section }: HeroMusicSectionProps) {
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
    isEditMode ? {} : { animation: "muFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both", animationDelay: `${i * 0.1}s` };

  return (
    <section
      className="relative grid min-h-[100svh] items-center overflow-hidden"
      style={{
        background:
          "radial-gradient(90% 70% at 50% 0%, hsl(var(--primary) / 0.45), transparent 60%), radial-gradient(70% 60% at 85% 100%, hsl(var(--accent) / 0.30), transparent 60%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--card)) 100%)",
      }}
    >
      <style>{`
        @keyframes muFadeUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
        @keyframes muFloat { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-16px) rotate(6deg); } }
        @keyframes muEq { 0%,100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }
        @keyframes muGlow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.85; } }
        @keyframes muSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Glowing orbs */}
      <div className="pointer-events-none absolute left-1/4 top-10 h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: "hsl(var(--primary))", opacity: 0.4, animation: isEditMode ? undefined : "muGlow 6s ease-in-out infinite" }} />
      <div className="pointer-events-none absolute right-1/4 top-24 h-64 w-64 rounded-full blur-3xl" style={{ backgroundColor: "hsl(var(--accent))", opacity: 0.3, animation: isEditMode ? undefined : "muGlow 7s ease-in-out 1s infinite" }} />

      {/* Floating notes */}
      {NOTES.map(({ delay, size, ...pos }, i) => (
        <div key={i} className="pointer-events-none absolute hidden lg:block" style={{ ...pos, color: "hsl(var(--foreground) / 0.35)", animation: isEditMode ? undefined : `muFloat ${5 + i}s ease-in-out infinite`, animationDelay: `${delay}s` }}>
          <Music style={{ width: size, height: size }} />
        </div>
      ))}

      <div className="relative z-10 mx-auto max-w-4xl px-4 pb-40 pt-20 text-center sm:px-6 lg:px-8 lg:pt-28">
        <span
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
          style={{ backgroundColor: "hsl(var(--primary) / 0.28)", color: "hsl(var(--foreground))", ...enter(0) }}
        >
          <Headphones className="h-4 w-4" />
          <EditableText value={content.eyebrow ?? "Studio-Grade Learning"} onChange={(v) => update("eyebrow", v)} as="span" />
        </span>

        <h1 className="mt-6 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl" style={{ color: "hsl(var(--foreground))", ...enter(1) }}>
          <EditableText
            value={content.headline}
            onChange={(v) => update("headline", v)}
            as="span"
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => handleTextStyleChange("headline", s)}
            multiline
          />
        </h1>

        {(content.description || isEditMode) && (
          <p className="mx-auto mt-5 max-w-2xl text-lg sm:text-xl" style={{ color: "hsl(var(--muted-foreground))", ...enter(2) }}>
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

        <div className="mt-9 flex flex-wrap justify-center gap-4" style={enter(3)}>
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
                className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold shadow-xl transition-transform hover:scale-105"
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                {isEditMode ? (
                  <>
                    <EditableText value={content.primaryCta.text} onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })} as="span" styleKey="primaryCta" style={content.textStyles?.primaryCta} onStyleChange={(s) => handleTextStyleChange("primaryCta", s)} />
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
                className="inline-flex items-center gap-2 rounded-full border px-8 py-4 text-base font-semibold transition-colors"
                style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", backgroundColor: "transparent" }}
              >
                <Play className="h-5 w-5" />
                {isEditMode ? (
                  <EditableText value={content.secondaryCta.text} onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })} as="span" styleKey="secondaryCta" style={content.textStyles?.secondaryCta} onStyleChange={(s) => handleTextStyleChange("secondaryCta", s)} />
                ) : (
                  <LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>
                )}
              </button>
            </EditableClickable>
          )}
        </div>

        {stats.length > 0 && (
          <div className="mt-12 flex flex-wrap justify-center gap-x-10 gap-y-6" style={enter(4)}>
            {stats.map((stat: HeroPhotographyStat, i: number) => (
              <div key={stat.id}>
                <div className="text-3xl font-extrabold" style={{ color: "hsl(var(--foreground))" }}>
                  <EditableText value={stat.value} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], value: v }; update("stats", n); }} as="span" />
                </div>
                <div className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <EditableText value={stat.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signature animated equalizer bar row */}
      <div className="absolute bottom-0 left-0 right-0 z-0 flex h-28 items-end justify-center gap-1 px-4 opacity-70">
        {EQ_BARS.map((_, i) => (
          <span
            key={i}
            className="w-2 rounded-t"
            style={{
              height: "100%",
              transformOrigin: "bottom",
              background: "linear-gradient(180deg, hsl(var(--accent)), hsl(var(--primary)))",
              animation: isEditMode ? undefined : `muEq ${0.8 + (i % 5) * 0.25}s ease-in-out ${(i % 7) * 0.12}s infinite`,
              transform: isEditMode ? "scaleY(0.4)" : undefined,
            }}
          />
        ))}
      </div>

      {isEditMode && (
        <div className="absolute right-6 top-6 z-20 h-10 w-10 overflow-hidden rounded-lg border-2 border-border">
          <EditableImage src={content.image || ""} alt={content.imageAlt || "Music hero"} onChange={(src) => update("image", src)} className="h-full w-full" aspectRatio="square" placeholder="IMG" />
        </div>
      )}
    </section>
  );
}
