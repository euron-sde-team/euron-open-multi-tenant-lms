"use client";

import type { SectionConfig, StatsBandContent, StatsBandLogo, StatsBandStat, TextStyle } from "@open-mtlms/shared";

import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";
import { Stagger, StaggerItem } from "../motion";

/**
 * Reusable social-proof band: animated stat figures plus an optional scrolling
 * "trusted by" logo marquee. Marquee scrolls via CSS keyframes on the live site
 * and falls back to an editable static row inside the editor.
 */
export function StatsBand({ section }: { section: SectionConfig }) {
  const content = section.content as StatsBandContent;
  const { isEditMode, updateSectionContent, EditableText, EditableImage } = useSectionEditor();
  const stats = content.stats ?? [];
  const logos = content.logos ?? [];

  const update = (key: keyof StatsBandContent, value: unknown) =>
    updateSectionContent(section.id, { [key]: value });
  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };
  const updateStat = (i: number, patch: Partial<StatsBandStat>) => {
    const next = [...stats];
    next[i] = { ...next[i], ...patch };
    update("stats", next);
  };
  const updateLogo = (i: number, patch: Partial<StatsBandLogo>) => {
    const next = [...logos];
    next[i] = { ...next[i], ...patch };
    update("logos", next);
  };

  const marqueeLogos = logos.length > 0 ? [...logos, ...logos] : [];

  return (
    <section className="py-16 sm:py-20" style={{ backgroundColor: "hsl(var(--muted) / 0.4)" }}>
      <style>{`@keyframes sbMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(content.headline || isEditMode) && (
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: "hsl(var(--foreground))" }}>
              <EditableText
                value={content.headline || ""}
                onChange={(v) => update("headline", v)}
                as="span"
                placeholder="Add a headline..."
                styleKey="headline"
                style={content.textStyles?.headline}
                onStyleChange={(s) => handleTextStyleChange("headline", s)}
              />
            </h2>
            {(content.subheadline || isEditMode) && (
              <p className="mt-3 text-base" style={{ color: "hsl(var(--muted-foreground))" }}>
                <EditableText
                  value={content.subheadline || ""}
                  onChange={(v) => update("subheadline", v)}
                  as="span"
                  placeholder="Add a supporting line..."
                />
              </p>
            )}
          </div>
        )}

        <Stagger
          disabled={isEditMode}
          className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4"
        >
          {stats.map((stat, i) => (
            <StaggerItem key={stat.id} className="text-center">
              <div className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: "hsl(var(--primary))" }}>
                <EditableText value={stat.value} onChange={(v) => updateStat(i, { value: v })} as="span" />
              </div>
              <div className="mt-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
                <EditableText value={stat.label} onChange={(v) => updateStat(i, { label: v })} as="span" />
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {logos.length > 0 && (
          <div className="mt-14">
            <p className="mb-6 text-center text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "hsl(var(--muted-foreground))" }}>
              <EditableLabel value={content.logosLabel} fallback="Trusted by teams everywhere" onChange={(v) => update("logosLabel", v)} />
            </p>
            {isEditMode ? (
              <div className="flex flex-wrap items-center justify-center gap-8">
                {logos.map((logo, i) => (
                  <div key={logo.id} className="h-10 w-28">
                    <EditableImage
                      src={logo.image || ""}
                      alt={logo.alt || "Partner logo"}
                      onChange={(src) => updateLogo(i, { image: src })}
                      className="h-full w-full object-contain"
                      placeholder="LOGO"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
                <div className="flex w-max items-center gap-16" style={{ animation: "sbMarquee 28s linear infinite" }}>
                  {marqueeLogos.map((logo, i) => (
                    <img
                      key={`${logo.id}-${i}`}
                      src={logo.image}
                      alt={logo.alt || "Partner logo"}
                      className="h-9 w-auto object-contain opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
