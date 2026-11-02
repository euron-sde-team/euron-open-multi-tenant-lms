"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Circle, Film, Maximize2, Play } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke film & content hero: a cinematic showcase marquee, two rows of
 *  poster/thumbnail cards auto-scrolling in opposite directions behind a
 *  centred headline, with a scrubber timeline + moving playhead and a REC/4K
 *  chip. Marquee is contained (overflow-hidden + masked edges) so no
 *  horizontal page scroll. No radar, no constellation, no corner-chip card. */
export function BespokeFilmHero({ section }: { section: SectionConfig }) {
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

  // Poster gradient palettes (theme-driven cinematic range).
  const palettes = [
    "linear-gradient(150deg, hsl(var(--primary) / 0.55), hsl(var(--card)) 70%)",
    "linear-gradient(150deg, hsl(var(--accent) / 0.5), hsl(var(--card)) 70%)",
    "linear-gradient(150deg, hsl(var(--primary) / 0.4), hsl(var(--accent) / 0.35))",
    "linear-gradient(150deg, hsl(var(--primary) / 0.3), hsl(var(--card)) 70%)",
    "linear-gradient(150deg, hsl(var(--accent) / 0.45), hsl(var(--card)) 72%)",
    "linear-gradient(150deg, hsl(var(--primary) / 0.5), hsl(var(--card)) 70%)",
  ];
  const labels = ["S01 · E04", "DOC", "SERIES", "4K · HDR", "LIVE", "TRAILER"];
  const durs = ["12:04", "48:22", "31:15", "07:58", "24:40", "58:11"];
  // Each poster card is uploadable via content.gallery (falls back to a
  // cinematic gradient when empty). Six cards fill the marquee.
  const gallery = content.gallery ?? [];
  const posters = Array.from({ length: 6 }, (_, i) => ({
    idx: i,
    bg: palettes[i % palettes.length],
    label: labels[i % labels.length],
    dur: durs[i % durs.length],
    src: gallery[i]?.src ?? "",
  }));
  const setPoster = (i: number, src: string) => {
    const next = Array.from({ length: 6 }, (_, k) => ({
      id: gallery[k]?.id ?? `poster-${k}`,
      src: gallery[k]?.src ?? "",
    }));
    next[i] = { id: next[i].id, src };
    update("gallery", next);
  };

  // A view-mode poster/video card: the uploaded image (or a cinematic gradient
  // fallback) with a play button, label, and duration overlay.
  const Poster = ({ p }: { p: (typeof posters)[number] }) => (
    <div
      className="group/card relative h-40 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] sm:h-48 sm:w-32"
      style={p.src ? undefined : { backgroundImage: p.bg }}
    >
      {p.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
        {p.label}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md transition-transform group-hover/card:scale-110"
          style={{ boxShadow: "0 0 24px hsl(var(--accent) / 0.4)" }}
        >
          <Play className="h-4 w-4 translate-x-[1px] fill-white" />
        </span>
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[9px] font-medium text-white/70">
        <Circle className="h-1.5 w-1.5 fill-current" />
        {p.dur}
      </div>
    </div>
  );

  // Duplicated track for a seamless CSS marquee loop (view mode).
  const Track = ({ reverse }: { reverse?: boolean }) => (
    <div
      className="flex w-max gap-4"
      style={{
        animation: on ? `bflmMarquee${reverse ? "Rev" : ""} 34s linear infinite` : undefined,
      }}
    >
      {[0, 1].map((dup) => (
        <div key={dup} className="flex gap-4 pr-4" aria-hidden={dup === 1}>
          {posters.map((p, i) => (
            <Poster key={`${dup}-${i}`} p={p} />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <section
      className="relative flex min-h-[100svh] flex-col items-center overflow-hidden px-6 py-16 lg:py-20"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      {/* Ambient wash */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 30%, hsl(var(--primary) / 0.18), transparent 70%), radial-gradient(50% 50% at 80% 90%, hsl(var(--accent) / 0.14), transparent 70%)",
        }}
      />
      {/* Film-grain scanlines */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.12]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, hsl(var(--foreground)) 0, hsl(var(--foreground)) 1px, transparent 1px, transparent 4px)" }}
      />

      {/* Centred content above marquee */}
      <div className="relative z-20 mx-auto max-w-3xl text-center">
        <motion.span
          {...enter(0)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-[13px] font-medium text-foreground/80 backdrop-blur-sm"
        >
          <Film className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
          <EditableText value={content.eyebrow ?? "Now streaming your next skill"} onChange={(v) => update("eyebrow", v)} as="span" />
        </motion.span>
        <motion.h1
          {...enter(0.08)}
          className="mt-7 text-5xl font-black leading-[1.03] tracking-tight text-foreground sm:text-6xl lg:text-[4rem]"
          style={{ textShadow: "0 4px 44px hsl(var(--primary) / 0.35)" }}
        >
          <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
        </motion.h1>
        {(content.description || isEditMode) && (
          <motion.p {...enter(0.16)} className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
          </motion.p>
        )}
        <motion.div {...enter(0.24)} className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
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
                    <Play className="h-5 w-5 fill-white" />
                    <EditableText value={content.primaryCta.text} onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })} as="span" />
                  </>
                ) : (
                  <LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">
                    <Play className="h-5 w-5 fill-white" />
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
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-4 text-sm font-semibold text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                <Maximize2 className="h-4 w-4" />
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

      {/* Signature graphic: dual-row cinematic showcase marquee (masked edges) */}
      <motion.div
        {...enter(0.34)}
        className="relative z-10 mt-14 w-full max-w-6xl"
        style={
          isEditMode
            ? undefined
            : {
                WebkitMaskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
                maskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
              }
        }
      >
        {isEditMode ? (
          // Edit mode: a single static row of uploadable poster cards.
          <div className="flex flex-wrap justify-center gap-4">
            {posters.map((p) => (
              <div
                key={p.idx}
                className="relative h-40 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 sm:h-48 sm:w-32"
              >
                <EditableImage
                  src={p.src}
                  alt=""
                  onChange={(src) => setPoster(p.idx, src)}
                  className="absolute inset-0 h-full w-full"
                  aspectRatio="auto"
                  placeholder="Upload"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden">
            <Track />
            <Track reverse />
          </div>
        )}
      </motion.div>

      {/* Scrubber timeline with moving playhead + REC/4K chip */}
      <motion.div {...enter(0.42)} className="relative z-20 mt-10 w-full max-w-2xl">
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Circle className="h-2 w-2 animate-pulse fill-current" style={{ color: "hsl(var(--primary))" }} />
            <EditableLabel value={content.tileLabels?.recLabel} fallback="REC" onChange={(v) => update("tileLabels", { ...content.tileLabels, recLabel: v })} />
          </span>
          <span className="rounded border border-border px-1.5 py-0.5 tracking-widest text-foreground/70">4K</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: "42%",
              backgroundImage: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
              animation: on ? "bflmScrub 9s ease-in-out infinite alternate" : undefined,
            }}
          />
          <span
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full shadow-[0_0_12px_hsl(var(--accent))]"
            style={{ left: "42%", backgroundColor: "hsl(var(--foreground))", animation: on ? "bflmHead 9s ease-in-out infinite alternate" : undefined }}
          />
        </div>
        {stats.length > 0 && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {stats.map((st: HeroPhotographyStat, i: number) => (
              <div key={st.id} className="text-center">
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
          </div>
        )}
      </motion.div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bflmMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes bflmMarqueeRev { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @keyframes bflmScrub { 0% { width: 10%; } 100% { width: 82%; } }
        @keyframes bflmHead { 0% { left: 10%; } 100% { left: 82%; } }
      `,
        }}
      />
    </section>
  );
}
