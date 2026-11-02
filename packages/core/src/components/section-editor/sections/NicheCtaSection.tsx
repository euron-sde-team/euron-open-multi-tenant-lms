"use client";

import type { NicheCtaContent, SectionConfig, TextStyle } from "@open-mtlms/shared";
import { ArrowRight } from "lucide-react";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";
import { getNicheVisual, type NicheVariant } from "./niche-visuals";

export function NicheCtaSection({ section, variant }: { section: SectionConfig; variant: NicheVariant }) {
  const content = section.content as NicheCtaContent;
  const { isEditMode, updateSectionContent, EditableText, LinkComponent } = useSectionEditor();
  const visual = getNicheVisual(variant);
  const Accent = visual.accentIcon;
  const Motif = visual.motifIcons;

  const resolveHref = (href: string) => (!href || href.startsWith("#") ? "/all-courses" : href);
  const update = (key: keyof NicheCtaContent, value: unknown) => updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  return (
    <section className="relative px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <style>{`
        @keyframes ctaDrift { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(14px,-14px) rotate(10deg); } }
        @keyframes ctaShine { 0% { transform: translateX(-120%) skewX(-18deg); } 100% { transform: translateX(220%) skewX(-18deg); } }
      `}</style>

      <div
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-16 text-center shadow-2xl sm:px-12"
        style={{ background: "linear-gradient(120deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)" }}
      >
        {/* Shine sweep */}
        {!isEditMode && (
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)", animation: "ctaShine 6s ease-in-out infinite" }} />
        )}
        {/* Floating motif */}
        {!isEditMode && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Motif.map((Icon, i) => (
              <Icon
                key={i}
                className="absolute text-white/15"
                style={{
                  left: `${6 + ((i * 29) % 88)}%`,
                  top: `${10 + ((i * 37) % 74)}%`,
                  width: 34 + (i % 3) * 10,
                  height: 34 + (i % 3) * 10,
                  animation: `ctaDrift ${5 + i}s ease-in-out ${i * 0.5}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur">
            <Accent className="h-4 w-4" />
            <EditableText value={content.eyebrow ?? visual.ctaEyebrow} onChange={(v) => update("eyebrow", v)} as="span" />
          </span>
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            <EditableText value={content.headline} onChange={(v) => update("headline", v)} as="span" styleKey="headline" style={content.textStyles?.headline} onStyleChange={(s) => handleTextStyleChange("headline", s)} multiline />
          </h2>
          {(content.subheadline || isEditMode) && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/85">
              <EditableText value={content.subheadline || ""} onChange={(v) => update("subheadline", v)} as="span" placeholder="Add a short subtitle..." styleKey="subheadline" style={content.textStyles?.subheadline} onStyleChange={(s) => handleTextStyleChange("subheadline", s)} />
            </p>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {content.primaryCta && !content.primaryCta.hidden && (
              <EditableClickable
                href={content.primaryCta.href}
                onHrefChange={(href) => update("primaryCta", { ...content.primaryCta, href })}
                hidden={content.primaryCta.hidden}
                onHiddenChange={(hidden) => update("primaryCta", { ...content.primaryCta, hidden })}
                isEditing={isEditMode}
                slotLabel="Primary Button"
              >
                <button type="button" className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold shadow-xl transition-transform hover:scale-105" style={{ color: "hsl(var(--primary))" }}>
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
                <button type="button" className="inline-flex items-center gap-2 rounded-full border-2 border-white/70 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-white/10">
                  {isEditMode ? (
                    <EditableText value={content.secondaryCta.text} onChange={(v) => update("secondaryCta", { ...content.secondaryCta, text: v })} as="span" />
                  ) : (
                    <LinkComponent href={resolveHref(content.secondaryCta.href)}>{content.secondaryCta.text}</LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
