"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Play, ShieldCheck } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke security hero: a radar sweep + concentric rings + falling matrix
 *  streams behind centred content, with a live terminal line. No side card. */
export function BespokeCyberHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const enter = (d: number): MotionProps => (on ? { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const } } : {});
  const streams = Array.from({ length: 16 }, (_, i) => ({ l: `${i * 6.2 + 2}%`, d: (i % 6) * 0.6, dur: 6 + (i % 5) }));
  const blips: Array<[number, number]> = [[32, 40], [66, 55], [52, 72], [44, 28]];

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden py-24" style={{ backgroundColor: "hsl(var(--background))" }}>
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {streams.map((s, i) => (<span key={i} className="absolute top-[-40%] h-[55%] w-px" style={{ left: s.l, background: "linear-gradient(to bottom, transparent, hsl(var(--accent)), transparent)", opacity: 0.32, animation: on ? `bchFall ${s.dur}s linear ${s.d}s infinite` : undefined }} />))}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 aspect-square w-[44rem] max-w-[94%] -translate-x-1/2 -translate-y-1/2">
        {[0.35, 0.6, 0.85, 1].map((sc, i) => (<span key={i} className="absolute inset-0 rounded-full border" style={{ borderColor: `hsl(var(--accent) / ${0.34 - i * 0.05})`, transform: `scale(${sc})` }} />))}
        <div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, transparent 0deg, hsl(var(--accent) / 0.34) 45deg, transparent 90deg)", animation: on ? "bchSweep 6s linear infinite" : undefined }} />
        {blips.map(([x, y], i) => (<span key={i} className="absolute h-2 w-2 rounded-full" style={{ left: `${x}%`, top: `${y}%`, backgroundColor: "hsl(var(--accent))", boxShadow: "0 0 0 5px hsl(var(--accent) / 0.2)", animation: on ? `bchBlip ${2.5 + i}s ease-in-out infinite` : undefined }} />))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40" style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }} />

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <motion.span {...enter(0)} className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-[13px] font-medium text-emerald-600 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          <EditableText value={content.eyebrow ?? "Live threat protection active"} onChange={(v) => update("eyebrow", v)} as="span" />
        </motion.span>
        <motion.h1 {...enter(0.08)} className="mt-7 text-5xl font-black leading-[1.03] tracking-tight text-foreground sm:text-6xl lg:text-[4rem]" style={{ textShadow: "0 2px 40px hsl(var(--accent) / 0.3)" }}>
          <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
        </motion.h1>
        {(content.description || isEditMode) && (<motion.p {...enter(0.16)} className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground"><EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." /></motion.p>)}
        {stats.length > 0 && (
          <motion.div {...enter(0.22)} className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {stats.map((st: HeroPhotographyStat, i: number) => (
              <div key={st.id} className="text-center">
                <div className="text-2xl font-black sm:text-3xl" style={{ color: "hsl(var(--accent))" }}><EditableText value={st.value} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], value: v }; update("stats", n); }} as="span" /></div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground"><EditableText value={st.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" /></div>
              </div>
            ))}
          </motion.div>
        )}
        <motion.div {...enter(0.3)} className="mt-9 flex flex-col items-center gap-4">
          {content.primaryCta && !content.primaryCta.hidden && (
            <EditableClickable href={content.primaryCta.href} onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })} hidden={content.primaryCta.hidden} onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })} isEditing={isEditMode} slotLabel="Primary Button">
              <button type="button" className="group inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-bold text-white shadow-[0_16px_50px_-12px_hsl(var(--accent))] transition-transform hover:scale-[1.04]" style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
                {isEditMode ? (<><EditableText value={content.primaryCta.text} onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })} as="span" /><ArrowRight className="h-5 w-5" /></>) : (<LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">{content.primaryCta.text}<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></LinkComponent>)}
              </button>
            </EditableClickable>
          )}
          {content.secondaryCta && !content.secondaryCta.hidden && (
            <EditableClickable href={content.secondaryCta.href} onHrefChange={(href) => update("secondaryCta", { ...content.secondaryCta, href })} hidden={content.secondaryCta.hidden} onHiddenChange={(hidden) => update("secondaryCta", { ...content.secondaryCta, hidden })} isEditing={isEditMode} slotLabel="Secondary Button">
              <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground">
                <Play className="h-4 w-4" />
                {isEditMode ? (<EditableText value={content.secondaryCta.text} onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })} as="span" />) : (<LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>)}
              </button>
            </EditableClickable>
          )}
        </motion.div>
        <motion.div {...enter(0.38)} className="mx-auto mt-9 max-w-md rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-left font-mono text-[12px] text-muted-foreground">
          <span style={{ color: "hsl(var(--accent))" }}>$</span> nmap -sV target <span className="text-emerald-400/80">→ 0 vulnerabilities</span>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bchFall { 0% { transform: translateY(0); } 100% { transform: translateY(260%); } }
        @keyframes bchSweep { to { transform: rotate(360deg); } }
        @keyframes bchBlip { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
      ` }} />
    </section>
  );
}
