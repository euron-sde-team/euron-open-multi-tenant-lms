"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  ContentListingContent,
  ContentListingItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "../../../lib/utils";
import { usePreferredCurrency } from "../../../hooks";
import { useSectionEditor } from "../SectionEditorContext";
import { SampleContentBadge } from "./SampleContentBadge";
import { getSampleContentItems } from "./sample-content-items";

interface CoursesListingPhotographySectionProps {
  section: SectionConfig;
}

/* ── Difficulty label map ── */
const difficultyLabels: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  EXPERT: "Expert",
  ALL_LEVELS: "All Levels",
};

/* ── Mode label map ── */
const modeLabels: Record<string, string> = {
  SELF_PACED: "Self-Paced",
  LIVE: "Live",
  HYBRID: "Hybrid",
};

/* ── Price helpers ── */
function parsePrice(price: string | null | undefined): number {
  if (!price) return 0;
  return typeof price === "string" ? parseFloat(price) || 0 : Number(price);
}

function computeFinalPrice(price: number, discount: number): number {
  if (discount > 0) return Math.round(price * (1 - discount / 100));
  return price;
}

/**
 * Access-managed storefront: the renderer's resolveItemPriceParts returns the
 * HIDDEN_PRICE sentinel for every item, render no price text (this section
 * computes prices from raw legacy fields, so it must check explicitly).
 */
function useHiddenPrice(item: ContentListingItem): boolean {
  const { resolveItemPriceParts } = useSectionEditor();
  if (!resolveItemPriceParts) return false;
  const parts = resolveItemPriceParts(item);
  return !!parts && "hidden" in parts && parts.hidden === true;
}



/* ── Single course card ── */
function PhotographyCourseCard({
  item,
  currency,
  onItemClick,
  onContinue,
}: {
  item: ContentListingItem;
  currency: "INR" | "USD";
  onItemClick?: (item: { type: string; slug: string }) => void;
  onContinue?: (item: { type: string; slug: string }) => void;
}) {
  const hidePrice = useHiddenPrice(item);
  const price = currency === "INR" ? parsePrice(item.priceInr) : parsePrice(item.priceUsd);
  const discount = currency === "INR" ? parsePrice(item.discountInr) : parsePrice(item.discountUsd);
  const symbol = currency === "INR" ? "₹" : "$";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const finalPrice = computeFinalPrice(price, discount);
  const hasDiscount = discount > 0;
  const isFree = item.purchaseMode === "FREE" || price === 0;

  // Show badge: difficulty if set, otherwise mode
  const diffLabel = item.difficulty ? difficultyLabels[item.difficulty] : undefined;
  const modeLabel = item.mode ? modeLabels[item.mode] : undefined;
  const badgeLabel = diffLabel || modeLabel;

  const handleClick = () => {
    if (item.hasAccess && onContinue) {
      onContinue({ type: item.type, slug: item.slug });
    } else if (onItemClick) {
      onItemClick({ type: item.type, slug: item.slug });
    }
  };

  return (
    <div
      className="group flex cursor-pointer flex-col overflow-hidden transition-all hover:-translate-y-2"
      style={{
        border: "3px solid hsl(var(--foreground))",
        boxShadow: "6px 6px 0px 0px hsl(var(--foreground))",
        backgroundColor: "hsl(var(--card))",
      }}
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="h-52 overflow-hidden sm:h-56 lg:h-64">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            No Image
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        {/* Badge + Duration */}
        <div className="mb-4 flex items-center gap-4">
          {badgeLabel && (
            <span
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
            >
              {badgeLabel}
            </span>
          )}
          {item.duration && (
            <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {item.duration}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className="mb-3 text-xl font-black sm:text-2xl lg:text-3xl"
          style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
        >
          {item.title}
        </h3>

        {/* Subtitle */}
        {item.subtitle && (
          <p className="mb-5 line-clamp-2 text-base text-muted-foreground lg:text-lg">
            {item.subtitle}
          </p>
        )}

        {/* Instructor */}
        {item.instructor?.name && (
          <p className="mb-5 text-sm font-medium text-muted-foreground">
            By {item.instructor.name}
          </p>
        )}

        {/* Footer: Price + Enroll. When the learner already has access, drop
            the price column entirely, otherwise a free course they're
            enrolled in reads as "FREE + Continue", which the user has
            flagged as effectively saying "enrolled for free". */}
        <div
          className="mt-auto flex items-center justify-between border-t-[3px] pt-5"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {item.hasAccess ? (
            <button
              type="button"
              className="w-full px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 lg:px-6 lg:py-3"
              style={{
                backgroundColor: "hsl(var(--foreground))",
                color: "hsl(var(--background))",
                border: "3px solid hsl(var(--foreground))",
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              Continue Learning →
            </button>
          ) : (
            <>
              {!hidePrice && (
                <div>
                  <p
                    className="text-3xl font-black lg:text-4xl"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    {isFree ? "FREE" : `${symbol}${finalPrice.toLocaleString(locale)}`}
                  </p>
                  {!isFree && hasDiscount && (
                    <p className="text-sm text-muted-foreground line-through">
                      {symbol}{price.toLocaleString(locale)}
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                className={cn(
                  "px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 lg:px-6 lg:py-3",
                  hidePrice && "w-full"
                )}
                style={{
                  backgroundColor: "hsl(var(--foreground))",
                  color: "hsl(var(--background))",
                  border: "3px solid hsl(var(--foreground))",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                {hidePrice ? "View Details" : "Enroll"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton card ── */
function PhotographyCourseCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        border: "3px solid hsl(var(--foreground) / 0.1)",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <div className="h-52 animate-pulse bg-muted sm:h-56 lg:h-64" />
      <div className="flex flex-1 flex-col gap-3 p-6 sm:p-8">
        <div className="flex gap-3">
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-5 w-full animate-pulse rounded bg-muted" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-auto flex items-center justify-between border-t pt-5">
          <div className="h-9 w-20 animate-pulse rounded bg-muted" />
          <div className="h-10 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

/* ── Filter tabs config ── */
const FILTER_TABS = [
  { key: "ALL", label: "All", seeAllHref: "/all-courses" },
  { key: "SELF_PACED", label: "Self-Paced", seeAllHref: "/self-paced" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

/* ── Main Section Component ── */
export function CoursesListingPhotographySection({
  section,
}: CoursesListingPhotographySectionProps) {
  const content = section.content as ContentListingContent;
  const hasCustomBg = hasCustomSectionBackground(section);
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    LinkComponent,
    fetchContentItems,
    tenantIdentifier,
    onContentItemClick,
    onContentItemContinue,
  } = useSectionEditor();

  const lockedFilter: FilterKey | null = null;

  const currency = usePreferredCurrency();
  const [activeFilter, setActiveFilter] = useState<FilterKey>(lockedFilter ?? "ALL");

  // Fetch a generous amount to allow client-side filtering
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["courses-listing-photography", section.type, tenantIdentifier ?? ""],
    queryFn: () =>
      fetchContentItems?.({
        sectionType: "all-courses-listing",
        limit: 30,
        sortBy: "sort_order",
        sortOrder: "asc",
      }) ?? Promise.resolve([]),
    enabled: !!fetchContentItems && !!tenantIdentifier,
    staleTime: 60_000,
  });

  // Filter courses by active tab (or locked mode for live/self-paced-* section types)
  const courses = useMemo(() => {
    const allCourses = items.filter((item) => item.type === "course");
    const f = lockedFilter ?? activeFilter;
    if (f === "ALL") return allCourses;
    return allCourses.filter((item) => item.mode === f);
  }, [items, activeFilter, lockedFilter]);

  // Which tabs have courses (to show/hide tabs)
  const availableModes = useMemo(() => {
    const modes = new Set(items.filter((i) => i.type === "course").map((i) => i.mode));
    return modes;
  }, [items]);

  // Only show filter tabs if there are courses with more than one mode
  const showFilters = availableModes.size > 1;

  const filterForSeeAll = lockedFilter ?? activeFilter;
  const seeAllHref =
    FILTER_TABS.find((t) => t.key === filterForSeeAll)?.seeAllHref || "/courses";

  const handleContentUpdate = (key: keyof ContentListingContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  const handleTextStyleChange = (styleKey: string, style: TextStyle) => {
    const existing = content.textStyles ?? {};
    const next = { ...existing };
    if (Object.keys(style).length === 0) delete next[styleKey];
    else next[styleKey] = style;
    updateSectionContent(section.id, { textStyles: next });
  };

  // Web: hide entirely when no data
  if (!isEditMode && !isLoading && items.length === 0) {
    return null;
  }

  // Editor: preview themed SAMPLE cards when nothing is published yet, so the
  // tenant can see the layout (labelled with a "Sample preview" ribbon).
  const showSample = isEditMode && !isLoading && items.length === 0;
  const displayCourses = showSample ? getSampleContentItems("all-courses-listing", 6) : courses;

  return (
    <section
      id={section.id}
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-muted",
      )}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-10 text-center lg:mb-14">
          <h2
            className="text-[clamp(2.5rem,5vw,4rem)] font-black uppercase tracking-tighter"
            style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
          >
            <EditableText
              value={content.headline}
              onChange={(v) => handleContentUpdate("headline", v)}
              as="span"
              styleKey="headline"
              style={content.textStyles?.headline}
              onStyleChange={(s) => handleTextStyleChange("headline", s)}
            />
          </h2>
          {(content.subheadline || isEditMode) && (
            <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground lg:text-xl">
              <EditableText
                value={content.subheadline || ""}
                onChange={(v) => handleContentUpdate("subheadline", v)}
                as="span"
                placeholder="Add a subtitle..."
                styleKey="subheadline"
                style={content.textStyles?.subheadline}
                onStyleChange={(s) => handleTextStyleChange("subheadline", s)}
              />
            </p>
          )}
        </div>

        {/* Filter tabs + See All */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          {/* Filter tabs (hidden when section type is live/self-paced-only legacy) */}
          {!lockedFilter && (
            <div className="flex flex-wrap gap-2">
              {FILTER_TABS.map((tab) => {
                // Hide tabs that have no courses (except "All")
                if (tab.key !== "ALL" && !showFilters) return null;
                if (tab.key !== "ALL" && !availableModes.has(tab.key)) return null;
                const isActive = activeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveFilter(tab.key)}
                    className={cn(
                      "px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all",
                      isActive ? "translate-x-0 translate-y-0" : "hover:-translate-x-0.5 hover:-translate-y-0.5",
                    )}
                    style={{
                      border: "3px solid hsl(var(--foreground))",
                      backgroundColor: isActive ? "hsl(var(--primary))" : "hsl(var(--card))",
                      color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                      boxShadow: isActive ? "none" : "3px 3px 0px 0px hsl(var(--foreground))",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* See All link */}
          {!isEditMode && (
            <LinkComponent
              href={seeAllHref}
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors"

            >
              <span style={{ color: "hsl(var(--primary))" }}>See All</span>
              <ArrowRight className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
            </LinkComponent>
          )}
        </div>

        {/* Editor-only ribbon when previewing sample placeholder cards. */}
        {showSample && <SampleContentBadge />}

        {/* Course cards grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {isLoading || !currency
            ? Array.from({ length: 6 }).map((_, i) => (
                <PhotographyCourseCardSkeleton key={i} />
              ))
            : displayCourses.map((item) => (
                <PhotographyCourseCard
                  key={item.id}
                  item={item}
                  currency={currency}
                  onItemClick={showSample ? undefined : onContentItemClick}
                  onContinue={showSample ? undefined : onContentItemContinue}
                />
              ))}
        </div>

        {/* No courses for this filter */}
        {!isLoading && courses.length === 0 && items.length > 0 && (
          <div
            className="p-12 text-center"
            style={{ border: "3px dashed hsl(var(--foreground) / 0.15)" }}
          >
            <p className="text-lg font-bold uppercase text-muted-foreground">
              No {activeFilter === "ALL" ? "" : activeFilter.replace("_", " ").toLowerCase()} courses available
            </p>
          </div>
        )}

      </div>
    </section>
  );
}
