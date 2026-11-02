"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Mic, Play, Sparkles } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke public-speaking hero: a mic at the top of the content projecting
 *  concentric sound-wave ripples, an overhead spotlight cone, and an arc of
 *  audience dots along the base. Content flows below the mic so nothing overlaps. */
export function BespokeSpeakingHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const enter = (d: number): MotionProps => (on ? { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const } } : {});

  // Confidence meter, editable percentage (drives both the label and the bar
  // width). Stored in the otherwise-unused `trust` field; clamped 0–100.
  const confidenceRaw = content.trust ?? "92";
  const confidencePct = Math.max(0, Math.min(100, parseInt(confidenceRaw, 10) || 0));

  const ripples = [0, 1, 2];
  const audience = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const angle = Math.PI * (1 - t);
    return { x: 50 + Math.cos(angle) * 46, y: 90 - Math.sin(angle) * 22, d: (i % 5) * 0.35 };
  });

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 py-24" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Overhead spotlight cone */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 flex justify-center overflow-hidden">
        <div className="h-[75%] w-[70%] max-w-3xl" style={{ background: "linear-gradient(to bottom, hsl(var(--accent) / 0.32), transparent 80%)", clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)", filter: "blur(6px)", animation: on ? "bspkBeam 7s ease-in-out infinite" : undefined }} />
      </div>

      {/* Audience arc along the base */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-0 mx-auto h-28 w-full max-w-3xl">
        {audience.map((a, i) => (
          <span key={i} className="absolute h-2 w-2 rounded-full" style={{ left: `${a.x}%`, top: `${a.y}%`, backgroundColor: "hsl(var(--accent))", boxShadow: "0 0 8px 1px hsl(var(--accent) / 0.55)", animation: on ? `bspkAudience ${2.4 + (i % 4) * 0.5}s ease-in-out ${a.d}s infinite` : undefined }} />
        ))}
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-40" style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }} />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        {/* Mic + sound-wave ripples (above the headline) */}
        <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
          {ripples.map((i) => (
            <span key={i} className="absolute left-1/2 top-1/2 rounded-full border" style={{ height: "5rem", width: "5rem", marginLeft: "-2.5rem", marginTop: "-2.5rem", borderColor: "hsl(var(--accent) / 0.45)", opacity: 0, animation: on ? `bspkRipple 3.6s ease-out ${i * 1.2}s infinite` : undefined }} />
          ))}
          <span className="absolute left-1/2 top-1/2 rounded-full" style={{ height: "9rem", width: "9rem", marginLeft: "-4.5rem", marginTop: "-4.5rem", background: "radial-gradient(circle, hsl(var(--primary) / 0.32), transparent 68%)", animation: on ? "bspkGlow 5s ease-in-out infinite" : undefined }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundImage: "linear-gradient(140deg, hsl(var(--primary)), hsl(var(--accent)))", boxShadow: "0 12px 40px -6px hsl(var(--accent) / 0.6)", animation: on ? "bspkMic 5s ease-in-out infinite" : undefined }}>
            <Mic className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>
        </div>

        <motion.span {...enter(0)} className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium" style={{ borderColor: "hsl(var(--accent) / 0.4)", backgroundColor: "hsl(var(--accent) / 0.14)", color: "hsl(var(--accent))" }}>
          <Sparkles className="h-4 w-4" />
          <EditableText value={content.eyebrow ?? "Own the stage"} onChange={(v) => update("eyebrow", v)} as="span" />
        </motion.span>

        <motion.h1 {...enter(0.08)} className="mt-6 text-5xl font-black leading-[1.03] tracking-tight text-foreground sm:text-6xl lg:text-[4rem]" style={{ textShadow: "0 2px 44px hsl(var(--accent) / 0.32)" }}>
          <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
        </motion.h1>

        {(content.description || isEditMode) && (
          <motion.p {...enter(0.16)} className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
          </motion.p>
        )}

        {stats.length > 0 && (
          <motion.div {...enter(0.22)} className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {stats.map((st: HeroPhotographyStat, i: number) => (
              <div key={st.id} className="text-center">
                <div className="text-2xl font-black sm:text-3xl" style={{ color: "hsl(var(--accent))" }}>
                  <EditableText value={st.value} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], value: v }; update("stats", n); }} as="span" />
                </div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <EditableText value={st.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" />
                </div>
              </div>
            ))}
          </motion.div>
        )}

        <motion.div {...enter(0.3)} className="mt-9 flex flex-col items-center gap-4">
          {content.primaryCta && !content.primaryCta.hidden && (
            <EditableClickable href={content.primaryCta.href} onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })} hidden={content.primaryCta.hidden} onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })} isEditing={isEditMode} slotLabel="Primary Button">
              <button type="button" className="group inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-bold text-white shadow-[0_16px_50px_-12px_hsl(var(--accent))] transition-transform hover:scale-[1.04]" style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
                {isEditMode ? (
                  <><EditableText value={content.primaryCta.text} onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })} as="span" /><ArrowRight className="h-5 w-5" /></>
                ) : (
                  <LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">{content.primaryCta.text}<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></LinkComponent>
                )}
              </button>
            </EditableClickable>
          )}
          {content.secondaryCta && !content.secondaryCta.hidden && (
            <EditableClickable href={content.secondaryCta.href} onHrefChange={(href) => update("secondaryCta", { ...content.secondaryCta, href })} hidden={content.secondaryCta.hidden} onHiddenChange={(hidden) => update("secondaryCta", { ...content.secondaryCta, hidden })} isEditing={isEditMode} slotLabel="Secondary Button">
              <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground">
                <Play className="h-4 w-4" />
                {isEditMode ? (
                  <EditableText value={content.secondaryCta.text} onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })} as="span" />
                ) : (
                  <LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>
                )}
              </button>
            </EditableClickable>
          )}
        </motion.div>

        {/* Confidence meter, editable percentage */}
        <motion.div {...enter(0.38)} className="mx-auto mt-10 w-full max-w-xs rounded-xl border border-border bg-muted/40 px-4 py-3 text-left backdrop-blur-sm">
          <div className="flex items-center justify-between text-[12px] font-medium">
            <span className="text-muted-foreground">Confidence</span>
            <span style={{ color: "hsl(var(--accent))" }} className="inline-flex items-center">
              <EditableText value={String(confidencePct)} onChange={(v) => update("trust", v)} as="span" />%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${confidencePct}%`, backgroundImage: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))", animation: on ? "bspkMeter 2.6s ease-in-out infinite alternate" : undefined }} />
          </div>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bspkRipple { 0% { transform: scale(0.4); opacity: 0.55; } 80% { opacity: 0.08; } 100% { transform: scale(2.3); opacity: 0; } }
        @keyframes bspkGlow { 0%,100% { opacity: 0.85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
        @keyframes bspkMic { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes bspkAudience { 0%,100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes bspkBeam { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
        @keyframes bspkMeter { from { opacity: 0.7; } to { opacity: 1; } }
      ` }} />
    </section>
  );
}
