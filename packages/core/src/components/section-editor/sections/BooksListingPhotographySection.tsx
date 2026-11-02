"use client";

import { hasCustomSectionBackground } from "@open-mtlms/shared";
import type {
  ContentListingContent,
  ContentListingItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";
import { useMemo } from "react";

import { cn } from "../../../lib/utils";
import { usePreferredCurrency } from "../../../hooks";
import { EditableLabel } from "../EditableLabel";
import { useSectionEditor } from "../SectionEditorContext";
import { SampleContentBadge } from "./SampleContentBadge";
import { getSampleContentItems } from "./sample-content-items";

interface BooksListingPhotographySectionProps {
  section: SectionConfig;
}

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

/* ── Single book card ── */
function PhotographyBookCard({
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
  const symbol = currency === "INR" ? "₹" : "$";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const finalPrice = computeFinalPrice(price, discount);
  const hasDiscount = discount > 0;
  const isFree = item.purchaseMode === "FREE" || price === 0;

  // Author display
  const authorName = item.authors?.length
    ? item.authors.map((a) => a.name).join(", ")
    : item.author || "";

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
      {/* Book cover */}
      <div className="flex items-center justify-center overflow-hidden bg-muted p-6 sm:p-8">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-64 w-auto max-w-full object-contain drop-shadow-xl transition-transform duration-300 group-hover:scale-105 sm:h-72 lg:h-80"
          />
        ) : (
          <div className="flex h-64 w-44 items-center justify-center bg-muted-foreground/10 sm:h-72 lg:h-80">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        {/* Title */}
        <h3
          className="mb-2 text-xl font-black sm:text-2xl"
          style={{ fontFamily: "var(--font-display, Georgia, serif)" }}
        >
          {item.title}
        </h3>

        {/* Author + Pages */}
        <p className="mb-4 text-sm text-muted-foreground">
          {authorName && <span>{authorName}</span>}
          {authorName && item.pages ? " · " : ""}
          {item.pages && <span>{item.pages} pages</span>}
        </p>

        {/* Description */}
        {item.description && (
          <p className="mb-5 line-clamp-2 text-base text-muted-foreground">
            {item.description}
          </p>
        )}

        {/* Footer: Price + Action */}
        <div
          className="mt-auto flex items-center justify-between border-t-[3px] pt-5"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {item.hasAccess ? (
            <button
              type="button"
              className="w-full py-3 text-center text-sm font-bold uppercase tracking-wider transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
              style={{
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
                border: "3px solid hsl(var(--foreground))",
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              Continue Reading →
            </button>
          ) : (
            <>
              {!hidePrice && (
                <div>
                  <p
                    className="text-2xl font-black lg:text-3xl"
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
                  "px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition-all hover:-translate-x-0.5 hover:-translate-y-0.5",
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
                <EditableLabel value={content.viewLabel} fallback="View Book" onChange={(v) => onContentUpdate("viewLabel", v)} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton card ── */
function PhotographyBookCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        border: "3px solid hsl(var(--foreground) / 0.1)",
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <div className="flex items-center justify-center p-8">
        <div className="h-72 w-44 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6 sm:p-8">
        <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="mt-auto flex items-center justify-between border-t pt-5">
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          <div className="h-10 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

/* ── Main Section Component ── */
export function BooksListingPhotographySection({
  section,
}: BooksListingPhotographySectionProps) {
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

  const currency = usePreferredCurrency();
  const itemCount = content.itemCount ?? 8;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["books-listing-photography", section.type, itemCount, tenantIdentifier ?? ""],
    queryFn: () =>
      fetchContentItems?.({
        sectionType: "books-listing",
        limit: itemCount,
        sortBy: "sort_order",
        sortOrder: "asc",
      }) ?? Promise.resolve([]),
    enabled: !!fetchContentItems && !!tenantIdentifier,
    staleTime: 60_000,
  });

  const books = useMemo(
    () => items.filter((item) => item.type === "book"),
    [items],
  );

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

  // Editor: preview themed SAMPLE cards when nothing is published yet.
  const showSample = isEditMode && !isLoading && items.length === 0;
  const displayBooks = showSample ? getSampleContentItems("books-listing", 4) : books;

  return (
    <section
      className={cn(
        "py-16 md:py-24",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 lg:mb-14">
          <div>
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
              <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
                <EditableText
                  value={content.subheadline || ""}
                  onChange={(v) => handleContentUpdate("subheadline", v)}
                  as="span"
                  placeholder="Add a subtitle..."
                />
              </p>
            )}
          </div>

          {/* See All */}
          {!isEditMode && (
            <LinkComponent
              href="/books"
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
            >
              <span style={{ color: "hsl(var(--primary))" }}>See All</span>
              <ArrowRight className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
            </LinkComponent>
          )}
        </div>

        {/* Editor-only ribbon when previewing sample placeholder cards. */}
        {showSample && <SampleContentBadge />}

        {/* Book cards grid */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading || !currency
            ? Array.from({ length: 4 }).map((_, i) => (
                <PhotographyBookCardSkeleton key={i} />
              ))
            : displayBooks.map((item) => (
                <PhotographyBookCard
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
      </div>
    </section>
  );
}
