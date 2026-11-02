"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Play, Rocket, Sparkles, TrendingUp } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke startup hero: a rocket ascends along a dashed trajectory leaving a
 *  trail, over a climbing MRR growth curve (animated line that rises + fills)
 *  with milestone flags (Idea → MVP → Seed → Scale) and a "funded" badge.
 *  Energetic upward momentum. Fully contained, mobile-clean, overlap-free. */
export function BespokeStartupHero({ section }: { section: SectionConfig }) {
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
          transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const },
        }
      : {};

  // MRR growth curve: rising, easing toward the top-right where the rocket sits.
  const curve = "M 8 232 C 70 226, 118 196, 168 168 S 262 96, 320 52";
  const fill = `${curve} L 320 248 L 8 248 Z`;
  // Milestone flags anchored on the curve (kept inside the viewBox).
  const milestones: Array<{ x: number; y: number; label: string; d: number }> = [
    { x: 30, y: 224, label: "Idea", d: 0.5 },
    { x: 118, y: 194, label: "MVP", d: 0.9 },
    { x: 210, y: 128, label: "Seed", d: 1.3 },
    { x: 300, y: 60, label: "Scale", d: 1.7 },
  ];
  const sparks = Array.from({ length: 9 }, (_, i) => ({
    l: `${12 + i * 9}%`,
    t: `${18 + ((i * 37) % 60)}%`,
    d: (i % 5) * 0.7,
    dur: 5 + (i % 4),
  }));

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden py-20 sm:py-24"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      {/* Ambient upward glow + drifting sparks */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-20%] h-[70%] w-[80%] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.28), transparent)" }}
        />
        <div
          className="absolute bottom-[-25%] right-[-10%] h-[60%] w-[55%] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.22), transparent)" }}
        />
        {sparks.map((s, i) => (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-primary/70"
            style={{ left: s.l, top: s.t, animation: on ? `bstpDrift ${s.dur}s ease-in-out ${s.d}s infinite` : undefined }}
          />
        ))}
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-10">
        {/* ── Copy column ── */}
        <div className="text-center lg:text-left">
          <motion.span
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-[13px] font-medium text-foreground/80 backdrop-blur"
          >
            <Sparkles className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
            <EditableText
              value={content.eyebrow ?? "Built for founders who ship"}
              onChange={(v) => update("eyebrow", v)}
              as="span"
            />
          </motion.span>

          <motion.h1
            {...enter(0.08)}
            className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            style={{ textShadow: "0 2px 44px hsl(var(--primary) / 0.35)" }}
          >
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground lg:mx-0">
              <EditableText
                value={content.description || ""}
                onChange={(v) => update("description", v)}
                as="span"
                placeholder="Add a subtitle..."
              />
            </motion.p>
          )}

          {stats.length > 0 && (
            <motion.div
              {...enter(0.22)}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 lg:justify-start"
            >
              {stats.map((st: HeroPhotographyStat, i: number) => (
                <div key={st.id} className="text-center lg:text-left">
                  <div className="text-2xl font-black sm:text-3xl" style={{ color: "hsl(var(--accent))" }}>
                    <EditableText
                      value={st.value}
                      onChange={(v) => {
                        const n = [...stats];
                        n[i] = { ...n[i], value: v };
                        update("stats", n);
                      }}
                      as="span"
                    />
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <EditableText
                      value={st.label}
                      onChange={(v) => {
                        const n = [...stats];
                        n[i] = { ...n[i], label: v };
                        update("stats", n);
                      }}
                      as="span"
                    />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div
            {...enter(0.3)}
            className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start"
          >
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
                  className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_16px_50px_-12px_hsl(var(--primary))] transition-transform hover:scale-[1.04]"
                  style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}
                >
                  {isEditMode ? (
                    <>
                      <EditableText
                        value={content.primaryCta.text}
                        onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })}
                        as="span"
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
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground"
                >
                  <Play className="h-4 w-4" />
                  {isEditMode ? (
                    <EditableText
                      value={content.secondaryCta.text}
                      onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })}
                      as="span"
                    />
                  ) : (
                    <LinkComponent href={resolveHref(content.secondaryCta.href)}>
                      {content.secondaryCta.text}
                    </LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
          </motion.div>
        </div>

        {/* ── Signature graphic: rocket + MRR growth curve + milestone flags ── */}
        <motion.div
          {...enter(0.24)}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
          aria-hidden="true"
        >
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card/40 p-5 backdrop-blur-sm shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
            {/* Funded badge */}
            <motion.div
              {...(on
                ? {
                    initial: { opacity: 0, scale: 0.6 },
                    animate: { opacity: 1, scale: 1 },
                    transition: { delay: 1.9, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
                  }
                : {})}
              className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/45 bg-emerald-500/[0.16] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-400/[0.12] dark:text-emerald-300"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <EditableText value={content.trust ?? "Funded"} onChange={(v) => update("trust", v)} as="span" />
            </motion.div>

            <svg viewBox="0 0 340 260" className="h-auto w-full" role="img">
              <defs>
                <linearGradient id="bstpLine" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
                <linearGradient id="bstpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent) / 0.28)" />
                  <stop offset="100%" stopColor="hsl(var(--accent) / 0)" />
                </linearGradient>
              </defs>

              {/* Baseline grid */}
              {[68, 128, 188, 248].map((y) => (
                <line key={y} x1="8" y1={y} x2="320" y2={y} stroke="hsl(var(--foreground) / 0.16)" strokeWidth="1" />
              ))}

              {/* Rising fill under the MRR curve */}
              <motion.path
                d={fill}
                fill="url(#bstpFill)"
                {...(on
                  ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 1.4, duration: 0.8 } }
                  : {})}
              />

              {/* MRR growth curve, draws itself upward */}
              <motion.path
                d={curve}
                fill="none"
                stroke="url(#bstpLine)"
                strokeWidth="3.5"
                strokeLinecap="round"
                {...(on
                  ? {
                      initial: { pathLength: 0 },
                      animate: { pathLength: 1 },
                      transition: { delay: 0.4, duration: 1.4, ease: "easeInOut" },
                    }
                  : {})}
              />

              {/* Dashed rocket trajectory continuing past the curve */}
              <motion.path
                d="M 320 52 C 336 40, 344 26, 348 12"
                fill="none"
                stroke="hsl(var(--accent))"
                strokeWidth="2"
                strokeDasharray="5 6"
                opacity="0.55"
                {...(on
                  ? {
                      initial: { pathLength: 0 },
                      animate: { pathLength: 1 },
                      transition: { delay: 1.7, duration: 0.6, ease: "easeOut" },
                    }
                  : {})}
              />

              {/* Milestone flags along the journey */}
              {milestones.map((m) => (
                <motion.g
                  key={m.label}
                  {...(on
                    ? {
                        initial: { opacity: 0, y: 8 },
                        animate: { opacity: 1, y: 0 },
                        transition: { delay: m.d, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
                      }
                    : {})}
                >
                  <circle cx={m.x} cy={m.y} r="4" fill="hsl(var(--accent))" stroke="hsl(var(--card))" strokeWidth="2" />
                  <line x1={m.x} y1={m.y - 4} x2={m.x} y2={m.y - 20} stroke="hsl(var(--foreground) / 0.35)" strokeWidth="1.5" />
                  <rect x={m.x} y={m.y - 30} width="46" height="15" rx="3" fill="hsl(var(--muted))" />
                  <text x={m.x + 6} y={m.y - 19} fontSize="10" fontWeight="700" fill="hsl(var(--foreground) / 0.85)">
                    {m.label}
                  </text>
                </motion.g>
              ))}
            </svg>

            {/* The rocket, rides the trajectory to the top-right */}
            <motion.div
              className="absolute"
              style={{ right: "6%", top: "8%" }}
              {...(on
                ? {
                    initial: { opacity: 0, x: -120, y: 130 },
                    animate: { opacity: 1, x: 0, y: 0 },
                    transition: { delay: 0.4, duration: 1.5, ease: [0.22, 1, 0.36, 1] as const },
                  }
                : {})}
            >
              <div className="relative">
                {/* Trail */}
                <span
                  className="absolute left-1/2 top-full h-14 w-1.5 -translate-x-1/2 rounded-full"
                  style={{
                    background: "linear-gradient(to bottom, hsl(var(--accent)), transparent)",
                    animation: on ? "bstpTrail 1.1s ease-in-out infinite" : undefined,
                  }}
                />
                <div
                  className="relative grid h-12 w-12 place-items-center rounded-2xl text-white shadow-[0_10px_30px_-6px_hsl(var(--accent))]"
                  style={{
                    backgroundImage: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
                    animation: on ? "bstpHover 3s ease-in-out infinite" : undefined,
                  }}
                >
                  <Rocket className="h-6 w-6 -rotate-45" />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bstpDrift { 0%,100% { transform: translateY(0); opacity: 0.35; } 50% { transform: translateY(-14px); opacity: 0.9; } }
        @keyframes bstpHover { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes bstpTrail { 0%,100% { opacity: 0.4; transform: translateX(-50%) scaleY(0.85); } 50% { opacity: 0.95; transform: translateX(-50%) scaleY(1.15); } }
      `,
        }}
      />
    </section>
  );
}
