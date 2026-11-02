"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Flag, Play, Repeat, Rocket, Sparkles, Star } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke "coding for kids" hero: a playful block-coding scene, colourful
 *  Scratch-style code blocks snap in beside a bouncing robot mascot, with
 *  floating stars/badges. Light, bright, energetic, kid-friendly. */
export function BespokeCodeKidsHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const enter = (d: number): MotionProps =>
    on
      ? {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.65, delay: d, ease: [0.22, 1, 0.36, 1] as const },
        }
      : {};
  const snap = (d: number): MotionProps =>
    on
      ? {
          initial: { opacity: 0, x: -28, rotate: -4 },
          animate: { opacity: 1, x: 0, rotate: 0 },
          transition: { type: "spring", stiffness: 260, damping: 16, delay: d },
        }
      : {};

  // Scratch-style code blocks: label, icon, colour token.
  const blocks: Array<{ label: string; Icon: typeof Flag; color: string }> = [
    { label: "when ▶ clicked", Icon: Flag, color: "hsl(var(--primary))" },
    { label: "move 10 steps", Icon: ArrowRight, color: "hsl(var(--accent))" },
    { label: "repeat 4", Icon: Repeat, color: "hsl(var(--primary))" },
    { label: "say “Hi!”", Icon: Sparkles, color: "hsl(var(--accent))" },
  ];
  // Floating badges/stars.
  const badges: Array<{ label: string; top: string; left: string; d: number }> = [
    { label: "Level 5", top: "6%", left: "70%", d: 0.2 },
    { label: "+120 ★", top: "60%", left: "82%", d: 0.9 },
  ];

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden py-20 lg:py-24"
      style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
      {/* Ambient playful backdrop: soft blobs + floating dotted stars */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "hsl(var(--primary) / 0.14)", animation: on ? "bckdFloat 9s ease-in-out infinite" : undefined }}
        />
        <div
          className="absolute -bottom-32 right-[-6rem] h-96 w-96 rounded-full blur-3xl"
          style={{ background: "hsl(var(--accent) / 0.16)", animation: on ? "bckdFloat 11s ease-in-out 1s infinite" : undefined }}
        />
        {Array.from({ length: 9 }, (_, i) => ({ l: `${8 + i * 10}%`, t: `${(i % 4) * 22 + 6}%`, d: (i % 5) * 0.7, s: 8 + (i % 3) * 4 })).map((p, i) => (
          <Star
            key={i}
            className="absolute"
            style={{
              left: p.l,
              top: p.t,
              width: p.s,
              height: p.s,
              color: i % 2 ? "hsl(var(--accent) / 0.5)" : "hsl(var(--primary) / 0.45)",
              animation: on ? `bckdTwinkle ${3 + (i % 3)}s ease-in-out ${p.d}s infinite` : undefined,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-10">
        {/* ── Copy column ── */}
        <div className="text-center lg:text-left">
          <motion.span
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-bold"
            style={{ backgroundColor: "hsl(var(--accent) / 0.16)", color: "hsl(var(--accent))" }}
          >
            <Rocket className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Fun coding club for kids"} onChange={(v) => update("eyebrow", v)} as="span" />
          </motion.span>

          <motion.h1
            {...enter(0.08)}
            className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.75rem]"
          >
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mx-auto mt-5 max-w-lg text-base leading-relaxed sm:text-lg lg:mx-0" style={{ color: "hsl(var(--foreground) / 0.68)" }}>
              <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
            </motion.p>
          )}

          {stats.length > 0 && (
            <motion.div {...enter(0.22)} className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 lg:justify-start">
              {stats.map((st: HeroPhotographyStat, i: number) => (
                <div key={st.id} className="text-center lg:text-left">
                  <div className="text-2xl font-black sm:text-3xl" style={{ color: "hsl(var(--primary))" }}>
                    <EditableText value={st.value} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], value: v }; update("stats", n); }} as="span" />
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--foreground) / 0.5)" }}>
                    <EditableText value={st.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div {...enter(0.3)} className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap lg:items-start lg:justify-start">
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
                  className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_16px_44px_-14px_hsl(var(--primary))] transition-transform hover:scale-[1.04]"
                  style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}
                >
                  {isEditMode ? (
                    <>
                      <EditableText value={content.primaryCta.text} onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })} as="span" />
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
                  className="inline-flex items-center gap-2 rounded-full border-2 px-6 py-3.5 text-sm font-bold transition-colors"
                  style={{ borderColor: "hsl(var(--primary) / 0.3)", color: "hsl(var(--primary))" }}
                >
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
        </div>

        {/* ── Signature graphic: block-coding scene + robot mascot ── */}
        <motion.div {...enter(0.24)} className="relative mx-auto w-full max-w-md">
          <div
            className="relative rounded-[2rem] border p-6 sm:p-8"
            style={{
              borderColor: "hsl(var(--primary) / 0.18)",
              background: "linear-gradient(160deg, hsl(var(--primary) / 0.06), hsl(var(--accent) / 0.06))",
              boxShadow: "0 30px 70px -30px hsl(var(--primary) / 0.4)",
            }}
          >
            {/* Snapped code blocks */}
            <div className="flex flex-col gap-2.5">
              {blocks.map((b, i) => {
                const BIcon = b.Icon;
                return (
                  <motion.div
                    key={b.label}
                    {...snap(0.35 + i * 0.14)}
                    className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold text-white"
                    style={{
                      backgroundColor: b.color,
                      marginLeft: `${i * 12}px`,
                      width: `calc(100% - ${i * 12}px)`,
                      boxShadow: "0 8px 18px -8px hsl(var(--foreground) / 0.35)",
                      animation: on ? `bckdWiggle ${3 + (i % 2)}s ease-in-out ${i * 0.3}s infinite` : undefined,
                    }}
                  >
                    <BIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{b.label}</span>
                  </motion.div>
                );
              })}
            </div>

            {/* Bouncing robot mascot */}
            <motion.div
              {...enter(0.7)}
              className="absolute -bottom-6 -right-4 sm:-right-6"
              style={{ animation: on ? "bckdBounce 2.2s ease-in-out infinite" : undefined }}
              aria-hidden
            >
              <div
                className="flex h-24 w-20 flex-col items-center justify-center rounded-3xl border-2"
                style={{ backgroundColor: "hsl(var(--background))", borderColor: "hsl(var(--primary) / 0.4)", boxShadow: "0 14px 30px -12px hsl(var(--primary) / 0.5)" }}
              >
                {/* antenna */}
                <span className="absolute -top-3 h-3 w-1 rounded-full" style={{ backgroundColor: "hsl(var(--accent))" }} />
                <span className="absolute -top-4 h-2 w-2 rounded-full" style={{ backgroundColor: "hsl(var(--accent))" }} />
                {/* eyes */}
                <div className="flex gap-2.5">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "hsl(var(--primary))" }} />
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "hsl(var(--primary))" }} />
                </div>
                {/* smile */}
                <span className="mt-2 h-2.5 w-8 rounded-b-full border-b-4" style={{ borderColor: "hsl(var(--accent))" }} />
              </div>
            </motion.div>
          </div>

          {/* Floating badges/stars, desktop only; they're absolutely
              positioned and would overlap the graphic / copy on a phone. */}
          {badges.map((bg) => (
            <motion.div
              key={bg.label}
              {...enter(0.5 + bg.d * 0.2)}
              className="absolute z-20 hidden items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black text-white shadow-lg lg:inline-flex"
              style={{
                top: bg.top,
                left: bg.left,
                backgroundImage: "linear-gradient(120deg, hsl(var(--accent)), hsl(var(--primary)))",
                animation: on ? `bckdFloat ${4 + bg.d}s ease-in-out ${bg.d}s infinite` : undefined,
              }}
            >
              <Star className="h-3 w-3" />
              {bg.label}
            </motion.div>
          ))}
        </motion.div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bckdFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes bckdTwinkle { 0%,100% { opacity: 0.25; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes bckdWiggle { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-1.2deg); } 75% { transform: rotate(1.2deg); } }
        @keyframes bckdBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `,
        }}
      />
    </section>
  );
}
