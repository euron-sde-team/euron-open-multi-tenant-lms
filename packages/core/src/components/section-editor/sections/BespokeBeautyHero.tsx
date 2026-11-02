"use client";

import type { HeroPhotographyContent, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Play, Sparkles, Star } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke editorial beauty hero: serif headline, a clean portrait with a
 *  contained rating badge, and an inline shade palette. Fully responsive, no
 *  overlap. */
export function BespokeBeautyHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, EditableImage, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const shades = ["#b45309", "#be123c", "#9d174d", "#7c2d12", "#a21caf"];
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const enter = (d: number): MotionProps => (on ? { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const } } : {});

  return (
    <section className="relative grid min-h-[100svh] items-center overflow-hidden" style={{ backgroundColor: "hsl(var(--background))" }}>
      <div className="pointer-events-none absolute right-0 top-0 h-[36rem] w-[36rem] translate-x-1/4 -translate-y-1/4 rounded-full blur-[130px]" style={{ background: "hsl(var(--accent) / 0.16)" }} />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full blur-[120px]" style={{ background: "hsl(var(--primary) / 0.1)" }} />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-6 py-16 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-14 lg:py-24">
        {/* Text */}
        <div className="min-w-0">
          <motion.span {...enter(0)} className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>
            <Sparkles className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "The art of beauty, mastered"} onChange={(v) => update("eyebrow", v)} as="span" />
          </motion.span>

          <motion.h1 {...enter(0.08)} className="mt-6 font-serif text-5xl font-black leading-[1.0] tracking-tight sm:text-6xl lg:text-7xl" style={{ color: "hsl(var(--foreground))" }}>
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
                <button type="button" className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-xl transition-transform hover:scale-[1.03]" style={{ backgroundColor: "hsl(var(--primary))" }}>
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

          {/* Inline shade palette (no overlap) */}
          <motion.div {...enter(0.32)} className="mt-9 flex items-center gap-3">
            <div className="flex items-center gap-1.5">{shades.map((c) => (<span key={c} className="h-6 w-6 rounded-full ring-2 ring-[hsl(var(--background))]" style={{ backgroundColor: c }} />))}</div>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>Signature palette</span>
          </motion.div>

          {/* In-flow editable stats on mobile, the portrait's rating badge only
              surfaces stats[0]; this exposes every stat for editing on phones
              without altering the desktop layout. Desktop-only badge stays put. */}
          {stats.length > 0 && (
            <motion.div {...enter(0.4)} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden">
              {stats.map((stat, i) => (
                <div key={stat.id} className="rounded-2xl px-4 py-3 text-center" style={{ backgroundColor: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}>
                  <div className="text-xl font-black" style={{ color: "hsl(var(--foreground))" }}>
                    <EditableText value={stat.value} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], value: v }; update("stats", n); }} as="span" />
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <EditableText value={stat.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Portrait */}
        <motion.div {...enter(0.12)} className="relative mx-auto w-full max-w-md">
          <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[2.2rem]" style={{ backgroundColor: "hsl(var(--accent) / 0.18)" }} />
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2.2rem] shadow-2xl" style={{ border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}>
            {content.image ? (
              isEditMode ? (
                <EditableImage src={content.image} alt={content.imageAlt || "Beauty"} onChange={(src) => update("image", src)} className="h-full w-full" aspectRatio="auto" />
              ) : (
                <img src={content.image} alt={content.imageAlt || "Beauty"} className="h-full w-full object-cover" />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ color: "hsl(var(--accent))" }}><Sparkles className="h-14 w-14" /></div>
            )}
            {/* Contained rating badge */}
            {stats[0] && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 shadow-lg">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="text-[13px] font-bold text-slate-800"><EditableText value={stats[0].value} onChange={(v) => { const n = [...stats]; n[0] = { ...n[0], value: v }; update("stats", n); }} as="span" /></span>
                <span className="text-[11px] text-slate-400"><EditableText value={stats[0].label} onChange={(v) => { const n = [...stats]; n[0] = { ...n[0], label: v }; update("stats", n); }} as="span" /></span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
