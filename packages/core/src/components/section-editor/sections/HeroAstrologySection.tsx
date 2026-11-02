"use client";

import type {
  HeroAstrologyContent,
  HeroAstrologySlide,
  HeroAstrologyStat,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

/* ── Cosmic gradient backgrounds per slide (theme-adaptive: primary-tinted glow over the theme surface) ── */
const cosmicGradients = [
  "radial-gradient(ellipse at 20% 50%, hsl(var(--primary) / 0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, hsl(var(--primary) / 0.12) 0%, hsl(var(--card)) 70%, hsl(var(--background)) 100%)",
  "radial-gradient(ellipse at 70% 60%, hsl(var(--primary) / 0.15) 0%, transparent 55%), radial-gradient(ellipse at 30% 30%, hsl(var(--primary) / 0.1) 0%, hsl(var(--card)) 65%, hsl(var(--background)) 100%)",
  "radial-gradient(ellipse at 50% 40%, hsl(var(--primary) / 0.12) 0%, transparent 50%), radial-gradient(ellipse at 40% 70%, hsl(var(--primary) / 0.1) 0%, hsl(var(--card)) 60%, hsl(var(--background)) 100%)",
  "radial-gradient(ellipse at 60% 30%, hsl(var(--primary) / 0.2) 0%, transparent 45%), radial-gradient(ellipse at 25% 65%, hsl(var(--primary) / 0.14) 0%, hsl(var(--card)) 55%, hsl(var(--background)) 100%)",
];


interface HeroAstrologySectionProps {
  section: SectionConfig;
}

export function HeroAstrologySection({ section }: HeroAstrologySectionProps) {
  const content = section.content as HeroAstrologyContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    EditableImage,
    LinkComponent,
  } = useSectionEditor();

  const slides = content.slides ?? [];
  const [activeSlide, setActiveSlide] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetAutoplay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (slides.length > 1 && !isEditMode) {
      timerRef.current = setInterval(() => {
        setActiveSlide((prev) => (prev + 1) % slides.length);
      }, 5000);
    }
  }, [slides.length, isEditMode]);

  useEffect(() => {
    resetAutoplay();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetAutoplay]);

  useEffect(() => {
    if (activeSlide >= slides.length && slides.length > 0) setActiveSlide(0);
  }, [slides.length, activeSlide]);

  const goToSlide = (index: number) => { setActiveSlide(index); resetAutoplay(); };

  const handleCtaClick = (href: string) => {
    if (href.startsWith("#")) {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleContentUpdate = (key: keyof HeroAstrologyContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const stats = content.stats ?? [];

  const handleStatUpdate = (index: number, updates: Partial<HeroAstrologyStat>) => {
    const newStats = [...stats];
    newStats[index] = { ...newStats[index], ...updates };
    handleContentUpdate("stats", newStats);
  };

  const addStat = () => {
    handleContentUpdate("stats", [
      ...stats,
      { id: `stat-${Date.now()}`, value: "0+", label: "New Stat" },
    ]);
  };

  const removeStat = (index: number) => {
    if (stats.length <= 1) return;
    handleContentUpdate("stats", stats.filter((_: HeroAstrologyStat, i: number) => i !== index));
  };

  const handleSlideUpdate = (index: number, updates: Partial<HeroAstrologySlide>) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], ...updates };
    handleContentUpdate("slides", newSlides);
  };

  const addSlide = () => {
    handleContentUpdate("slides", [
      ...slides,
      { id: `slide-${Date.now()}`, image: "", imageAlt: "Slide background" },
    ]);
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_: HeroAstrologySlide, i: number) => i !== index);
    handleContentUpdate("slides", newSlides);
    if (activeSlide >= newSlides.length) setActiveSlide(0);
  };

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden">
      {/* ── Background slides ── */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={cn(
            "absolute inset-0 z-0 transition-opacity duration-[1800ms] ease-in-out",
            index === activeSlide ? "opacity-100" : "opacity-0",
          )}
        >
          {slide.image ? (
            <img src={slide.image} alt={slide.imageAlt || "Celestial background"} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: cosmicGradients[index % cosmicGradients.length] }} />
          )}
        </div>
      ))}

      {/* Fallback when no slides */}
      {slides.length === 0 && (
        <div className="absolute inset-0 z-0" style={{ background: cosmicGradients[0] }} />
      )}

      {/* Theme-adaptive scrim for text readability (dark theme darkens, light theme lightens) */}
      <div className="absolute inset-0 z-[1]" style={{ backgroundColor: "hsl(var(--background) / 0.55)" }} />

      {/* Slide management controls (edit mode) */}
      {isEditMode && (
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="relative h-10 w-10 overflow-hidden rounded-xl"
              style={{ border: index === activeSlide ? "2px solid hsl(var(--primary))" : "2px solid hsl(var(--border))" }}
            >
              <EditableImage
                src={slide.image || ""}
                alt={slide.imageAlt || "Slide"}
                onChange={(src) => handleSlideUpdate(index, { image: src })}
                className="h-full w-full"
                aspectRatio="square"
                placeholder={`${index + 1}`}
              />
              {slides.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeSlide(index); }}
                  className="absolute right-1 top-1 z-10 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSlide} className="h-10 rounded-xl text-foreground border-border">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto max-w-[1100px] px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Headline */}
          <h1
            className="whitespace-pre-line text-[clamp(2.2rem,6vw,5.5rem)] font-bold leading-[0.95] tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
          >
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              as="span"
              className="text-foreground"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
              multiline
            />
            {(content.headlineAccent || isEditMode) && (
              <>
                {" "}
                <span style={{ color: "hsl(var(--primary))", textShadow: "0 0 40px hsl(var(--primary) / 0.4)" }}>
                  <EditableText
                    value={content.headlineAccent || ""}
                    onChange={(v) => handleContentUpdate("headlineAccent", v)}
                    as="span"
                    placeholder="accent text..."
                  />
                </span>
              </>
            )}
          </h1>

          {/* Description */}
          {(content.description || isEditMode) && (
            <p
              className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg"
              style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
            >
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add description..."
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
              />
            </p>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-3 pt-4 sm:gap-4">
            {content.primaryCta && !content.primaryCta.hidden && (
              <EditableClickable
                href={content.primaryCta.href}
                onHrefChange={(href) => handleContentUpdate("primaryCta", { ...content.primaryCta, href })}
                hidden={content.primaryCta.hidden}
                onHiddenChange={(hidden) => handleContentUpdate("primaryCta", { ...content.primaryCta, hidden })}
                isEditing={isEditMode}
                slotLabel="Primary Button"
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold transition-all duration-300 hover:scale-105 sm:px-9 sm:py-3.5 sm:text-base"
                  style={{
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    boxShadow: "0 0 30px hsl(var(--primary) / 0.35), 0 0 60px hsl(var(--primary) / 0.15)",
                  }}
                >
                  {isEditMode ? (
                    <EditableText value={content.primaryCta.text} onChange={(v) => handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })} as="span" />
                  ) : content.primaryCta.href.startsWith("#") ? (
                    <span className="inline-flex items-center gap-2" onClick={() => handleCtaClick(content.primaryCta!.href)}>
                      {content.primaryCta.text} <ArrowRight className="h-4 w-4" />
                    </span>
                  ) : (
                    <LinkComponent href={content.primaryCta.href} className="inline-flex items-center gap-2">
                      {content.primaryCta.text} <ArrowRight className="h-4 w-4" />
                    </LinkComponent>
                  )}
                  {isEditMode && <ArrowRight className="h-4 w-4" />}
                </button>
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
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-foreground/90 transition-all duration-300 hover:scale-105 hover:text-foreground sm:px-9 sm:py-3.5 sm:text-base"
                  style={{ border: "1px solid hsl(var(--primary) / 0.35)", backgroundColor: "hsl(var(--primary) / 0.12)", backdropFilter: "blur(12px)" }}
                >
                  {isEditMode ? (
                    <EditableText value={content.secondaryCta!.text} onChange={(v) => handleContentUpdate("secondaryCta", { ...content.secondaryCta, text: v })} as="span" />
                  ) : content.secondaryCta!.href.startsWith("#") ? (
                    <span className="inline-flex items-center gap-2" onClick={() => handleCtaClick(content.secondaryCta!.href)}>
                      {content.secondaryCta!.text}
                    </span>
                  ) : (
                    <LinkComponent href={content.secondaryCta!.href} className="inline-flex items-center gap-2">
                      {content.secondaryCta!.text}
                    </LinkComponent>
                  )}
                </button>
              </EditableClickable>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-8 pt-8 sm:gap-16 sm:pt-12">
            {stats.map((stat, index) => (
              <div key={stat.id} className="relative text-center text-foreground">
                {isEditMode && (
                  <button type="button" onClick={() => removeStat(index)} className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                <p
                  className="text-3xl font-bold tabular-nums sm:text-5xl"
                  style={{ color: "hsl(var(--primary))", fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)", textShadow: "0 0 24px hsl(var(--primary) / 0.3)" }}
                >
                  <EditableText value={stat.value} onChange={(v) => handleStatUpdate(index, { value: v })} as="span" />
                </p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                  <EditableText value={stat.label} onChange={(v) => handleStatUpdate(index, { label: v })} as="span" />
                </p>
              </div>
            ))}
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={addStat} className="self-center rounded-full text-foreground border-border">
                <Plus className="mr-1 h-4 w-4" /> Add Stat
              </Button>
            )}
          </div>

          {/* Dot indicators */}
          {slides.length > 1 && (
            <div className="flex justify-center gap-2.5 pt-4">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-700",
                    index === activeSlide ? "w-9" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                  )}
                  style={index === activeSlide ? { backgroundColor: "hsl(var(--primary))", boxShadow: "0 0 10px hsl(var(--primary) / 0.5)" } : undefined}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
