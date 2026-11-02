"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  TestimonialsCorpupskillContent,
  TestimonialCorpupskill,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { Plus, Star, Trash2 } from "lucide-react";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

import { VideoTestimonials } from "./VideoTestimonials";

interface TestimonialsCorpupskillSectionProps {
  section: SectionConfig;
}

export function TestimonialsCorpupskillSection({ section }: TestimonialsCorpupskillSectionProps) {
  const { isEditMode, EditableText, updateSectionContent } = useSectionEditor();
  const content = section.content as TestimonialsCorpupskillContent;
  const hasCustomBg = hasCustomSectionBackground(section);
  const testimonials = content.testimonials ?? [];

  const handleContentUpdate = (key: keyof TestimonialsCorpupskillContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  const handleTestimonialUpdate = (index: number, updates: Partial<TestimonialCorpupskill>) => {
    const newItems = [...testimonials];
    newItems[index] = { ...newItems[index], ...updates };
    handleContentUpdate("testimonials", newItems);
  };

  const addTestimonial = () => {
    handleContentUpdate("testimonials", [
      ...testimonials,
      {
        id: `t-${Date.now()}`,
        name: "New Person",
        role: "Role / title",
        quote: "Add a testimonial quote here.",
        metricValue: "-",
        metricLabel: "Outcome",
        rating: 5,
        initials: "NP",
      },
    ]);
  };

  const removeTestimonial = (index: number) => {
    if (testimonials.length <= 1) return;
    handleContentUpdate("testimonials", testimonials.filter((_: TestimonialCorpupskill, i: number) => i !== index));
  };

  const avatarColors = [
    "hsl(var(--primary))",
    "hsl(var(--ring))",
    "hsl(var(--destructive))",
    "hsl(var(--success))",
    "hsl(var(--warning))",
  ];

  function TestimonialCard({ item, index }: { item: TestimonialCorpupskill; index: number }) {
    const bgColor = avatarColors[index % avatarColors.length];
    const rating = Math.min(5, Math.max(0, item.rating ?? 5));
    const hasMetric =
      isEditMode ||
      (Boolean(item.metricValue?.trim()) && Boolean(item.metricLabel?.trim()));

    return (
      <div
        className="relative min-w-[280px] max-w-[360px] flex-shrink-0 rounded-2xl p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl sm:min-w-[320px] sm:max-w-[400px] md:min-w-[380px] md:p-8"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border) / 0.4)" }}
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

        {/* Stars, same row as IIT JEE / NEET / Govt Exam */}
        <div className="mb-4 flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn("h-4 w-4 sm:h-5 sm:w-5", i < rating ? "fill-current" : "opacity-30")}
              style={{ color: "hsl(var(--warning))" }}
            />
          ))}
        </div>

        {/* Quote */}
        <p className="mb-6 text-sm italic text-muted-foreground md:text-base">
          &ldquo;
          <EditableText
            value={item.quote}
            onChange={(v) => handleTestimonialUpdate(index, { quote: v })}
            as="span"
            multiline
          />
          &rdquo;
        </p>

        {/* Author, avatar + name + role (UPSC / examprep order) */}
        <div className="flex items-center">
          <div
            className="mr-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: bgColor, color: "hsl(var(--primary-foreground))" }}
          >
            <EditableText
              value={item.initials || item.name.split(" ").map((n) => n[0]).join("")}
              onChange={(v) => handleTestimonialUpdate(index, { initials: v })}
              as="span"
            />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-foreground">
              <EditableText
                value={item.name}
                onChange={(v) => handleTestimonialUpdate(index, { name: v })}
                as="span"
              />
            </h4>
            <p className="text-sm text-muted-foreground">
              <EditableText
                value={item.role}
                onChange={(v) => handleTestimonialUpdate(index, { role: v })}
                as="span"
              />
            </p>
            {hasMetric && (
              <p className="mt-1 text-xs font-medium text-primary/90">
                <EditableText
                  value={item.metricValue}
                  onChange={(v) => handleTestimonialUpdate(index, { metricValue: v })}
                  as="span"
                />
                <span className="text-muted-foreground"> · </span>
                <EditableText
                  value={item.metricLabel}
                  onChange={(v) => handleTestimonialUpdate(index, { metricLabel: v })}
                  as="span"
                />
              </p>
            )}
          </div>
        </div>

        {isEditMode && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-4 text-xs text-muted-foreground">
            <span>Rating:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleTestimonialUpdate(index, { rating: n })}
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium",
                  rating === n ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      className={cn("overflow-hidden py-16 md:py-24", hasCustomBg && "bg-transparent")}
      style={
        hasCustomBg
          ? undefined
          : {
              background:
                "linear-gradient(to bottom right, hsl(var(--muted) / 0.5), hsl(var(--primary) / 0.06))",
            }
      }
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header, badge + title + description (corp badge + exam-prep style body) */}
        <div className="mb-12 text-center md:mb-16">
          {(content.badge || isEditMode) && (
            <div className="mb-4 flex justify-center sm:mb-6">
              <div
                className="inline-block rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wider"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                <EditableText
                  value={content.badge || ""}
                  onChange={(v) => handleContentUpdate("badge", v)}
                  as="span"
                  placeholder="Badge..."
                />
              </div>
            </div>
          )}
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl lg:text-[2.75rem]">
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              as="span"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
            />
          </h2>
          {(content.description || isEditMode) && (
            <p className="mx-auto mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg md:text-xl">
              <EditableText
                value={content.description || ""}
                onChange={(v) => handleContentUpdate("description", v)}
                as="span"
                placeholder="Add a short description..."
              />
            </p>
          )}
        </div>

        {isEditMode ? (
          <>
            <div className="corpupskill-testimonials-edit-row flex gap-4 overflow-x-auto pb-6 snap-x sm:gap-6 sm:pb-8 lg:gap-8">
              {testimonials.map((item, index) => (
                <TestimonialCard key={item.id} item={item} index={index} />
              ))}
            </div>
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={addTestimonial}
                className="inline-flex items-center gap-2 rounded-full border-2 border-dashed px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <Plus className="h-4 w-4" />
                Add Testimonial
              </button>
            </div>
          </>
        ) : (
          <div className="corpupskill-marquee-container relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24"
              style={{ background: "linear-gradient(to right, hsl(var(--background)), transparent)" }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-24"
              style={{ background: "linear-gradient(to left, hsl(var(--background)), transparent)" }}
            />

            <div className="corpupskill-marquee-track flex w-max gap-4 sm:gap-6 lg:gap-8">
              {[...testimonials, ...testimonials].map((item, i) => (
                <TestimonialCard
                  key={`${item.id}-marquee-${i}`}
                  item={item}
                  index={i % testimonials.length}
                />
              ))}
            </div>
          </div>
        )}

        <VideoTestimonials section={section} />
      </div>

      <style>{`
        .corpupskill-testimonials-edit-row { scrollbar-width: none; -ms-overflow-style: none; }
        .corpupskill-testimonials-edit-row::-webkit-scrollbar { display: none; }

        @keyframes corpupskill-marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .corpupskill-marquee-track {
          animation: corpupskill-marquee-scroll 40s linear infinite;
        }
        .corpupskill-marquee-container:hover .corpupskill-marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .corpupskill-marquee-track {
            animation: none;
            flex-wrap: wrap;
            justify-content: center;
            width: 100% !important;
            max-width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
