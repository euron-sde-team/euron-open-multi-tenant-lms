"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionProps, type MotionValue } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import type { CSSProperties } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/**
 * A deliberately bespoke, immersive hero: NOT the shared split-card skeleton.
 * Full-bleed neural-network constellation that reacts to the cursor, a big
 * centred headline, glass metric orbs drifting in 3D space around it, and one
 * focused CTA. Everything editable; motion off in the editor / reduced-motion.
 */

const NODES: Array<[number, number]> = [
  [12, 22], [26, 12], [20, 46], [8, 70], [30, 78], [44, 30], [40, 60],
  [58, 16], [56, 48], [52, 74], [70, 34], [74, 66], [86, 20], [90, 52], [82, 80], [94, 40],
];
const LINKS: Array<[number, number]> = [
  [0, 1], [0, 2], [1, 5], [2, 3], [2, 6], [3, 4], [5, 6], [5, 7], [6, 8], [7, 8], [8, 9], [8, 10], [10, 11], [10, 12], [11, 13], [12, 15], [13, 14], [13, 15],
];

export function BespokeDataHero({ section }: { section: SectionConfig }) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();
  const reduce = useReducedMotion();
  const interactive = !isEditMode && !reduce;

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 20 });
  const sy = useSpring(py, { stiffness: 60, damping: 20 });
  const aX = useTransform(sx, (v) => v * 26);
  const aY = useTransform(sy, (v) => v * 22);
  const bX = useTransform(sx, (v) => v * -40);
  const bY = useTransform(sy, (v) => v * -34);
  const glowX = useTransform(sx, (v) => `${50 + v * 26}%`);
  const glowY = useTransform(sy, (v) => `${42 + v * 26}%`);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };

  const stats = content.stats ?? [];
  const update = (key: keyof HeroPhotographyContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });
  const resolveHref = (href: string) => (!href || href.startsWith("#") ? "/all-courses" : href);

  const ORB_POS: CSSProperties[] = [
    { top: "16%", left: "7%" },
    { top: "20%", right: "8%" },
    { bottom: "20%", left: "12%" },
    { bottom: "16%", right: "9%" },
  ];

  const enter = (delay: number): MotionProps =>
    interactive ? { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const } } : {};

  return (
    <section
      onMouseMove={interactive ? onMove : undefined}
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden py-24"
      style={{ backgroundColor: "hsl(var(--background))", perspective: "1400px" }}
    >
      {/* cursor-following glow */}
      <motion.div className="pointer-events-none absolute z-0 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]" style={{ left: interactive ? glowX : "56%", top: interactive ? glowY : "42%", background: "radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 65%)" }} />
      <div className="pointer-events-none absolute right-[6%] top-[8%] z-0 h-[30rem] w-[30rem] rounded-full blur-[130px]" style={{ background: "hsl(var(--accent) / 0.28)" }} />

      {/* constellation (two parallax layers) */}
      <ConstellationLayer x={interactive ? aX : undefined} y={interactive ? aY : undefined} spin={interactive} slice={[0, 9]} opacity={0.9} />
      <ConstellationLayer x={interactive ? bX : undefined} y={interactive ? bY : undefined} spin={interactive} slice={[9, 16]} opacity={0.6} />

      {/* fine grid + fade */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.18]" style={{ backgroundImage: "linear-gradient(hsl(var(--foreground) / 0.16) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.16) 1px, transparent 1px)", backgroundSize: "60px 60px", maskImage: "radial-gradient(80% 80% at 50% 45%, black, transparent 80%)", WebkitMaskImage: "radial-gradient(80% 80% at 50% 45%, black, transparent 80%)" }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40" style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }} />

      {/* orbiting glass metric orbs */}
      {stats.slice(0, 4).map((stat: HeroPhotographyStat, i: number) => (
        <MetricOrb key={stat.id} stat={stat} pos={ORB_POS[i]} layer={i % 2 ? { x: interactive ? aX : undefined, y: interactive ? aY : undefined } : { x: interactive ? bX : undefined, y: interactive ? bY : undefined }} interactive={interactive} delay={i * 0.4} onChange={(patch) => { const next = [...stats]; next[i] = { ...next[i], ...patch }; update("stats", next); }} EditableText={EditableText} />
      ))}

      {/* centre content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.span {...enter(0)} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-[13px] font-medium text-foreground/85 backdrop-blur-md">
          <span className="relative flex h-2 w-2"><span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 ${interactive ? "animate-ping" : ""}`} /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
          <EditableText value={content.eyebrow ?? "4,000+ models training live"} onChange={(v) => update("eyebrow", v)} as="span" />
        </motion.span>

        <motion.h1 {...enter(0.08)} className="mx-auto mt-7 max-w-3xl text-5xl font-black leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl" style={{ textShadow: "0 2px 40px hsl(var(--primary) / 0.35)" }}>
          <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
        </motion.h1>

        {(content.description || isEditMode) && (
          <motion.p {...enter(0.16)} className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
            <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
          </motion.p>
        )}

        <motion.div {...enter(0.24)} className="mt-9 flex flex-col items-center gap-4">
          {content.primaryCta && !content.primaryCta.hidden && (
            <EditableClickable href={content.primaryCta.href} onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })} hidden={content.primaryCta.hidden} onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })} isEditing={isEditMode} slotLabel="Primary Button">
              <button type="button" className="group inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-bold text-white shadow-[0_16px_50px_-12px_hsl(var(--primary))] transition-transform hover:scale-[1.04]" style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
                {isEditMode ? (<><EditableText value={content.primaryCta.text} onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })} as="span" /><ArrowRight className="h-5 w-5" /></>) : (<LinkComponent href={resolveHref(content.primaryCta.href)} className="inline-flex items-center gap-2">{content.primaryCta.text}<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></LinkComponent>)}
              </button>
            </EditableClickable>
          )}
          {content.secondaryCta && !content.secondaryCta.hidden && (
            <EditableClickable href={content.secondaryCta.href} onHrefChange={(href) => update("secondaryCta", { ...content.secondaryCta, href })} hidden={content.secondaryCta.hidden} onHiddenChange={(hidden) => update("secondaryCta", { ...content.secondaryCta, hidden })} isEditing={isEditMode} slotLabel="Secondary Button">
              <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/70 transition-colors hover:text-foreground">
                <Play className="h-4 w-4" />
                {isEditMode ? (<EditableText value={content.secondaryCta.text} onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })} as="span" />) : (<LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>)}
              </button>
            </EditableClickable>
          )}
        </motion.div>

        {/* In-flow stats on mobile, the floating orbs are desktop-only so they
            never overlap the headline / CTA on small screens. */}
        {stats.length > 0 && (
          <motion.div {...enter(0.32)} className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden">
            {stats.slice(0, 4).map((stat: HeroPhotographyStat, i: number) => (
              <div key={stat.id} className="rounded-2xl border border-border bg-card/50 px-4 py-3 text-center backdrop-blur-xl">
                <div className="text-xl font-black text-foreground">
                  <EditableText value={stat.value} onChange={(v) => { const next = [...stats]; next[i] = { ...next[i], value: v }; update("stats", next); }} as="span" />
                </div>
                <div className="text-[11px] font-medium text-muted-foreground">
                  <EditableText value={stat.label} onChange={(v) => { const next = [...stats]; next[i] = { ...next[i], label: v }; update("stats", next); }} as="span" />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bdhTwinkle { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes bdhFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
      ` }} />
    </section>
  );
}

function ConstellationLayer({ x, y, spin, slice, opacity }: { x?: MotionValue<number>; y?: MotionValue<number>; spin: boolean; slice: [number, number]; opacity: number }) {
  const nodes = NODES.slice(slice[0], slice[1]).map((n, i) => ({ n, i: i + slice[0] }));
  const links = LINKS.filter(([a, b]) => a >= slice[0] && a < slice[1] && b >= slice[0] && b < slice[1]);
  return (
    <motion.svg className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ x, y, opacity }} aria-hidden>
      {links.map(([a, b], k) => (
        <line key={k} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="hsl(var(--primary))" strokeWidth="0.12" opacity="0.45" />
      ))}
      {nodes.map(({ n, i }) => (
        <circle key={i} cx={n[0]} cy={n[1]} r={i % 4 === 0 ? 0.7 : 0.45} fill={i % 3 === 0 ? "hsl(var(--accent))" : "hsl(var(--primary))"} style={spin ? { animation: `bdhTwinkle ${3 + (i % 5)}s ease-in-out ${(i % 4) * 0.4}s infinite` } : undefined} />
      ))}
    </motion.svg>
  );
}

function MetricOrb({ stat, pos, layer, interactive, delay, onChange, EditableText }: {
  stat: HeroPhotographyStat;
  pos: CSSProperties;
  layer: { x?: MotionValue<number>; y?: MotionValue<number> };
  interactive: boolean;
  delay: number;
  onChange: (patch: Partial<HeroPhotographyStat>) => void;
  EditableText: ReturnType<typeof useSectionEditor>["EditableText"];
}) {
  return (
    <motion.div className="absolute z-[5] hidden lg:block" style={{ ...pos, x: layer.x, y: layer.y }}>
      <div className="rounded-2xl border border-border bg-card/50 px-4 py-3 shadow-[0_24px_70px_-22px_rgba(0,0,0,0.85)] backdrop-blur-xl" style={{ animation: interactive ? `bdhFloat ${5 + delay}s ease-in-out ${delay}s infinite` : undefined }}>
        <div className="text-xl font-black text-foreground"><EditableText value={stat.value} onChange={(v) => onChange({ value: v })} as="span" /></div>
        <div className="text-[11px] font-medium text-muted-foreground"><EditableText value={stat.label} onChange={(v) => onChange({ label: v })} as="span" /></div>
      </div>
    </motion.div>
  );
}
