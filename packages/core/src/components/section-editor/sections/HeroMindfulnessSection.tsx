"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  HeroMindfulnessContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroMindfulnessSectionProps {
  section: SectionConfig;
}

export function HeroMindfulnessSection({ section }: HeroMindfulnessSectionProps) {
  const content = section.content as HeroMindfulnessContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    EditableMedia,
    LinkComponent,
  } = useSectionEditor();

  const handleContentUpdate = (key: keyof HeroMindfulnessContent, value: unknown) => {
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
  const stats = content.stats ?? [];
  const benefits = content.benefits ?? [];

  return (
    <section className={cn("relative grid min-h-[100svh] items-center overflow-hidden", hasCustomBg ? "bg-transparent" : "bg-background")}>
      {/* Decorative background blurs */}
      {!hasCustomBg && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div
            className="absolute -left-[5%] top-[10%] h-[60%] w-[40%] rounded-full blur-[120px]"
            style={{ background: "hsl(var(--primary) / 0.22)" }}
          />
          <div
            className="absolute right-[10%] top-[30%] h-[50%] w-[35%] rounded-full blur-[100px]"
            style={{ background: "hsl(var(--primary) / 0.16)" }}
          />
          <div
            className="absolute bottom-[10%] left-1/4 h-[45%] w-[40%] rounded-full blur-[120px]"
            style={{ background: "hsl(var(--primary) / 0.18)" }}
          />
        </div>
      )}

      <div className="container-custom relative z-10 py-12 sm:py-16 md:py-20 lg:py-28">
        <div className="grid grid-cols-1 items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-20">
          {/* Left Content */}
          <div className="relative min-w-0">
            {/* Corner accents, hidden on small screens */}
            <div
              className="absolute -left-4 -top-8 hidden h-16 w-16 rounded-tl-2xl border-l-[3px] border-t-[3px] sm:block"
              style={{ borderColor: "hsl(var(--primary) / 0.35)" }}
            />

            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
              as="h1"
              className="break-words text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl lg:text-[4.5rem]"
            />

            {(content.headlineAccent || isEditMode) && (
              <EditableText
                value={content.headlineAccent ?? ""}
                onChange={(v) => handleContentUpdate("headlineAccent", v)}
                styleKey="headlineAccent"
                style={content.textStyles?.headlineAccent}
                onStyleChange={(s) => handleTextStyleChange("headlineAccent", s)}
                as="span"
                className="block break-words text-3xl font-bold leading-[1.1] tracking-tight text-primary sm:text-4xl md:text-5xl lg:text-[4.5rem]"
                placeholder="Accent text..."
              />
            )}

            {(content.description || isEditMode) && (
              <div className="mt-4 sm:mt-6 lg:mt-8">
                <EditableText
                  value={content.description ?? ""}
                  onChange={(v) => handleContentUpdate("description", v)}
                  styleKey="description"
                  style={content.textStyles?.description}
                  onStyleChange={(s) => handleTextStyleChange("description", s)}
                  as="p"
                  className="text-base font-light leading-relaxed text-muted-foreground sm:text-lg md:text-xl"
                  multiline
                  placeholder="Add a description..."
                />
              </div>
            )}

            {/* CTAs */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4 lg:mt-10">
              {content.primaryCta && !content.primaryCta.hidden && (
                <EditableClickable
                  href={content.primaryCta.href}
                  onHrefChange={(href) => handleContentUpdate("primaryCta", { ...content.primaryCta, href })}
                  hidden={content.primaryCta.hidden}
                  onHiddenChange={(hidden) => handleContentUpdate("primaryCta", { ...content.primaryCta, hidden })}
                  isEditing={isEditMode}
                  slotLabel="Primary Button"
                >
                  <Button size="lg" className="gap-2 px-8 py-6 text-base font-semibold shadow-lg" asChild={!isEditMode}>
                    {isEditMode ? (
                      <EditableText
                        value={content.primaryCta.text}
                        onChange={(v) => handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })}
                      />
                    ) : (
                      <LinkComponent href={content.primaryCta.href}>
                        {content.primaryCta.text}
                        <ArrowRightIcon />
                      </LinkComponent>
                    )}
                  </Button>
                </EditableClickable>
              )}
              {content.secondaryCta && !content.secondaryCta.hidden && (
                <EditableClickable
                  href={content.secondaryCta.href}
                  onHrefChange={(href) => handleContentUpdate("secondaryCta", { ...content.secondaryCta, href })}
                  hidden={content.secondaryCta.hidden}
                  onHiddenChange={(hidden) => handleContentUpdate("secondaryCta", { ...content.secondaryCta, hidden })}
                  isEditing={isEditMode}
                  slotLabel="Secondary Button"
                >
                  <Button size="lg" variant="outline" className="gap-3 px-8 py-6 text-base font-semibold" asChild={!isEditMode}>
                    {isEditMode ? (
                      <EditableText
                        value={content.secondaryCta.text}
                        onChange={(v) => handleContentUpdate("secondaryCta", { ...content.secondaryCta, text: v })}
                      />
                    ) : (
                      <LinkComponent href={content.secondaryCta.href}>
                        <PlayIcon />
                        {content.secondaryCta.text}
                      </LinkComponent>
                    )}
                  </Button>
                </EditableClickable>
              )}
            </div>

            {/* Bottom corner accent, hidden on small screens */}
            <div
              className="absolute -bottom-8 -left-4 hidden h-20 w-20 rounded-bl-2xl border-b-[3px] border-l-[3px] sm:block"
              style={{ borderColor: "hsl(var(--primary) / 0.3)" }}
            />
          </div>

          {/* Right Visual */}
          <div className="relative">
            <div
              className="rounded-2xl border p-4 shadow-2xl sm:rounded-3xl sm:p-6 lg:p-8"
              style={{
                background: "hsl(var(--primary) / 0.12)",
                borderColor: "hsl(var(--border) / 0.6)",
              }}
            >
              {/* Main image */}
              <div className="relative mb-4 overflow-hidden rounded-xl sm:mb-6 sm:rounded-2xl">
                <EditableMedia
                  image={content.image}
                  imageAlt={content.imageAlt}
                  videoUrl={content.videoUrl}
                  onImageChange={(src, alt) => {
                    handleContentUpdate("image", src);
                    handleContentUpdate("imageAlt", alt);
                  }}
                  onVideoChange={(url) => handleContentUpdate("videoUrl", url)}
                  className="aspect-[4/3] w-full object-cover"
                  aspectRatio="auto"
                  placeholder="Click to add meditation image or video"
                  lockedAspectRatio="4:3"
                  recommendedAspectRatio="4:3"
                  sectionContext={{
                    sectionType: "hero-mindfulness",
                    headline: content.headline,
                    description: content.description,
                  }}
                />

                {/* Gradient overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                {/* Live badge */}
                {(content.liveBadgeText || isEditMode) && (
                  <div
                    className="absolute right-4 top-4 flex items-center gap-2 rounded-xl px-4 py-2 shadow-lg backdrop-blur-md"
                    style={{
                      background: "hsl(var(--background) / 0.95)",
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 animate-pulse rounded-full"
                      style={{ background: "hsl(0 84% 60%)" }}
                    />
                    <EditableText
                      value={content.liveBadgeText ?? ""}
                      onChange={(v) => handleContentUpdate("liveBadgeText", v)}
                      as="span"
                      className="text-sm font-bold"
                      placeholder="Live Now"
                    />
                  </div>
                )}
              </div>

              {/* Stats grid */}
              {stats.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {stats.map((stat, i) => (
                    <div
                      key={stat.id}
                      className="rounded-lg border p-2.5 transition-shadow hover:shadow-lg sm:rounded-xl sm:p-4"
                      style={{
                        background: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                      }}
                    >
                      <div
                        className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-md sm:mb-2 sm:h-10 sm:w-10 sm:rounded-lg"
                        style={{ background: "hsl(var(--primary) / 0.1)" }}
                      >
                        <StatIcon name={stat.icon} />
                      </div>
                      <EditableText
                        value={stat.label}
                        onChange={(v) => {
                          const newStats = [...stats];
                          newStats[i] = { ...newStats[i], label: v };
                          handleContentUpdate("stats", newStats);
                        }}
                        as="span"
                        className="text-[10px] text-muted-foreground sm:text-xs"
                      />
                      <EditableText
                        value={stat.value}
                        onChange={(v) => {
                          const newStats = [...stats];
                          newStats[i] = { ...newStats[i], value: v };
                          handleContentUpdate("stats", newStats);
                        }}
                        as="span"
                        className="block text-base font-bold text-primary sm:text-xl"
                      />
                    </div>
                  ))}
                </div>
              )}

              {isEditMode && stats.length === 0 && (
                <button
                  className="w-full rounded-xl border-2 border-dashed p-4 text-sm text-muted-foreground hover:border-primary/50"
                  style={{ borderColor: "hsl(var(--border))" }}
                  onClick={() =>
                    handleContentUpdate("stats", [
                      { id: `stat-${Date.now()}`, icon: "heart-pulse", label: "Metric", value: "+50%" },
                    ])
                  }
                >
                  + Add Stats
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Bar */}
      {benefits.length > 0 && (
        <div
          className="border-y py-4 sm:py-6"
          style={{
            background: "hsl(var(--muted) / 0.5)",
            borderColor: "hsl(var(--border))",
          }}
        >
          <div className="container-custom">
            <div className="flex flex-wrap items-center justify-center gap-4 text-center sm:gap-6 md:gap-8 lg:gap-12">
              {benefits.map((benefit, i) => (
                <div key={benefit.id} className="flex items-center gap-2 sm:gap-3">
                  <BenefitIcon name={benefit.icon} />
                  <EditableText
                    value={benefit.label}
                    onChange={(v) => {
                      const newBenefits = [...benefits];
                      newBenefits[i] = { ...newBenefits[i], label: v };
                      handleContentUpdate("benefits", newBenefits);
                    }}
                    as="span"
                    className="text-xs font-medium text-muted-foreground sm:text-sm md:text-base"
                  />
                  {isEditMode && benefits.length > 1 && (
                    <button
                      className="ml-1 text-xs text-muted-foreground/50 hover:text-destructive"
                      onClick={() => handleContentUpdate("benefits", benefits.filter((_, j) => j !== i))}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
              {isEditMode && (
                <button
                  className="text-sm text-muted-foreground hover:text-primary"
                  onClick={() =>
                    handleContentUpdate("benefits", [
                      ...benefits,
                      { id: `benefit-${Date.now()}`, icon: "check-circle", label: "New Benefit" },
                    ])
                  }
                >
                  + Add
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.333 8h9.334M8.667 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
      <path d="M6.667 4.167l9.166 5.833-9.166 5.833V4.167z" fill="currentColor" />
    </svg>
  );
}

function StatIcon({ name }: { name: string }) {
  const iconMap: Record<string, string> = {
    "heart-pulse": "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
    brain: "M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z",
  };
  const d = iconMap[name] || iconMap["heart-pulse"];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function BenefitIcon({ name }: { name: string }) {
  const iconMap: Record<string, string> = {
    "shield-check": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0v10l4 2",
    award: "M12 15l-3.5 2 1-4L6 10l4-.5L12 6l2 3.5 4 .5-3.5 3 1 4z",
    smartphone: "M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z",
    "check-circle": "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3",
  };
  const d = iconMap[name] || iconMap["check-circle"];
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
