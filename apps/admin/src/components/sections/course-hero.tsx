"use client";

import { Button, Badge } from "@open-mtlms/core";
import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type { CourseHeroContent, SectionConfig } from "@open-mtlms/shared";
import { Clock, Globe, Star, Users, Video, Radio, Layers, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { EditableImage } from "@/components/editor/editable-image";
import { EditableText } from "@/components/editor/editable-text";
import { useEditMode, useContentEditable } from "@/lib/contexts/edit-mode-context";
import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

interface CourseHeroSectionProps {
  section: SectionConfig;
}

const modeConfig = {
  SELF_PACED: { icon: Video, label: "Self-Paced", color: "bg-primary/10 text-primary" },
  LIVE: { icon: Radio, label: "Live Course", color: "bg-accent/50 text-accent-foreground" },
  HYBRID: { icon: Layers, label: "Hybrid", color: "bg-secondary/50 text-secondary-foreground" },
};

// Default content for course hero when not provided
const defaultContent: CourseHeroContent = {
  title: "Course Title",
  subtitle: "Course subtitle goes here",
  thumbnail: "",
  mode: "SELF_PACED",
  duration: "",
  price: 0,
};

export function CourseHeroSection({ section }: CourseHeroSectionProps) {
  const rawContent = section.content as CourseHeroContent | undefined;
  const content: CourseHeroContent = rawContent ? { ...defaultContent, ...rawContent } : defaultContent;
  const isEditMode = useEditMode();
  const isContentEditable = useContentEditable();
  const { updateSectionContent } = useEditorStore();
  const variant = section.variant;

  const handleContentUpdate = (key: keyof CourseHeroContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const mode = content.mode || "SELF_PACED";
  const ModeIcon = modeConfig[mode]?.icon || Video;
  const modeLabel = modeConfig[mode]?.label || "Course";
  const modeColor = modeConfig[mode]?.color || "";

  const price = content.price || 0;
  const finalPrice = content.discount && content.discount > 0 
    ? Math.round(price * (1 - content.discount / 100)) 
    : price;
  
  const currencySymbol = content.currency === "USD" ? "$" : "₹";

  const isModern = variant === "modern";
  const isMinimal = variant === "minimal";
  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "section-padding relative overflow-hidden",
        hasCustomBg && "bg-transparent",
        !hasCustomBg && isModern && "bg-gradient-to-br from-primary/5 via-background to-accent/5"
      )}
    >
      <div className="container-custom">
        <div className={cn(
          "flex flex-col gap-8",
          isMinimal ? "lg:flex-col items-center text-center" : "lg:flex-row lg:items-start lg:gap-12"
        )}>
          {/* Left Content */}
          <div className={cn("flex-1 space-y-6", isMinimal && "max-w-2xl")}>
            {/* Breadcrumb / Category */}
            {content.category && (
              <div className="flex items-center gap-2">
                {content.categoryIcon && <span>{content.categoryIcon}</span>}
                <span className="text-sm font-medium text-primary">{content.category}</span>
              </div>
            )}

            {/* Mode Badge */}
            <Badge className={cn("inline-flex items-center gap-1", modeColor)}>
              <ModeIcon className="h-3 w-3" />
              {modeLabel}
            </Badge>

            {/* Title */}
            {isContentEditable ? (
              <EditableText
                value={content.title}
                onChange={(value) => handleContentUpdate("title", value)}
                as="h1"
                className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
              />
            ) : (
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {content.title}
              </h1>
            )}

            {/* Subtitle */}
            {isContentEditable ? (
              <EditableText
                value={content.subtitle}
                onChange={(value) => handleContentUpdate("subtitle", value)}
                as="p"
                className="text-lg text-muted-foreground"
              />
            ) : (
              <p className="text-lg text-muted-foreground">{content.subtitle}</p>
            )}

            {/* Description */}
            {content.description && !isMinimal && (
              <p className="text-muted-foreground">
                {isContentEditable ? (
                  <EditableText
                    value={content.description}
                    onChange={(value) => handleContentUpdate("description", value)}
                  />
                ) : (
                  content.description
                )}
              </p>
            )}

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {content.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium text-foreground">{content.rating}</span>
                </div>
              )}
              {content.studentsCount && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{content.studentsCount.toLocaleString()} students</span>
                </div>
              )}
              {content.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{content.duration}</span>
                </div>
              )}
              {content.language && (
                <div className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  <span>{content.language}</span>
                </div>
              )}
            </div>

            {/* Pricing */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                {currencySymbol}{finalPrice.toLocaleString()}
              </span>
              {content.originalPrice && content.discount && content.discount > 0 && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {currencySymbol}{content.originalPrice.toLocaleString()}
                  </span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    {content.discount}% OFF
                  </Badge>
                </>
              )}
            </div>

            {/* CTA */}
            {content.enrollCta && (
              <Button size="lg" className="w-full sm:w-auto" asChild={!isContentEditable}>
                {isContentEditable ? (
                  <EditableText
                    value={content.enrollCta.text}
                    onChange={(value) =>
                      handleContentUpdate("enrollCta", { ...content.enrollCta, text: value })
                    }
                  />
                ) : (
                  <Link href={content.enrollCta.href}>{content.enrollCta.text}</Link>
                )}
              </Button>
            )}
          </div>

          {/* Right - Thumbnail */}
          <div className={cn(
            "relative",
            isMinimal ? "w-full max-w-xl" : "w-full lg:w-[45%] lg:max-w-lg"
          )}>
            <div className="relative overflow-hidden rounded-xl border shadow-lg">
              {isContentEditable ? (
                <EditableImage
                  src={content.thumbnail}
                  alt={content.thumbnailAlt || "Course thumbnail"}
                  onChange={(src, alt) => {
                    handleContentUpdate("thumbnail", src);
                    handleContentUpdate("thumbnailAlt", alt);
                  }}
                  className="w-full h-auto"
                  placeholder="Add course thumbnail"
                />
              ) : content.thumbnail ? (
                <Image
                  src={content.thumbnail}
                  alt={content.thumbnailAlt || "Course thumbnail"}
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="w-full h-auto"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <Video className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}
              
              {/* Play button overlay for preview video */}
              {content.previewVideoUrl && !isEditMode && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                  <Button size="lg" variant="secondary" className="gap-2 rounded-full">
                    <Play className="h-5 w-5" />
                    Preview
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Background decoration for modern variant */}
      {isModern && (
        <>
          <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-accent/5 blur-3xl" />
        </>
      )}
    </section>
  );
}
