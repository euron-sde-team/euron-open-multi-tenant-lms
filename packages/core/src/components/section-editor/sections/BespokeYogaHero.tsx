"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Flower2, Leaf, Play, Sparkles } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke yoga & meditation hero: a serene, centred layout whose signature
 *  graphic is a slow "breathing orb", concentric soft rings that expand and
 *  contract on a ~6s inhale/exhale loop around a lotus glyph, with a synced
 *  "Breathe in · Breathe out" caption and leaves gently rising behind it. */
export function BespokeYogaHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const enter = (d: number): MotionProps => (on ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: d, ease: [0.22, 1, 0.36, 1] as const } } : {});

  // Rings ordered largest → smallest so the outer ring's slower breath reads as the "lead" of the loop.
  const rings = [
    { scale: 1, opacity: 0.1, delay: 0 },
    { scale: 0.76, opacity: 0.14, delay: 0.15 },
    { scale: 0.54, opacity: 0.2, delay: 0.3 },
    { scale: 0.34, opacity: 0.28, delay: 0.45 },
  ];
  // Rising leaves: evenly-spaced horizontal offsets with staggered timing for a calm, non-uniform drift.
  const leaves = Array.from({ length: 9 }, (_, i) => ({
    left: `${8 + i * 10}%`,
    delay: (i % 5) * 1.1,
    dur: 11 + (i % 4) * 2,
    size: 12 + (i % 3) * 5,
    drift: i % 2 === 0 ? "18px" : "-18px",
  }));

  return (
    <section
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 py-24"
      style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
      {/* Soft ambient wash, layered radial calm gradients */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 38%, hsl(var(--primary) / 0.12), transparent 70%), radial-gradient(50% 45% at 82% 78%, hsl(var(--accent) / 0.12), transparent 72%), radial-gradient(45% 40% at 16% 82%, hsl(var(--primary) / 0.08), transparent 70%)",
        }}
      />

      {/* Rising leaves / particles */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {leaves.map((lf, i) => (
          <span
            key={i}
            className="absolute bottom-[-8%]"
            style={{
              left: lf.left,
              // Custom prop drives per-leaf horizontal sway inside the keyframe.
              ["--byga-drift" as string]: lf.drift,
              color: i % 3 === 0 ? "hsl(var(--accent))" : "hsl(var(--primary))",
              opacity: 0,
              animation: on ? `bygaRise ${lf.dur}s ease-in-out ${lf.delay}s infinite` : undefined,
            }}
          >
            <Leaf style={{ width: lf.size, height: lf.size }} strokeWidth={1.5} />
          </span>
        ))}
      </div>

      {/* Centred content */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        {/* Signature graphic: breathing orb */}
        <motion.div {...enter(0)} className="relative mb-10 flex h-52 w-52 items-center justify-center sm:h-64 sm:w-64">
          {rings.map((r, i) => (
            <span
              key={i}
              className="absolute rounded-full border"
              style={{
                inset: 0,
                borderColor: `hsl(var(--primary) / ${r.opacity + 0.12})`,
                background: `radial-gradient(circle, hsl(var(--primary) / ${r.opacity}), transparent 70%)`,
                // --s is each ring's base scale; the breathe keyframe multiplies it so every ring expands from its own size.
                ["--s" as string]: r.scale,
                transform: `scale(${r.scale})`,
                transformOrigin: "center",
                animation: on ? `bygaBreathe 6s ease-in-out ${r.delay}s infinite` : undefined,
              }}
            />
          ))}
          {/* Core glow + lotus glyph */}
          <span
            className="absolute h-16 w-16 rounded-full sm:h-20 sm:w-20"
            style={{
              background: "radial-gradient(circle, hsl(var(--accent) / 0.35), transparent 72%)",
              animation: on ? "bygaGlow 6s ease-in-out infinite" : undefined,
            }}
          />
          <Flower2
            className="relative h-10 w-10 sm:h-12 sm:w-12"
            strokeWidth={1.5}
            style={{ color: "hsl(var(--primary))", animation: on ? "bygaGlyph 6s ease-in-out infinite" : undefined }}
          />
        </motion.div>

        {/* Breath caption synced to the orb loop */}
        <div className="mb-7 h-5 text-xs font-medium uppercase tracking-[0.3em]" style={{ color: "hsl(var(--muted-foreground))" }}>
          <span style={{ animation: on ? "bygaBreatheIn 6s ease-in-out infinite" : undefined, opacity: on ? undefined : 0.7 }}>Breathe in</span>
          <span className="mx-2 opacity-40">·</span>
          <span style={{ animation: on ? "bygaBreatheOut 6s ease-in-out infinite" : undefined, opacity: on ? undefined : 0.5 }}>Breathe out</span>
        </div>

        <motion.span
          {...enter(0.08)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium"
          style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
        >
          <Sparkles className="h-4 w-4" />
          <EditableText value={content.eyebrow ?? "Find your calm, one breath at a time"} onChange={(v) => update("eyebrow", v)} as="span" />
        </motion.span>

        <motion.h1 {...enter(0.16)} className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
          <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
        </motion.h1>

        {(content.description || isEditMode) && (
          <motion.p {...enter(0.24)} className="mx-auto mt-5 max-w-lg text-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
            <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a calming subtitle..." />
          </motion.p>
        )}

        <motion.div {...enter(0.32)} className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
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
                className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white transition-transform hover:scale-[1.03]"
                style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))", boxShadow: "0 16px 44px -14px hsl(var(--primary))" }}
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
                className="inline-flex items-center gap-2 rounded-full border px-6 py-4 text-sm font-semibold transition-colors"
                style={{ borderColor: "hsl(var(--primary) / 0.3)", color: "hsl(var(--foreground))" }}
              >
                <Play className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
                {isEditMode ? (
                  <EditableText value={content.secondaryCta.text} onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })} as="span" />
                ) : (
                  <LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>
                )}
              </button>
            </EditableClickable>
          )}
        </motion.div>

        {stats.length > 0 && (
          <motion.div {...enter(0.4)} className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {stats.map((st: HeroPhotographyStat, i: number) => (
              <div key={st.id} className="text-center">
                <div className="text-2xl font-bold sm:text-3xl" style={{ color: "hsl(var(--primary))" }}>
                  <EditableText value={st.value} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], value: v }; update("stats", n); }} as="span" />
                </div>
                <div className="text-[11px] uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <EditableText value={st.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bygaBreathe { 0%, 100% { transform: scale(var(--s, 1)); opacity: 0.7; } 50% { transform: scale(calc(var(--s, 1) * 1.14)); opacity: 1; } }
        @keyframes bygaGlow { 0%, 100% { transform: scale(0.9); opacity: 0.55; } 50% { transform: scale(1.18); opacity: 1; } }
        @keyframes bygaGlyph { 0%, 100% { transform: scale(0.94); } 50% { transform: scale(1.08); } }
        @keyframes bygaBreatheIn { 0% { opacity: 0.35; } 25% { opacity: 1; } 50%, 100% { opacity: 0.35; } }
        @keyframes bygaBreatheOut { 0%, 50% { opacity: 0.35; } 75% { opacity: 1; } 100% { opacity: 0.35; } }
        @keyframes bygaRise {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          12% { opacity: 0.7; }
          88% { opacity: 0.7; }
          100% { transform: translateY(-115vh) translateX(var(--byga-drift, 16px)) rotate(180deg); opacity: 0; }
        }
      ` }} />
    </section>
  );
}
