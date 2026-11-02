"use client";

import type { SectionConfig, TestimonialsContent } from "@open-mtlms/shared";
import { Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";
import { VideoTestimonials } from "./VideoTestimonials";

interface TestimonialsGridSectionProps {
  section: SectionConfig;
}

function ClientIcon({
  icon: Icon,
  className,
}: {
  icon: typeof Star;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className={cn("inline-block", className)} />;
  return <Icon className={className} />;
}

export function TestimonialsGridSection({
  section,
}: TestimonialsGridSectionProps) {
  const content = section.content as TestimonialsContent;
  const { EditableText, EditableImage, isEditMode, updateSectionContent } =
    useSectionEditor();
  const variant = section.variant;

  const handleContentUpdate = (
    key: keyof TestimonialsContent,
    value: unknown,
  ) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTestimonialUpdate = (
    index: number,
    key: string,
    value: string,
  ) => {
    const newTestimonials = [...(content.testimonials || [])];
    newTestimonials[index] = { ...newTestimonials[index], [key]: value };
    handleContentUpdate("testimonials", newTestimonials);
  };

  const isMasonry = variant === "masonry";

  return (
    <section className="section-padding">
      <div className="container-custom">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <EditableText
            value={content.headline}
            onChange={(value) => handleContentUpdate("headline", value)}
            styleKey="headline"
            as="h2"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          />
          {content.subheadline && (
            <p className="mt-4 text-lg text-muted-foreground">
              <EditableText
                value={content.subheadline}
                onChange={(value) =>
                  handleContentUpdate("subheadline", value)
                }
                styleKey="subheadline"
              />
            </p>
          )}
        </div>

        {/* Testimonials Grid */}
        <div
          className={cn(
            "mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
            isMasonry && "items-start",
          )}
        >
          {content.testimonials?.map((testimonial, index) => (
            <div
              key={testimonial.id || index}
              className={cn(
                "relative rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md",
                isMasonry && index % 3 === 1 && "lg:mt-8",
              )}
            >
              {/* Quote icon */}
              <ClientIcon
                icon={Quote}
                className="absolute right-6 top-6 h-8 w-8 text-primary/10"
              />

              {/* Rating */}
              {testimonial.rating && (
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <ClientIcon
                      key={i}
                      icon={Star}
                      className={cn(
                        "h-4 w-4",
                        i < testimonial.rating!
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted",
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Quote */}
              <EditableText
                value={testimonial.quote}
                onChange={(value) =>
                  handleTestimonialUpdate(index, "quote", value)
                }
                styleKey={`testimonial-${index}-quote`}
                as="p"
                className="text-muted-foreground"
              />

              {/* Author */}
              <div className="mt-6 flex items-center gap-4">
                {isEditMode ? (
                  <EditableImage
                    src={testimonial.avatar || ""}
                    alt={testimonial.author}
                    onChange={(src) =>
                      handleTestimonialUpdate(index, "avatar", src)
                    }
                    className="h-12 w-12 rounded-full"
                    aspectRatio="square"
                    placeholder={testimonial.author.charAt(0)}
                  />
                ) : testimonial.avatar ? (
                  <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.author}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {testimonial.author.charAt(0)}
                  </div>
                )}
                <div>
                  <EditableText
                    value={testimonial.author}
                    onChange={(value) =>
                      handleTestimonialUpdate(index, "author", value)
                    }
                    styleKey={`testimonial-${index}-author`}
                    className="font-semibold"
                  />
                  <p className="text-sm text-muted-foreground">
                    <EditableText
                      value={testimonial.role}
                      onChange={(value) =>
                        handleTestimonialUpdate(index, "role", value)
                      }
                      styleKey={`testimonial-${index}-role`}
                    />
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Video Testimonials */}
        <VideoTestimonials section={section} />

        {/* Summary Stats Bar */}
        {variant === "with-stats" &&
          content.summaryStats &&
          content.summaryStats.length > 0 && (
            <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-8 rounded-2xl bg-muted px-8 py-6 sm:divide-x sm:divide-border">
              {content.summaryStats.map((stat, index) => (
                <div key={stat.id || index} className="px-6 text-center">
                  <div className="text-2xl font-bold sm:text-3xl">
                    {stat.prefix}
                    <EditableText
                      value={stat.value}
                      onChange={(value) => {
                        const newStats = [...(content.summaryStats || [])];
                        newStats[index] = { ...newStats[index], value };
                        handleContentUpdate("summaryStats", newStats);
                      }}
                      styleKey={`summaryStats-${index}-value`}
                      className="inline"
                      inline
                    />
                    {stat.suffix}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <EditableText
                      value={stat.label}
                      onChange={(value) => {
                        const newStats = [...(content.summaryStats || [])];
                        newStats[index] = { ...newStats[index], label: value };
                        handleContentUpdate("summaryStats", newStats);
                      }}
                      styleKey={`summaryStats-${index}-label`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </section>
  );
}
