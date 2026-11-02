"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { Activity, ArrowRight, CalendarCheck, HeartPulse, Play, Stethoscope } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke medical/nursing hero: a calm split layout with an editable text
 *  column and a "vitals monitor" panel. Signature graphic: a continuously
 *  drawing ECG heartbeat line (SVG stroke-dashoffset) beside a softly pulsing
 *  heart-rate ring and a next-appointment chip. Light, teal + sky, trustworthy. */
export function BespokeMedicalHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, EditableImage, LinkComponent } = useSectionEditor();
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

  // ECG polyline, a repeating heartbeat waveform drawn left-to-right.
  const ecgPath =
    "M0,40 L46,40 L58,40 L66,22 L74,58 L82,12 L90,40 L128,40 L150,40 L158,40 L166,22 L174,58 L182,12 L190,40 L236,40 L248,40 L256,40 L264,22 L272,58 L280,12 L288,40 L340,40 L360,40";

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden py-20 lg:py-24"
      style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
      {/* Ambient soft glows */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl"
          style={{ backgroundColor: "hsl(var(--primary) / 0.12)", animation: on ? "bmedDrift 14s ease-in-out infinite" : undefined }}
        />
        <div
          className="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ backgroundColor: "hsl(var(--accent) / 0.12)", animation: on ? "bmedDrift 18s ease-in-out infinite reverse" : undefined }}
        />
        {/* Subtle medical cross grid */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        {/* ── Left: editable text ── */}
        <div className="max-w-xl">
          <motion.span
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold"
            style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
          >
            <Stethoscope className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Trusted clinical training"} onChange={(v) => update("eyebrow", v)} as="span" />
          </motion.span>

          <motion.h1 {...enter(0.08)} className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.5rem]">
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
            {(content.headlineAccent || isEditMode) && (
              <>
                {" "}
                <span style={{ color: "hsl(var(--primary))" }}>
                  <EditableText
                    value={content.headlineAccent || ""}
                    onChange={(v) => update("headlineAccent", v)}
                    as="span"
                    placeholder="accent"
                  />
                </span>
              </>
            )}
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mt-5 max-w-lg text-lg leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
            </motion.p>
          )}

          <motion.div {...enter(0.24)} className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
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
                  className="group inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base font-bold text-white shadow-[0_16px_40px_-14px_hsl(var(--primary))] transition-transform hover:scale-[1.03]"
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
                  className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold transition-colors"
                  style={{ border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
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
            <motion.div {...enter(0.32)} className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {stats.map((st: HeroPhotographyStat, i: number) => (
                <div key={st.id}>
                  <div className="text-2xl font-black sm:text-3xl" style={{ color: "hsl(var(--primary))" }}>
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
                  <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
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
        </div>

        {/* ── Right: vitals monitor panel ── */}
        <motion.div {...enter(0.18)} className="relative mx-auto w-full max-w-md">
          {/* Optional doctor photo card behind the vitals card */}
          {(content.image || isEditMode) && (
            <div
              className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] shadow-2xl"
              style={{ border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}
            >
              {content.image ? (
                isEditMode ? (
                  <EditableImage src={content.image} alt={content.imageAlt || "Medical professional"} onChange={(src) => update("image", src)} className="h-full w-full" aspectRatio="auto" />
                ) : (
                  <img src={content.image} alt={content.imageAlt || "Medical professional"} className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center" style={{ color: "hsl(var(--primary) / 0.5)" }}>
                  <Stethoscope className="h-16 w-16" />
                </div>
              )}
            </div>
          )}

          {/* Vitals monitor card, overlaps neatly, contained on mobile */}
          <div
            className={
              (content.image || isEditMode
                ? "relative -mt-16 ml-auto mr-0 w-full max-w-[19rem] sm:absolute sm:-bottom-8 sm:-left-8 sm:mt-0 "
                : "relative mx-auto w-full max-w-[22rem] ") +
              "rounded-2xl p-5 shadow-xl backdrop-blur"
            }
            style={{ border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card) / 0.95)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full"
                    style={{ backgroundColor: "hsl(var(--primary) / 0.5)", animation: on ? "bmedPing 1.6s cubic-bezier(0,0,0.2,1) infinite" : undefined }}
                  />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(var(--primary))" }} />
                </span>
                <EditableLabel value={content.tileLabels?.vitalsTitle} fallback="Vitals Monitor" onChange={(v) => update("tileLabels", { ...content.tileLabels, vitalsTitle: v })} />
              </div>
              <Activity className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
            </div>

            {/* Signature graphic: continuously drawing ECG line */}
            <div
              className="mt-4 overflow-hidden rounded-xl px-3 py-4"
              style={{ backgroundColor: "hsl(var(--muted) / 0.6)", border: "1px solid hsl(var(--border))" }}
            >
              <svg viewBox="0 0 360 80" className="h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0,40 H360" stroke="hsl(var(--border))" strokeWidth="1" />
                <path
                  d={ecgPath}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={100}
                  style={{
                    strokeDasharray: 100,
                    strokeDashoffset: on ? undefined : 0,
                    animation: on ? "bmedTrace 3.2s linear infinite" : undefined,
                    filter: "drop-shadow(0 0 4px hsl(var(--primary) / 0.5))",
                  }}
                />
              </svg>
            </div>

            {/* Heart-rate ring + next appointment chip */}
            <div className="mt-4 flex items-center gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ border: "3px solid hsl(var(--accent) / 0.25)", animation: on ? "bmedPulse 1.1s ease-in-out infinite" : undefined }}
                />
                <span className="absolute inset-0 rounded-full" style={{ border: "3px solid transparent", borderTopColor: "hsl(var(--primary))", borderRightColor: "hsl(var(--primary))" }} />
                <HeartPulse className="h-6 w-6" style={{ color: "hsl(var(--primary))", animation: on ? "bmedBeat 1.1s ease-in-out infinite" : undefined }} />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black leading-none" style={{ color: "hsl(var(--foreground))" }}>72</span>
                  <span className="text-xs font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>bpm</span>
                </div>
                <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>Heart rate</div>
              </div>
            </div>

            <div
              className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
              style={{ backgroundColor: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))" }}
            >
              <CalendarCheck className="h-4 w-4 shrink-0" />
              <EditableText value={content.trust ?? "Next appointment · Today, 2:30 PM"} onChange={(v) => update("trust", v)} as="span" />
            </div>
          </div>
        </motion.div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bmedTrace { 0% { stroke-dashoffset: 100; } 100% { stroke-dashoffset: -100; } }
        @keyframes bmedPulse { 0%,100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.12); opacity: 1; } }
        @keyframes bmedBeat { 0%,100% { transform: scale(1); } 15% { transform: scale(1.22); } 30% { transform: scale(1); } 45% { transform: scale(1.14); } }
        @keyframes bmedPing { 75%,100% { transform: scale(2.4); opacity: 0; } }
        @keyframes bmedDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(24px,-20px); } }
      `,
        }}
      />
    </section>
  );
}
