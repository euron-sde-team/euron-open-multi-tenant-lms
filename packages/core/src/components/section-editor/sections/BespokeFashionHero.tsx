"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Camera, Play, Scissors } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke fashion hero: a fanned lookbook of three staggered, slightly rotated
 *  portrait cards (the centre one holds content.image) above a thin runway line
 *  with an "FW25" season tag, beside a large editorial headline. Cards are
 *  contained so they never clip or cause horizontal scroll, and collapse to a
 *  single clean card on mobile. */
export function BespokeFashionHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, EditableImage, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const enter = (d: number): MotionProps => (on ? { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const } } : {});

  // Side lookbook cards (behind the featured image). Tints via theme tokens.
  const sideCards = [
    { rotate: -9, tint: "hsl(var(--accent) / 0.16)", icon: Scissors, spreadX: "-14%", spreadY: "6%" },
    { rotate: 8, tint: "hsl(var(--primary) / 0.14)", icon: Camera, spreadX: "14%", spreadY: "3%" },
  ];

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden py-16 lg:py-24" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Ambient wash */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-[34rem] w-[34rem] rounded-full blur-[140px]" style={{ background: "hsl(var(--primary) / 0.14)" }} />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full blur-[130px]" style={{ background: "hsl(var(--accent) / 0.16)" }} />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-14">
        {/* Text column */}
        <div className="min-w-0">
          <motion.span {...enter(0)} className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>
            <Scissors className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "The FW25 lookbook edit"} onChange={(v) => update("eyebrow", v)} as="span" />
          </motion.span>

          <motion.h1 {...enter(0.08)} className="mt-6 font-serif text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-[4.6rem]" style={{ color: "hsl(var(--foreground))" }}>
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mt-6 max-w-md text-lg leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
            </motion.p>
          )}

          <motion.div {...enter(0.24)} className="mt-8 flex flex-wrap items-center gap-5">
            {content.primaryCta && !content.primaryCta.hidden && (
              <EditableClickable href={content.primaryCta.href} onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })} hidden={content.primaryCta.hidden} onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })} isEditing={isEditMode} slotLabel="Primary Button">
                <button type="button" className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-xl transition-transform hover:scale-[1.03]" style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
                  {isEditMode ? (<><EditableText value={content.primaryCta.text} onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })} as="span" /><ArrowRight className="h-5 w-5" /></>) : (<LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">{content.primaryCta.text}<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></LinkComponent>)}
                </button>
              </EditableClickable>
            )}
            {content.secondaryCta && !content.secondaryCta.hidden && (
              <EditableClickable href={content.secondaryCta.href} onHrefChange={(href) => update("secondaryCta", { ...content.secondaryCta, href })} hidden={content.secondaryCta.hidden} onHiddenChange={(hidden) => update("secondaryCta", { ...content.secondaryCta, hidden })} isEditing={isEditMode} slotLabel="Secondary Button">
                <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                  <Play className="h-4 w-4" />
                  {isEditMode ? (<EditableText value={content.secondaryCta.text} onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })} as="span" />) : (<LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>)}
                </button>
              </EditableClickable>
            )}
          </motion.div>

          {stats.length > 0 && (
            <motion.div {...enter(0.32)} className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t pt-6" style={{ borderColor: "hsl(var(--border))" }}>
              {stats.map((st: HeroPhotographyStat, i: number) => (
                <div key={st.id} className="min-w-0">
                  <div className="font-serif text-2xl font-black sm:text-3xl" style={{ color: "hsl(var(--primary))" }}><EditableText value={st.value} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], value: v }; update("stats", n); }} as="span" /></div>
                  <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "hsl(var(--muted-foreground))" }}><EditableText value={st.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" /></div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Fanned lookbook */}
        <motion.div {...enter(0.12)} className="relative mx-auto w-full max-w-[26rem]">
          {/* Card stage, padded so rotated corners stay inside */}
          <div className="relative mx-auto aspect-[4/5] w-full px-4">
            {/* Side lookbook cards, desktop-only so the rotated corners never
                spill over the featured card / stacked text on phones + tablets */}
            {sideCards.map((c, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={i}
                  className="absolute inset-y-6 left-1/2 hidden w-[72%] -translate-x-1/2 overflow-hidden rounded-[1.6rem] shadow-xl lg:block"
                  style={{
                    backgroundColor: "hsl(var(--muted))",
                    border: "1px solid hsl(var(--border))",
                    transform: `translateX(calc(-50% + ${c.spreadX})) translateY(${c.spreadY}) rotate(${c.rotate}deg)`,
                    animation: on ? `bfshFloat${i} ${6 + i}s ease-in-out ${i * 0.4}s infinite` : undefined,
                    zIndex: 0,
                  }}
                >
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2" style={{ background: c.tint, color: "hsl(var(--foreground) / 0.55)" }}>
                    <Icon className="h-8 w-8" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">Look {i + 1}</span>
                  </div>
                </div>
              );
            })}

            {/* Featured centre card */}
            <div
              className="absolute inset-x-4 inset-y-0 z-10 overflow-hidden rounded-[1.8rem] shadow-2xl"
              style={{ border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--muted))", animation: on ? "bfshFloatMain 7s ease-in-out infinite" : undefined }}
            >
              {content.image ? (
                isEditMode ? (
                  <EditableImage src={content.image} alt={content.imageAlt || "Fashion look"} onChange={(src) => update("image", src)} className="h-full w-full" aspectRatio="auto" />
                ) : (
                  <img src={content.image} alt={content.imageAlt || "Fashion look"} className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center" style={{ color: "hsl(var(--primary))" }}><Camera className="h-14 w-14" /></div>
              )}
              {/* Season tag */}
              <div className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-lg" style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
                <EditableText value={content.headlineAccent ?? "FW25"} onChange={(v) => update("headlineAccent", v)} as="span" />
              </div>
            </div>
          </div>

          {/* Thin runway line */}
          <div className="relative mx-auto mt-6 h-px w-[82%]" style={{ background: "linear-gradient(to right, transparent, hsl(var(--foreground) / 0.3), transparent)" }}>
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: "hsl(var(--primary))", boxShadow: "0 0 0 5px hsl(var(--primary) / 0.16)", animation: on ? "bfshPulse 3s ease-in-out infinite" : undefined }} />
          </div>
          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: "hsl(var(--muted-foreground))" }}>
            <EditableText value={content.trust ?? "Runway · Autumn Winter"} onChange={(v) => update("trust", v)} as="span" />
          </p>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bfshFloatMain { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-8px) rotate(-0.6deg); } }
        @keyframes bfshFloat0 { 0%,100% { transform: translateX(calc(-50% - 14%)) translateY(6%) rotate(-9deg); } 50% { transform: translateX(calc(-50% - 16%)) translateY(3%) rotate(-11deg); } }
        @keyframes bfshFloat1 { 0%,100% { transform: translateX(calc(-50% + 14%)) translateY(3%) rotate(8deg); } 50% { transform: translateX(calc(-50% + 16%)) translateY(0%) rotate(10deg); } }
        @keyframes bfshPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      ` }} />
    </section>
  );
}
