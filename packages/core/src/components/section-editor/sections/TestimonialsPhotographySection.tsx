"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  TestimonialsPhotographyContent,
  TestimonialsPhotographyItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Star, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { useSectionEditor } from "../SectionEditorContext";

import { VideoTestimonials } from "./VideoTestimonials";

interface TestimonialsPhotographySectionProps {
  section: SectionConfig;
}

export function TestimonialsPhotographySection({ section }: TestimonialsPhotographySectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as TestimonialsPhotographyContent;
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof TestimonialsPhotographyContent, value: unknown) => {
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

  const handleTestimonialUpdate = (index: number, updates: Partial<TestimonialsPhotographyItem>) => {
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
    handleContentUpdate("testimonials", testimonials.filter((_: TestimonialsPhotographyItem, i: number) => i !== index));
  };

  return (
    <section
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-16 text-center">
          <h2
            className="text-[clamp(2.5rem,5vw,4rem)] font-black uppercase tracking-tighter"
            style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
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

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className="relative p-5 sm:p-8"
              style={{
                border: "3px solid hsl(var(--foreground))",
                boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
                backgroundColor: "hsl(var(--card))",
              }}
            >
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => removeTestimonial(index)}
                  className="absolute right-2 top-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}

              {/* Stars */}
              <div className="mb-6 flex items-center gap-1">
                {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                ))}
              </div>

              {/* Quote */}
              <p className="mb-6 text-base font-medium leading-relaxed sm:mb-8 sm:text-xl">
                &ldquo;
                <EditableText
                  value={testimonial.quote}
                  onChange={(v) => handleTestimonialUpdate(index, { quote: v })}
                  as="span"
                  multiline
                />
                &rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                {testimonial.avatar && (
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.author}
                    className="h-14 w-14 rounded-full object-cover"
                    style={{ border: "3px solid hsl(var(--foreground))" }}
                  />
                )}
                {!testimonial.avatar && (
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground"
                    style={{ border: "3px solid hsl(var(--foreground))" }}
                  >
                    {testimonial.author?.charAt(0) || "?"}
                  </div>
                )}
                <div>
                  <h5 className="text-lg font-bold">
                    <EditableText
                      value={testimonial.author}
                      onChange={(v) => handleTestimonialUpdate(index, { author: v })}
                      as="span"
                    />
                  </h5>
                  <p className="text-muted-foreground">
                    <EditableText
                      value={testimonial.role}
                      onChange={(v) => handleTestimonialUpdate(index, { role: v })}
                      as="span"
                    />
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isEditMode && (
          <div className="mt-8 text-center">
            <Button variant="outline" size="sm" onClick={addTestimonial}>
              <Plus className="mr-1 h-4 w-4" /> Add Testimonial
            </Button>
          </div>
        )}

        <VideoTestimonials section={section} />
      </div>
    </section>
  );
}
