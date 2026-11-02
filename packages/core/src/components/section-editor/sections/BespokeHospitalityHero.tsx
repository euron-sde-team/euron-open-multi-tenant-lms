"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, CalendarCheck, Leaf, Star, UtensilsCrossed, Wine } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke hospitality / culinary hero: a plated fine-dining dish, a circular
 *  plate (content.image as the dish or a warm gradient plate) with rising steam
 *  wisps, slowly orbiting ingredient/utensil chips, a floating reservation card
 *  and a rating badge. Warm saffron + burgundy. */
export function BespokeHospitalityHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, EditableImage, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const on = !isEditMode && !reduce;
  const stats = content.stats ?? [];
  const update = (k: keyof HeroPhotographyContent, v: unknown) => updateSectionContent(section.id, { [k]: v });
  const resolveHref = (h: string) => (!h || h.startsWith("#") ? "/all-courses" : h);
  const enter = (d: number): MotionProps =>
    on
      ? { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const } }
      : {};

  // Rising steam wisps above the plate.
  const steam = [
    { l: "38%", d: 0, dur: 3.6 },
    { l: "50%", d: 0.7, dur: 4.2 },
    { l: "62%", d: 1.3, dur: 3.9 },
  ];
  // Cuisine accent icons shown in a clean row below the plate (all breakpoints).
  const chips: Array<{ Icon: typeof Leaf; tint: string }> = [
    { Icon: UtensilsCrossed, tint: "hsl(var(--primary))" },
    { Icon: Leaf, tint: "hsl(var(--accent))" },
    { Icon: Wine, tint: "hsl(var(--primary))" },
    { Icon: Star, tint: "hsl(var(--accent))" },
  ];

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-[hsl(var(--background))] py-20 text-[hsl(var(--foreground))] lg:py-24">
      {/* Ambient warm glow, decorative, contained. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-[32rem] w-[32rem] rounded-full" style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent)" }} />
        <div className="absolute -bottom-32 -left-24 h-[30rem] w-[30rem] rounded-full" style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.16), transparent)" }} />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-10">
        {/* ── Copy column ── */}
        <div className="text-center lg:text-left">
          <motion.span {...enter(0)} className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium" style={{ borderColor: "hsl(var(--primary) / 0.3)", backgroundColor: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))" }}>
            <UtensilsCrossed className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Fine dining, mastered"} onChange={(v) => update("eyebrow", v)} as="span" />
          </motion.span>

          <motion.h1 {...enter(0.08)} className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mx-auto mt-5 max-w-xl text-lg text-[hsl(var(--foreground)/0.65)] lg:mx-0">
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
                  <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--foreground)/0.5)]">
                    <EditableText value={st.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div {...enter(0.3)} className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
            {content.primaryCta && !content.primaryCta.hidden && (
              <EditableClickable href={content.primaryCta.href} onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })} hidden={content.primaryCta.hidden} onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })} isEditing={isEditMode} slotLabel="Primary Button">
                <button type="button" className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-bold text-[hsl(var(--primary-foreground))] shadow-[0_16px_50px_-12px_hsl(var(--primary))] transition-transform hover:scale-[1.04]" style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
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
              <EditableClickable href={content.secondaryCta.href} onHrefChange={(href) => update("secondaryCta", { ...content.secondaryCta, href })} hidden={content.secondaryCta.hidden} onHiddenChange={(hidden) => update("secondaryCta", { ...content.secondaryCta, hidden })} isEditing={isEditMode} slotLabel="Secondary Button">
                <button type="button" className="inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-[hsl(var(--muted))]" style={{ borderColor: "hsl(var(--foreground) / 0.15)", color: "hsl(var(--foreground) / 0.8)" }}>
                  <Wine className="h-4 w-4" />
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

        {/* ── Signature graphic: plated dish ── */}
        <motion.div {...enter(0.2)} className="relative mx-auto w-full max-w-[26rem]">
          {/* Orbit box: padded so chips never clip. Aspect-square keeps it circular. */}
          <div className="relative mx-auto aspect-square w-[78%] sm:w-[84%] lg:w-full">
            {/* Steam wisps rising from the plate (hidden on small screens for clarity). */}
            <div className="pointer-events-none absolute inset-x-0 top-[-8%] z-20 hidden h-[30%] sm:block">
              {steam.map((s, i) => (
                <span key={i} className="absolute bottom-0 h-16 w-1.5 rounded-full" style={{ left: s.l, background: "linear-gradient(to top, hsl(var(--foreground) / 0.28), transparent)", filter: "blur(2px)", animation: on ? `bhspSteam ${s.dur}s ease-in-out ${s.d}s infinite` : undefined, opacity: on ? undefined : 0.35 }} />
              ))}
            </div>

            {/* Outer ring halo */}
            <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(closest-side, transparent 62%, hsl(var(--primary) / 0.14) 78%, transparent)" }} />

            {/* The plate */}
            <div className="absolute inset-[12%] overflow-hidden rounded-full shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.5)] ring-1 ring-[hsl(var(--foreground)/0.08)]" style={{ backgroundImage: "radial-gradient(closest-side, hsl(var(--accent) / 0.35), hsl(var(--primary) / 0.25) 70%, hsl(var(--background)))", animation: on ? "bhspPlate 9s ease-in-out infinite" : undefined }}>
              {/* Inner rim */}
              <div className="absolute inset-[8%] rounded-full ring-1 ring-[hsl(var(--background)/0.5)]" />
              {content.image ? (
                <EditableImage src={content.image} alt={content.imageAlt || "Signature dish"} onChange={(src) => update("image", src)} className="absolute inset-[14%] overflow-hidden rounded-full" aspectRatio="square" placeholder="Dish" />
              ) : (
                <div className="absolute inset-[14%] flex items-center justify-center rounded-full" style={{ backgroundImage: "radial-gradient(closest-side, hsl(var(--primary) / 0.5), hsl(var(--accent) / 0.4))" }}>
                  {isEditMode ? (
                    <EditableImage src="" alt={content.imageAlt || "Signature dish"} onChange={(src) => update("image", src)} className="h-full w-full rounded-full" aspectRatio="square" placeholder="Dish" />
                  ) : (
                    <UtensilsCrossed className="h-1/3 w-1/3 text-[hsl(var(--primary-foreground)/0.85)]" />
                  )}
                </div>
              )}
            </div>

            {/* Floating reservation card (bottom-left), desktop only so it can't
                overflow the shrunken plate box / overlap copy on phones. */}
            <motion.div {...enter(0.5)} className="absolute -bottom-2 left-[-4%] z-30 hidden items-center gap-2.5 rounded-xl bg-[hsl(var(--background))] px-3.5 py-2.5 shadow-[0_18px_40px_-14px_hsl(var(--primary)/0.55)] ring-1 ring-[hsl(var(--foreground)/0.08)] sm:left-[-8%] lg:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                <CalendarCheck className="h-5 w-5" />
              </span>
              <span className="text-left leading-tight">
                <span className="block text-[13px] font-bold text-[hsl(var(--foreground))]">Table booked</span>
                <span className="block text-[11px] text-[hsl(var(--foreground)/0.55)]">Tonight 8 PM</span>
              </span>
            </motion.div>

            {/* Rating badge (top-right), desktop only for the same reason. */}
            <motion.div {...enter(0.58)} className="absolute -top-1 right-[-3%] z-30 hidden items-center gap-1.5 rounded-full bg-[hsl(var(--background))] px-3 py-1.5 shadow-[0_14px_34px_-12px_hsl(var(--accent)/0.6)] ring-1 ring-[hsl(var(--foreground)/0.08)] sm:right-[-6%] lg:flex">
              <Star className="h-4 w-4 fill-current" style={{ color: "hsl(var(--accent))" }} />
              <span className="text-[13px] font-bold text-[hsl(var(--foreground))]">4.9</span>
            </motion.div>
          </div>

          {/* Cuisine accent icons, in-flow row so it renders cleanly on tablet
              and mobile too, without overlapping the plate. */}
          <motion.div {...enter(0.5)} className="mt-7 flex items-center justify-center gap-3">
            {chips.map(({ Icon, tint }, i) => (
              <div
                key={i}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--background))] shadow-[0_10px_24px_-8px_hsl(var(--primary)/0.4)] ring-1 ring-[hsl(var(--foreground)/0.08)]"
              >
                <Icon className="h-5 w-5" style={{ color: tint }} />
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bhspSteam { 0% { transform: translateY(6px) scaleY(0.8); opacity: 0; } 25% { opacity: 0.6; } 60% { opacity: 0.4; } 100% { transform: translateY(-34px) scaleY(1.15); opacity: 0; } }
        @keyframes bhspPlate { 0%,100% { transform: scale(1); } 50% { transform: scale(1.015); } }
      ` }} />
    </section>
  );
}
