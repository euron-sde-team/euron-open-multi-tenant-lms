"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Heart, MessageCircle, Play, Rocket, Sparkles, TrendingUp, UserPlus } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke digital-marketing hero: a split layout with editable copy on the
 *  left and a signature graphic on the right, a phone mockup showing a live
 *  social feed, ringed by gently orbiting notification bubbles, with an
 *  upward-climbing growth curve drawing itself behind the device. */
export function BespokeMarketingHero({ section }: { section: SectionConfig }) {
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

  // Orbiting notification bubbles. Positioned around the device with negative
  // offsets, so they're gated to desktop (hidden lg:flex) where the split
  // layout gives them room, otherwise they clip/overlap on mobile & tablet.
  const bubbles = [
    { Icon: Heart, label: "+248 likes", sub: "on your reel", tint: "hsl(var(--accent))", pos: "left-[-12%] top-[10%]", dur: 7, delay: 0 },
    { Icon: UserPlus, label: "New follower", sub: "@growthlab", tint: "hsl(var(--primary))", pos: "right-[-10%] top-[26%]", dur: 8, delay: 0.6 },
    { Icon: Rocket, label: "Campaign live", sub: "reach 12.4k", tint: "hsl(var(--accent))", pos: "left-[-8%] bottom-[18%]", dur: 9, delay: 1.2 },
    { Icon: MessageCircle, label: "42 comments", sub: "trending now", tint: "hsl(var(--primary))", pos: "right-[-12%] bottom-[8%]", dur: 7.5, delay: 0.3 },
  ];

  const feed = [
    { name: "Aria Vance", handle: "@ariacreates", likes: "3.2k", accent: "hsl(var(--accent))" },
    { name: "Kai Monroe", handle: "@kaigrowth", likes: "1.8k", accent: "hsl(var(--primary))" },
  ];

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden py-20 sm:py-24"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      {/* Ambient background: vibrant orange/pink glows + faint grid */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-[10%] top-[-20%] h-[36rem] w-[36rem] rounded-full blur-[130px]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 70%)", animation: on ? "bmktGlow 11s ease-in-out infinite" : undefined }}
        />
        <div
          className="absolute -right-[8%] bottom-[-25%] h-[34rem] w-[34rem] rounded-full blur-[130px]"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.32), transparent 70%)", animation: on ? "bmktGlow 13s ease-in-out 1.5s infinite" : undefined }}
        />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "56px 56px" }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-8">
        {/* ── Left: editable copy ── */}
        <div className="text-center lg:text-left">
          <motion.span
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium"
            style={{ borderColor: "hsl(var(--accent) / 0.3)", backgroundColor: "hsl(var(--accent) / 0.08)", color: "hsl(var(--accent))" }}
          >
            <Sparkles className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Grow your audience on autopilot"} onChange={(v) => update("eyebrow", v)} as="span" />
          </motion.span>

          <motion.h1
            {...enter(0.08)}
            className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            style={{ textShadow: "0 2px 40px hsl(var(--primary) / 0.35)" }}
          >
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mx-auto mt-5 max-w-lg text-base text-muted-foreground sm:text-lg lg:mx-0">
              <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
            </motion.p>
          )}

          <motion.div {...enter(0.26)} className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap lg:justify-start sm:justify-center">
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
                <button type="button" className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-4 text-sm font-semibold text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground">
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

          {stats.length > 0 && (
            <motion.div {...enter(0.34)} className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 lg:justify-start">
              {stats.map((st: HeroPhotographyStat, i: number) => (
                <div key={st.id} className="text-center lg:text-left">
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
        </div>

        {/* ── Right: signature graphic (device + orbiting bubbles + growth curve) ── */}
        <motion.div
          {...(on
            ? { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] as const } }
            : {})}
          className="relative mx-auto flex w-full max-w-[280px] justify-center sm:max-w-[340px]"
        >
          {/* Rising growth curve behind the phone */}
          <svg
            className="pointer-events-none absolute -inset-x-8 inset-y-0 z-0 h-full w-[calc(100%+4rem)]"
            viewBox="0 0 320 400"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="bmktCurve" x1="0" y1="400" x2="320" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
            <path
              d="M8 380 C 70 360, 120 300, 170 250 S 260 120, 312 30"
              stroke="url(#bmktCurve)"
              strokeWidth="3"
              strokeLinecap="round"
              style={{ strokeDasharray: 620, strokeDashoffset: on ? 620 : 0, animation: on ? "bmktDraw 2.4s ease-out 0.5s forwards" : undefined }}
            />
            <circle cx="312" cy="30" r="6" fill="hsl(var(--accent))" style={{ opacity: on ? 0 : 1, animation: on ? "bmktPeak 0.6s ease-out 2.7s forwards" : undefined }} />
          </svg>

          {/* Phone mockup with live social feed */}
          <div
            className="relative z-10 w-full overflow-hidden rounded-[2.2rem] border border-border bg-card p-2.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
            style={{ animation: on ? "bmktFloat 6s ease-in-out infinite" : undefined }}
          >
            <div className="overflow-hidden rounded-[1.7rem] bg-muted/40">
              {/* notch + status */}
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <div className="h-1.5 w-10 rounded-full bg-foreground/15" />
                <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: "hsl(var(--accent))" }}>
                  <TrendingUp className="h-3 w-3" /> +38%
                </div>
              </div>
              {/* feed header */}
              <div className="flex items-center gap-2 px-4 pb-3">
                <div className="h-8 w-8 rounded-full" style={{ backgroundImage: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }} />
                <div className="flex-1">
                  <div className="h-2 w-20 rounded-full bg-foreground/20" />
                  <div className="mt-1.5 h-1.5 w-12 rounded-full bg-foreground/10" />
                </div>
              </div>
              {/* feed cards */}
              <div className="space-y-2.5 px-3 pb-4">
                {feed.map((p, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-foreground/[0.03] p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full" style={{ backgroundColor: p.accent }} />
                      <div className="flex-1">
                        <div className="text-[11px] font-semibold leading-none text-foreground">{p.name}</div>
                        <div className="mt-1 text-[9px] text-muted-foreground">{p.handle}</div>
                      </div>
                    </div>
                    <div className="mt-2.5 h-20 rounded-xl" style={{ backgroundImage: `linear-gradient(135deg, ${p.accent} / 0.25, transparent)`, backgroundColor: "hsl(var(--primary) / 0.12)" }} />
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" style={{ color: p.accent }} /> {p.likes}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> 128</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Orbiting notification bubbles (desktop only, contained around device) */}
          {bubbles.map((b, i) => (
            <div
              key={i}
              className={`absolute z-20 hidden items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 py-2 shadow-[0_12px_30px_-8px_rgba(0,0,0,0.7)] backdrop-blur-sm lg:flex ${b.pos}`}
              style={{ animation: on ? `bmktOrbit ${b.dur}s ease-in-out ${b.delay}s infinite` : undefined }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${"hsl(var(--accent) / 0.15)"}`, color: b.tint }}>
                <b.Icon className="h-3.5 w-3.5" />
              </span>
              <span className="leading-tight">
                <span className="block text-[11px] font-bold text-foreground">{b.label}</span>
                <span className="block text-[9px] text-muted-foreground">{b.sub}</span>
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* bottom fade to seat the section on dark backgrounds */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-32" style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }} />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bmktGlow { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
        @keyframes bmktFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        @keyframes bmktOrbit { 0%,100% { transform: translate(0, 0); } 50% { transform: translate(6px, -10px); } }
        @keyframes bmktDraw { to { stroke-dashoffset: 0; } }
        @keyframes bmktPeak { to { opacity: 1; } }
      `,
        }}
      />
    </section>
  );
}
