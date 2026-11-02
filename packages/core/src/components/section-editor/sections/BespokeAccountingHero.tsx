"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, BadgeCheck, FileText, Play, TrendingUp } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke accounting / CA hero: count-up KPI figures + an animated P&L area
 *  chart with rising bars + a ledger/receipt card stamped "GST filed". Light
 *  navy+gold financial aesthetic. Split layout, mobile-clean. */
export function BespokeAccountingHero({ section }: { section: SectionConfig }) {
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

  // Chart geometry, a smooth-ish rising P&L area over 12 points, plus quarter bars.
  const points = [22, 30, 26, 38, 34, 46, 44, 56, 60, 70, 66, 82];
  const chartW = 300;
  const chartH = 130;
  const stepX = chartW / (points.length - 1);
  const toXY = (v: number, i: number) => [i * stepX, chartH - (v / 100) * chartH] as const;
  const linePath = points.map((v, i) => { const [x, y] = toXY(v, i); return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ");
  const areaPath = `${linePath} L${chartW},${chartH} L0,${chartH} Z`;
  const bars = [40, 58, 72, 90];
  const ledger = [
    { label: "Revenue", value: "18,40,000" },
    { label: "Expenses", value: "7,25,000" },
    { label: "Net Profit", value: "11,15,000", strong: true },
  ];

  return (
    <section
      className="relative flex min-h-[100svh] items-center overflow-hidden py-20 lg:py-24"
      style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
      {/* Ambient background: soft grid + gold glow, non-interactive, clipped */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground) / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.04) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 80% 70% at 70% 40%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 70% 40%, black, transparent)",
          }}
        />
        <div
          className="absolute right-[-8%] top-[-10%] h-[32rem] w-[32rem] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.16), transparent 68%)", animation: on ? "baccPulse 9s ease-in-out infinite" : undefined }}
        />
        <div
          className="absolute bottom-[-14%] left-[-10%] h-[26rem] w-[26rem] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.12), transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        {/* ── Left: copy ── */}
        <div className="max-w-xl">
          <motion.span
            {...enter(0)}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-semibold"
            style={{ borderColor: "hsl(var(--accent) / 0.35)", backgroundColor: "hsl(var(--accent) / 0.1)", color: "hsl(var(--accent))" }}
          >
            <BadgeCheck className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "Chartered Accountancy Mastery"} onChange={(v) => update("eyebrow", v)} as="span" />
          </motion.span>

          <motion.h1 {...enter(0.08)} className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
          </motion.h1>

          {(content.description || isEditMode) && (
            <motion.p {...enter(0.16)} className="mt-5 text-lg leading-relaxed" style={{ color: "hsl(var(--foreground) / 0.66)" }}>
              <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
            </motion.p>
          )}

          {/* Count-up KPI figures */}
          {stats.length > 0 && (
            <motion.div {...enter(0.24)} className="mt-8 grid grid-cols-3 gap-4 sm:gap-6">
              {stats.map((st: HeroPhotographyStat, i: number) => (
                <div key={st.id} className="min-w-0">
                  <div className="truncate text-2xl font-black tabular-nums sm:text-3xl lg:text-4xl" style={{ color: "hsl(var(--accent))" }}>
                    <EditableText value={st.value} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], value: v }; update("stats", n); }} as="span" />
                  </div>
                  <div className="mt-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: "hsl(var(--foreground) / 0.5)" }}>
                    <EditableText value={st.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div {...enter(0.32)} className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            {content.primaryCta && !content.primaryCta.hidden && (
              <EditableClickable href={content.primaryCta.href} onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })} hidden={content.primaryCta.hidden} onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })} isEditing={isEditMode} slotLabel="Primary Button">
                <button type="button" className="group inline-flex items-center justify-center gap-2 rounded-lg px-8 py-3.5 text-base font-bold transition-transform hover:scale-[1.03]" style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", boxShadow: "0 16px 44px -14px hsl(var(--primary) / 0.6)" }}>
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
                <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold transition-colors" style={{ border: "1px solid hsl(var(--foreground) / 0.16)", color: "hsl(var(--foreground) / 0.8)" }}>
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
        </div>

        {/* ── Right: signature financial graphic ── */}
        <motion.div
          {...(on ? { initial: { opacity: 0, y: 30, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] as const } } : {})}
          className="relative mx-auto w-full max-w-md lg:mx-0"
        >
          {/* P&L chart card */}
          <div
            className="relative overflow-hidden rounded-2xl border p-5 shadow-xl"
            style={{ borderColor: "hsl(var(--foreground) / 0.1)", backgroundColor: "hsl(var(--background))", boxShadow: "0 30px 70px -30px hsl(var(--primary) / 0.4)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <TrendingUp className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
                <span>Profit &amp; Loss</span>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: "hsl(var(--accent) / 0.14)", color: "hsl(var(--accent))" }}>
                <EditableLabel value={content.tileLabels?.fiscalYear} fallback="FY 2025-26" onChange={(v) => update("tileLabels", { ...content.tileLabels, fiscalYear: v })} />
              </span>
            </div>

            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Profit and loss trend chart">
              <defs>
                <linearGradient id="baccArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* quarter bars */}
              {bars.map((h, i) => (
                <rect
                  key={i}
                  x={18 + i * ((chartW - 36) / bars.length)}
                  width={(chartW - 36) / bars.length - 14}
                  y={chartH - (h / 100) * chartH}
                  height={(h / 100) * chartH}
                  rx="3"
                  fill="hsl(var(--primary) / 0.14)"
                  style={{ transformOrigin: `center ${chartH}px`, animation: on ? `baccBar 0.9s ${0.3 + i * 0.12}s cubic-bezier(0.22,1,0.36,1) both` : undefined }}
                />
              ))}
              {/* area + line */}
              <path d={areaPath} fill="url(#baccArea)" style={{ opacity: on ? 0 : 1, animation: on ? "baccFade 0.8s 1.1s ease forwards" : undefined }} />
              <path
                d={linePath}
                fill="none"
                stroke="hsl(var(--accent))"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                style={on ? { strokeDasharray: 1, strokeDashoffset: 1, animation: "baccDraw 1.4s 0.5s cubic-bezier(0.22,1,0.36,1) forwards" } : undefined}
              />
            </svg>
          </div>

          {/* Receipt / ledger card, offset, kept inside container to avoid overflow */}
          <motion.div
            {...(on ? { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.6 } } : {})}
            className="relative z-10 mx-auto mt-[-20px] w-[85%] rounded-xl border p-4 pb-14 shadow-lg"
            style={{ borderColor: "hsl(var(--foreground) / 0.1)", backgroundColor: "hsl(var(--background))", boxShadow: "0 20px 50px -20px hsl(var(--foreground) / 0.28)" }}
          >
            <div className="mb-3 flex items-center gap-2 border-b pb-2 text-xs font-bold uppercase tracking-wide" style={{ borderColor: "hsl(var(--foreground) / 0.08)", color: "hsl(var(--foreground) / 0.55)" }}>
              <FileText className="h-3.5 w-3.5" />
              <EditableLabel value={content.tileLabels?.ledgerTitle} fallback="Ledger Summary" onChange={(v) => update("tileLabels", { ...content.tileLabels, ledgerTitle: v })} />
            </div>
            <div className="space-y-2 font-mono text-[13px]">
              {ledger.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span style={{ color: "hsl(var(--foreground) / 0.6)" }}>{row.label}</span>
                  <span className={row.strong ? "font-bold" : ""} style={{ color: row.strong ? "hsl(var(--accent))" : "hsl(var(--foreground) / 0.85)" }}>
                    &#8377;{row.value}
                  </span>
                </div>
              ))}
            </div>
            {/* GST filed stamp */}
            <div
              className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-black uppercase tracking-wide"
              style={{ borderColor: "hsl(var(--accent) / 0.5)", color: "hsl(var(--accent))", transform: "rotate(-8deg)", animation: on ? "baccStamp 0.5s 1.3s cubic-bezier(0.34,1.56,0.64,1) both" : undefined }}
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              <EditableLabel value={content.tileLabels?.gstStatus} fallback="GST Filed" onChange={(v) => update("tileLabels", { ...content.tileLabels, gstStatus: v })} />
            </div>
          </motion.div>
        </motion.div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes baccPulse { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
        @keyframes baccDraw { to { stroke-dashoffset: 0; } }
        @keyframes baccFade { to { opacity: 1; } }
        @keyframes baccBar { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes baccStamp { 0% { opacity: 0; transform: rotate(-8deg) scale(1.6); } 100% { opacity: 1; transform: rotate(-8deg) scale(1); } }
      `,
        }}
      />
    </section>
  );
}
