"use client";

import type { PricingContent, SectionConfig } from "@open-mtlms/shared";
import {
  BarChart,
  BookOpen,
  Check,
  CreditCard,
  Crown,
  Eye,
  Gem,
  Globe,
  Heart,
  Layers,
  Moon,
  Settings,
  Shield,
  Sparkles,
  Star,
  Sun,
  Target,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { EditableClickable } from "../../editable-clickable/EditableClickable";
import { useSectionEditor } from "../SectionEditorContext";

function CheckIcon({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted)
    return <span className={cn("inline-block h-5 w-5 shrink-0", className)} />;
  return <Check className={className} />;
}

const iconMap: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "credit-card": CreditCard,
  users: Users,
  "bar-chart": BarChart,
  globe: Globe,
  shield: Shield,
  zap: Zap,
  heart: Heart,
  star: Star,
  target: Target,
  layers: Layers,
  settings: Settings,
  sparkles: Sparkles,
  moon: Moon,
  sun: Sun,
  eye: Eye,
  gem: Gem,
  crown: Crown,
};

function ServiceIcon({
  iconName,
  className,
}: {
  iconName: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={cn("h-10 w-10", className)} />;
  const IconComponent = iconMap[iconName] || Sparkles;
  return <IconComponent className={className} />;
}

interface PricingTableSectionProps {
  section: SectionConfig;
}

export function PricingTableSection({ section }: PricingTableSectionProps) {
  const content = section.content as PricingContent;
  const { EditableText, LinkComponent, isEditMode, updateSectionContent } =
    useSectionEditor();

  const handleContentUpdate = (key: keyof PricingContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTierUpdate = (index: number, key: string, value: unknown) => {
    const newTiers = [...(content.tiers || [])];
    newTiers[index] = { ...newTiers[index], [key]: value };
    handleContentUpdate("tiers", newTiers);
  };

  const variant = section.variant;
  const isServiceCards = variant === "service-cards";

  // Defensive: AI-generated or legacy tiers may omit `cta` (or use the flat
  // ctaText/ctaHref shape). The renderer reads tier.cta.{text,href}, so coerce
  // every tier to a valid cta object, otherwise a single bad tier crashes the
  // whole editor with "Cannot read properties of undefined (reading 'href')".
  const safeTiers = (content.tiers ?? []).map((t) => ({
    ...t,
    cta:
      t.cta && typeof t.cta === "object"
        ? t.cta
        : {
            text:
              (t as { ctaText?: string }).ctaText ?? "Get Started",
            href: (t as { ctaHref?: string }).ctaHref ?? "#",
            hidden: false,
          },
  }));

  if (isServiceCards) {
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

          {/* Service Cards Grid */}
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {safeTiers.map((tier, index) => (
              <div
                key={tier.id || index}
                className={cn(
                  "group relative flex flex-col items-center rounded-2xl border bg-card p-8 text-center transition-all hover:shadow-xl hover:border-accent",
                  tier.highlighted &&
                    "bg-gradient-to-br from-primary to-accent text-primary-foreground border-0",
                )}
              >
                {/* Icon */}
                {tier.icon && (
                  <div
                    className={cn(
                      "mb-6 flex h-16 w-16 items-center justify-center rounded-2xl",
                      tier.highlighted
                        ? "bg-primary-foreground/20"
                        : "bg-primary/10",
                    )}
                  >
                    <ServiceIcon
                      iconName={tier.icon}
                      className={cn(
                        "h-8 w-8",
                        tier.highlighted
                          ? "text-primary-foreground"
                          : "text-primary",
                      )}
                    />
                  </div>
                )}

                {/* Name */}
                <EditableText
                  value={tier.name}
                  onChange={(value) => handleTierUpdate(index, "name", value)}
                  styleKey={`tier-${index}-name`}
                  as="h3"
                  className="text-xl font-semibold"
                />

                {/* Description */}
                {tier.description && (
                  <p
                    className={cn(
                      "mt-2",
                      tier.highlighted
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground",
                    )}
                  >
                    <EditableText
                      value={tier.description}
                      onChange={(value) =>
                        handleTierUpdate(index, "description", value)
                      }
                      styleKey={`tier-${index}-description`}
                    />
                  </p>
                )}

                {/* Price */}
                <div className="mt-6">
                  <span className="text-3xl font-bold">
                    <EditableText
                      value={tier.price}
                      onChange={(value) =>
                        handleTierUpdate(index, "price", value)
                      }
                      styleKey={`tier-${index}-price`}
                      className="inline"
                    />
                  </span>
                  {tier.period && (
                    <span
                      className={cn(
                        tier.highlighted
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {tier.period}
                    </span>
                  )}
                </div>

                {/* CTA */}
                <EditableClickable
                  href={tier.cta.href}
                  onHrefChange={(href) =>
                    handleTierUpdate(index, "cta", { ...tier.cta, href })
                  }
                  hidden={tier.cta.hidden}
                  onHiddenChange={(hidden) =>
                    handleTierUpdate(index, "cta", { ...tier.cta, hidden })
                  }
                  isEditing={isEditMode}
                  slotLabel={`${tier.name} CTA`}
                >
                  <Button
                    className={cn(
                      "mt-6 w-full",
                      tier.highlighted &&
                        "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
                    )}
                    variant={tier.highlighted ? "secondary" : "outline"}
                    size="lg"
                    asChild={!isEditMode}
                  >
                    {isEditMode ? (
                      <EditableText
                        value={tier.cta.text}
                        onChange={(value) =>
                          handleTierUpdate(index, "cta", {
                            ...tier.cta,
                            text: value,
                          })
                        }
                      />
                    ) : (
                      <LinkComponent href={tier.cta.href}>
                        {tier.cta.text}
                      </LinkComponent>
                    )}
                  </Button>
                </EditableClickable>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default pricing table
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

        {/* Pricing Cards */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {safeTiers.map((tier, index) => (
            <div
              key={tier.id || index}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-8",
                tier.highlighted &&
                  "border-primary shadow-lg ring-1 ring-primary",
              )}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
                    {tier.badge}
                  </span>
                </div>
              )}

              {/* Tier name */}
              <EditableText
                value={tier.name}
                onChange={(value) => handleTierUpdate(index, "name", value)}
                styleKey={`tier-${index}-name`}
                as="h3"
                className="text-xl font-semibold"
              />

              {/* Description */}
              {tier.description && (
                <p className="mt-2 text-muted-foreground">
                  <EditableText
                    value={tier.description}
                    onChange={(value) =>
                      handleTierUpdate(index, "description", value)
                    }
                    styleKey={`tier-${index}-description`}
                  />
                </p>
              )}

              {/* Price */}
              <div className="mt-6">
                <span className="text-4xl font-bold">
                  <EditableText
                    value={tier.price}
                    onChange={(value) =>
                      handleTierUpdate(index, "price", value)
                    }
                    styleKey={`tier-${index}-price`}
                    className="inline"
                  />
                </span>
                {tier.period && (
                  <span className="text-muted-foreground">{tier.period}</span>
                )}
              </div>

              {/* Features */}
              <ul className="mt-8 flex-1 space-y-4">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <CheckIcon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-muted-foreground">
                      <EditableText
                        value={feature}
                        onChange={(value) => {
                          const newFeatures = [...tier.features];
                          newFeatures[featureIndex] = value;
                          handleTierUpdate(index, "features", newFeatures);
                        }}
                        styleKey={`tier-${index}-feature-${featureIndex}`}
                      />
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <EditableClickable
                href={tier.cta.href}
                onHrefChange={(href) =>
                  handleTierUpdate(index, "cta", { ...tier.cta, href })
                }
                hidden={tier.cta.hidden}
                onHiddenChange={(hidden) =>
                  handleTierUpdate(index, "cta", { ...tier.cta, hidden })
                }
                isEditing={isEditMode}
                slotLabel={`${tier.name} CTA`}
              >
                <Button
                  className="mt-8 w-full"
                  variant={tier.highlighted ? "default" : "outline"}
                  size="lg"
                  asChild={!isEditMode}
                >
                  {isEditMode ? (
                    <EditableText
                      value={tier.cta.text}
                      onChange={(value) =>
                        handleTierUpdate(index, "cta", {
                          ...tier.cta,
                          text: value,
                        })
                      }
                    />
                  ) : (
                    <LinkComponent href={tier.cta.href}>
                      {tier.cta.text}
                    </LinkComponent>
                  )}
                </Button>
              </EditableClickable>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
