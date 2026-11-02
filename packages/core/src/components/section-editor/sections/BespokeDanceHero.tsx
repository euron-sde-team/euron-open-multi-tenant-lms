"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Music, Play, Sparkles } from "lucide-react";

import type { CSSProperties } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke dance hero: a circular audio equalizer, bars arranged radially
 *  around a central circle, each pulsing to a beat, with a dancer silhouette
 *  (or content.image) inside the ring, drifting confetti sparks and a BPM chip.
 *  Neon fuchsia + cyan nightlife energy. Two-column on desktop, stacked mobile. */
export function BespokeDanceHero({ section }: { section: SectionConfig }) {
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

  // Radial equalizer bars: evenly distributed around a ring, each with its own
  // staggered beat delay + duration so the ring "breathes" rhythmically.
  const BARS = 40;
  const bars = Array.from({ length: BARS }, (_, i) => {
    const angle = (360 / BARS) * i;
    const seed = (i * 7) % 13;
    return {
      angle,
      delay: `${(seed * 0.06).toFixed(2)}s`,
      dur: `${(0.75 + (seed % 5) * 0.12).toFixed(2)}s`,
      accent: i % 3 === 0,
    };
  });

  // Confetti / spark particles drifting upward.
  const sparks = Array.from({ length: 10 }, (_, i) => ({
    left: `${(i * 9.5 + 5) % 96}%`,
    delay: `${(i % 5) * 0.8}s`,
    dur: `${5 + (i % 4) * 1.4}s`,
    size: 4 + (i % 3) * 3,
    accent: i % 2 === 0,
  }));

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden px-6 py-20 sm:py-24"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      {/* Ambient neon glows */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-32 top-[-10%] h-[32rem] w-[32rem] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 70%)" }}
        />
        <div
          className="absolute -right-24 bottom-[-15%] h-[30rem] w-[30rem] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.3), transparent 70%)" }}
        />
      </div>

      {/* Drifting confetti sparks */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {sparks.map((s, i) => (
          <span
            key={i}
            className="absolute bottom-[-10%] rounded-sm"
            style={{
              left: s.left,
              width: s.size,
              height: s.size,
              backgroundColor: s.accent ? "hsl(var(--accent))" : "hsl(var(--primary))",
              opacity: 0.7,
              boxShadow: `0 0 ${s.size * 2}px ${s.accent ? "hsl(var(--accent))" : "hsl(var(--primary))"}`,
              animation: on ? `bdncDrift ${s.dur} linear ${s.delay} infinite` : undefined,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-8">
        {/* ── Content column ── */}
        <div className="text-center lg:text-left">
          <motion.span
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium text-foreground/90"
            style={{ borderColor: "hsl(var(--accent) / 0.4)", backgroundColor: "hsl(var(--accent) / 0.14)" }}
          >
            <Music className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
            <EditableText
              value={content.eyebrow ?? "Feel the rhythm, learn to move"}
              onChange={(v) => update("eyebrow", v)}
              as="span"
            />
          </motion.span>

          <motion.h1
            {...enter(0.08)}
            className="mt-6 text-5xl font-black leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-[4.25rem]"
            style={{ textShadow: "0 2px 44px hsl(var(--primary) / 0.4)" }}
          >
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mx-auto mt-6 max-w-md text-lg text-muted-foreground lg:mx-0">
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
              className="mt-8 flex flex-wrap items-center justify-center gap-x-9 gap-y-3 lg:justify-start"
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
                  className="group inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-bold text-white shadow-[0_16px_50px_-12px_hsl(var(--primary))] transition-transform hover:scale-[1.04]"
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

        {/* ── Signature graphic: circular radial equalizer ── */}
        <motion.div
          {...enter(0.2)}
          className="relative mx-auto aspect-square w-full max-w-[20rem] sm:max-w-[24rem] lg:max-w-[28rem]"
        >
          {/* Slowly rotating ring wrapper carries the radial bars */}
          <div
            className="absolute inset-0"
            style={{ animation: on ? "bdncSpin 40s linear infinite" : undefined }}
          >
            {bars.map((b, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 origin-bottom rounded-full"
                style={
                  {
                    "--a": `${b.angle}deg`,
                    width: b.accent ? 4 : 3,
                    height: "13%",
                    // Push each bar out to the ring radius (46%) then rotate into place.
                    transform: `rotate(${b.angle}deg) translateY(-46%)`,
                    backgroundColor: b.accent ? "hsl(var(--accent))" : "hsl(var(--primary))",
                    boxShadow: `0 0 8px ${b.accent ? "hsl(var(--accent))" : "hsl(var(--primary))"}`,
                    opacity: 0.9,
                    animation: on ? `bdncBeat ${b.dur} ease-in-out ${b.delay} infinite` : undefined,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          {/* Concentric glow rings */}
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ borderColor: "hsl(var(--primary) / 0.4)" }}
          />
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ borderColor: "hsl(var(--accent) / 0.35)" }}
          />

          {/* Central circle with dancer silhouette or content.image */}
          <div
            className="absolute left-1/2 top-1/2 flex h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
            style={{
              background: "radial-gradient(circle at 50% 30%, hsl(var(--primary) / 0.45), hsl(var(--primary) / 0.85) 75%)",
              boxShadow: "0 0 60px -10px hsl(var(--primary) / 0.6), inset 0 0 40px hsl(var(--accent) / 0.15)",
            }}
          >
            {content.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={content.image}
                alt={content.imageAlt ?? "Dancer"}
                className="h-full w-full object-cover"
                style={{ animation: on ? "bdncPulse 2s ease-in-out infinite" : undefined }}
              />
            ) : (
              <svg
                viewBox="0 0 100 120"
                className="h-[78%] w-[78%]"
                fill="hsl(var(--accent))"
                style={{ animation: on ? "bdncPulse 2s ease-in-out infinite" : undefined }}
                aria-hidden="true"
              >
                {/* Stylised dancer silhouette mid-pose */}
                <circle cx="52" cy="16" r="9" />
                <path d="M52 26 C46 34 44 44 40 52 L24 44 L20 52 L42 64 C44 70 46 74 48 80 L36 104 L44 108 L56 84 L66 106 L74 100 L64 78 C66 70 68 62 68 54 L84 60 L88 52 L66 44 C62 36 58 30 52 26 Z" />
              </svg>
            )}
          </div>

          {/* BPM chip, editable value via content.trust. Sits inside the
              graphic (its own relative box), so it never overlaps the headline;
              the graphic is an in-flow grid item that stacks below text on
              mobile. Gated to desktop as a foreground overlay for safety. */}
          <div
            className="absolute bottom-1 right-1 hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold text-foreground backdrop-blur-sm sm:bottom-2 sm:right-2 lg:inline-flex"
            style={{ borderColor: "hsl(var(--accent) / 0.4)", backgroundColor: "hsl(var(--card) / 0.85)" }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "hsl(var(--accent))" }} />
            <span style={{ color: "hsl(var(--accent))" }}>
              <EditableText value={content.trust ?? "128"} onChange={(v) => update("trust", v)} as="span" />
            </span>
            <span className="text-muted-foreground">BPM</span>
          </div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32"
        style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bdncBeat { 0%,100% { transform: rotate(var(--a,0deg)) translateY(-46%) scaleY(0.45); } 50% { transform: rotate(var(--a,0deg)) translateY(-46%) scaleY(1); } }
        @keyframes bdncSpin { to { transform: rotate(360deg); } }
        @keyframes bdncPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes bdncDrift { 0% { transform: translateY(0) rotate(0deg); opacity: 0; } 12% { opacity: 0.75; } 90% { opacity: 0.4; } 100% { transform: translateY(-110vh) rotate(320deg); opacity: 0; } }
      `,
        }}
      />
    </section>
  );
}
