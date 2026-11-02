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

interface BooksListingAstrologySectionProps {
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
function AstrologyBookCard({
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
  const isFree = item.purchaseMode === "FREE" || price === 0;

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
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1"
      style={{
        backgroundColor: "hsl(var(--card))",
        border: "1px solid hsl(var(--primary) / 0.1)",
        boxShadow: "0 2px 12px hsl(var(--primary) / 0.03)",
      }}
      onClick={handleClick}
    >
      {/* Book cover */}
      <div className="flex items-center justify-center overflow-hidden bg-muted p-4">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="h-44 w-auto max-w-full object-contain drop-shadow-lg transition-transform duration-500 group-hover:scale-105 sm:h-52"
          />
        ) : (
          <div className="flex h-44 w-32 items-center justify-center rounded-lg bg-muted-foreground/10 sm:h-52">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <h3
          className="mb-1 line-clamp-2 text-sm font-semibold leading-snug"
          style={{ fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
        >
          {item.title}
        </h3>

        <p className="mb-2 text-[10px] text-muted-foreground">
          {authorName && <span>{authorName}</span>}
          {authorName && item.pages ? " \u00B7 " : ""}
          {item.pages && <span>{item.pages} pages</span>}
        </p>

        <div
          className="mt-auto flex items-center justify-between border-t pt-2.5"
          style={{ borderColor: "hsl(var(--primary) / 0.08)" }}
        >
          {item.hasAccess ? (
            <button
              type="button"
              className="w-full rounded-full py-2 text-center text-[11px] font-semibold transition-all hover:scale-105"
              style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              onClick={(e) => { e.stopPropagation(); handleClick(); }}
            >
              <EditableLabel value={content.continueLabel} fallback="Continue Reading" onChange={(v) => onContentUpdate("continueLabel", v)} />
            </button>
          ) : (
            <>
              {!hidePrice && (
                <p
                  className="text-base font-bold"
                  style={{ color: "hsl(var(--primary))", fontFamily: "var(--font-display, 'Playfair Display', Georgia, serif)" }}
                >
                  {isFree ? "FREE" : `${symbol}${finalPrice.toLocaleString(locale)}`}
                </p>
              )}
              <button
                type="button"
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all hover:scale-105",
                  hidePrice && "w-full"
                )}
                style={{ backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                onClick={(e) => { e.stopPropagation(); handleClick(); }}
              >
                <EditableLabel value={content.viewLabel} fallback="View" onChange={(v) => onContentUpdate("viewLabel", v)} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton card ── */
function AstrologyBookCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl"
      style={{ border: "1px solid hsl(var(--primary) / 0.05)", backgroundColor: "hsl(var(--card))" }}
    >
      <div className="flex items-center justify-center bg-muted p-4">
        <div className="h-44 w-32 animate-pulse rounded-lg bg-muted-foreground/10 sm:h-52" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="mt-auto flex items-center justify-between border-t pt-2.5">
          <div className="h-5 w-14 animate-pulse rounded bg-muted" />
          <div className="h-7 w-14 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

/* ── Main Section Component ── */
export function BooksListingAstrologySection({
  section,
}: BooksListingAstrologySectionProps) {
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
    queryKey: ["books-listing-astrology", section.type, itemCount, tenantIdentifier ?? ""],
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

  if (!isEditMode && !isLoading && items.length === 0) {
    return null;
  }

  // Editor: preview themed SAMPLE cards when nothing is published yet.
  const showSample = isEditMode && !isLoading && items.length === 0;
  const displayBooks = showSample ? getSampleContentItems("books-listing", 4) : books;

  return (
    <section
      id="books-listing-astrology"
      className={cn(
        "relative py-12 md:py-16",
        hasCustomBg ? "bg-transparent" : "bg-background",
      )}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute right-0 top-1/3 h-64 w-64 rounded-full opacity-[0.025]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 65%)" }}
        />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
          <div>
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
              <p className="mt-2 max-w-2xl text-base text-muted-foreground sm:text-lg">
                <EditableText
                  value={content.subheadline || ""}
                  onChange={(v) => handleContentUpdate("subheadline", v)}
                  as="span"
                  placeholder="Add a subtitle..."
                />
              </p>
            )}
          </div>

          {!isEditMode && (
            <LinkComponent
              href="/books"
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide"
            >
              <span style={{ color: "hsl(var(--primary))" }}>See All</span>
              <ArrowRight className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
            </LinkComponent>
          )}
        </div>

        {/* Editor-only ribbon when previewing sample placeholder cards. */}
        {showSample && <SampleContentBadge />}

        {/* Book cards grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading || !currency
            ? Array.from({ length: 4 }).map((_, i) => <AstrologyBookCardSkeleton key={i} />)
            : displayBooks.map((item) => (
                <AstrologyBookCard
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
