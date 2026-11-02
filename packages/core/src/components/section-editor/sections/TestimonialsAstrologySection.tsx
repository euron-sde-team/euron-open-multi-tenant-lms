"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  TestimonialsAstrologyContent,
  TestimonialsAstrologyItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

import { VideoTestimonials } from "./VideoTestimonials";

/* ── Decorative quote mark SVG ── */
function QuoteMark({ className }: { className?: string }) {
  return (
    <svg className={className} width="40" height="32" viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 20.8C0 12.267 5.333 5.333 16 0l2.133 4.267C12.267 7.467 9.6 11.733 8.533 16H16v16H0V20.8Zm24 0C24 12.267 29.333 5.333 40 0l2.133 4.267C36.267 7.467 33.6 11.733 32.533 16H40v16H24V20.8Z"
        fill="hsl(var(--primary) / 0.1)"
      />
    </svg>
  );
}

interface TestimonialsAstrologySectionProps {
  section: SectionConfig;
}

export function TestimonialsAstrologySection({ section }: TestimonialsAstrologySectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as TestimonialsAstrologyContent;
  const hasCustomBg = hasCustomSectionBackground(section);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const handleContentUpdate = (key: keyof TestimonialsAstrologyContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const testimonials = content.testimonials ?? [];

  const handleTestimonialUpdate = (index: number, updates: Partial<TestimonialsAstrologyItem>) => {
    const updated = [...testimonials];
    updated[index] = { ...updated[index], ...updates };
    handleContentUpdate("testimonials", updated);
  };

  const addTestimonial = () => {
    handleContentUpdate("testimonials", [
      ...testimonials,
      { id: `test-${Date.now()}`, quote: "Add your testimonial here...", author: "Name", role: "Role", rating: 5 },
    ]);
  };

  const removeTestimonial = (index: number) => {
    if (testimonials.length <= 1) return;
    handleContentUpdate("testimonials", testimonials.filter((_: TestimonialsAstrologyItem, i: number) => i !== index));
    if (featuredIndex >= testimonials.length - 1) setFeaturedIndex(0);
  };

  const featured = testimonials[featuredIndex] || testimonials[0];
  const others = testimonials.filter((_, i) => i !== featuredIndex);

  return (
    <section
      className={cn(
        "relative py-12 md:py-16",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/4 top-0 h-64 w-64 rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-8 text-center sm:mb-10">
          <h2
            className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
          >
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              as="span"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
            />
          </h2>
        </div>

        {/* Featured testimonial */}
        {featured && (
          <div
            className="relative mx-auto mb-10 max-w-3xl rounded-3xl p-8 sm:mb-12 sm:p-12"
            style={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--primary) / 0.12)",
              boxShadow: "0 8px 40px hsl(var(--primary) / 0.06)",
            }}
          >
            {isEditMode && (
              <button
                type="button"
                onClick={() => removeTestimonial(featuredIndex)}
                className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}

            <QuoteMark className="mb-6" />

            {/* Star rating */}
            <div className="mb-5 flex items-center gap-1">
              {Array.from({ length: featured.rating || 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-5 w-5"
                  style={{ fill: "hsl(var(--primary))", color: "hsl(var(--primary))" }}
                />
              ))}
            </div>

            {/* Quote */}
            <p
              className="mb-8 text-lg italic leading-relaxed sm:text-xl md:text-2xl"
              style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
            >
              &ldquo;
              <EditableText
                value={featured.quote}
                onChange={(v) => handleTestimonialUpdate(featuredIndex, { quote: v })}
                as="span"
                multiline
              />
              &rdquo;
            </p>

            {/* Author */}
            <div className="flex items-center gap-4">
              {featured.avatar ? (
                <img
                  src={featured.avatar}
                  alt={featured.author}
                  className="h-14 w-14 rounded-full object-cover"
                  style={{
                    border: "2px solid hsl(var(--primary) / 0.2)",
                    boxShadow: "0 0 16px hsl(var(--primary) / 0.1)",
                  }}
                />
              ) : (
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: "hsl(var(--primary) / 0.1)",
                    color: "hsl(var(--primary))",
                    border: "2px solid hsl(var(--primary) / 0.2)",
                    boxShadow: "0 0 16px hsl(var(--primary) / 0.1)",
                  }}
                >
                  {featured.author?.charAt(0) || "?"}
                </div>
              )}
              <div>
                <h5
                  className="text-base font-semibold sm:text-lg"
                  style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
                >
                  <EditableText
                    value={featured.author}
                    onChange={(v) => handleTestimonialUpdate(featuredIndex, { author: v })}
                    as="span"
                  />
                </h5>
                <p className="text-sm text-muted-foreground">
                  <EditableText
                    value={featured.role}
                    onChange={(v) => handleTestimonialUpdate(featuredIndex, { role: v })}
                    as="span"
                  />
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Other testimonials grid */}
        {others.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
            {others.map((testimonial) => {
              const realIndex = testimonials.findIndex((t) => t.id === testimonial.id);
              return (
                <div
                  key={testimonial.id}
                  className="group relative cursor-pointer rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5 sm:p-7"
                  style={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--primary) / 0.08)",
                    boxShadow: "0 2px 12px hsl(var(--primary) / 0.03)",
                  }}
                  onClick={() => !isEditMode && setFeaturedIndex(realIndex)}
                >
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => removeTestimonial(realIndex)}
                      className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}

                  {/* Stars */}
                  <div className="mb-3 flex items-center gap-0.5">
                    {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5" style={{ fill: "hsl(var(--primary))", color: "hsl(var(--primary))" }} />
                    ))}
                  </div>

                  <p
                    className="mb-5 line-clamp-3 text-sm leading-relaxed sm:text-base"
                    style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
                  >
                    &ldquo;
                    <EditableText
                      value={testimonial.quote}
                      onChange={(v) => handleTestimonialUpdate(realIndex, { quote: v })}
                      as="span"
                      multiline
                    />
                    &rdquo;
                  </p>

                  <div className="flex items-center gap-3">
                    {testimonial.avatar ? (
                      <img
                        src={testimonial.avatar}
                        alt={testimonial.author}
                        className="h-10 w-10 rounded-full object-cover"
                        style={{ border: "1.5px solid hsl(var(--primary) / 0.15)" }}
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold"
                        style={{ backgroundColor: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))" }}
                      >
                        {testimonial.author?.charAt(0) || "?"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold">
                        <EditableText
                          value={testimonial.author}
                          onChange={(v) => handleTestimonialUpdate(realIndex, { author: v })}
                          as="span"
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <EditableText
                          value={testimonial.role}
                          onChange={(v) => handleTestimonialUpdate(realIndex, { role: v })}
                          as="span"
                        />
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isEditMode && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="sm" onClick={addTestimonial} className="rounded-full">
              <Plus className="mr-1 h-4 w-4" /> Add Testimonial
            </Button>
          </div>
        )}

        <VideoTestimonials section={section} />
      </div>
    </section>
  );
}
