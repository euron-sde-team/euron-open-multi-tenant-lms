"use client";

import type {
  HeroSliderCorpupskillContent,
  HeroSlide,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { ArrowRight, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "../../../lib/utils";

import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroSliderCorpupskillSectionProps {
  section: SectionConfig;
}

export function HeroSliderCorpupskillSection({ section }: HeroSliderCorpupskillSectionProps) {
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    EditableMedia,
    LinkComponent,
  } = useSectionEditor();
  const content = section.content as HeroSliderCorpupskillContent;
  const slides = content.slides ?? [];
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [carouselHovered, setCarouselHovered] = useState(false);
  /** Desktop / trackpad: hide prev-next until hover; touch: always show (no hover). */
  const [navHoverOnly, setNavHoverOnly] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setNavHoverOnly(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const goTo = useCallback((idx: number) => {
    setCurrent(((idx % slides.length) + slides.length) % slides.length);
  }, [slides.length]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (isEditMode || slides.length <= 1) return;
    timerRef.current = setInterval(next, 6000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isEditMode, slides.length, next]);

  const handleContentUpdate = (key: keyof HeroSliderCorpupskillContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleSlideUpdate = (index: number, updates: Partial<HeroSlide>) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], ...updates };
    handleContentUpdate("slides", newSlides);
  };

  const addSlide = () => {
    handleContentUpdate("slides", [
      ...slides,
      {
        id: `slide-${Date.now()}`,
        image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=900&fit=crop",
        badge: "New Slide",
        headlineLine1: "Your Headline",
        headlineAccent: "Here",
        headlineLine3: "Now",
        subtitle: "Subtitle text",
        description: "Description goes here.",
        cornerBadge: "NEW",
      },
    ]);
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_: HeroSlide, i: number) => i !== index);
    handleContentUpdate("slides", newSlides);
    if (current >= newSlides.length) setCurrent(newSlides.length - 1);
  };

  const handleCtaClick = (href: string) => {
    if (href.startsWith("#")) {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (slides.length === 0) return null;

  const navArrowsHidden =
    slides.length > 1 && navHoverOnly && !isEditMode && !carouselHovered;

  const slideAccents = [
    "hsl(var(--primary))",
    "hsl(var(--ring))",
    "hsl(var(--muted-foreground))",
  ];

  return (
    <section className="relative grid min-h-[100svh] items-center overflow-x-hidden" style={{ background: "hsl(var(--background))" }}>
      <div
        className="relative w-full min-w-0 overflow-hidden"
        onMouseEnter={() => setCarouselHovered(true)}
        onMouseLeave={() => setCarouselHovered(false)}
      >
        {/* Slide track */}
        <div
          className="flex transition-transform duration-1000 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((slide, index) => {
            const accent = slideAccents[index % slideAccents.length];
            return (
              <div key={slide.id} className="relative min-w-full">
                {/* Background image */}
                <div className="absolute inset-0">
                  <div className="absolute inset-0 z-10" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0.6), transparent)" }} />
                  {isEditMode ? (
                    <EditableMedia
                      image={slide.image}
                      imageAlt={slide.imageAlt || "Slide image"}
                      onImageChange={(src, alt) => handleSlideUpdate(index, { image: src, imageAlt: alt })}
                      onVideoChange={() => {}}
                      className="h-full w-full object-cover"
                      aspectRatio="video"
                      placeholder="Click to add slide image"
                      recommendedAspectRatio="16:9"
                      sectionContext={{
                        sectionType: section.type,
                        headline: slide.headlineLine1,
                        description: slide.description,
                        badge: slide.badge,
                      }}
                    />
                  ) : (
                    slide.image && (
                      <img
                        src={slide.image}
                        alt={slide.imageAlt || ""}
                        className="h-full w-full object-cover"
                      />
                    )
                  )}
                </div>

                {/* Content overlay, in flow so long copy grows the slide
                    instead of overflowing a fixed height and getting clipped. */}
                <div
                  className="relative z-20 flex w-full items-center"
                  style={{ minHeight: "clamp(500px, 80vh, 900px)" }}
                >
                  <div
                    className={cn(
                      "mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-12",
                      /* Gutters so copy clears compact side arrows (8px + 32px button + gap) */
                      slides.length > 1 && "max-md:px-11",
                    )}
                  >
                    <div className="w-full max-w-3xl">
                      {/* Badge */}
                      {(slide.badge || isEditMode) && (
                        <div className="mb-6 sm:mb-8">
                          <div
                            className="inline-flex items-center gap-3 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-2xl sm:px-6 sm:py-3 sm:text-sm"
                            style={{ background: accent }}
                          >
                            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white sm:h-3 sm:w-3" />
                            <EditableText
                              value={slide.badge}
                              onChange={(v) => handleSlideUpdate(index, { badge: v })}
                              as="span"
                            />
                          </div>
                        </div>
                      )}

                      {/* Headline, middle line must stay light on dark photos (avoid theme muted/border gradient) */}
                      <h1 className="mb-6 text-[clamp(2rem,6vw,5rem)] font-black leading-[1.02] text-white sm:mb-8 [text-shadow:_0_2px_24px_rgb(0_0_0_/_0.75)]">
                        <EditableText
                          value={slide.headlineLine1}
                          onChange={(v) => handleSlideUpdate(index, { headlineLine1: v })}
                          as="span"
                          styleKey={`slide${index}-h1`}
                          style={content.textStyles?.[`slide${index}-h1`]}
                          onStyleChange={(s) => handleTextStyleChange(`slide${index}-h1`, s)}
                        />
                        <br />
                        <span className="text-amber-100 drop-shadow-[0_2px_20px_rgba(0,0,0,0.95)]">
                          <EditableText
                            value={slide.headlineAccent}
                            onChange={(v) => handleSlideUpdate(index, { headlineAccent: v })}
                            as="span"
                          />
                        </span>
                        <br />
                        <EditableText
                          value={slide.headlineLine3}
                          onChange={(v) => handleSlideUpdate(index, { headlineLine3: v })}
                          as="span"
                        />
                      </h1>

                      {/* Subtitle bar */}
                      {(slide.subtitle || isEditMode) && (
                        <div className="mb-6 flex items-center gap-4 sm:mb-10 sm:gap-6">
                          <div className="h-1 w-20 sm:w-32" style={{ background: accent }} />
                          <div className="text-base font-semibold text-white sm:text-xl [text-shadow:_0_1px_16px_rgb(0_0_0_/_0.8)]">
                            <EditableText
                              value={slide.subtitle || ""}
                              onChange={(v) => handleSlideUpdate(index, { subtitle: v })}
                              as="span"
                              placeholder="Subtitle..."
                            />
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      {(slide.description || isEditMode) && (
                        <p className="mb-8 max-w-2xl text-base font-medium leading-relaxed text-white sm:mb-12 sm:text-xl lg:text-2xl [text-shadow:_0_2px_20px_rgb(0_0_0_/_0.75)]">
                          <EditableText
                            value={slide.description || ""}
                            onChange={(v) => handleSlideUpdate(index, { description: v })}
                            as="span"
                            placeholder="Description..."
                            multiline
                          />
                        </p>
                      )}

                      {/* CTA */}
                      {content.primaryCta && !content.primaryCta.hidden && (
                        <div className="mb-8 sm:mb-16">
                          <EditableClickable
                            href={content.primaryCta.href}
                            onHrefChange={(href) =>
                              handleContentUpdate("primaryCta", { ...content.primaryCta, href })
                            }
                            hidden={content.primaryCta.hidden}
                            onHiddenChange={(hidden) =>
                              handleContentUpdate("primaryCta", { ...content.primaryCta, hidden })
                            }
                            isEditing={isEditMode}
                            slotLabel="Primary Button"
                          >
                            <button
                              type="button"
                              className="group relative overflow-hidden px-8 py-4 text-base font-black text-foreground shadow-2xl transition-all sm:px-10 sm:py-5 sm:text-lg"
                              style={{ background: "hsl(var(--background))" }}
                            >
                              {isEditMode ? (
                                <span className="relative z-10 inline-flex items-center gap-3">
                                  <EditableText
                                    value={content.primaryCta.text}
                                    onChange={(v) =>
                                      handleContentUpdate("primaryCta", { ...content.primaryCta, text: v })
                                    }
                                    as="span"
                                  />
                                  <ArrowRight className="h-4 w-4" />
                                </span>
                              ) : content.primaryCta.href.startsWith("#") ? (
                                <span
                                  className="relative z-10 inline-flex items-center gap-3"
                                  onClick={() => handleCtaClick(content.primaryCta!.href)}
                                >
                                  {content.primaryCta.text}
                                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-2" />
                                </span>
                              ) : (
                                <LinkComponent href={content.primaryCta.href} className="relative z-10 inline-flex items-center gap-3">
                                  {content.primaryCta.text}
                                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-2" />
                                </LinkComponent>
                              )}
                              <div
                                className="absolute inset-0 origin-left scale-x-0 text-white transition-transform group-hover:scale-x-100"
                                style={{ background: accent }}
                              />
                            </button>
                          </EditableClickable>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Corner badge */}
                {(slide.cornerBadge || isEditMode) && (
                  <div
                    className="absolute right-4 top-4 z-30 px-4 py-2 text-xs font-black text-white shadow-2xl sm:right-8 sm:top-8 sm:px-8 sm:py-4 sm:text-base"
                    style={{ background: accent }}
                  >
                    <EditableText
                      value={slide.cornerBadge || ""}
                      onChange={(v) => handleSlideUpdate(index, { cornerBadge: v })}
                      as="span"
                      placeholder="Corner badge..."
                    />
                  </div>
                )}

                {/* Remove slide button */}
                {isEditMode && slides.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSlide(index)}
                    className="absolute left-4 top-4 z-30 rounded-full bg-destructive p-2 text-destructive-foreground shadow-lg sm:left-8 sm:top-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Navigation dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-8 left-1/2 z-40 flex -translate-x-1/2 gap-3 sm:bottom-12 sm:gap-4">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                className="h-3 w-3 rounded-full shadow-xl transition-all sm:h-4 sm:w-4"
                style={{
                  background: index === current ? "white" : "rgba(255,255,255,0.4)",
                }}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        )}

        {/* Prev / Next, compact; on fine-pointer devices hidden until carousel hover (edit mode: always visible) */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous slide"
              aria-hidden={navArrowsHidden}
              tabIndex={navArrowsHidden ? -1 : 0}
              className={cn(
                "absolute left-2 top-1/2 z-40 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-white/25 text-white shadow-md backdrop-blur-sm transition-all duration-200 md:left-3 md:h-9 md:w-9",
                "hover:border-white/40 hover:bg-white/20 focus-visible:border-white/50 focus-visible:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                navArrowsHidden && "pointer-events-none opacity-0",
              )}
              style={{ background: "rgba(0,0,0,0.35)" }}
            >
              <ChevronLeft className="h-4 w-4 md:h-[18px] md:w-[18px]" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              aria-hidden={navArrowsHidden}
              tabIndex={navArrowsHidden ? -1 : 0}
              className={cn(
                "absolute right-2 top-1/2 z-40 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-white/25 text-white shadow-md backdrop-blur-sm transition-all duration-200 md:right-3 md:h-9 md:w-9",
                "hover:border-white/40 hover:bg-white/20 focus-visible:border-white/50 focus-visible:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                navArrowsHidden && "pointer-events-none opacity-0",
              )}
              style={{ background: "rgba(0,0,0,0.35)" }}
            >
              <ChevronRight className="h-4 w-4 md:h-[18px] md:w-[18px]" strokeWidth={2.25} />
            </button>
          </>
        )}
      </div>

      {/* Add slide button (edit mode) */}
      {isEditMode && (
        <div className="flex justify-center py-4" style={{ background: "hsl(var(--muted))" }}>
          <button
            type="button"
            onClick={addSlide}
            className="inline-flex items-center gap-2 rounded-full border-2 border-dashed px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <Plus className="h-4 w-4" />
            Add Slide
          </button>
        </div>
      )}
    </section>
  );
}
