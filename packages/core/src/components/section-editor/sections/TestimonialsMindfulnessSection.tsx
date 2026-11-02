"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  TestimonialsMindfulnessContent,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

import { VideoTestimonials } from "./VideoTestimonials";

interface TestimonialsMindfulnessSectionProps {
  section: SectionConfig;
}

export function TestimonialsMindfulnessSection({ section }: TestimonialsMindfulnessSectionProps) {
  const content = section.content as TestimonialsMindfulnessContent;
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
  } = useSectionEditor();

  const handleContentUpdate = (key: keyof TestimonialsMindfulnessContent, value: unknown) => {
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
  const testimonials = content.testimonials ?? [];

  return (
    <section className={cn("relative py-12 sm:py-16 md:py-20 lg:py-24", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom">
        {/* Header */}
        <div className="mb-8 text-center sm:mb-10 lg:mb-16">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0 sm:gap-x-3">
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
              as="h2"
              className="text-3xl font-bold sm:text-4xl md:text-5xl lg:text-[3.75rem]"
            />
            {(content.headlineAccent || isEditMode) && (
              <EditableText
                value={content.headlineAccent ?? ""}
                onChange={(v) => handleContentUpdate("headlineAccent", v)}
                styleKey="headlineAccent"
                style={content.textStyles?.headlineAccent}
                onStyleChange={(s) => handleTextStyleChange("headlineAccent", s)}
                as="span"
                className="text-3xl font-bold text-primary sm:text-4xl md:text-5xl lg:text-[3.75rem]"
                placeholder="accent"
              />
            )}
          </div>
          {(content.description || isEditMode) && (
            <div className="mt-3 sm:mt-4">
              <EditableText
                value={content.description ?? ""}
                onChange={(v) => handleContentUpdate("description", v)}
                styleKey="description"
                style={content.textStyles?.description}
                onStyleChange={(s) => handleTextStyleChange("description", s)}
                as="p"
                className="mx-auto max-w-2xl text-base font-light text-muted-foreground sm:text-lg"
                placeholder="Add a description..."
              />
            </div>
          )}
        </div>

        {/* ── Edit mode: static scrollable row + add button below ── */}
        {isEditMode ? (
          <>
            <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-6 snap-x sm:gap-6 sm:pb-8 lg:gap-8">
              {testimonials.map((item, i) => (
                <TestimonialCard
                  key={item.id}
                  item={item}
                  index={i}
                  testimonials={testimonials}
                  isEditMode
                  EditableText={EditableText}
                  handleContentUpdate={handleContentUpdate}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-center">
              <button
                className="inline-flex items-center gap-2 rounded-full border-2 border-dashed px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                style={{ borderColor: "hsl(var(--border))" }}
                onClick={() =>
                  handleContentUpdate("testimonials", [
                    ...testimonials,
                    { id: `testimonial-${Date.now()}`, name: "New Person", role: "learner" as const, quote: "Add a testimonial quote here.", rating: 5 },
                  ])
                }
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Testimonial
              </button>
            </div>
          </>
        ) : (
          /* ── Live mode: infinite marquee ── */
          <div className="marquee-container relative overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-24" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-24" />

            <div className="marquee-track flex w-max gap-4 sm:gap-6 lg:gap-8">
              {[...testimonials, ...testimonials].map((item, i) => (
                <TestimonialCard
                  key={`${item.id}-${i}`}
                  item={item}
                  index={i % testimonials.length}
                  testimonials={testimonials}
                  isEditMode={false}
                  EditableText={EditableText}
                  handleContentUpdate={handleContentUpdate}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <VideoTestimonials section={section} />
      </div>

      <style>{`
        .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }

        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marquee-scroll 30s linear infinite;
        }
        .marquee-container:hover .marquee-track {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}

function TestimonialCard({
  item,
  index,
  testimonials,
  isEditMode,
  EditableText,
  handleContentUpdate,
}: {
  item: NonNullable<TestimonialsMindfulnessContent["testimonials"]>[number];
  index: number;
  testimonials: NonNullable<TestimonialsMindfulnessContent["testimonials"]>;
  isEditMode: boolean;
  EditableText: ReturnType<typeof useSectionEditor>["EditableText"];
  handleContentUpdate: (key: keyof TestimonialsMindfulnessContent, value: unknown) => void;
}) {
  return (
    <div
      className="min-w-[280px] max-w-[360px] flex-shrink-0 rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 sm:min-w-[320px] sm:max-w-[400px] sm:rounded-[2rem] sm:p-8 md:min-w-[380px] lg:p-10"
      style={{
        background: "hsl(var(--background) / 0.8)",
        borderColor: "hsl(var(--border) / 0.5)",
      }}
    >
      {/* Role badge */}
      <div className="mb-4 sm:mb-6">
        <span
          className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase sm:text-xs"
          style={{
            background: item.role === "instructor" ? "hsl(var(--primary) / 0.1)" : "hsl(var(--accent))",
            color: item.role === "instructor" ? "hsl(var(--primary))" : "hsl(var(--accent-foreground))",
          }}
        >
          {isEditMode ? (
            <EditableText
              value={item.role}
              onChange={(v: string) => {
                const newItems = [...testimonials];
                newItems[index] = { ...newItems[index], role: v as "learner" | "instructor" };
                handleContentUpdate("testimonials", newItems);
              }}
              as="span"
            />
          ) : (
            item.role
          )}
        </span>
      </div>

      {/* Avatar + name */}
      <div className="mb-4 flex items-center gap-3 sm:mb-6 sm:gap-4 lg:mb-8">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-lg sm:h-14 sm:w-14 sm:rounded-2xl sm:text-lg lg:h-16 lg:w-16"
          style={{
            background: "hsl(var(--primary) / 0.15)",
            color: "hsl(var(--primary))",
          }}
        >
          {item.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <EditableText
            value={item.name}
            onChange={(v: string) => {
              const newItems = [...testimonials];
              newItems[index] = { ...newItems[index], name: v };
              handleContentUpdate("testimonials", newItems);
            }}
            as="h4"
            className="truncate text-base font-bold sm:text-lg"
          />
          {item.rating && (
            <div className="mt-1 flex gap-0.5 sm:gap-1">
              {Array.from({ length: item.rating }).map((_, s) => (
                <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill="hsl(45 93% 47%)" stroke="none" className="sm:h-3.5 sm:w-3.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quote */}
      <EditableText
        value={item.quote}
        onChange={(v: string) => {
          const newItems = [...testimonials];
          newItems[index] = { ...newItems[index], quote: v };
          handleContentUpdate("testimonials", newItems);
        }}
        as="p"
        className="text-sm italic leading-relaxed text-muted-foreground sm:text-base lg:text-lg"
        multiline
      />

      {isEditMode && testimonials.length > 1 && (
        <button
          className="mt-4 text-xs text-muted-foreground/50 hover:text-destructive"
          onClick={() => handleContentUpdate("testimonials", testimonials.filter((_, j) => j !== index))}
        >
          Remove
        </button>
      )}
    </div>
  );
}
