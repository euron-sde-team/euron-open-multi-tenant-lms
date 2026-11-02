"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { FeaturesContent, SectionConfig } from "@open-mtlms/shared";
import {
  BarChart,
  BookOpen,
  CreditCard,
  Globe,
  Heart,
  Layers,
  Settings,
  Shield,
  Star,
  Target,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "../../../lib/utils";
import { useSectionEditor } from "../SectionEditorContext";

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
};

function FeatureIcon({
  iconName,
  className,
}: {
  iconName: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={cn("h-6 w-6", className)} />;
  const IconComponent = iconMap[iconName] || Star;
  return <IconComponent className={className} />;
}

interface FeaturesGridSectionProps {
  section: SectionConfig;
}

export function FeaturesGridSection({ section }: FeaturesGridSectionProps) {
  const content = section.content as FeaturesContent;
  const { EditableText, updateSectionContent } = useSectionEditor();
  const variant = section.variant;

  const handleContentUpdate = (key: keyof FeaturesContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleFeatureUpdate = (index: number, key: string, value: string) => {
    const newFeatures = [...(content.features || [])];
    newFeatures[index] = { ...newFeatures[index], [key]: value };
    handleContentUpdate("features", newFeatures);
  };

  const gridCols = variant === "4-col" ? "lg:grid-cols-4" : "lg:grid-cols-3";
  const isIconLeft = variant === "icon-left";
  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "section-padding",
        hasCustomBg ? "bg-transparent" : "bg-muted/30",
      )}
    >
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
                onChange={(value) => handleContentUpdate("subheadline", value)}
                styleKey="subheadline"
              />
            </p>
          )}
        </div>

        {/* Features Grid */}
        <div className={cn("mt-16 grid gap-8 sm:grid-cols-2", gridCols)}>
          {content.features?.map((feature, index) => (
            <div
              key={feature.id || index}
              className={cn(
                "group relative rounded-lg border bg-card p-6 transition-all hover:shadow-lg",
                isIconLeft && "flex gap-4",
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary",
                  !isIconLeft && "mb-4",
                )}
              >
                <FeatureIcon
                  iconName={feature.icon || "star"}
                  className="h-6 w-6"
                />
              </div>

              {/* Content */}
              <div className={cn(isIconLeft && "flex-1")}>
                <EditableText
                  value={feature.title}
                  onChange={(value) =>
                    handleFeatureUpdate(index, "title", value)
                  }
                  styleKey={`feature-${index}-title`}
                  as="h3"
                  className="text-lg font-semibold"
                />
                <EditableText
                  value={feature.description}
                  onChange={(value) =>
                    handleFeatureUpdate(index, "description", value)
                  }
                  styleKey={`feature-${index}-description`}
                  as="p"
                  className="mt-2 text-muted-foreground"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
