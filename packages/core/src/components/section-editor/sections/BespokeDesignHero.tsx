"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowUpRight, MousePointer2, Play, Sparkles, Type as TypeIcon } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke design-studio hero: a live bento tile canvas, a headline tile plus
 *  surrounding "design artifact" tiles (color swatches, an Aa type tile, a mini
 *  UI-component preview, a stat tile) that stagger in, with a drifting "You"
 *  cursor label. Not a centered hero, not a card-with-chips. */
export function BespokeDesignHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const tile = (d: number): MotionProps =>
    on
      ? {
          initial: { opacity: 0, y: 26, scale: 0.96 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration: 0.62, delay: d, ease: [0.22, 1, 0.36, 1] as const },
        }
      : {};

  const swatches = [
    "hsl(var(--primary))",
    "hsl(var(--accent))",
    "hsl(var(--primary) / 0.55)",
    "hsl(var(--accent) / 0.55)",
    "hsl(var(--foreground) / 0.85)",
  ];
  const firstStat = stats[0];

  const tileBase =
    "relative overflow-hidden rounded-3xl border p-6";
  const tileStyle = {
    borderColor: "hsl(var(--foreground) / 0.08)",
    backgroundColor: "hsl(var(--foreground) / 0.02)",
    boxShadow: "0 1px 2px hsl(var(--foreground) / 0.04)",
  };

  return (
    <section
      className="relative grid min-h-[100svh] items-center overflow-hidden py-16 lg:py-24"
      style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
      {/* dotted canvas grid + soft color washes */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-24 top-0 z-0 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "hsl(var(--primary) / 0.18)", animation: on ? "bdsnFloat 9s ease-in-out infinite" : undefined }}
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 z-0 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "hsl(var(--accent) / 0.16)", animation: on ? "bdsnFloat 11s ease-in-out infinite reverse" : undefined }}
      />

      <div className="relative z-10 mx-auto min-h-[600px] w-full max-w-6xl px-5 sm:px-6 lg:min-h-[720px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* HEADLINE TILE, large */}
          <motion.div
            {...tile(0)}
            className={`${tileBase} flex flex-col justify-between sm:col-span-2 sm:row-span-2 sm:min-h-[360px] sm:p-8 lg:col-span-2`}
            style={{
              ...tileStyle,
              backgroundImage:
                "linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--accent) / 0.05))",
            }}
          >
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold"
                style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <EditableText
                  value={content.eyebrow ?? "Design Studio"}
                  onChange={(v) => update("eyebrow", v)}
                  as="span"
                />
              </span>
              <h1 className="mt-5 text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
              </h1>
              {(content.description || isEditMode) && (
                <p className="mt-4 max-w-md text-base leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <EditableText
                    value={content.description || ""}
                    onChange={(v) => update("description", v)}
                    as="span"
                    placeholder="Add a subtitle..."
                  />
                </p>
              )}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
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
                    className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-[0_14px_40px_-14px_hsl(var(--primary))] transition-transform hover:scale-[1.04]"
                    style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}
                  >
                    {isEditMode ? (
                      <>
                        <EditableText
                          value={content.primaryCta.text}
                          onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })}
                          as="span"
                        />
                        <ArrowUpRight className="h-4 w-4" />
                      </>
                    ) : (
                      <LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">
                        {content.primaryCta.text}
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
                    className="inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold transition-colors"
                    style={{ borderColor: "hsl(var(--foreground) / 0.14)", color: "hsl(var(--foreground))" }}
                  >
                    <Play className="h-4 w-4" />
                    {isEditMode ? (
                      <EditableText
                        value={content.secondaryCta.text}
                        onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })}
                        as="span"
                      />
                    ) : (
                      <LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>
                    )}
                  </button>
                </EditableClickable>
              )}
            </div>

            {/* drifting "You" cursor label, desktop only so it never overlaps
                the headline / eyebrow on phones & tablets */}
            <div
              className="pointer-events-none absolute right-6 top-6 hidden items-center gap-1.5 lg:flex"
              style={{ animation: on ? "bdsnDrift 7s ease-in-out infinite" : undefined }}
            >
              <MousePointer2 className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} fill="hsl(var(--accent))" />
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-accent-foreground"
                style={{ backgroundColor: "hsl(var(--accent))" }}
              >
                <EditableLabel value={content.tileLabels?.cursorLabel} fallback="You" onChange={(v) => update("tileLabels", { ...content.tileLabels, cursorLabel: v })} />
              </span>
            </div>
          </motion.div>

          {/* COLOR SWATCH TILE */}
          <motion.div {...tile(0.1)} className={`${tileBase} flex flex-col justify-between`} style={tileStyle}>
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
              <EditableLabel value={content.tileLabels?.paletteLabel} fallback="Palette" onChange={(v) => update("tileLabels", { ...content.tileLabels, paletteLabel: v })} />
            </span>
            <div className="mt-4 flex items-end gap-2">
              {swatches.map((c, i) => (
                <span
                  key={i}
                  className="w-full rounded-lg"
                  style={{
                    background: c,
                    height: `${34 + (i % 3) * 14}px`,
                    animation: on ? `bdsnSwatch 3.2s ease-in-out ${i * 0.25}s infinite` : undefined,
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* TYPOGRAPHY "Aa" TILE */}
          <motion.div
            {...tile(0.18)}
            className={`${tileBase} flex flex-col justify-between`}
            style={{ ...tileStyle, backgroundImage: "linear-gradient(160deg, hsl(var(--accent) / 0.08), transparent)" }}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
              <TypeIcon className="h-3.5 w-3.5" /> Type
            </div>
            <div
              className="mt-1 text-6xl font-black leading-none tracking-tight lg:text-7xl"
              style={{
                backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              <EditableLabel value={content.tileLabels?.typeSpecimen} fallback="Aa" onChange={(v) => update("tileLabels", { ...content.tileLabels, typeSpecimen: v })} />
            </div>
            <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              <EditableLabel value={content.tileLabels?.typeCaption} fallback="Inter · 700" onChange={(v) => update("tileLabels", { ...content.tileLabels, typeCaption: v })} />
            </span>
          </motion.div>

          {/* MINI UI-COMPONENT PREVIEW TILE */}
          <motion.div {...tile(0.26)} className={`${tileBase} flex flex-col justify-between sm:col-span-1`} style={tileStyle}>
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
              <EditableLabel value={content.tileLabels?.componentLabel} fallback="Component" onChange={(v) => update("tileLabels", { ...content.tileLabels, componentLabel: v })} />
            </span>
            <div
              className="mt-4 rounded-2xl border p-4"
              style={{ borderColor: "hsl(var(--foreground) / 0.08)", backgroundColor: "hsl(var(--background))" }}
            >
              <div className="h-2.5 w-2/3 rounded-full" style={{ backgroundColor: "hsl(var(--foreground) / 0.12)" }} />
              <div className="mt-2 h-2.5 w-1/2 rounded-full" style={{ backgroundColor: "hsl(var(--foreground) / 0.08)" }} />
              <div
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                style={{
                  backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))",
                  animation: on ? "bdsnPulse 2.6s ease-in-out infinite" : undefined,
                }}
              >
                Get started <ArrowUpRight className="h-3 w-3" />
              </div>
            </div>
          </motion.div>

          {/* STAT TILE */}
          <motion.div
            {...tile(0.34)}
            className={`${tileBase} flex flex-col justify-center sm:col-span-1`}
            style={{ ...tileStyle, backgroundImage: "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.06))" }}
          >
            {firstStat ? (
              <>
                <div className="text-4xl font-black lg:text-5xl" style={{ color: "hsl(var(--primary))" }}>
                  <EditableText
                    value={firstStat.value}
                    onChange={(v) => {
                      const n = [...stats];
                      n[0] = { ...n[0], value: v };
                      update("stats", n);
                    }}
                    as="span"
                  />
                </div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <EditableText
                    value={firstStat.label}
                    onChange={(v) => {
                      const n = [...stats];
                      n[0] = { ...n[0], label: v };
                      update("stats", n);
                    }}
                    as="span"
                  />
                </div>
              </>
            ) : (
              <div className="text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
                Add a stat to fill this tile
              </div>
            )}
          </motion.div>
        </div>

        {/* remaining stats, a slim strip so all stats stay editable/visible */}
        {stats.length > 1 && (
          <motion.div {...tile(0.42)} className="mt-4 flex flex-wrap items-center gap-x-10 gap-y-3">
            {stats.slice(1).map((st: HeroPhotographyStat, i: number) => {
              const idx = i + 1;
              return (
                <div key={st.id} className="flex items-baseline gap-2">
                  <span className="text-2xl font-black" style={{ color: "hsl(var(--accent))" }}>
                    <EditableText
                      value={st.value}
                      onChange={(v) => {
                        const n = [...stats];
                        n[idx] = { ...n[idx], value: v };
                        update("stats", n);
                      }}
                      as="span"
                    />
                  </span>
                  <span className="text-xs uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <EditableText
                      value={st.label}
                      onChange={(v) => {
                        const n = [...stats];
                        n[idx] = { ...n[idx], label: v };
                        update("stats", n);
                      }}
                      as="span"
                    />
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bdsnFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-24px); } }
        @keyframes bdsnDrift { 0%,100% { transform: translate(0,0); } 33% { transform: translate(-14px,10px); } 66% { transform: translate(8px,-6px); } }
        @keyframes bdsnSwatch { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.16); } }
        @keyframes bdsnPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); } 50% { transform: scale(1.03); box-shadow: 0 0 0 8px hsl(var(--primary) / 0); } }
      `,
        }}
      />
    </section>
  );
}
