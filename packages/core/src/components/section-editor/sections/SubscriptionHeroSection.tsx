"use client";

import type { SectionConfig, SubscriptionHeroContent } from "@open-mtlms/shared";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

interface SubscriptionHeroSectionProps {
  section: SectionConfig;
}

export function SubscriptionHeroSection({ section }: SubscriptionHeroSectionProps) {
  const content = section.content as SubscriptionHeroContent;
  const { EditableText, LinkComponent, isEditMode, updateSectionContent } = useSectionEditor();

  const handleContentUpdate = (key: keyof SubscriptionHeroContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/3 blur-2xl" />
      </div>

      <div className="relative px-4 py-16 sm:px-6 sm:py-20 md:py-28 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm sm:mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Premium Access</span>
          </div>

          {/* Headline */}
          <EditableText
            value={content.headline}
            onChange={(value) => handleContentUpdate("headline", value)}
            styleKey="headline"
            as="h1"
            className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl"
          />

          {/* Subheadline */}
          <div className="mx-auto mt-5 max-w-2xl sm:mt-6">
            <EditableText
              value={content.subheadline}
              onChange={(value) => handleContentUpdate("subheadline", value)}
              styleKey="subheadline"
              as="p"
              className="text-base leading-relaxed text-primary-foreground/80 sm:text-lg md:text-xl"
            />
          </div>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {content.primaryCta && !content.primaryCta.hidden && (
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
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full gap-2 text-sm font-semibold shadow-lg sm:w-auto sm:text-base"
                  asChild={!isEditMode}
                >
                  {isEditMode ? (
                    <EditableText
                      value={content.primaryCta.text}
                      onChange={(value) =>
                        handleContentUpdate("primaryCta", { ...content.primaryCta, text: value })
                      }
                    />
                  ) : (
                    <LinkComponent href={content.primaryCta.href}>
                      {content.primaryCta.text}
                      <ArrowRight className="h-4 w-4" />
                    </LinkComponent>
                  )}
                </Button>
              </EditableClickable>
            )}
            {content.secondaryCta && !content.secondaryCta.hidden && (
              <EditableClickable
                href={content.secondaryCta.href}
                onHrefChange={(href) =>
                  handleContentUpdate("secondaryCta", { ...content.secondaryCta, href })
                }
                hidden={content.secondaryCta.hidden}
                onHiddenChange={(hidden) =>
                  handleContentUpdate("secondaryCta", { ...content.secondaryCta, hidden })
                }
                isEditing={isEditMode}
                slotLabel="Secondary Button"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-primary-foreground/25 bg-primary-foreground/5 text-sm font-semibold text-primary-foreground backdrop-blur-sm hover:bg-primary-foreground/15 sm:w-auto sm:text-base"
                  asChild={!isEditMode}
                >
                  {isEditMode ? (
                    <EditableText
                      value={content.secondaryCta.text}
                      onChange={(value) =>
                        handleContentUpdate("secondaryCta", { ...content.secondaryCta, text: value })
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

          {/* Trust Badges */}
          {content.trustBadges && content.trustBadges.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
              {content.trustBadges.map((badge, index) => (
                <span
                  key={badge.id || index}
                  className="rounded-full border border-primary-foreground/15 bg-primary-foreground/5 px-3.5 py-1.5 text-xs font-medium text-primary-foreground/80 backdrop-blur-sm sm:text-sm"
                >
                  {isEditMode ? (
                    <EditableText
                      value={badge.label}
                      onChange={(value) => {
                        const newBadges = [...(content.trustBadges || [])];
                        newBadges[index] = { ...newBadges[index], label: value };
                        handleContentUpdate("trustBadges", newBadges);
                      }}
                    />
                  ) : (
                    badge.label
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          {content.stats && content.stats.length > 0 && (
            <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-6 border-t border-primary-foreground/10 pt-10 sm:grid-cols-3 sm:gap-8 md:mt-16">
              {content.stats.map((stat, index) => (
                <div key={stat.id || index} className="text-center">
                  <div className="text-2xl font-bold tabular-nums sm:text-3xl md:text-4xl">
                    {isEditMode ? (
                      <EditableText
                        value={stat.value}
                        onChange={(value) => {
                          const newStats = [...(content.stats || [])];
                          newStats[index] = { ...newStats[index], value };
                          handleContentUpdate("stats", newStats);
                        }}
                      />
                    ) : (
                      stat.value
                    )}
                  </div>
                  <div className="mt-1 text-xs text-primary-foreground/60 sm:text-sm">
                    {isEditMode ? (
                      <EditableText
                        value={stat.label}
                        onChange={(value) => {
                          const newStats = [...(content.stats || [])];
                          newStats[index] = { ...newStats[index], label: value };
                          handleContentUpdate("stats", newStats);
                        }}
                      />
                    ) : (
                      stat.label
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
