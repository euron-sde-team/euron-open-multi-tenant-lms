"use client";

import type {
  ContentListingContent,
  ContentListingItem,
  SectionConfig,
  TextStyle,
} from "@open-mtlms/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import { CourseCard, CourseCardSkeleton } from "../../cards/CourseCard";
import type { CardPriceParts } from "../../cards/price-parts";
import { BookCard, BookCardSkeleton } from "../../cards/BookCard";
import { BundleCard, BundleCardSkeleton } from "../../cards/BundleCard";
import { CategoryCard, CategoryCardSkeleton } from "../../cards/CategoryCard";
import { cn } from "../../../lib/utils";
import { usePreferredCurrency } from "../../../hooks";
import { useSectionEditor } from "../SectionEditorContext";
import { SampleContentBadge } from "./SampleContentBadge";
import { getSampleContentItems } from "./sample-content-items";

interface ContentListingSectionProps {
  section: SectionConfig;
}

// ── Section type → card type mapping ──

function getCardType(
  sectionType: string
): "course" | "book" | "bundle" | "category" | "test-series" {
  if (sectionType.includes("test-series")) return "test-series";
  if (sectionType.includes("courses") || sectionType === "course-cards") return "course";
  if (sectionType.includes("books") || sectionType === "book-showcase") return "book";
  if (sectionType.includes("bundles")) return "bundle";
  if (sectionType.includes("categories")) return "category";
  return "course";
}

// ── Main Component ──

export function ContentListingSection({ section }: ContentListingSectionProps) {
  const content = section.content as ContentListingContent;
  const variant = section.variant || "grid";
  const {
    isEditMode,
    updateSectionContent,
    EditableText,
    LinkComponent,
    fetchContentItems,
    tenantIdentifier,
    onContentItemClick,
    onContentItemContinue,
    onCartToggle,
    isInCart,
    onBookmarkToggle,
    isBookmarked,
    resolveItemPriceParts,
    courseTerm,
  } = useSectionEditor();

  const renderCardOpts: RenderCardOptions | undefined =
    onCartToggle || onBookmarkToggle || resolveItemPriceParts || courseTerm
      ? { onCartToggle, isInCart, onBookmarkToggle, isBookmarked, resolveItemPriceParts, courseTerm }
      : undefined;

  const currency = usePreferredCurrency();
  const [isEditingLink, setIsEditingLink] = useState(false);

  const defaultLimit = variant === "scroll" ? 20 : 8;
  const itemCount = content.itemCount ?? defaultLimit;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["content-listing", section.type, itemCount, tenantIdentifier ?? ""],
    queryFn: () =>
      fetchContentItems?.({
        sectionType: section.type,
        limit: itemCount,
        sortBy: variant === "row" ? "created_at" : "sort_order",
        sortOrder: variant === "row" ? "desc" : "asc",
      }) ?? Promise.resolve([]),
    enabled: !!fetchContentItems && !!tenantIdentifier,
    staleTime: 60_000,
  });

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

  const cardType = getCardType(section.type);
  const seeAllLink = content.seeAllLink;

  const isEmpty = !isLoading && !!currency && items.length === 0;

  // How many placeholder cards to reserve. `itemCount` is the tenant's MAXIMUM,
  // not the number of items that exist: a "Books" section capped at 4 against a
  // catalogue of one book reserved four card-heights and then collapsed to one
  // the moment data landed. Across five listing sections that read as the whole
  // page twitching. Once the query has resolved we know the true count, so the
  // skeleton matches the content it is standing in for and nothing moves.
  const skeletonCount = items.length > 0 ? Math.min(items.length, itemCount, 8) : Math.min(itemCount, 8);

  // A listing with nothing in it hides itself (below). Rendering its skeleton
  // in the meantime means a block of shimmering cards appears and then vanishes
  //, worse than the section never having been there. On the live site, wait
  // silently instead.
  const willRenderNothing = !isEditMode && !isLoading && items.length === 0;

  // Live/preview: an empty listing hides itself entirely so a tenant's homepage
  // never shows a blank gap. It reappears automatically once matching content is
  // published (hidden sections are filtered out upstream before this mounts).
  // While loading / before currency resolves we fall through to the skeleton, so
  // real data never flashes in from an empty state.
  if ((isEmpty || willRenderNothing) && !isEditMode) {
    return null;
  }

  // Editor: fall back to themed SAMPLE cards so the tenant can preview how the
  // section will look once real content exists (labelled with a "Sample preview"
  // ribbon so it's never mistaken for published data).
  const showSample = isEmpty && isEditMode;
  const displayItems = showSample ? getSampleContentItems(section.type, itemCount) : items;

  return (
    <section className="section-padding max-sm:!px-0">
      <div className="container-custom max-sm:!px-3">
        {/* Header */}
        <div className="mb-8">
          <div className="text-center sm:flex sm:items-end sm:justify-between sm:gap-4 sm:text-left">
            <div className="min-w-0">
              <EditableText
                value={content.headline}
                onChange={(v) => handleContentUpdate("headline", v)}
                styleKey="headline"
                style={content.textStyles?.headline}
                onStyleChange={(s) => handleTextStyleChange("headline", s)}
                as="h2"
                className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl"
              />
              {(isEditMode || content.subheadline) && (
                <EditableText
                  value={content.subheadline || ""}
                  onChange={(v) => handleContentUpdate("subheadline", v)}
                  styleKey="subheadline"
                  style={content.textStyles?.subheadline}
                  onStyleChange={(s) => handleTextStyleChange("subheadline", s)}
                  as="p"
                  className="text-muted-foreground mx-auto mt-2 max-w-2xl sm:mx-0"
                />
              )}
            </div>

            {/* See All link, right corner on sm+, centered below on mobile */}
            {seeAllLink && !isEditMode && (
              <div className="mt-4 sm:mt-0">
                <LinkComponent
                  href={seeAllLink}
                  className="text-primary hover:text-primary/80 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium transition-colors"
                >
                  See All
                  <ArrowRight className="h-4 w-4" />
                </LinkComponent>
              </div>
            )}
            {isEditMode && (
              <div className="mt-4 shrink-0 sm:mt-0">
                {isEditingLink ? (
                  <input
                    type="text"
                    value={seeAllLink || ""}
                    onChange={(e) => handleContentUpdate("seeAllLink", e.target.value)}
                    onBlur={() => setIsEditingLink(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setIsEditingLink(false);
                    }}
                    autoFocus
                    placeholder="/all-courses"
                    className="border-border bg-background text-foreground focus:border-primary rounded-md border px-3 py-1.5 text-sm outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setIsEditingLink(true)}
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                  >
                    {seeAllLink ? `See All → ${seeAllLink}` : "+ Add See All link"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Editor-only ribbon when we're previewing sample placeholder cards. */}
        {showSample && <SampleContentBadge />}

        {/* Content, show skeleton until currency resolves (one frame) or data is
            loading. When empty in the editor, displayItems holds sample cards;
            on live an empty listing returns null above and never reaches here. */}
        {isLoading || !currency ? (
          <SkeletonLayout variant={variant} cardType={cardType} count={skeletonCount} />
        ) : variant === "scroll" ? (
          <ScrollLayout
            items={displayItems}
            cardType={cardType}
            currency={currency}
            onItemClick={showSample ? undefined : onContentItemClick}
            onItemContinue={showSample ? undefined : onContentItemContinue}
            renderCardOpts={showSample ? undefined : renderCardOpts}
          />
        ) : variant === "row" ? (
          <RowLayout
            items={displayItems.slice(0, itemCount)}
            cardType={cardType}
            currency={currency}
            onItemClick={showSample ? undefined : onContentItemClick}
            onItemContinue={showSample ? undefined : onContentItemContinue}
            renderCardOpts={showSample ? undefined : renderCardOpts}
          />
        ) : (
          <GridLayout
            items={displayItems.slice(0, itemCount)}
            cardType={cardType}
            currency={currency}
            onItemClick={showSample ? undefined : onContentItemClick}
            onItemContinue={showSample ? undefined : onContentItemContinue}
            renderCardOpts={showSample ? undefined : renderCardOpts}
          />
        )}
      </div>
    </section>
  );
}

// ── Card Renderer ──

interface RenderCardOptions {
  onCartToggle?: (item: { type: string; id: string; title: string }) => void;
  isInCart?: (itemId: string) => boolean;
  onBookmarkToggle?: (item: {
    type: string;
    id: string;
    title: string;
    slug: string;
    thumbnailUrl?: string | null;
  }) => void;
  isBookmarked?: (itemId: string) => boolean;
  /** Resolve multi-currency price parts for an item (web only). */
  resolveItemPriceParts?: (item: ContentListingItem) => CardPriceParts | null;
  /** The tenant's word for a course, for an owned course card's label (web only). */
  courseTerm?: string;
}

function renderCard(
  item: ContentListingItem,
  cardType: string,
  currency: "INR" | "USD",
  onItemClick?: (item: { type: string; slug: string }) => void,
  onItemContinue?: (item: { type: string; slug: string }) => void,
  options?: RenderCardOptions
) {
  const handleClick = onItemClick
    ? () => onItemClick({ type: cardType, slug: item.slug })
    : undefined;
  const handleContinue = onItemContinue
    ? () => onItemContinue({ type: cardType, slug: item.slug })
    : undefined;

  const priceParts = options?.resolveItemPriceParts?.(item) ?? undefined;
  const showCart = !!options?.onCartToggle && !item.hasAccess && item.purchaseMode === "PAID";
  const showBookmark = !!options?.onBookmarkToggle;
  const cartToggle = showCart
    ? () => options.onCartToggle!({ type: cardType, id: item.id, title: item.title })
    : undefined;
  const bookmarkToggle = showBookmark
    ? () =>
        options.onBookmarkToggle!({
          type: cardType,
          id: item.id,
          title: item.title,
          slug: item.slug,
          thumbnailUrl: item.thumbnailUrl,
        })
    : undefined;

  switch (cardType) {
    case "course":
      return (
        <CourseCard
          id={item.id}
          title={item.title}
          slug={item.slug}
          subtitle={item.subtitle}
          description={item.description}
          thumbnailUrl={item.thumbnailUrl}
          badge={item.badge}
          discountMode="percent"
          duration={item.duration}
          priceInr={item.priceInr}
          priceUsd={item.priceUsd}
          discountInr={item.discountInr}
          discountUsd={item.discountUsd}
          purchaseMode={item.purchaseMode}
          currency={currency}
          priceParts={priceParts}
          mode={item.mode}
          difficulty={item.difficulty}
          language={item.language}
          instructor={item.instructor}
          hasAccess={item.hasAccess}
          progressPercent={item.hasAccess ? item.progressPercent : undefined}
          courseTerm={options?.courseTerm}
          onContinue={handleContinue}
          onClick={handleClick}
          showAddToCartIcon={showCart}
          isInCart={options?.isInCart?.(item.id) ?? false}
          onAddToCart={cartToggle}
          showBookmarkIcon={showBookmark}
          isBookmarked={options?.isBookmarked?.(item.id) ?? false}
          onBookmarkToggle={bookmarkToggle}
        />
      );
    case "book":
      return (
        <BookCard
          id={item.id}
          title={item.title}
          slug={item.slug}
          description={item.description}
          thumbnailUrl={item.thumbnailUrl}
          pages={item.pages}
          priceInr={item.priceInr}
          priceUsd={item.priceUsd}
          discountInr={item.discountInr}
          discountUsd={item.discountUsd}
          purchaseMode={item.purchaseMode}
          currency={currency}
          priceParts={priceParts}
          language={item.language}
          author={item.author}
          authors={item.authors}
          hasAccess={item.hasAccess}
          onContinue={handleContinue}
          onClick={handleClick}
          showAddToCartIcon={showCart}
          isInCart={options?.isInCart?.(item.id) ?? false}
          onAddToCart={cartToggle}
          showBookmarkIcon={showBookmark}
          isBookmarked={options?.isBookmarked?.(item.id) ?? false}
          onBookmarkToggle={bookmarkToggle}
        />
      );
    case "bundle":
      return (
        <BundleCard
          id={item.id}
          title={item.title}
          slug={item.slug}
          subtitle={item.subtitle}
          description={item.description}
          thumbnailUrl={item.thumbnailUrl}
          priceInr={item.priceInr}
          priceUsd={item.priceUsd}
          discountInr={item.discountInr}
          discountUsd={item.discountUsd}
          purchaseMode={item.purchaseMode}
          currency={currency}
          priceParts={priceParts}
          itemCount={item.itemCount}
          hasAccess={item.hasAccess}
          onContinue={handleContinue}
          onClick={handleClick}
        />
      );
    case "category":
      return (
        <CategoryCard
          id={item.id}
          title={item.title}
          slug={item.slug}
          description={item.description}
          iconUrl={item.iconUrl}
          onClick={handleClick}
        />
      );
    case "test-series":
      // Reuse the course card visual for test series: it exposes the same
      // title/description/thumbnail/pricing shape.
      return (
        <CourseCard
          id={item.id}
          title={item.title}
          slug={item.slug}
          subtitle={item.subtitle}
          description={item.description}
          thumbnailUrl={item.thumbnailUrl}
          badge={item.badge}
          discountMode="percent"
          duration={item.duration}
          priceInr={item.priceInr}
          priceUsd={item.priceUsd}
          discountInr={item.discountInr}
          discountUsd={item.discountUsd}
          purchaseMode={item.purchaseMode}
          currency={currency}
          priceParts={priceParts}
          language={item.language}
          instructor={item.instructor}
          hasAccess={item.hasAccess}
          onContinue={handleContinue}
          onClick={handleClick}
          showAddToCartIcon={showCart}
          isInCart={options?.isInCart?.(item.id) ?? false}
          onAddToCart={cartToggle}
          showBookmarkIcon={showBookmark}
          isBookmarked={options?.isBookmarked?.(item.id) ?? false}
          onBookmarkToggle={bookmarkToggle}
        />
      );
    default:
      return null;
  }
}

function renderSkeleton(cardType: string, className?: string) {
  switch (cardType) {
    case "course":
      return <CourseCardSkeleton className={className} />;
    case "book":
      return <BookCardSkeleton className={className} />;
    case "bundle":
      return <BundleCardSkeleton className={className} />;
    case "category":
      return <CategoryCardSkeleton className={className} />;
    default:
      return <CourseCardSkeleton className={className} />;
  }
}

// ── Scroll Layout (horizontal scroll + arrow buttons) ──

function ScrollLayout({
  items,
  cardType,
  currency,
  onItemClick,
  onItemContinue,
  renderCardOpts,
}: {
  items: ContentListingItem[];
  cardType: string;
  currency: "INR" | "USD";
  onItemClick?: (item: { type: string; slug: string }) => void;
  onItemContinue?: (item: { type: string; slug: string }) => void;
  renderCardOpts?: RenderCardOptions;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const showArrows = items.length > 4;

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -320 : 320;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="group/scroll relative">
      {/* Left arrow, only when more than 4 items */}
      {showArrows && (
        <button
          onClick={() => scroll("left")}
          className="border-border bg-background hover:bg-muted absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-md transition-opacity group-hover/scroll:flex"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Scrollable container, center when few items */}
      <div
        ref={scrollRef}
        className={cn(
          "scrollbar-hide flex scroll-smooth pb-2",
          cardType === "book" ? "gap-3" : "gap-4",
          showArrows ? "items-stretch overflow-x-auto" : "flex-wrap items-stretch justify-center",
          "max-sm:[&>div>*]:!w-full"
        )}
        style={
          showArrows
            ? {
                scrollSnapType: "x mandatory",
                maskImage: "linear-gradient(90deg, transparent, black 2%, black 98%, transparent)",
              }
            : undefined
        }
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "shrink-0 snap-start",
              cardType === "category"
                ? "w-[200px]"
                : cardType === "book"
                  ? "flex w-[240px]"
                  : "w-[280px] max-sm:!w-full"
            )}
          >
            {cardType === "book" ? (
              <div className="flex h-full min-h-0 w-full">
                {renderCard(item, cardType, currency, onItemClick, onItemContinue, renderCardOpts)}
              </div>
            ) : (
              renderCard(item, cardType, currency, onItemClick, onItemContinue, renderCardOpts)
            )}
          </div>
        ))}
      </div>

      {/* Right arrow, only when more than 4 items */}
      {showArrows && (
        <button
          onClick={() => scroll("right")}
          className="border-border bg-background hover:bg-muted absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border shadow-md transition-opacity group-hover/scroll:flex"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

// ── Grid Layout (responsive grid, center-aligned) ──

function GridLayout({
  items,
  cardType,
  currency,
  onItemClick,
  onItemContinue,
  renderCardOpts,
}: {
  items: ContentListingItem[];
  cardType: string;
  currency: "INR" | "USD";
  onItemClick?: (item: { type: string; slug: string }) => void;
  onItemContinue?: (item: { type: string; slug: string }) => void;
  renderCardOpts?: RenderCardOptions;
}) {
  const maxCols = cardType === "category" ? 4 : 4;
  const fewItems = items.length <= maxCols;

  const gapClass = cardType === "category" ? "gap-5" : cardType === "book" ? "gap-3" : "gap-4";

  // When few items, use centered flex instead of grid to avoid left-aligned gaps
  if (fewItems) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-stretch justify-center",
          gapClass,
          // Let each cell's responsive width win over the card's intrinsic
          // fixed width at every breakpoint (not just mobile), so cards fill
          // their column and stay aligned on all screen sizes.
          "[&>div>*]:!w-full"
        )}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              cardType === "category"
                ? "w-[200px]"
                : cardType === "book"
                  ? "flex w-[240px]"
                  : "w-full sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)] lg:w-[calc(25%-0.75rem)]"
            )}
          >
            {cardType === "book" ? (
              <div className="flex h-full min-h-0 w-full">
                {renderCard(item, cardType, currency, onItemClick, onItemContinue, renderCardOpts)}
              </div>
            ) : (
              renderCard(item, cardType, currency, onItemClick, onItemContinue, renderCardOpts)
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid items-stretch",
        gapClass,
        cardType === "category"
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        // Card fills its grid cell at every breakpoint (overrides the card's
        // intrinsic fixed width) so columns stay even and aligned everywhere.
        "[&>div>*]:!w-full"
      )}
    >
      {items.map((item) => (
        <div key={item.id}>
          {cardType === "book" ? (
            <div className="h-full min-h-0">
              {renderCard(item, cardType, currency, onItemClick, onItemContinue, renderCardOpts)}
            </div>
          ) : (
            renderCard(item, cardType, currency, onItemClick, onItemContinue, renderCardOpts)
          )}
        </div>
      ))}
    </div>
  );
}

// ── Row Layout (centered horizontal row, limited items) ──

function RowLayout({
  items,
  cardType,
  currency,
  onItemClick,
  onItemContinue,
  renderCardOpts,
}: {
  items: ContentListingItem[];
  cardType: string;
  currency: "INR" | "USD";
  onItemClick?: (item: { type: string; slug: string }) => void;
  onItemContinue?: (item: { type: string; slug: string }) => void;
  renderCardOpts?: RenderCardOptions;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-stretch justify-center",
        cardType === "book" ? "gap-3" : "gap-4",
        "max-sm:[&>div>*]:!w-full"
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "shrink-0",
            cardType === "category"
              ? "w-[220px]"
              : cardType === "book"
                ? "flex w-[240px]"
                : "w-[280px] max-sm:!w-full"
          )}
        >
          {cardType === "book" ? (
            <div className="flex h-full min-h-0 w-full">
              {renderCard(item, cardType, currency, onItemClick, onItemContinue, renderCardOpts)}
            </div>
          ) : (
            renderCard(item, cardType, currency, onItemClick, onItemContinue, renderCardOpts)
          )}
        </div>
      ))}
    </div>
  );
}

// ── Skeleton Layout ──

function SkeletonLayout({
  variant,
  cardType,
  count,
}: {
  variant: string;
  cardType: string;
  count: number;
}) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (variant === "scroll") {
    return (
      <div className="flex gap-4 overflow-hidden pb-2">
        {skeletons.map((i) => (
          <div
            key={i}
            className={cn("shrink-0", cardType === "category" ? "w-[200px]" : "w-[280px]")}
          >
            {renderSkeleton(cardType)}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div className="flex flex-wrap justify-center gap-4">
        {skeletons.map((i) => (
          <div
            key={i}
            className={cn("shrink-0", cardType === "category" ? "w-[200px]" : "w-[280px]")}
          >
            {renderSkeleton(cardType)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4",
        cardType === "category"
          ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      )}
    >
      {skeletons.map((i) => (
        <div key={i}>{renderSkeleton(cardType)}</div>
      ))}
    </div>
  );
}
