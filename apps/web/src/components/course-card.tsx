"use client";

import Link from "next/link";
import Image from "next/image";
import { decodeHtmlEntities, isResolvedPrice, isUnavailablePrice } from "@open-mtlms/shared";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePrice } from "@/lib/hooks/use-price";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useCurrencyContext } from "@/components/providers/currency-provider";
import type { CourseListItem } from "@/lib/api";
import { getCourseThumbnailUrl } from "@/lib/api";

const DESCRIPTION_MAX_LENGTH = 120;

function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text || typeof text !== "string") return "";
  const t = decodeHtmlEntities(text).trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trim() + "…";
}

export interface CourseCardProps {
  course: CourseListItem;
  className?: string;
}

export function CourseCard({ course, className }: CourseCardProps) {
  const description = truncate(course.description ?? course.subtitle, DESCRIPTION_MAX_LENGTH);
  const hasAccess = course.has_access === true;
  const priceInr = (course.price_inr ?? (course as { priceInr?: string }).priceInr) ?? null;
  const priceUsd = (course.price_usd ?? (course as { priceUsd?: string }).priceUsd) ?? null;
  const purchaseMode = course.purchase_mode ?? (course as { purchaseMode?: string }).purchaseMode ?? "PAID";
  const extra = course as {
    prices?: Record<string, { amount: number | string; discount?: number | string | null }> | null;
    discount_inr?: string | null;
    discount_usd?: string | null;
  };
  const { isLoaded } = useCurrencyContext();
  const { accessManaged } = useStorefrontConfig();
  const price = usePrice({
    prices: extra.prices ?? null,
    legacyInr: priceInr,
    legacyUsd: priceUsd,
    legacyDiscountInr: extra.discount_inr,
    legacyDiscountUsd: extra.discount_usd,
    purchaseMode,
  });
  const isUnavailable = !hasAccess && isLoaded && isUnavailablePrice(price);
  const priceLabel = hasAccess
    ? "Start Learning"
    : !isLoaded
      ? ""
      : isUnavailablePrice(price)
        ? "Not available for purchase"
        : isResolvedPrice(price)
          ? price.format()
          : "Free";
  // API may return thumbnailUrl (S3 key) instead of thumbnail_key
  const thumbnailKey = course.thumbnail_key ?? (course as { thumbnailUrl?: string }).thumbnailUrl;
  const thumbnailUrl = getCourseThumbnailUrl(thumbnailKey);

  return (
    <Link href={`/courses/${encodeURIComponent(course.slug)}`} className="block focus:outline-none">
      <Card
        className={cn(
          "h-full overflow-hidden transition-all duration-200 hover:border-primary/40 hover:shadow-md",
          className
        )}
      >
        {/* Thumbnail: use resolved URL from thumbnail_key when NEXT_PUBLIC_THUMBNAILS_BASE_URL is set */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={decodeHtmlEntities(course.title)}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <span className="text-4xl font-light tracking-tighter text-muted-foreground/60">
                {decodeHtmlEntities(course.title).charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <CardHeader className="pb-2">
          <h3 className="line-clamp-2 font-semibold leading-tight tracking-tight">
            {decodeHtmlEntities(course.title)}
          </h3>
          {course.subtitle && (
            <p className="line-clamp-1 text-sm text-muted-foreground">{decodeHtmlEntities(course.subtitle)}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {course.duration && <span>{course.duration}</span>}
              {course.difficulty && course.difficulty !== "NONE" && (
                <span> · {course.difficulty}</span>
              )}
            </div>
            {!hasAccess && !isLoaded ? (
              <span className="bg-muted h-4 w-12 animate-pulse rounded" />
            ) : accessManaged && !hasAccess ? null : (
              <span
                className={cn(
                  "text-sm font-medium",
                  hasAccess && "text-green-600 dark:text-green-400",
                  isUnavailable && "text-muted-foreground text-xs font-normal"
                )}
              >
                {priceLabel}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
