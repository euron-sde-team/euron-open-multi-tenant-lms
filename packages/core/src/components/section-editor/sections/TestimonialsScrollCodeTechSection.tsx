"use client";

import type {
  TestimonialsScrollCodeTechContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

import { useSectionEditor } from "../SectionEditorContext";

import { VideoTestimonials } from "./VideoTestimonials";

interface TestimonialsScrollCodeTechSectionProps {
  section: SectionConfig;
}

export function TestimonialsScrollCodeTechSection({
  section,
}: TestimonialsScrollCodeTechSectionProps) {
  const content = section.content as TestimonialsScrollCodeTechContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    LinkComponent: _LinkComponent,
    fetchTestimonials,
  } = useSectionEditor();

  const { data: testimonials = [] } = useQuery({
    queryKey: ["testimonials", "scroll-section"],
    queryFn: () => fetchTestimonials?.() ?? Promise.resolve([]),
    enabled: !!fetchTestimonials,
    staleTime: 60_000,
  });

  const handleContentUpdate = (
    key: keyof TestimonialsScrollCodeTechContent,
    value: unknown,
  ) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  // Split testimonials into two rows
  const mid = Math.ceil(testimonials.length / 2);
  const topRow = testimonials.slice(0, mid);
  const bottomRow = testimonials.slice(mid);

  const cardLabel = content.cardLabel || "Success Story";

  // Web: hide entirely when no testimonials
  if (!isEditMode && testimonials.length === 0) {
    return null;
  }

  return (
    <section className="relative w-full overflow-hidden bg-background py-10 sm:py-14">
      {/* Header */}
      <div className="relative z-10 mb-8 px-4 text-center sm:mb-10">
        <div className="mb-2">
          <EditableText
            value={content.headline}
            onChange={(v) => handleContentUpdate("headline", v)}
            styleKey="headline"
            style={content.textStyles?.headline}
            onStyleChange={(s) => handleTextStyleChange("headline", s)}
            as="h2"
            className="text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-5xl"
          />
          {(isEditMode || content.headlineAccent) && (
            <EditableText
              value={content.headlineAccent || ""}
              onChange={(v) => handleContentUpdate("headlineAccent", v)}
              styleKey="headlineAccent"
              style={content.textStyles?.headlineAccent}
              onStyleChange={(s) => handleTextStyleChange("headlineAccent", s)}
              as="p"
              className="bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-3xl font-bold italic leading-[1.1] text-transparent sm:text-4xl lg:text-5xl"
             
            />
          )}
        </div>
        {(isEditMode || content.description) && (
          <EditableText
            value={content.description || ""}
            onChange={(v) => handleContentUpdate("description", v)}
            styleKey="description"
            style={content.textStyles?.description}
            onStyleChange={(s) => handleTextStyleChange("description", s)}
            as="p"
            className="mx-auto max-w-[560px] text-sm leading-relaxed text-muted-foreground sm:text-base"
           
          />
        )}
      </div>

      {/* Testimonials */}
      {testimonials.length === 0 ? (
        <div className="py-12" />
      ) : (
        <div className="relative z-10 space-y-4">
          {/* Top row, scrolls left */}
          <ScrollRow items={topRow} direction="left" cardLabel={cardLabel} />
          {/* Bottom row, scrolls right */}
          {bottomRow.length > 0 && (
            <ScrollRow
              items={bottomRow}
              direction="right"
              cardLabel={cardLabel}
            />
          )}
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <VideoTestimonials section={section} />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scrollLeft { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes scrollRight { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
      `,
        }}
      />
    </section>
  );
}

function ScrollRow({
  items,
  direction,
  cardLabel,
}: {
  items: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    memberName: string | null;
    text: string | null;
  }>;
  direction: "left" | "right";
  cardLabel: string;
}) {
  // Duplicate for infinite scroll
  const doubled = [...items, ...items];

  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, black 5%, black 95%, transparent)",
      }}
    >
      <div
        className="flex gap-4 hover:[animation-play-state:paused]"
        style={{
          width: "max-content",
          animation: `scroll${direction === "left" ? "Left" : "Right"} ${Math.max(items.length * 2, 10)}s linear infinite`,
        }}
      >
        {doubled.map((t, i) => (
          <TestimonialCard
            key={`${t.id}-${i}`}
            testimonial={t}
            label={cardLabel}
          />
        ))}
      </div>
    </div>
  );
}

function TestimonialCard({
  testimonial,
  label,
}: {
  testimonial: {
    id: string;
    name: string;
    imageUrl: string | null;
    memberName: string | null;
    text: string | null;
  };
  label: string;
}) {
  const hasImage = !!testimonial.imageUrl;

  return (
    <div className="w-[220px] shrink-0 overflow-hidden rounded-xl border border-border/40 bg-card sm:w-[260px]">
      {/* Image or Text fallback */}
      <div className="relative aspect-[3/4] w-full bg-muted/30">
        {hasImage ? (
          <Image
            src={testimonial.imageUrl!}
            alt={testimonial.memberName || testimonial.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full flex-col justify-between p-4">
            {/* Quote icon */}
            <svg
              className="h-8 w-8 text-primary/40"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11h4v10H0z" />
            </svg>
            {/* Testimonial text */}
            {testimonial.text && (
              <p className="line-clamp-6 text-sm leading-relaxed text-foreground/80">
                {testimonial.text}
              </p>
            )}
            {/* Author name */}
            <p className="mt-auto pt-2 text-xs font-semibold text-foreground">
, {testimonial.memberName || testimonial.name}
            </p>
          </div>
        )}
      </div>
      {/* Label */}
      <div className="flex items-center gap-1.5 border-t border-border/30 px-3 py-2">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
    </div>
  );
}
