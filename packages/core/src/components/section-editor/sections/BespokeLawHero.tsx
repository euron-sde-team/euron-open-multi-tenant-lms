"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, BookMarked, Check, Gavel, Scale } from "lucide-react";
import type { CSSProperties } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke law / CLAT hero: an authoritative centred layout whose signature
 *  graphic is an animated scales of justice, a beam on a central pillar that
 *  gently tips one way then settles level. Framed by classical side columns and
 *  a faint legal-document texture, with a glass "case status" card. */
export function BespokeLawHero({ section }: { section: SectionConfig }) {
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
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay: d, ease: [0.22, 1, 0.36, 1] as const },
        }
      : {};
  const caseStatus = content.tileItems?.caseStatus ?? [
    "Petition filed",
    "Precedent cited",
    "Verdict reserved",
  ];

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 py-24" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Faint legal-document texture: ruled lines */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "repeating-linear-gradient(hsl(var(--foreground) / 0.035) 0px, hsl(var(--foreground) / 0.035) 1px, transparent 1px, transparent 34px)",
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 45%, black, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 45%, black, transparent 85%)",
        }}
      />
      {/* Warm burgundy/gold ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[36rem] w-[36rem] max-w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.14), transparent 68%)" }} />

      {/* Classical side columns (hidden on small screens to stay overlap-free) */}
      {(["left", "right"] as const).map((side) => (
        <div
          key={side}
          aria-hidden
          className="pointer-events-none absolute bottom-0 top-0 z-0 hidden w-16 lg:block xl:w-20"
          style={{ [side]: "3%" } as CSSProperties}
        >
          <div className="relative mx-auto h-full w-full">
            {/* capital */}
            <div className="absolute left-1/2 top-16 h-4 w-[120%] -translate-x-1/2 rounded-sm" style={{ background: "linear-gradient(hsl(var(--accent) / 0.28), hsl(var(--accent) / 0.14))" }} />
            {/* fluted shaft */}
            <div
              className="absolute bottom-16 left-1/2 top-20 w-full -translate-x-1/2"
              style={{
                backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--foreground) / 0.09) 0px, hsl(var(--foreground) / 0.09) 2px, hsl(var(--foreground) / 0.02) 2px, hsl(var(--foreground) / 0.02) 8px)",
                borderRadius: "3px",
              }}
            />
            {/* base */}
            <div className="absolute bottom-10 left-1/2 h-5 w-[130%] -translate-x-1/2 rounded-sm" style={{ background: "linear-gradient(hsl(var(--accent) / 0.14), hsl(var(--accent) / 0.28))" }} />
          </div>
        </div>
      ))}

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        {/* Signature graphic: animated scales of justice */}
        <motion.div {...enter(0)} className="mb-8">
          <svg
            viewBox="0 0 220 170"
            role="img"
            aria-label="Scales of justice"
            className="mx-auto h-32 w-auto sm:h-40 lg:h-44"
            style={{ color: "hsl(var(--primary))" }}
          >
            {/* base */}
            <ellipse cx="110" cy="160" rx="46" ry="7" fill="hsl(var(--accent) / 0.22)" />
            <rect x="88" y="150" width="44" height="10" rx="2" fill="hsl(var(--accent))" />
            {/* central pillar */}
            <rect x="105" y="34" width="10" height="118" rx="3" fill="hsl(var(--primary))" />
            {/* finial */}
            <circle cx="110" cy="30" r="8" fill="hsl(var(--accent))" />
            {/* pivoting beam + pans */}
            <g
              style={{
                transformOrigin: "110px 34px",
                animation: on ? "blawTip 5s ease-in-out infinite" : undefined,
              }}
            >
              <rect x="24" y="31" width="172" height="6" rx="3" fill="hsl(var(--primary))" />
              {/* left hanger + pan */}
              <line x1="40" y1="36" x2="40" y2="74" stroke="hsl(var(--accent))" strokeWidth="2" />
              <path d="M18 74 h44 a22 22 0 0 1 -44 0 z" fill="hsl(var(--primary) / 0.18)" stroke="hsl(var(--accent))" strokeWidth="2" />
              {/* right hanger + pan */}
              <line x1="180" y1="36" x2="180" y2="74" stroke="hsl(var(--accent))" strokeWidth="2" />
              <path d="M158 74 h44 a22 22 0 0 1 -44 0 z" fill="hsl(var(--primary) / 0.18)" stroke="hsl(var(--accent))" strokeWidth="2" />
            </g>
          </svg>
        </motion.div>

        <motion.span {...enter(0.06)} className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium" style={{ borderColor: "hsl(var(--accent) / 0.4)", backgroundColor: "hsl(var(--accent) / 0.08)", color: "hsl(var(--primary))" }}>
          <Gavel className="h-4 w-4" />
          <EditableText value={content.eyebrow ?? "Trusted CLAT & Law preparation"} onChange={(v) => update("eyebrow", v)} as="span" />
        </motion.span>

        <motion.h1 {...enter(0.12)} className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl" style={{ color: "hsl(var(--foreground))" }}>
          <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
        </motion.h1>

        {(content.description || isEditMode) && (
          <motion.p {...enter(0.18)} className="mx-auto mt-5 max-w-xl text-lg" style={{ color: "hsl(var(--foreground) / 0.62)" }}>
            <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a subtitle..." />
          </motion.p>
        )}

        {/* Case status glass card */}
        <motion.div {...enter(0.24)} className="mt-8 w-full max-w-md rounded-2xl border px-5 py-4 text-left backdrop-blur-md" style={{ borderColor: "hsl(var(--foreground) / 0.1)", backgroundColor: "hsl(var(--foreground) / 0.03)" }}>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--primary))" }}>
            <BookMarked className="h-3.5 w-3.5" />
            <EditableLabel value={content.tileLabels?.caseStatusLabel} fallback="Case status" onChange={(v) => update("tileLabels", { ...content.tileLabels, caseStatusLabel: v })} />
          </div>
          <ul className="space-y-2">
            {caseStatus.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm" style={{ color: "hsl(var(--foreground) / 0.78)" }}>
                <span>
                  <EditableLabel
                    value={item}
                    fallback={item}
                    onChange={(v) => {
                      const next = [...caseStatus];
                      next[i] = v;
                      update("tileItems", { ...content.tileItems, caseStatus: next });
                    }}
                  />
                </span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: i === caseStatus.length - 1 ? "hsl(var(--foreground) / 0.08)" : "hsl(var(--accent) / 0.18)", color: "hsl(var(--primary))" }}>
                  {i === caseStatus.length - 1 ? <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "hsl(var(--foreground) / 0.4)" }} /> : <Check className="h-3 w-3" />}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        {stats.length > 0 && (
          <motion.div {...enter(0.3)} className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {stats.map((st: HeroPhotographyStat, i: number) => (
              <div key={st.id} className="text-center">
                <div className="text-2xl font-black sm:text-3xl" style={{ color: "hsl(var(--primary))" }}>
                  <EditableText value={st.value} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], value: v }; update("stats", n); }} as="span" />
                </div>
                <div className="text-[11px] uppercase tracking-wide" style={{ color: "hsl(var(--foreground) / 0.5)" }}>
                  <EditableText value={st.label} onChange={(v) => { const n = [...stats]; n[i] = { ...n[i], label: v }; update("stats", n); }} as="span" />
                </div>
              </div>
            ))}
          </motion.div>
        )}

        <motion.div {...enter(0.36)} className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {content.primaryCta && !content.primaryCta.hidden && (
            <EditableClickable href={content.primaryCta.href} onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })} hidden={content.primaryCta.hidden} onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })} isEditing={isEditMode} slotLabel="Primary Button">
              <button type="button" className="group inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-bold text-white shadow-[0_16px_50px_-12px_hsl(var(--primary))] transition-transform hover:scale-[1.04]" style={{ backgroundImage: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
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
              <button type="button" className="inline-flex items-center gap-2 rounded-full border px-8 py-4 text-base font-semibold transition-colors" style={{ borderColor: "hsl(var(--foreground) / 0.18)", color: "hsl(var(--foreground) / 0.8)" }}>
                <Scale className="h-4 w-4" />
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

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blawTip {
          0%   { transform: rotate(0deg); }
          20%  { transform: rotate(6deg); }
          45%  { transform: rotate(-4deg); }
          68%  { transform: rotate(2deg); }
          85%  { transform: rotate(-1deg); }
          100% { transform: rotate(0deg); }
        }
      ` }} />
    </section>
  );
}
