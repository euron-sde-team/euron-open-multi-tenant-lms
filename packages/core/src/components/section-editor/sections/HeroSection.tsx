"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { HeroContent, SectionConfig } from "@open-mtlms/shared";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface HeroSectionProps {
  section: SectionConfig;
}

export function HeroSection({ section }: HeroSectionProps) {
  const content = section.content as HeroContent;
  const {
    EditableText,
    EditableMedia,
    LinkComponent,
    isEditMode,
    updateSectionContent,
  } = useSectionEditor();

  const handleContentUpdate = (key: keyof HeroContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "section-padding relative grid min-h-[100svh] items-center overflow-hidden",
        hasCustomBg && "bg-transparent",
      )}
    >
      <div className="container-custom">
        <div className="flex flex-col items-center gap-8">
          {/* Content */}
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            {content.badge && (
              <span className="mb-4 inline-block rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium text-primary-foreground">
                {isEditMode ? (
                  <EditableText
                    value={content.badge}
                    onChange={(value) => handleContentUpdate("badge", value)}
                  />
                ) : (
                  content.badge
                )}
              </span>
            )}

            {/* Headline */}
            <EditableText
              value={content.headline}
              onChange={(value) => handleContentUpdate("headline", value)}
              styleKey="headline"
              as="h1"
              className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            />

            {/* Subheadline */}
            <EditableText
              value={content.subheadline}
              onChange={(value) => handleContentUpdate("subheadline", value)}
              styleKey="subheadline"
              as="p"
              className="mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl"
            />

            {/* Description */}
            {content.description && (
              <p className="mt-4 max-w-2xl text-muted-foreground">
                <EditableText
                  value={content.description}
                  onChange={(value) =>
                    handleContentUpdate("description", value)
                  }
                  styleKey="description"
                />
              </p>
            )}

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              {content.primaryCta && !content.primaryCta.hidden && (
                <EditableClickable
                  href={content.primaryCta.href}
                  onHrefChange={(href) =>
                    handleContentUpdate("primaryCta", {
                      ...content.primaryCta,
                      href,
                    })
                  }
                  hidden={content.primaryCta.hidden}
                  onHiddenChange={(hidden) =>
                    handleContentUpdate("primaryCta", {
                      ...content.primaryCta,
                      hidden,
                    })
                  }
                  isEditing={isEditMode}
                  slotLabel="Primary Button"
                >
                  <Button size="lg" asChild={!isEditMode}>
                    {isEditMode ? (
                      <EditableText
                        value={content.primaryCta.text}
                        onChange={(value) =>
                          handleContentUpdate("primaryCta", {
                            ...content.primaryCta,
                            text: value,
                          })
                        }
                      />
                    ) : (
                      <LinkComponent href={content.primaryCta.href}>
                        {content.primaryCta.text}
                      </LinkComponent>
                    )}
                  </Button>
                </EditableClickable>
              )}
              {content.secondaryCta && !content.secondaryCta.hidden && (
                <EditableClickable
                  href={content.secondaryCta.href}
                  onHrefChange={(href) =>
                    handleContentUpdate("secondaryCta", {
                      ...content.secondaryCta,
                      href,
                    })
                  }
                  hidden={content.secondaryCta.hidden}
                  onHiddenChange={(hidden) =>
                    handleContentUpdate("secondaryCta", {
                      ...content.secondaryCta,
                      hidden,
                    })
                  }
                  isEditing={isEditMode}
                  slotLabel="Secondary Button"
                >
                  <Button size="lg" variant="outline" asChild={!isEditMode}>
                    {isEditMode ? (
                      <EditableText
                        value={content.secondaryCta.text}
                        onChange={(value) =>
                          handleContentUpdate("secondaryCta", {
                            ...content.secondaryCta,
                            text: value,
                          })
                        }
                      />
                    ) : (
                      <LinkComponent href={content.secondaryCta.href}>
                        {content.secondaryCta.text}
                      </LinkComponent>
                    )}
                  </Button>
                </EditableClickable>
              )}
            </div>

            {/* Stats */}
            {content.stats && content.stats.length > 0 && (
              <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:gap-8">
                {content.stats.map((stat, index) => (
                  <div key={stat.id || index} className="text-center">
                    <div className="text-2xl font-bold sm:text-3xl">
                      {stat.prefix}
                      <EditableText
                        value={stat.value}
                        onChange={(value) => {
                          const newStats = [...(content.stats || [])];
                          newStats[index] = { ...newStats[index], value };
                          handleContentUpdate("stats", newStats);
                        }}
                        styleKey={`stat-${index}-value`}
                        className="inline"
                        inline
                      />
                      {stat.suffix}
                    </div>
                    <div className="mt-1 text-sm opacity-80">
                      <EditableText
                        value={stat.label}
                        onChange={(value) => {
                          const newStats = [...(content.stats || [])];
                          newStats[index] = {
                            ...newStats[index],
                            label: value,
                          };
                          handleContentUpdate("stats", newStats);
                        }}
                        styleKey={`stat-${index}-label`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Media (Image and/or Video) */}
          <div className="relative w-full max-w-4xl">
            <EditableMedia
              image={content.image}
              imageAlt={content.imageAlt}
              videoUrl={content.videoUrl}
              onImageChange={(src, alt) => {
                handleContentUpdate("image", src);
                handleContentUpdate("imageAlt", alt);
              }}
              onVideoChange={(url) => handleContentUpdate("videoUrl", url)}
              className="rounded-lg border shadow-2xl"
              aspectRatio="video"
              placeholder="Click to add hero image or video"
              recommendedAspectRatio="16:9"
              sectionContext={{
                sectionType: section.type,
                headline: content.headline,
                description: content.description,
                badge: content.badge,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
