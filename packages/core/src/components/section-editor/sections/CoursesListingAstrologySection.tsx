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
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";
import { SampleContentBadge } from "./SampleContentBadge";
import { getSampleContentItems } from "./sample-content-items";

interface CoursesListingAstrologySectionProps {
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

/* ── Compact course card ── */
function AstrologyCourseCard({
  item,
  currency,
  onItemClick,
  onContinue,
  content,
  onContentUpdate,
}: {
  item: ContentListingItem;
  currency: "INR" | "USD";
  onItemClick?: (item: { type: string; slug: string }) => void;
  onContinue?: (item: { type: string; slug: string }) => void;
  /** Section content, the card renders its own editable CTA labels. */
  content: ContentListingContent;
  onContentUpdate: (key: keyof ContentListingContent, value: unknown) => void;
}) {
  const hidePrice = useHiddenPrice(item);
  const price = currency === "INR" ? parsePrice(item.priceInr) : parsePrice(item.priceUsd);
  const discount = currency === "INR" ? parsePrice(item.discountInr) : parsePrice(item.discountUsd);
  const symbol = currency === "INR" ? "\u20B9" : "$";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const finalPrice = computeFinalPrice(price, discount);
  const hasDiscount = discount > 0;
  const isFree = item.purchaseMode === "FREE" || price === 0;

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
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1"
      style={{
        backgroundColor: "hsl(var(--card))",
        border: "1px solid hsl(var(--primary) / 0.1)",
        boxShadow: "0 2px 12px hsl(var(--primary) / 0.03)",
      }}
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="h-44 overflow-hidden sm:h-48 lg:h-52">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            No Image
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {/* Badge + Duration */}
        <div className="mb-2 flex items-center gap-2">
          {badgeLabel && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
            >
              {badgeLabel}
            </span>
          )}
          {item.duration && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {item.duration}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className="mb-1.5 line-clamp-2 text-sm font-bold leading-snug text-foreground sm:text-[15px]"
          style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
        >
          {item.title}
        </h3>

        {/* Subtitle */}
        {item.subtitle && (
          <p className="mb-2 line-clamp-1 text-xs leading-relaxed text-foreground/60">
            {item.subtitle}
          </p>
        )}

        {/* Footer: Price + Enroll. Enrolled learners get a full-width
            "Continue Learning" CTA; we hide the FREE/price label so the
            card doesn't read as "enrolled for free". */}
        <div
          className="mt-auto flex items-center justify-between border-t pt-2.5"
          style={{ borderColor: "hsl(var(--primary) / 0.08)" }}
        >
          {item.hasAccess ? (
            <button
              type="button"
              className="w-full rounded-full py-2 text-center text-[11px] font-semibold transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
              onClick={(e) => { e.stopPropagation(); handleClick(); }}
            >
              <EditableLabel value={content.continueLabel} fallback="Continue Learning" onChange={(v) => onContentUpdate("continueLabel", v)} />
            </button>
          ) : (
            <>
              {!hidePrice && (
                <div>
                  <p
                    className="text-base font-bold"
                    style={{ color: "hsl(var(--primary))", fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
                  >
                    {isFree ? "FREE" : `${symbol}${finalPrice.toLocaleString(locale)}`}
                  </p>
                  {!isFree && hasDiscount && (
                    <p className="text-[10px] text-muted-foreground line-through">
                      {symbol}{price.toLocaleString(locale)}
                    </p>
                  )}
                </div>
              )}
              <button
                type="button"
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-200 hover:scale-105",
                  hidePrice && "w-full"
                )}
                style={{
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
                onClick={(e) => { e.stopPropagation(); handleClick(); }}
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
function AstrologyCourseCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{ border: "1px solid hsl(var(--primary) / 0.05)", backgroundColor: "hsl(var(--card))" }}
    >
      <div className="h-44 animate-pulse bg-muted sm:h-48 lg:h-52" />
      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="mt-auto flex items-center justify-between border-t pt-2.5">
          <div className="h-5 w-14 animate-pulse rounded bg-muted" />
          <div className="h-7 w-16 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

/* ── Filter tabs config ── */
const FILTER_TABS = [
  { key: "ALL", label: "All", seeAllHref: "/all-courses" },
  { key: "SELF_PACED", label: "Self-Paced", seeAllHref: "/all-courses" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

/* ── Main Section Component ── */
export function CoursesListingAstrologySection({
  section,
}: CoursesListingAstrologySectionProps) {
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

  const lockedFilter: FilterKey | null = section.type.startsWith("self-paced-courses-listing-astrology")
    ? "SELF_PACED"
    : null;

  const currency = usePreferredCurrency();
  const [activeFilter, setActiveFilter] = useState<FilterKey>(lockedFilter ?? "ALL");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["courses-listing-astrology", section.type, tenantIdentifier ?? ""],
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

  const courses = useMemo(() => {
    const allCourses = items.filter((item) => item.type === "course");
    const f = lockedFilter ?? activeFilter;
    if (f === "ALL") return allCourses;
    return allCourses.filter((item) => item.mode === f);
  }, [items, activeFilter, lockedFilter]);

  const availableModes = useMemo(() => {
    const modes = new Set(items.filter((i) => i.type === "course").map((i) => i.mode));
    return modes;
  }, [items]);

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

  if (!isEditMode && !isLoading && items.length === 0) {
    return null;
  }

  // Editor: preview themed SAMPLE cards when nothing is published yet.
  const showSample = isEditMode && !isLoading && items.length === 0;
  const displayCourses = showSample ? getSampleContentItems("all-courses-listing", 8) : courses;

  return (
    <section
      id={section.id}
      className={cn(
        "relative py-12 md:py-16",
        hasCustomBg ? "bg-transparent" : "bg-muted",
      )}
    >
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full opacity-[0.025]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 65%)" }}
        />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-6 text-center lg:mb-8">
          <h2
            className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
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
            <p className="mx-auto mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
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
          {!lockedFilter && (
            <div className="flex flex-wrap gap-2">
              {FILTER_TABS.map((tab) => {
                if (tab.key !== "ALL" && !showFilters) return null;
                if (tab.key !== "ALL" && !availableModes.has(tab.key)) return null;
                const isActive = activeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveFilter(tab.key)}
                    className={cn(
                      "rounded-full px-5 py-2 text-sm font-semibold tracking-wide transition-all duration-200",
                      isActive ? "" : "hover:scale-105",
                    )}
                    style={{
                      backgroundColor: isActive ? "hsl(var(--primary))" : "hsl(var(--card))",
                      color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                      border: `1px solid ${isActive ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.12)"}`,
                      boxShadow: isActive ? "0 0 14px hsl(var(--primary) / 0.2)" : "none",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {!isEditMode && (
            <LinkComponent
              href={seeAllHref}
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide transition-colors"
            >
              <span style={{ color: "hsl(var(--primary))" }}>See All</span>
              <ArrowRight className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
            </LinkComponent>
          )}
        </div>

        {/* Editor-only ribbon when previewing sample placeholder cards. */}
        {showSample && <SampleContentBadge />}

        {/* Course cards grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading || !currency
            ? Array.from({ length: 6 }).map((_, i) => <AstrologyCourseCardSkeleton key={i} />)
            : displayCourses.map((item) => (
                <AstrologyCourseCard
                  key={item.id}
                  item={item}
                  currency={currency}
                  onItemClick={showSample ? undefined : onContentItemClick}
                  onContinue={showSample ? undefined : onContentItemContinue}
                  content={content}
                  onContentUpdate={handleContentUpdate}
                />
              ))}
        </div>

        {/* No courses for this filter */}
        {!isLoading && courses.length === 0 && items.length > 0 && (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ border: "1px dashed hsl(var(--primary) / 0.12)" }}
          >
            <p className="text-base font-semibold text-muted-foreground">
              No {activeFilter === "ALL" ? "" : activeFilter.replace("_", " ").toLowerCase()} courses available
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
