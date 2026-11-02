"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Moon, Play, Sparkles } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke spirituality/Vedic hero: a centred, meditative layout whose signature
 *  graphic is an ornate multi-layer sacred-geometry mandala (concentric rings of
 *  petals + polygons) rotating slowly at different speeds and opposite directions,
 *  glowing in gold, ringed by an arc of moon-phase dots, with a daily wisdom card. */
export function BespokeSpiritualHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const enter = (d: number): MotionProps => (on ? { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: d, ease: [0.22, 1, 0.36, 1] as const } } : {});

  // 12-petal lotus ring: each petal is an ellipse rotated around centre (50,50).
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  // 8-petal inner lotus, offset for a layered bloom.
  const innerPetals = Array.from({ length: 8 }, (_, i) => i * 45 + 22.5);
  // Points for regular polygons (sacred geometry) at a given radius.
  const polyPoints = (sides: number, r: number, rot = 0) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (Math.PI * 2 * i) / sides - Math.PI / 2 + (rot * Math.PI) / 180;
      return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
    }).join(" ");
  // Waxing arc of moon-phase dots above the mandala.
  const moons = Array.from({ length: 7 }, (_, i) => {
    const a = (-140 + i * (100 / 6)) * (Math.PI / 180); // -140deg .. -40deg
    const rad = 47;
    return { x: 50 + rad * Math.cos(a), y: 50 + rad * Math.sin(a), fill: `${(i / 6) * 100}%` };
  });

  return (
    <section
      className="bspr-root relative flex min-h-[100svh] flex-col items-center justify-start overflow-hidden px-6 pb-20 pt-24 sm:pt-28"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      {/* Ambient aurora + starfield */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute left-1/2 top-1/2 h-[46rem] w-[46rem] max-w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.28), transparent 62%)", filter: "blur(30px)", animation: on ? "bsprBreathe 9s ease-in-out infinite" : undefined }}
        />
        {Array.from({ length: 22 }, (_, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${(i * 47) % 100}%`,
              top: `${(i * 29) % 100}%`,
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              backgroundColor: "hsl(var(--accent))",
              opacity: 0.35,
              animation: on ? `bsprTwinkle ${3 + (i % 5)}s ease-in-out ${(i % 7) * 0.4}s infinite` : undefined,
            }}
          />
        ))}
      </div>

      {/* Signature graphic: ornate multi-layer rotating mandala */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 aspect-square w-[34rem] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 opacity-50 sm:opacity-[0.55]">
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <radialGradient id="bsprGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Layer 1, outer 12-petal lotus, slow CW */}
          <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: on ? "bsprSpin 60s linear infinite" : undefined }}>
            {petals.map((deg) => (
              <ellipse
                key={deg}
                cx="50"
                cy="14"
                rx="4.4"
                ry="12"
                transform={`rotate(${deg} 50 50)`}
                fill="none"
                stroke="hsl(var(--accent) / 0.5)"
                strokeWidth="0.5"
              />
            ))}
          </g>

          {/* Layer 2, twin polygons (12-gon + hexagon), slow CCW */}
          <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: on ? "bsprSpinRev 46s linear infinite" : undefined }}>
            <polygon points={polyPoints(12, 34)} fill="none" stroke="hsl(var(--primary) / 0.55)" strokeWidth="0.5" />
            <polygon points={polyPoints(6, 34)} fill="none" stroke="hsl(var(--accent) / 0.35)" strokeWidth="0.4" />
            <polygon points={polyPoints(6, 34, 30)} fill="none" stroke="hsl(var(--accent) / 0.35)" strokeWidth="0.4" />
          </g>

          {/* Layer 3, inner 8-petal lotus, medium CW */}
          <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: on ? "bsprSpin 34s linear infinite" : undefined }}>
            {innerPetals.map((deg) => (
              <ellipse
                key={deg}
                cx="50"
                cy="30"
                rx="3.2"
                ry="8"
                transform={`rotate(${deg} 50 50)`}
                fill="hsl(var(--accent) / 0.06)"
                stroke="hsl(var(--accent) / 0.6)"
                strokeWidth="0.45"
              />
            ))}
          </g>

          {/* Layer 4, pulsing core with dotted seed-of-life ring */}
          <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: on ? "bsprSpinRev 24s linear infinite" : undefined }}>
            <circle cx="50" cy="50" r="12" fill="none" stroke="hsl(var(--primary) / 0.7)" strokeWidth="0.5" strokeDasharray="1 2.2" />
          </g>
          <circle cx="50" cy="50" r="6.5" fill="url(#bsprGlow)" style={{ transformBox: "fill-box", transformOrigin: "center", animation: on ? "bsprPulse 5s ease-in-out infinite" : undefined }} />
          <circle cx="50" cy="50" r="2.4" fill="hsl(var(--accent))" style={{ transformBox: "fill-box", transformOrigin: "center", animation: on ? "bsprPulse 5s ease-in-out infinite" : undefined }} />

          {/* Arc of moon-phase dots */}
          {moons.map((m, i) => (
            <g key={i}>
              <circle cx={m.x} cy={m.y} r="1.9" fill="hsl(var(--accent) / 0.18)" stroke="hsl(var(--accent) / 0.6)" strokeWidth="0.3" />
              <clipPath id={`bsprMoon${i}`}>
                <circle cx={m.x} cy={m.y} r="1.9" />
              </clipPath>
              <rect x={m.x - 1.9} y={m.y - 1.9} width={m.fill} height="3.8" fill="hsl(var(--accent))" clipPath={`url(#bsprMoon${i})`} opacity="0.85" />
            </g>
          ))}
        </svg>
      </div>

      {/* Bottom fade so content stays legible */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-44" style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }} />

      {/* Readability backdrop behind the text (sits over the mandala) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[42rem] w-[46rem] max-w-[96%] -translate-x-1/2 -translate-y-1/2" style={{ background: "radial-gradient(closest-side, hsl(var(--background) / 0.55) 30%, hsl(var(--background) / 0.25) 55%, transparent 78%)" }} />

      {/* Centred content */}
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.span
          {...enter(0)}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium"
          style={{ borderColor: "hsl(var(--primary) / 0.35)", backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
        >
          <Sparkles className="h-4 w-4" />
          <EditableText value={content.eyebrow ?? "Awaken your inner wisdom"} onChange={(v) => update("eyebrow", v)} as="span" />
        </motion.span>

        <motion.h1
          {...enter(0.08)}
          className="mt-7 text-5xl font-black leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-[4rem]"
          style={{ textShadow: "0 2px 44px hsl(var(--primary) / 0.5)" }}
        >
          <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
        </motion.h1>

        {(content.description || isEditMode) && (
          <motion.p {...enter(0.16)} className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-foreground/70">
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
              <button type="button" className="group inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-bold text-white shadow-[0_16px_50px_-12px_hsl(var(--primary))] transition-transform hover:scale-[1.04]" style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
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

        {/* Daily wisdom card */}
        {(content.trust || isEditMode) && (
          <motion.div
            {...enter(0.38)}
            className="mx-auto mt-10 flex max-w-md items-start gap-3 rounded-2xl border px-5 py-4 text-left backdrop-blur-sm"
            style={{ borderColor: "hsl(var(--accent) / 0.22)", backgroundColor: "hsl(var(--primary) / 0.1)" }}
          >
            <Moon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "hsl(var(--accent))" }} />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "hsl(var(--accent))" }}>Daily wisdom</div>
              <div className="mt-1 text-sm italic leading-relaxed text-foreground/70">
                <EditableText value={content.trust || "The quieter you become, the more you are able to hear."} onChange={(v) => update("trust", v)} as="span" placeholder="Add a daily quote..." />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bsprSpin { to { transform: rotate(360deg); } }
        @keyframes bsprSpinRev { to { transform: rotate(-360deg); } }
        @keyframes bsprPulse { 0%,100% { opacity: 0.55; transform: scale(0.94); } 50% { opacity: 1; transform: scale(1.08); } }
        @keyframes bsprBreathe { 0%,100% { opacity: 0.65; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.06); } }
        @keyframes bsprTwinkle { 0%,100% { opacity: 0.15; } 50% { opacity: 0.7; } }
      ` }} />
    </section>
  );
}
