"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  TeachMindfulnessContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface TeachMindfulnessSectionProps {
  section: SectionConfig;
}

export function TeachMindfulnessSection({ section }: TeachMindfulnessSectionProps) {
  const content = section.content as TeachMindfulnessContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    LinkComponent,
  } = useSectionEditor();

  const handleContentUpdate = (key: keyof TeachMindfulnessContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "relative overflow-hidden py-12 sm:py-16 md:py-20 lg:py-24",
        hasCustomBg ? "bg-transparent" : "bg-muted/30",
      )}
    >
      <div className="container-custom relative z-10">
        <div
          className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border shadow-sm sm:rounded-[2rem]"
          style={{
            background: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          {/* ── Decorative background layer ── */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {/* Soft radial glow */}
            <div
              className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
              style={{ background: "hsl(var(--primary) / 0.15)" }}
            />

            {/* Top-left lotus mandala */}
            <svg className="absolute -left-8 -top-8 h-40 w-40 opacity-[0.3] sm:h-52 sm:w-52 md:h-64 md:w-64" viewBox="0 0 200 200" fill="none">
              <circle cx="100" cy="100" r="90" stroke="hsl(var(--primary))" strokeWidth="1.2" />
              <circle cx="100" cy="100" r="68" stroke="hsl(var(--primary))" strokeWidth="1" />
              <circle cx="100" cy="100" r="46" stroke="hsl(var(--primary))" strokeWidth="0.8" />
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
                <ellipse key={a} cx="100" cy="38" rx="14" ry="40" stroke="hsl(var(--primary))" strokeWidth="1" transform={`rotate(${a} 100 100)`} />
              ))}
            </svg>

            {/* Bottom-right flowing waves */}
            <svg className="absolute -bottom-6 -right-6 h-40 w-56 opacity-[0.25] sm:h-48 sm:w-64 md:h-56 md:w-80" viewBox="0 0 320 200" fill="none">
              <path d="M0 100 C50 60, 110 140, 160 100 C210 60, 270 140, 320 100" stroke="hsl(var(--primary))" strokeWidth="2.5" />
              <path d="M0 130 C50 90, 110 170, 160 130 C210 90, 270 170, 320 130" stroke="hsl(var(--primary))" strokeWidth="2" />
              <path d="M0 160 C50 120, 110 200, 160 160 C210 120, 270 200, 320 160" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            </svg>
          </div>

          {/* ── Main content grid ── */}
          <div className="relative z-10 grid grid-cols-1 items-center gap-6 p-6 sm:p-8 md:grid-cols-5 md:gap-10 md:p-10 lg:gap-14 lg:p-14">

            {/* Left, meditation illustration (md+) */}
            <div className="hidden md:col-span-2 md:flex md:items-center md:justify-center">
              <div className="relative flex items-center justify-center py-6 lg:py-8">
                {/* Outer aura rings */}
                <div
                  className="absolute h-60 w-60 rounded-full lg:h-72 lg:w-72"
                  style={{ border: "1.5px solid hsl(var(--primary) / 0.2)" }}
                />
                <div
                  className="absolute h-52 w-52 rounded-full lg:h-62 lg:w-62"
                  style={{ border: "1.5px solid hsl(var(--primary) / 0.28)" }}
                />
                <div
                  className="absolute h-44 w-44 rounded-full lg:h-52 lg:w-52"
                  style={{ background: "hsl(var(--primary) / 0.1)", border: "1.5px solid hsl(var(--primary) / 0.35)" }}
                />

                {/* Meditation figure */}
                <svg viewBox="0 0 200 200" fill="none" className="relative h-44 w-44 lg:h-52 lg:w-52">
                  {/* Lotus base */}
                  <ellipse cx="100" cy="158" rx="42" ry="10" fill="hsl(var(--primary) / 0.2)" />
                  {/* Left petal */}
                  <path d="M58 155 C50 140, 42 125, 52 118 C62 111, 72 120, 72 135 Z" fill="hsl(var(--primary) / 0.25)" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.8" />
                  {/* Right petal */}
                  <path d="M142 155 C150 140, 158 125, 148 118 C138 111, 128 120, 128 135 Z" fill="hsl(var(--primary) / 0.25)" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.8" />
                  {/* Center petal */}
                  <path d="M85 152 C80 135, 82 118, 100 110 C118 118, 120 135, 115 152 Z" fill="hsl(var(--primary) / 0.3)" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.85" />

                  {/* Body, cross-legged silhouette */}
                  <path
                    d="M78 148 C72 138, 74 120, 80 108 C84 100, 90 94, 100 90 C110 94, 116 100, 120 108 C126 120, 128 138, 122 148"
                    fill="hsl(var(--primary) / 0.2)"
                    stroke="hsl(var(--primary))"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  {/* Head */}
                  <circle cx="100" cy="76" r="14" fill="hsl(var(--primary) / 0.18)" stroke="hsl(var(--primary))" strokeWidth="1.8" />

                  {/* Aura glow lines radiating from the figure */}
                  <path d="M100 58 L100 44" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
                  <path d="M116 64 L126 54" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
                  <path d="M84 64 L74 54" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
                  <path d="M122 76 L136 76" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
                  <path d="M78 76 L64 76" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
                  <path d="M118 68 L130 60" stroke="hsl(var(--primary))" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
                  <path d="M82 68 L70 60" stroke="hsl(var(--primary))" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />

                  {/* Small floating particles around the figure */}
                  <circle cx="66" cy="88" r="2.5" fill="hsl(var(--primary))" opacity="0.4" />
                  <circle cx="134" cy="92" r="2" fill="hsl(var(--primary))" opacity="0.35" />
                  <circle cx="80" cy="50" r="2" fill="hsl(var(--primary))" opacity="0.42" />
                  <circle cx="120" cy="48" r="2.5" fill="hsl(var(--primary))" opacity="0.35" />
                  <circle cx="56" cy="70" r="1.5" fill="hsl(var(--primary))" opacity="0.38" />
                  <circle cx="144" cy="68" r="1.5" fill="hsl(var(--primary))" opacity="0.35" />
                  <circle cx="100" cy="38" r="2" fill="hsl(var(--primary))" opacity="0.3" />
                </svg>
              </div>
            </div>

            {/* Right, text content */}
            <div className="text-center md:col-span-3 md:text-left">
              {/* Badge */}
              {(content.badge || isEditMode) && (
                <div
                  className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 sm:mb-5 sm:px-4 sm:py-2"
                  style={{ background: "hsl(var(--primary) / 0.1)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <EditableText
                    value={content.badge ?? ""}
                    onChange={(v) => handleContentUpdate("badge", v)}
                    as="span"
                    className="text-xs font-semibold text-primary sm:text-sm"
                    placeholder="Badge text..."
                  />
                </div>
              )}

              {/* Headline */}
              <EditableText
                value={content.headline}
                onChange={(v) => handleContentUpdate("headline", v)}
                styleKey="headline"
                style={content.textStyles?.headline}
                onStyleChange={(s) => handleTextStyleChange("headline", s)}
                as="h2"
                className="text-2xl font-bold leading-snug sm:text-3xl sm:leading-snug md:text-4xl md:leading-snug lg:text-[3rem] lg:leading-[1.3]"
              />

              {(content.headlineAccent || isEditMode) && (
                <EditableText
                  value={content.headlineAccent ?? ""}
                  onChange={(v) => handleContentUpdate("headlineAccent", v)}
                  styleKey="headlineAccent"
                  style={content.textStyles?.headlineAccent}
                  onStyleChange={(s) => handleTextStyleChange("headlineAccent", s)}
                  as="span"
                  className="mt-1 block text-2xl font-bold leading-snug text-primary sm:text-3xl sm:leading-snug md:text-4xl md:leading-snug lg:text-[3rem] lg:leading-[1.3]"
                  placeholder="Accent text..."
                />
              )}

              {/* Description */}
              {(content.description || isEditMode) && (
                <div className="mt-3 sm:mt-5">
                  <EditableText
                    value={content.description ?? ""}
                    onChange={(v) => handleContentUpdate("description", v)}
                    styleKey="description"
                    style={content.textStyles?.description}
                    onStyleChange={(s) => handleTextStyleChange("description", s)}
                    as="p"
                    className="text-base leading-relaxed text-muted-foreground sm:text-lg md:max-w-lg"
                    multiline
                    placeholder="Add a description..."
                  />
                </div>
              )}

              {/* Feature highlights */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-4 sm:mt-6 sm:gap-5 md:justify-start lg:gap-6">
                {FEATURES.map((feat) => (
                  <div key={feat.label} className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg sm:h-8 sm:w-8"
                      style={{ background: "hsl(var(--primary) / 0.1)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={feat.icon} />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground sm:text-sm">{feat.label}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {content.primaryCta && !content.primaryCta.hidden && (
                <div className="mt-6 sm:mt-8">
                  <EditableClickable
                    href={content.primaryCta.href}
                    onHrefChange={(href) => handleContentUpdate("primaryCta", { ...content.primaryCta, href })}
                    hidden={content.primaryCta.hidden}
                    onHiddenChange={(hidden) => handleContentUpdate("primaryCta", { ...content.primaryCta, hidden })}
                    isEditing={isEditMode}
                    slotLabel="CTA Button"
                  >
                    <Button
                      size="lg"
                      className="gap-2 rounded-full px-8 py-5 text-base font-semibold shadow-lg sm:gap-3 sm:px-10"
                      style={{
                        background: "hsl(var(--primary))",
                        color: "hsl(var(--primary-foreground))",
                        boxShadow: "0 6px 24px hsl(var(--primary) / 0.25)",
                      }}
                      asChild={!isEditMode}
                    >
                      {isEditMode ? (
                        <EditableText
                          value={content.primaryCta.text}
                          onChange={(v) => handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })}
                        />
                      ) : (
                        <LinkComponent href={content.primaryCta.href}>
                          {content.primaryCta.text}
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3.333 8h9.334M8.667 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </LinkComponent>
                      )}
                    </Button>
                  </EditableClickable>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { label: "Self-Paced Learning", icon: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { label: "Expert Instructors", icon: "M12 14l9-5-9-5-9 5 9 5zm0 0v6m-3.75-2.5L12 20l3.75-2.5" },
  { label: "Certificates", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
];
