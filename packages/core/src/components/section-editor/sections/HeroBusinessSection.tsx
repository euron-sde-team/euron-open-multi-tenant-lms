"use client";

import type {
  HeroPhotographyContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, BarChart3, ShieldCheck, TrendingUp } from "lucide-react";
import type { CSSProperties } from "react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroBusinessSectionProps {
  section: SectionConfig;
}

/**
 * Business hero, a clean, professional split: copy + trust row on the left, a
 * gently floating "dashboard" frame (the image in browser chrome) with two
 * bobbing metric cards on the right, over a subtle dotted grid. Distinct from
 * the Cooking, Fitness and Music heroes. Theme colors via HSL vars.
 */
export function HeroBusinessSection({ section }: HeroBusinessSectionProps) {
  const content = section.content as HeroPhotographyContent;
  const { isEditMode, updateSectionContent, EditableText, EditableImage, LinkComponent } =
    useSectionEditor();

  const resolveHref = (href: string) =>
    !href || href.startsWith("#") ? "/all-courses" : href;
  const update = (key: keyof HeroPhotographyContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const stats = content.stats ?? [];
  const enter = (i: number): CSSProperties =>
    isEditMode ? {} : { animation: "bizFadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both", animationDelay: `${i * 0.1}s` };

  return (
    <section className="relative grid min-h-[100svh] items-center overflow-hidden" style={{ backgroundColor: "hsl(var(--background))" }}>
      <style>{`
        @keyframes bizFadeUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
        @keyframes bizFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes bizBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>

      {/* Dotted grid + gradient wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(120% 100% at 80% 20%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(120% 100% at 80% 20%, black, transparent 70%)",
        }}
      />
      <div className="pointer-events-none absolute -right-32 -top-24 h-96 w-96 rounded-full blur-3xl" style={{ backgroundColor: "hsl(var(--primary))", opacity: 0.1 }} />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
        {/* Left */}
        <div className="min-w-0 space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold" style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))", ...enter(0) }}>
            <TrendingUp className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? "For Teams & Enterprises"} onChange={(v) => update("eyebrow", v)} as="span" />
          </span>

          <h1 className="break-words text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl" style={{ color: "hsl(var(--foreground))", ...enter(1) }}>
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" styleKey="headline" style={content.textStyles?.headline} onStyleChange={(s) => handleTextStyleChange("headline", s)} multiline />
          </h1>

          {(content.description || isEditMode) && (
            <p className="max-w-xl text-lg leading-relaxed" style={{ color: "hsl(var(--muted-foreground))", ...enter(2) }}>
              <EditableText value={content.description || ""} onChange={(v) => update("description", v)} as="span" placeholder="Add a compelling subtitle..." styleKey="description" style={content.textStyles?.description} onStyleChange={(s) => handleTextStyleChange("description", s)} />
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-1" style={enter(3)}>
            {content.primaryCta && !content.primaryCta.hidden && (
              <EditableClickable href={content.primaryCta.href} onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })} hidden={content.primaryCta.hidden} onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })} isEditing={isEditMode} slotLabel="Primary Button">
                <button type="button" className="group inline-flex items-center gap-2 rounded-lg px-7 py-3.5 text-base font-semibold shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
                  {isEditMode ? (
                    <>
                      <EditableText value={content.primaryCta.text} onChange={(v) => update("primaryCta", { ...content.primaryCta, text: v })} as="span" styleKey="primaryCta" style={content.textStyles?.primaryCta} onStyleChange={(s) => handleTextStyleChange("primaryCta", s)} />
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
                <button type="button" className="inline-flex items-center gap-2 rounded-lg border px-7 py-3.5 text-base font-semibold transition-colors" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", backgroundColor: "transparent" }}>
                  {isEditMode ? (
                    <EditableText value={content.secondaryCta.text} onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })} as="span" styleKey="secondaryCta" style={content.textStyles?.secondaryCta} onStyleChange={(s) => handleTextStyleChange("secondaryCta", s)} />
                  ) : (
                    <LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
          </div>

          {/* Trust row */}
          <div className="flex items-center gap-2 pt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))", ...enter(4) }}>
            <ShieldCheck className="h-4 w-4" style={{ color: "hsl(var(--accent))" }} />
            <EditableLabel value={content.tileLabels?.trustRow} fallback="Trusted by teams at leading companies" onChange={(v) => update("tileLabels", { ...content.tileLabels, trustRow: v })} />
          </div>
        </div>

        {/* Right, floating dashboard */}
        <div className="relative">
          <div
            className="overflow-hidden rounded-2xl border shadow-2xl"
            style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))", animation: isEditMode ? undefined : "bizFloat 7s ease-in-out infinite" }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 border-b px-4 py-2.5" style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--muted))" }}>
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="relative aspect-[16/11] w-full" style={{ backgroundColor: "hsl(var(--muted))" }}>
              {content.image ? (
                <img src={content.image} alt={content.imageAlt || "Platform dashboard"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BarChart3 className="h-16 w-16" style={{ color: "hsl(var(--muted-foreground))" }} />
                </div>
              )}
              {isEditMode && (
                <div className="absolute bottom-3 right-3 h-10 w-10 overflow-hidden rounded-lg border-2 border-white/60">
                  <EditableImage src={content.image || ""} alt={content.imageAlt || "Dashboard"} onChange={(src) => update("image", src)} className="h-full w-full" aspectRatio="square" placeholder="IMG" />
                </div>
              )}
            </div>
          </div>

          {/* Floating metric cards from stats */}
          {stats[0] && (
            <div className="absolute -left-5 top-10 hidden rounded-xl px-4 py-3 shadow-xl sm:block" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", animation: isEditMode ? undefined : "bizBob 4s ease-in-out infinite" }}>
              <div className="text-xl font-extrabold" style={{ color: "hsl(var(--primary))" }}>
                <EditableText value={stats[0].value} onChange={(v) => { const n = [...stats]; n[0] = { ...n[0], value: v }; update("stats", n); }} as="span" />
              </div>
              <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                <EditableText value={stats[0].label} onChange={(v) => { const n = [...stats]; n[0] = { ...n[0], label: v }; update("stats", n); }} as="span" />
              </div>
            </div>
          )}
          {stats[1] && (
            <div className="absolute -right-4 bottom-8 hidden rounded-xl px-4 py-3 shadow-xl sm:block" style={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", animation: isEditMode ? undefined : "bizBob 4.6s ease-in-out 0.6s infinite" }}>
              <div className="text-xl font-extrabold" style={{ color: "hsl(var(--accent))" }}>
                <EditableText value={stats[1].value} onChange={(v) => { const n = [...stats]; n[1] = { ...n[1], value: v }; update("stats", n); }} as="span" />
              </div>
              <div className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                <EditableText value={stats[1].label} onChange={(v) => { const n = [...stats]; n[1] = { ...n[1], label: v }; update("stats", n); }} as="span" />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
