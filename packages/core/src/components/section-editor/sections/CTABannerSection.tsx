"use client";

import type { CTAContent, SectionConfig } from "@open-mtlms/shared";
import { Clock, Mail, Shield, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

const trustIconMap: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  mail: Mail,
  shield: Shield,
  clock: Clock,
  star: Star,
  sparkles: Sparkles,
};

function TrustIcon({
  iconName,
  className,
}: {
  iconName: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className={cn("inline-block h-5 w-5", className)} />;
  const IconComponent = trustIconMap[iconName] || Shield;
  return <IconComponent className={className} />;
}

interface CTABannerSectionProps {
  section: SectionConfig;
}

export function CTABannerSection({ section }: CTABannerSectionProps) {
  const content = section.content as CTAContent;
  const {
    EditableText,
    LinkComponent,
    isEditMode,
    updateSectionContent,
  } = useSectionEditor();
  const variant = section.variant;

  const handleContentUpdate = (key: keyof CTAContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const isGradient = variant === "gradient";

  if (variant === "newsletter") {
    return (
      <section
        className="section-padding relative overflow-hidden text-primary-foreground"
        style={{
          background:
            "linear-gradient(to bottom right, hsl(var(--primary) / 0.9), hsl(var(--accent) / 0.8), hsl(var(--primary) / 0.95))",
        }}
      >
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <EditableText
              value={content.headline}
              onChange={(value) => handleContentUpdate("headline", value)}
              styleKey="headline"
              as="h2"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            />
            {content.subheadline && (
              <p className="mt-4 text-lg text-primary-foreground/90">
                <EditableText
                  value={content.subheadline}
                  onChange={(value) =>
                    handleContentUpdate("subheadline", value)
                  }
                  styleKey="subheadline"
                />
              </p>
            )}

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <input
                type="email"
                disabled={isEditMode}
                placeholder={content.emailPlaceholder || "Enter your email"}
                className="h-12 w-full max-w-sm rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-4 text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30 disabled:cursor-default"
              />
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
                  <Button
                    size="lg"
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    asChild={!isEditMode}
                  >
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
            </div>

            {content.benefits && content.benefits.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {content.benefits.map((benefit, index) => (
                  <span
                    key={index}
                    className="rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-sm text-primary-foreground/90"
                  >
                    {isEditMode ? (
                      <EditableText
                        value={benefit}
                        onChange={(value) => {
                          const newBenefits = [...(content.benefits || [])];
                          newBenefits[index] = value;
                          handleContentUpdate("benefits", newBenefits);
                        }}
                      />
                    ) : (
                      benefit
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-accent/10 blur-3xl" />
      </section>
    );
  }

  if (variant === "hero-cta") {
    return (
      <section
        className="section-padding relative overflow-hidden text-primary-foreground"
        style={{
          background:
            "linear-gradient(to bottom right, hsl(var(--primary) / 0.9), hsl(var(--accent) / 0.8), hsl(var(--primary) / 0.95))",
        }}
      >
        {content.image && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10"
            style={{ backgroundImage: `url(${content.image})` }}
          />
        )}

        <div className="container-custom relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <EditableText
              value={content.headline}
              onChange={(value) => handleContentUpdate("headline", value)}
              styleKey="headline"
              as="h2"
              className="text-4xl font-bold tracking-tight sm:text-5xl"
            />
            {content.subheadline && (
              <p className="mt-6 text-lg text-primary-foreground/90 sm:text-xl">
                <EditableText
                  value={content.subheadline}
                  onChange={(value) =>
                    handleContentUpdate("subheadline", value)
                  }
                  styleKey="subheadline"
                />
              </p>
            )}

            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
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
                  <Button
                    size="lg"
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    asChild={!isEditMode}
                  >
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
                  <Button
                    size="lg"
                    variant="outline"
                    className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                    asChild={!isEditMode}
                  >
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

            {content.trustBadges && content.trustBadges.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
                {content.trustBadges.map((badge, index) => (
                  <div
                    key={badge.id || index}
                    className="flex items-center gap-2 text-primary-foreground/80"
                  >
                    <TrustIcon iconName={badge.icon} className="h-5 w-5" />
                    <span className="text-sm">
                      {isEditMode ? (
                        <EditableText
                          value={badge.label}
                          onChange={(value) => {
                            const newBadges = [
                              ...(content.trustBadges || []),
                            ];
                            newBadges[index] = {
                              ...newBadges[index],
                              label: value,
                            };
                            handleContentUpdate("trustBadges", newBadges);
                          }}
                        />
                      ) : (
                        badge.label
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-accent/10 blur-3xl" />
      </section>
    );
  }

  // Default / gradient variant
  return (
    <section
      className={cn(
        "section-padding",
        isGradient
          ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
          : "bg-muted",
      )}
    >
      <div className="container-custom">
        <div className="mx-auto max-w-3xl text-center">
          <EditableText
            value={content.headline}
            onChange={(value) => handleContentUpdate("headline", value)}
            styleKey="headline"
            as="h2"
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          />
          {content.subheadline && (
            <p
              className={cn(
                "mt-4 text-lg",
                isGradient
                  ? "text-primary-foreground/90"
                  : "text-muted-foreground",
              )}
            >
              <EditableText
                value={content.subheadline}
                onChange={(value) =>
                  handleContentUpdate("subheadline", value)
                }
                styleKey="subheadline"
              />
            </p>
          )}
          {content.description && (
            <p
              className={cn(
                "mt-4",
                isGradient
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground",
              )}
            >
              <EditableText
                value={content.description}
                onChange={(value) =>
                  handleContentUpdate("description", value)
                }
                styleKey="description"
              />
            </p>
          )}

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
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
                <Button
                  size="lg"
                  variant={isGradient ? "secondary" : "default"}
                  asChild={!isEditMode}
                >
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
                <Button
                  size="lg"
                  variant="outline"
                  className={cn(
                    isGradient &&
                      "bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10",
                  )}
                  asChild={!isEditMode}
                >
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
        </div>
      </div>
    </section>
  );
}
