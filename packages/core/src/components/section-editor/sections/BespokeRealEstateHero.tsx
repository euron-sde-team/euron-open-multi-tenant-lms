"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Bath, BedDouble, Home, MapPin, Maximize, Phone } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke real estate hero: a stylized neighbourhood map (streets/blocks grid)
 *  with dropping/bouncing location pins, a dashed route line linking two pins,
 *  and a floating property listing card (thumbnail + price + beds/baths/sqft). */
export function BespokeRealEstateHero({ section }: { section: SectionConfig }) {
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
  const pin = (d: number): MotionProps =>
    on
      ? {
          initial: { opacity: 0, y: -34, scale: 0.5 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { delay: d, type: "spring", stiffness: 460, damping: 12, mass: 0.6 },
        }
      : {};

  // Map pin coordinates (percent within the map surface).
  const pins: Array<{ x: number; y: number; d: number; primary?: boolean }> = [
    { x: 24, y: 66, d: 0.5 },
    { x: 70, y: 30, d: 0.75, primary: true },
    { x: 82, y: 74, d: 1.0 },
  ];
  // Vertical + horizontal street lines drawn across the map surface.
  const vLines = [16, 34, 52, 70, 88];
  const hLines = [22, 44, 66, 88];

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden py-20 lg:py-24"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      {/* Ambient soft washes */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-24 top-[-10%] h-[36rem] w-[36rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.16), transparent 70%)" }}
        />
        <div
          className="absolute -right-24 bottom-[-14%] h-[34rem] w-[34rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.18), transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        {/* ── Copy column ── */}
        <div className="text-center lg:text-left">
          <motion.span
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold"
            style={{
              color: "hsl(var(--primary))",
              backgroundColor: "hsl(var(--primary) / 0.1)",
              border: "1px solid hsl(var(--primary) / 0.22)",
            }}
          >
            <Home className="h-4 w-4" />
            <EditableText
              value={content.eyebrow ?? "Find your next address"}
              onChange={(v) => update("eyebrow", v)}
              as="span"
            />
          </motion.span>

          <motion.h1
            {...enter(0.08)}
            className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ color: "hsl(var(--foreground))" }}
          >
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p
              {...enter(0.16)}
              className="mx-auto mt-5 max-w-lg text-lg lg:mx-0"
              style={{ color: "hsl(var(--foreground) / 0.62)" }}
            >
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
                  <div
                    className="text-[11px] font-medium uppercase tracking-wide"
                    style={{ color: "hsl(var(--foreground) / 0.45)" }}
                  >
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
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start"
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
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-[0_16px_44px_-14px_hsl(var(--primary))] transition-transform hover:scale-[1.04] sm:w-auto"
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-bold transition-colors sm:w-auto"
                  style={{
                    color: "hsl(var(--foreground))",
                    border: "1px solid hsl(var(--foreground) / 0.18)",
                  }}
                >
                  <Phone className="h-4 w-4" />
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

        {/* ── Signature graphic: neighbourhood map + pins + route + listing card ── */}
        <motion.div {...enter(0.2)} className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-3xl"
            style={{
              backgroundColor: "hsl(var(--muted) / 0.5)",
              border: "1px solid hsl(var(--foreground) / 0.08)",
              boxShadow: "0 30px 70px -30px hsl(var(--primary) / 0.35)",
            }}
          >
            {/* Map surface: street grid */}
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {/* soft block fills */}
              <rect x="18" y="24" width="14" height="18" rx="1.5" fill="hsl(var(--primary) / 0.06)" />
              <rect x="54" y="48" width="16" height="16" rx="1.5" fill="hsl(var(--accent) / 0.07)" />
              <rect x="36" y="68" width="18" height="14" rx="1.5" fill="hsl(var(--primary) / 0.05)" />
              {vLines.map((x) => (
                <line
                  key={`v${x}`}
                  x1={x}
                  y1="4"
                  x2={x}
                  y2="96"
                  stroke="hsl(var(--foreground) / 0.1)"
                  strokeWidth="0.5"
                />
              ))}
              {hLines.map((y) => (
                <line
                  key={`h${y}`}
                  x1="4"
                  y1={y}
                  x2="96"
                  y2={y}
                  stroke="hsl(var(--foreground) / 0.1)"
                  strokeWidth="0.5"
                />
              ))}
              {/* dashed route line connecting first two pins */}
              <path
                d="M24 66 C 40 58, 54 40, 70 30"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="0.9"
                strokeDasharray="2.4 2.4"
                strokeLinecap="round"
                opacity="0.75"
                style={on ? { animation: "bresRoute 3.2s linear infinite" } : undefined}
              />
            </svg>

            {/* Location pins (drop + bounce in) */}
            {pins.map((p, i) => (
              <motion.div
                key={i}
                {...pin(0.35 + i * 0.18)}
                className="absolute z-10 -translate-x-1/2 -translate-y-full"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                <div className="relative flex flex-col items-center">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg"
                    style={{
                      backgroundColor: p.primary ? "hsl(var(--primary))" : "hsl(var(--accent))",
                      color: "hsl(var(--primary-foreground))",
                    }}
                  >
                    <MapPin className="h-5 w-5" fill="currentColor" />
                  </div>
                  {/* pin tail + ground pulse */}
                  <div
                    className="h-2.5 w-1.5 -mt-0.5"
                    style={{
                      backgroundColor: p.primary ? "hsl(var(--primary))" : "hsl(var(--accent))",
                      clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                    }}
                  />
                  <span
                    className="mt-1 h-1.5 w-3 rounded-full"
                    style={{
                      backgroundColor: "hsl(var(--foreground) / 0.18)",
                      animation: on ? `bresPulse ${2.4 + i * 0.5}s ease-in-out infinite` : undefined,
                    }}
                  />
                </div>
              </motion.div>
            ))}

            {/* Floating property listing card */}
            <motion.div
              {...enter(0.7)}
              className="absolute bottom-4 left-4 right-auto z-20 w-48 rounded-2xl p-3 shadow-xl backdrop-blur-sm sm:w-64"
              style={{
                backgroundColor: "hsl(var(--background) / 0.94)",
                border: "1px solid hsl(var(--foreground) / 0.1)",
              }}
            >
              <div className="relative overflow-hidden rounded-xl">
                <div className="aspect-[16/10] w-full" style={{ backgroundColor: "hsl(var(--muted))" }}>
                  <EditableImage
                    src={content.image || ""}
                    alt={content.imageAlt || "Featured property"}
                    onChange={(src) => update("image", src)}
                    className="h-full w-full object-cover"
                    aspectRatio="auto"
                  />
                </div>
                <span
                  className="absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-black text-white shadow"
                  style={{ backgroundColor: "hsl(var(--primary))" }}
                >
                  <EditableText
                    value={content.headlineAccent ?? "$1.2M"}
                    onChange={(v) => update("headlineAccent", v)}
                    as="span"
                  />
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs" style={{ color: "hsl(var(--foreground) / 0.6)" }}>
                <MapPin className="h-3.5 w-3.5" style={{ color: "hsl(var(--primary))" }} />
                <span className="truncate font-medium">
                  <EditableText
                    value={content.imageAlt || "218 Maple Avenue"}
                    onChange={(v) => update("imageAlt", v)}
                    as="span"
                  />
                </span>
              </div>
              <div
                className="mt-2.5 flex items-center justify-between border-t pt-2.5 text-xs font-semibold"
                style={{ borderColor: "hsl(var(--foreground) / 0.08)", color: "hsl(var(--foreground) / 0.72)" }}
              >
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} /> 4
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bath className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} /> 3
                </span>
                <span className="inline-flex items-center gap-1">
                  <Maximize className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} /> 2,850 sqft
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bresRoute { to { stroke-dashoffset: -19.2; } }
        @keyframes bresPulse { 0%,100% { transform: scaleX(0.6); opacity: 0.4; } 50% { transform: scaleX(1.2); opacity: 0.9; } }
      `,
        }}
      />
    </section>
  );
}
