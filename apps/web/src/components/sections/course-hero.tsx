"use client";

import { discountLabel, hasCustomSectionBackground, isResolvedPrice, isUnavailablePrice, resolvePrice } from "@open-mtlms/shared";
import type { ContentPrice, CourseHeroContent, SectionConfig } from "@open-mtlms/shared";
import { CalendarDays, Clock, Globe, Star, Users, Video, Radio, Layers, Play } from "lucide-react";
import Image from "next/image";
import { SafeLink } from "@open-mtlms/core";

import { Button } from "@/components/ui/button";
import { useCurrencyContext } from "@/lib/hooks/use-currency";
import { cn, decodeHtmlEntities } from "@/lib/utils";

// Simple Badge component for course hero
function Badge({
  children,
  className,
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "secondary"
          ? "bg-secondary text-secondary-foreground"
          : "bg-primary/10 text-primary",
        className
      )}
    >
      {children}
    </span>
  );
}

interface CourseHeroSectionProps {
  section: SectionConfig;
}

const modeConfig = {
  SELF_PACED: {
    icon: Video,
    label: "Self-Paced",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  LIVE: {
    icon: Radio,
    label: "Live Course",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  HYBRID: {
    icon: Layers,
    label: "Hybrid",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
};

// Default content for course hero when not provided
const defaultContent: CourseHeroContent = {
  title: "Course Title",
  subtitle: "Course subtitle goes here",
  thumbnail: "",
  mode: "SELF_PACED",
  duration: "",
  price: 0,
  enrollCta: { text: "Enroll Now", href: "#", variant: "primary" },
};

export function CourseHeroSection({ section }: CourseHeroSectionProps) {
  const rawContent = section.content as CourseHeroContent | undefined;
  const content: CourseHeroContent = rawContent ? { ...defaultContent, ...rawContent } : defaultContent;
  const variant = section.variant;

  const mode = content.mode || "SELF_PACED";
  const ModeIcon = modeConfig[mode]?.icon || Video;
  const modeLabel = modeConfig[mode]?.label || "Course";
  const modeColor = modeConfig[mode]?.color || "";

  const price = content.price || 0;
  const finalPrice =
    content.discount && content.discount > 0
      ? Math.round(price * (1 - content.discount / 100))
      : price;

  const currencySymbol = content.currency === "USD" ? "$" : "₹";

  // Multi-currency: hero content may carry a `prices` array. Resolve under the
  // buyer's currency context; fall back to the legacy single-currency fields
  // while the context loads (keeps SSR markup identical to the old render).
  const { resolvedCurrency, defaultCurrency, enabledCurrencies, isLoaded } = useCurrencyContext();
  const heroPrices = (content as { prices?: ContentPrice[] | null }).prices ?? null;
  const priceResult = isLoaded
    ? resolvePrice(
        {
          prices: heroPrices,
          legacyInr: content.currency === "USD" ? undefined : content.price,
          legacyUsd: content.currency === "USD" ? content.price : undefined,
          legacyDiscountInr: content.currency === "USD" ? undefined : content.discount,
          legacyDiscountUsd: content.currency === "USD" ? content.discount : undefined,
        },
        { resolvedCurrency, defaultCurrency, enabledCurrencies }
      )
    : null;
  const resolvedDisplay = priceResult !== null && isResolvedPrice(priceResult) ? priceResult : null;
  const priceUnavailable = priceResult !== null && isUnavailablePrice(priceResult);
  const showLegacyOriginal =
    !resolvedDisplay && !!content.originalPrice && !!content.discount && content.discount > 0;
  const displayDiscountPct = resolvedDisplay
    ? resolvedDisplay.hasDiscount && resolvedDisplay.original > 0
      ? Math.round((1 - resolvedDisplay.amount / resolvedDisplay.original) * 100)
      : 0
    : content.discount || 0;
  // "₹100 off" for a flat discount, "10% off" for a percentage. Null on the
  // legacy (no resolvedDisplay) path, where the fallback below still applies.
  const savingLabel = resolvedDisplay ? discountLabel(resolvedDisplay) : null;

  const isModern = variant === "modern";
  const isMinimal = variant === "minimal";
  const hasCustomBg = hasCustomSectionBackground(section);

  return (
    <section
      className={cn(
        "section-padding relative overflow-hidden",
        hasCustomBg && "bg-transparent",
        !hasCustomBg && isModern && "from-primary/5 via-background to-accent/5 bg-gradient-to-br"
      )}
    >
      <div className="container-custom">
        <div
          className={cn(
            "flex flex-col gap-8",
            isMinimal
              ? "items-center text-center lg:flex-col"
              : "lg:flex-row lg:items-start lg:gap-12"
          )}
        >
          {/* Left Content */}
          <div className={cn("flex-1 space-y-6", isMinimal && "max-w-2xl")}>
            {/* Breadcrumb / Category */}
            {content.category && (
              <div className="flex items-center gap-2">
                {content.categoryIcon && <span>{content.categoryIcon}</span>}
                <span className="text-primary text-sm font-medium">{content.category}</span>
              </div>
            )}

            {/* Mode Badge */}
            <Badge className={cn("inline-flex items-center gap-1", modeColor)}>
              <ModeIcon className="h-3 w-3" />
              {modeLabel}
            </Badge>

            {/* Title */}
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {decodeHtmlEntities(content.title)}
            </h1>

            {/* Subtitle */}
            <p className="text-muted-foreground text-lg">{decodeHtmlEntities(content.subtitle)}</p>

            {/* Description */}
            {content.description && !isMinimal && (
              <p className="text-muted-foreground">{content.description}</p>
            )}

            {/* Stats Row */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
              {content.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-foreground font-medium">{content.rating}</span>
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
              {/* null = lifetime (render it, it's a selling point); undefined
                  = unspecified (render nothing, as before). */}
              {(content.validityDays === null || (content.validityDays ?? 0) > 0) && (
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {content.validityDays === null
                      ? "Lifetime access"
                      : `Access valid for ${content.validityDays} days`}
                  </span>
                </div>
              )}
            </div>

            {/* Pricing */}
            <div className="flex items-baseline gap-3">
              {priceUnavailable ? (
                <span className="text-muted-foreground text-sm">Not available for purchase</span>
              ) : (
                <>
                  <span className="text-primary text-3xl font-bold">
                    {resolvedDisplay
                      ? resolvedDisplay.format(resolvedDisplay.amount)
                      : `${currencySymbol}${finalPrice.toLocaleString()}`}
                  </span>
                  {(resolvedDisplay ? resolvedDisplay.hasDiscount : showLegacyOriginal) && (
                    <>
                      <span className="text-muted-foreground text-lg line-through">
                        {resolvedDisplay
                          ? resolvedDisplay.format(resolvedDisplay.original)
                          : `${currencySymbol}${(content.originalPrice ?? 0).toLocaleString()}`}
                      </span>
                      {displayDiscountPct > 0 && (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        >
                          {savingLabel ?? `${displayDiscountPct}% OFF`}
                        </Badge>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* CTA */}
            {content.enrollCta && !priceUnavailable && (
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <SafeLink href={content.enrollCta.href}>{content.enrollCta.text}</SafeLink>
              </Button>
            )}
          </div>

          {/* Right - Thumbnail */}
          <div
            className={cn(
              "relative",
              isMinimal ? "w-full max-w-xl" : "w-full lg:w-[45%] lg:max-w-lg"
            )}
          >
            <div className="relative overflow-hidden rounded-xl border shadow-lg">
              {content.thumbnail ? (
                <Image
                  src={content.thumbnail}
                  alt={content.thumbnailAlt || "Course thumbnail"}
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="w-full h-auto"
                />
              ) : (
                <div className="bg-muted flex h-full w-full items-center justify-center">
                  <Video className="text-muted-foreground/50 h-12 w-12" />
                </div>
              )}

              {/* Play button overlay for preview video */}
              {content.previewVideoUrl && (
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
          <div className="bg-primary/5 absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full blur-3xl" />
          <div className="bg-accent/5 absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full blur-3xl" />
        </>
      )}
    </section>
  );
}
