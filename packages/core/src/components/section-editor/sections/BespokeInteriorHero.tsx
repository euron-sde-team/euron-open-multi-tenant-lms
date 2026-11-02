"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Ruler, Sparkles } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke interior-design hero: a blueprint room that draws itself, an
 *  isometric floor-plan whose walls + furniture strokes animate in via
 *  stroke-dashoffset, then dimension lines with measurements and a warm
 *  row of material swatches (wood / stone / linen / sage) fade in. A small
 *  optional room photo (content.image) settles inside the plan frame. */
export function BespokeInteriorHero({ section }: { section: SectionConfig }) {
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

  // Material / mood strip, warm interior palette.
  const swatches: Array<{ label: string; color: string }> = [
    { label: "Oak", color: "#b98b5e" },
    { label: "Stone", color: "#d9d2c7" },
    { label: "Linen", color: "#efe7da" },
    { label: "Sage", color: "#9bab8a" },
  ];

  // Blueprint stroke length long enough to hide dashoffset until animated.
  const DASH = 2600;

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden py-20 lg:py-24"
      style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
      {/* Ambient warm wash + faint grid, contained */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 85% 15%, hsl(var(--accent) / 0.12), transparent 55%), radial-gradient(90% 80% at 10% 90%, hsl(var(--primary) / 0.08), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground) / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.04) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(120% 120% at 50% 40%, black, transparent 78%)",
            WebkitMaskImage: "radial-gradient(120% 120% at 50% 40%, black, transparent 78%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* ── Copy column ── */}
        <div className="max-w-xl">
          <motion.span
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium"
            style={{ borderColor: "hsl(var(--primary) / 0.3)", backgroundColor: "hsl(var(--primary) / 0.07)", color: "hsl(var(--primary))" }}
          >
            <Sparkles className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Interiors, thoughtfully planned"} onChange={(v) => update("eyebrow", v)} as="span" />
          </motion.span>

          <motion.h1 {...enter(0.08)} className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mt-5 max-w-lg text-base leading-relaxed sm:text-lg" style={{ color: "hsl(var(--foreground) / 0.66)" }}>
              <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
            </motion.p>
          )}

          {stats.length > 0 && (
            <motion.div {...enter(0.24)} className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              {stats.map((st: HeroPhotographyStat, i: number) => (
                <div key={st.id} className="min-w-[70px]">
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
                  <div className="mt-0.5 text-[11px] uppercase tracking-wide" style={{ color: "hsl(var(--foreground) / 0.5)" }}>
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

          {/* Material / mood strip */}
          <motion.div {...enter(0.32)} className="mt-8 flex flex-wrap items-center gap-3">
            {swatches.map((s, i) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-[12px] font-medium"
                style={{
                  borderColor: "hsl(var(--foreground) / 0.1)",
                  backgroundColor: "hsl(var(--foreground) / 0.02)",
                  color: "hsl(var(--foreground) / 0.7)",
                  animation: on ? `bintSwatch 0.6s ease ${0.5 + i * 0.1}s both` : undefined,
                }}
              >
                <span className="h-4 w-4 rounded-full ring-1 ring-inset ring-black/5" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </motion.div>

          <motion.div {...enter(0.4)} className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
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
                  className="group inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-bold text-white shadow-[0_16px_44px_-14px_hsl(var(--primary))] transition-transform hover:scale-[1.03]"
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
                  className="inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-muted"
                  style={{ borderColor: "hsl(var(--foreground) / 0.16)", color: "hsl(var(--foreground) / 0.8)" }}
                >
                  <Ruler className="h-4 w-4" />
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

        {/* ── Signature graphic: self-drawing blueprint room ── */}
        <motion.div {...enter(0.2)} className="relative mx-auto w-full max-w-[440px]">
          <div
            className="relative aspect-square w-full rounded-2xl border p-4"
            style={{
              borderColor: "hsl(var(--primary) / 0.2)",
              backgroundColor: "hsl(var(--primary) / 0.03)",
              boxShadow: "0 30px 80px -40px hsl(var(--primary) / 0.5)",
            }}
          >
            {/* Optional room photo fades in inside the plan frame */}
            {(content.image || isEditMode) && (
              <div
                className="absolute right-6 top-6 z-10 h-[38%] w-[42%] overflow-hidden rounded-lg border shadow-lg"
                style={{ borderColor: "hsl(var(--background))", animation: on ? "bintPhoto 0.9s ease 1.6s both" : undefined, opacity: on ? 0 : 1 }}
              >
                <EditableImage
                  src={content.image || ""}
                  alt={content.imageAlt || "Room render"}
                  onChange={(src) => update("image", src)}
                  className="h-full w-full"
                  aspectRatio="auto"
                  placeholder="Room"
                />
              </div>
            )}

            <svg viewBox="0 0 400 400" className="h-full w-full" style={{ overflow: "visible" }} aria-hidden="true">
              <g
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={
                  on
                    ? { strokeDasharray: DASH, strokeDashoffset: DASH, animation: "bintDraw 2.4s ease forwards 0.4s" }
                    : undefined
                }
              >
                {/* Room outer walls */}
                <path d="M40 70 L360 70 L360 340 L40 340 Z" />
                {/* Interior partition */}
                <path d="M40 220 L230 220 L230 340" />
                {/* Door swing (arc) */}
                <path d="M230 220 A70 70 0 0 1 160 290" strokeDasharray="4 6" />
              </g>

              {/* Furniture, softer accent stroke, drawn slightly later */}
              <g
                fill="none"
                stroke="hsl(var(--accent))"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={
                  on
                    ? { strokeDasharray: DASH, strokeDashoffset: DASH, animation: "bintDraw 2s ease forwards 1s" }
                    : undefined
                }
              >
                {/* Sofa */}
                <path d="M70 250 L210 250 L210 320 L70 320 Z" />
                <path d="M70 250 L70 230 L210 230 L210 250" />
                {/* Rug (dashed) */}
                <path d="M100 275 L180 275 L180 305 L100 305 Z" strokeDasharray="3 6" />
                {/* Bed / table upper-left */}
                <path d="M70 100 L170 100 L170 190 L70 190 Z" />
                <path d="M70 130 L170 130" strokeDasharray="3 6" />
                {/* Round table upper-right */}
                <circle cx="290" cy="150" r="34" />
                <circle cx="290" cy="150" r="6" fill="hsl(var(--accent))" stroke="none" />
              </g>

              {/* Dimension lines with measurements */}
              <g style={{ animation: on ? "bintDim 0.8s ease 2.4s both" : undefined, opacity: on ? 0 : 1 }}>
                {/* Top width dimension */}
                <line x1="40" y1="46" x2="360" y2="46" stroke="hsl(var(--foreground) / 0.4)" strokeWidth={1} />
                <line x1="40" y1="40" x2="40" y2="52" stroke="hsl(var(--foreground) / 0.4)" strokeWidth={1} />
                <line x1="360" y1="40" x2="360" y2="52" stroke="hsl(var(--foreground) / 0.4)" strokeWidth={1} />
                <rect x="176" y="36" width="48" height="20" rx="4" fill="hsl(var(--background))" />
                <text x="200" y="50" textAnchor="middle" fontSize="12" fontWeight="600" fill="hsl(var(--foreground) / 0.7)">
                  6.4 m
                </text>
                {/* Left height dimension */}
                <line x1="22" y1="70" x2="22" y2="340" stroke="hsl(var(--foreground) / 0.4)" strokeWidth={1} />
                <line x1="16" y1="70" x2="28" y2="70" stroke="hsl(var(--foreground) / 0.4)" strokeWidth={1} />
                <line x1="16" y1="340" x2="28" y2="340" stroke="hsl(var(--foreground) / 0.4)" strokeWidth={1} />
                <g transform="rotate(-90 22 205)">
                  <rect x="-2" y="195" width="48" height="20" rx="4" fill="hsl(var(--background))" />
                  <text x="22" y="209" textAnchor="middle" fontSize="12" fontWeight="600" fill="hsl(var(--foreground) / 0.7)">
                    5.4 m
                  </text>
                </g>
              </g>
            </svg>

            {/* Plan caption chip */}
            <div
              className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-medium"
              style={{
                borderColor: "hsl(var(--foreground) / 0.1)",
                backgroundColor: "hsl(var(--background) / 0.85)",
                color: "hsl(var(--foreground) / 0.6)",
                animation: on ? "bintDim 0.8s ease 2.6s both" : undefined,
                opacity: on ? 0 : 1,
              }}
            >
              <Ruler className="h-3.5 w-3.5" style={{ color: "hsl(var(--primary))" }} />
              <EditableLabel value={content.tileLabels?.planCaption} fallback="Living Room · Plan 01" onChange={(v) => update("tileLabels", { ...content.tileLabels, planCaption: v })} />
            </div>
          </div>
        </motion.div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bintDraw { to { stroke-dashoffset: 0; } }
        @keyframes bintDim { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bintPhoto { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @keyframes bintSwatch { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `,
        }}
      />
    </section>
  );
}
