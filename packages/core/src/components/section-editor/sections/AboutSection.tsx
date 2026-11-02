"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { AboutContent, SectionConfig } from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

interface AboutSectionProps {
  section: SectionConfig;
}

export function AboutSection({ section }: AboutSectionProps) {
  const content = section.content as AboutContent;
  const { EditableText, EditableMedia, updateSectionContent } =
    useSectionEditor();
  const variant = section.variant;

  const handleContentUpdate = (key: keyof AboutContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleStatUpdate = (index: number, key: string, value: string) => {
    const newStats = [...(content.stats || [])];
    newStats[index] = { ...newStats[index], [key]: value };
    handleContentUpdate("stats", newStats);
  };

  const hasImage =
    (variant === "with-image" || variant === "with-stats") && content.image;
  const imagePosition = content.imagePosition ?? "right";
  const hasStats = variant === "with-stats" && content.stats?.length;
  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "section-padding",
        hasCustomBg ? "bg-transparent" : "bg-muted/30",
      )}
    >
      <div className="container-custom">
        <div
          className={cn(
            "flex flex-col gap-12 lg:gap-16",
            hasImage && "lg:flex-row lg:items-center",
            hasImage && imagePosition === "right" && "lg:flex-row-reverse",
          )}
        >
          {/* Content */}
          <div className={cn("flex-1", hasImage && "lg:flex-1")}>
            <div className="mx-auto max-w-3xl">
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
              <div className="mt-6 text-muted-foreground">
                <EditableText
                  value={content.content}
                  onChange={(value) => handleContentUpdate("content", value)}
                  styleKey="content"
                  as="p"
                  multiline
                  className="text-base leading-relaxed sm:text-lg"
                />
              </div>

              {/* Stats (with-stats variant) */}
              {hasStats && (
                <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3">
                  {content.stats?.map((stat, index) => (
                    <div key={stat.id || index} className="text-center">
                      <div className="text-3xl font-bold text-primary sm:text-4xl">
                        {stat.prefix}
                        <EditableText
                          value={stat.value}
                          onChange={(value) =>
                            handleStatUpdate(index, "value", value)
                          }
                          styleKey={`about-item-${index}-value`}
                          className="inline"
                          inline
                        />
                        {stat.suffix}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Image */}
          {hasImage && (
            <div className="relative w-full flex-shrink-0 lg:w-1/2">
              <EditableMedia
                image={content.image}
                imageAlt="About section image"
                onImageChange={(src) => handleContentUpdate("image", src)}
                onVideoChange={() => {}}
                className="rounded-xl border shadow-lg"
                aspectRatio="video"
                placeholder="Add image"
                recommendedAspectRatio="16:9"
                sectionContext={{
                  sectionType: section.type,
                  headline: content.headline,
                  description: content.subheadline,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
