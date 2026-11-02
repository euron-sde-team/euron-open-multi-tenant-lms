"use client";

import type { HeroPhotographyContent, HeroPhotographyStat, SectionConfig } from "@open-mtlms/shared";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { ArrowRight, Globe2, MapPin, Plane } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

/** Bespoke study-abroad hero: an immersive, centred aspirational hero with a
 *  rotating dotted globe (stacked elliptical latitude rings + masked sphere)
 *  behind the headline, flight-path arcs orbiting it, destination pins, and one
 *  floating "boarding pass" glass card. Azure theme, white text, single CTA. */
export function BespokeStudyHero({ section }: { section: SectionConfig }) {
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

  // Latitude rings for the sphere illusion (scaled + flattened vertically).
  const rings = [0.18, 0.42, 0.66, 0.86, 1];
  // Destination pins placed around the globe (percentages within globe box).
  const pins: Array<[number, number, number]> = [
    [22, 30, 0],
    [78, 40, 0.8],
    [40, 74, 1.6],
    [66, 66, 2.4],
  ];

  return (
    <section
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 py-24"
      style={{
        backgroundImage:
          "linear-gradient(150deg, hsl(var(--primary)), hsl(var(--primary) / 0.85), hsl(var(--primary) / 0.65))",
      }}
    >
      {/* ambient starfield glows */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-24 top-[-10%] h-72 w-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.28), transparent 70%)" }}
        />
        <div
          className="absolute -right-20 bottom-[-10%] h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.18), transparent 70%)" }}
        />
      </div>

      {/* signature graphic: rotating dotted globe + orbiting flight arcs + pins */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 aspect-square w-[38rem] max-w-[92vw] -translate-x-1/2 -translate-y-1/2">
        {/* masked sphere body with dotted texture */}
        <div
          className="absolute inset-[8%] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 38% 32%, hsl(var(--accent) / 0.32), hsl(var(--primary) / 0.25) 55%, transparent 72%)",
            boxShadow: "inset 0 0 80px hsl(var(--accent) / 0.25)",
          }}
        />
        <div
          className="absolute inset-[8%] rounded-full opacity-40"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--accent) / 0.55) 1px, transparent 1.4px)",
            backgroundSize: "16px 16px",
            WebkitMaskImage: "radial-gradient(circle at center, #000 58%, transparent 72%)",
            maskImage: "radial-gradient(circle at center, #000 58%, transparent 72%)",
          }}
        />
        {/* rotating equator meridian */}
        <div
          className="absolute inset-[8%] rounded-full border-2"
          style={{
            borderColor: "hsl(var(--accent) / 0.4)",
            animation: on ? "bstuSpin 26s linear infinite" : undefined,
          }}
        />
        {/* stacked flattened latitude rings → sphere illusion */}
        {rings.map((sc, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-[50%] border"
            style={{
              width: `${sc * 84}%`,
              height: `${sc * 84 * 0.34}%`,
              transform: "translate(-50%, -50%)",
              borderColor: `hsl(var(--accent) / ${0.34 - i * 0.03})`,
            }}
          />
        ))}
        {/* orbiting flight-path arcs (behind/around globe only) */}
        <div className="absolute inset-0" style={{ animation: on ? "bstuOrbit 22s linear infinite" : undefined }}>
          <span
            className="absolute left-1/2 top-1/2 rounded-[50%] border-t-2 border-dashed"
            style={{
              width: "104%",
              height: "62%",
              transform: "translate(-50%, -50%) rotate(-18deg)",
              borderColor: "hsl(var(--accent) / 0.5)",
            }}
          />
          <Plane
            className="absolute h-5 w-5 text-primary-foreground"
            style={{ left: "6%", top: "30%", filter: "drop-shadow(0 0 6px hsl(var(--accent)))" }}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{ animation: on ? "bstuOrbitRev 30s linear infinite" : undefined }}
        >
          <span
            className="absolute left-1/2 top-1/2 rounded-[50%] border-t-2 border-dashed"
            style={{
              width: "96%",
              height: "74%",
              transform: "translate(-50%, -50%) rotate(26deg)",
              borderColor: "hsl(var(--accent) / 0.3)",
            }}
          />
        </div>
        {/* destination pins */}
        {pins.map(([x, y, d], i) => (
          <span key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
            <MapPin
              className="h-5 w-5 text-primary-foreground"
              style={{ filter: "drop-shadow(0 0 6px hsl(var(--accent)))", animation: on ? `bstuFloat ${4 + d}s ease-in-out ${d}s infinite` : undefined }}
            />
          </span>
        ))}
      </div>

      {/* bottom fade for depth */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40"
        style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.65))" }}
      />

      {/* floating boarding-pass glass card */}
      <motion.div
        {...enter(0.5)}
        className="pointer-events-none absolute right-[6%] top-[16%] z-[5] hidden w-56 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-4 text-left backdrop-blur-md lg:block"
        style={{ animation: on ? "bstuFloat 6s ease-in-out infinite" : undefined }}
      >
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/60">
          <span>Boarding Pass</span>
          <Globe2 className="h-3.5 w-3.5" style={{ color: "hsl(var(--accent))" }} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-primary-foreground/50">From</div>
            <div className="text-lg font-black text-primary-foreground">HOME</div>
          </div>
          <Plane className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
          <div className="text-right">
            <div className="text-[10px] text-primary-foreground/50">To</div>
            <div className="text-lg font-black text-primary-foreground">ABRD</div>
          </div>
        </div>
        <div className="mt-3 border-t border-dashed border-primary-foreground/20 pt-2 text-[10px] text-primary-foreground/50">
          <EditableLabel value={content.tileLabels?.seatCaption} fallback="Seat 1A · Admission Confirmed" onChange={(v) => update("tileLabels", { ...content.tileLabels, seatCaption: v })} />
        </div>
      </motion.div>

      {/* centred content */}
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <motion.span
          {...enter(0)}
          className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/[0.08] px-4 py-1.5 text-[13px] font-medium text-primary-foreground/85"
        >
          <Globe2 className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
          <EditableText
            value={content.eyebrow ?? "Study abroad, ambition unlocked"}
            onChange={(v) => update("eyebrow", v)}
            as="span"
          />
        </motion.span>

        <motion.h1
          {...enter(0.08)}
          className="mt-7 text-5xl font-black leading-[1.03] tracking-tight text-primary-foreground sm:text-6xl lg:text-[4rem]"
          style={{ textShadow: "0 2px 40px hsl(var(--accent) / 0.35)" }}
        >
          <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" multiline />
        </motion.h1>

        {(content.description || isEditMode) && (
          <motion.p {...enter(0.16)} className="mx-auto mt-6 max-w-xl text-lg text-primary-foreground/65">
            <EditableText
              value={content.description || ""}
              onChange={(v) => update("description", v)}
              as="span"
              placeholder="Add a subtitle..."
            />
          </motion.p>
        )}

        {stats.length > 0 && (
          <motion.div {...enter(0.22)} className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
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
                <div className="text-[11px] uppercase tracking-wide text-primary-foreground/45">
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

        <motion.div {...enter(0.3)} className="mt-9 flex flex-col items-center gap-4">
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
                className="group inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-bold text-primary-foreground shadow-[0_16px_50px_-12px_hsl(var(--accent))] transition-transform hover:scale-[1.04]"
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
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
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
        </motion.div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes bstuSpin { to { transform: rotate(360deg); } }
        @keyframes bstuOrbit { to { transform: rotate(360deg); } }
        @keyframes bstuOrbitRev { to { transform: rotate(-360deg); } }
        @keyframes bstuFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `,
        }}
      />
    </section>
  );
}
