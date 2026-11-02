"use client";

import {
  BookOpen,
  Globe,
  FileText,
  User,
  Share2,
  Check,
  Pencil,
  Sparkles,
  Lock,
  Library,
  Star,
  ShoppingCart,
  Bookmark,
  Linkedin,
  Twitter,
  Github,
  Youtube,
  Facebook,
  Instagram,
} from "lucide-react";
import { useState } from "react";
import { AccessManagedCta } from "@open-mtlms/core";
import { cn, resolveTemplatePrice } from "../lib/utils";
import { useBookData, useBookEdit } from "../context";
import { EditableText, EditableThumbnail } from "../components/editable";

const SOCIAL_ICON_MAP: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  twitter: Twitter,
  github: Github,
  youtube: Youtube,
  website: Globe,
  facebook: Facebook,
  instagram: Instagram,
};

interface ClassicTemplateProps {
  className?: string;
  onStartReading?: () => void;
  onUnlock?: () => void;
  /** EPUB upload callback - used in edit mode */
  onEpubUpload?: (file: File) => Promise<string | undefined>;
  /** PDF upload callback - used in edit mode */
  onPdfUpload?: (file: File) => Promise<string | undefined>;
}

/**
 * Classic book template (the original BookHeader layout)
 * Side-by-side layout with book cover and details in a rounded card
 */
export function ClassicTemplate({ className, onStartReading, onUnlock, onEpubUpload: _onEpubUpload, onPdfUpload: _onPdfUpload }: ClassicTemplateProps) {
  const { bookData, authors, categories, accessManaged, supportEmail } = useBookData();
  const { isEditMode, callbacks, setActiveModal } = useBookEdit();
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [expandedExpDetails, setExpandedExpDetails] = useState<Set<string>>(new Set());

  const toggleExpDetail = (key: string) => {
    setExpandedExpDetails((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const sliceLength = 300;
  const isLongDescription = (bookData.description?.length || 0) > sliceLength;
  
  // Pricing, pre-resolved multi-currency priceParts win; legacy INR/USD math
  // (driven by callbacks.preferredCurrency) is the fallback.
  const isUSD = callbacks.preferredCurrency === "USD";
  const priceDisplay = resolveTemplatePrice(callbacks.priceParts, {
    isUSD,
    priceInr: bookData.priceInr || bookData.webPriceINR || 0,
    priceUsd: bookData.priceUsd || bookData.webPriceUSD || 0,
    discountInr: bookData.discountInr ?? bookData.webDiscount ?? 0,
    discountUsd: bookData.discountUsd ?? 0,
  });
  const { symbol, finalPrice, locale } = priceDisplay;
  const priceUnavailable =
    priceDisplay.unavailable && bookData.purchaseMode === "PAID" && !bookData.isBought;
  // Access-managed storefront (never active in the admin editor): hide all
  // price text and self-serve purchase CTAs; non-owners get Contact Support.
  const accessManagedActive = accessManaged && !isEditMode;
  // In access-managed mode the live access check (callbacks.hasAccess) also
  // counts as owned, so owners keep "Start Reading" instead of Contact
  // Support. Default mode keeps the legacy isBought-only behavior.
  const displayAsOwned = bookData.isBought || (accessManagedActive && !!callbacks.hasAccess);

  // Authors display
  const authorNames = authors.length > 0 ? authors.map((a) => a.name).join(", ") : "";

  // Category display
  const categoryIds = bookData.categoryIds || [];
  const lastCategory = categoryIds.length > 0
    ? categories.find((c) => c.id === categoryIds[categoryIds.length - 1])
    : null;

  return (
    <div className={cn("min-h-screen", className)} style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
      {/* Main Book Card */}
      <section className="py-8 lg:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div
            className="relative overflow-hidden rounded-3xl p-4 shadow-2xl sm:p-8"
            style={{ backgroundColor: "hsl(var(--card))" }}
          >
            {/* Content Grid */}
            <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
              {/* Book Cover */}
              <div className="relative h-[300px] w-full max-w-[15rem] shrink-0 overflow-hidden rounded-2xl shadow-lg sm:h-[400px] sm:max-w-[18rem]">
                <EditableThumbnail
                  src={bookData.webThumbnailUrl || ""}
                  fallbackSrc={bookData.mobileThumbnailUrl || ""}
                  alt={bookData.title || "Book cover"}
                  aspectRatio="auto"
                  placeholder="Click to add book cover"
                  className="absolute inset-0 h-full w-full"
                />
              </div>

              {/* Book Details */}
              <div className="w-full text-center sm:w-2/3 sm:text-left lg:w-3/4">
                {/* Category Tag */}
                {(lastCategory || isEditMode) && (
                  <div className="mb-2">
                    {isEditMode ? (
                      <button
                        onClick={() => setActiveModal("category")}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors"
                        style={{ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                      >
                        {lastCategory?.name || "Book"}
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    ) : (
                      <span
                        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                      >
                        {lastCategory?.name || "Book"}
                      </span>
                    )}
                  </div>
                )}

                {/* Title */}
                <EditableText
                  value={bookData.title || ""}
                  onChange={(title) => callbacks.onEditTitle?.(title)}
                  as="h1"
                  className="mb-2 text-2xl font-bold sm:text-3xl md:text-4xl"
                  style={{ color: "hsl(var(--card-foreground))" }}
                  placeholder="Book Title"
                />

                {/* Authors */}
                {(authors.length > 0 || isEditMode) && (
                  <div className="mb-4 flex items-center justify-center gap-2 sm:justify-start">
                    {authors.length > 0 && (
                      <h2 className="text-lg sm:text-xl" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {authorNames}
                      </h2>
                    )}
                    {isEditMode && (
                      <button
                        className="p-1 rounded hover:bg-muted/50"
                        onClick={() => setActiveModal("author")}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}

                {/* Meta Info */}
                <div className="my-6 flex flex-wrap justify-center gap-4 sm:justify-start sm:gap-6">
                  {((bookData.rating != null && bookData.rating > 0) || (isEditMode && callbacks.onEditRating)) ? (
                    <div className="flex items-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                      <Star className="mr-2 h-5 w-5 fill-yellow-500 text-yellow-500" />
                      <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>{(bookData.rating ?? 0).toFixed(1)}</span>
                      {bookData.ratingTotalCount != null && bookData.ratingTotalCount > 0 && (
                        <span className="ml-1">({bookData.ratingTotalCount} ratings)</span>
                      )}
                      {isEditMode && callbacks.onEditRating && (
                        <button onClick={() => callbacks.onEditRating?.()} className="ml-1" style={{ color: "hsl(var(--primary))" }}>
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : null}
                  <div className="flex items-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <Globe className="mr-2 h-5 w-5" />
                    <span>{bookData.language || "English"}</span>
                  </div>
                  <div className="flex items-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <User className="mr-2 h-5 w-5" />
                    <span>{authorNames || "Independent author"}</span>
                  </div>
                  <div className="flex items-center text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    <FileText className="mr-2 h-5 w-5" />
                    <span>{bookData.pages || "N/A"} pages</span>
                  </div>
                  <button
                    className="flex items-center rounded-full p-2 transition-all"
                    style={{ backgroundColor: "hsl(var(--muted))" }}
                    onClick={!isEditMode ? callbacks.onShare : undefined}
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>

                {/* CTA Section */}
                {displayAsOwned ? (
                  // Purchased - Show Start Reading
                  <div className="mx-auto flex max-w-64 flex-col items-start space-y-4 sm:mx-0">
                    <div className="w-full rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 p-4 dark:from-emerald-900/20 dark:to-teal-900/20">
                      <div className="flex items-center justify-center">
                        <div className="mr-3 rounded-full bg-green-100 p-2 dark:bg-green-900/30">
                          <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-800 dark:text-gray-200">
                            Active Membership
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Plus subscription
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      className="group relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-[#0E99AD] to-[#32bbd1] px-6 py-3 font-bold text-white shadow-lg transition-all duration-300 hover:from-[#32bbd1] hover:to-[#0E99AD] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#0E99AD] focus:ring-opacity-50"
                      onClick={onStartReading}
                    >
                      <span className="flex items-center justify-center text-base">
                        <span className="mr-3">📚</span>
                        Start Reading
                      </span>
                      <span className="absolute bottom-0 left-0 h-1 w-full transform bg-white opacity-30 transition-transform duration-500 ease-in-out group-hover:translate-x-full"></span>
                    </button>
                  </div>
                ) : (
                  // Not purchased - Show unlock options
                  <div className="mx-auto flex max-w-md flex-col space-y-4 sm:mx-0">
                    {/* Premium Badge */}
                    <div
                      className="rounded-lg p-4"
                      style={{ 
                        background: "linear-gradient(to right, hsl(var(--primary)/0.1), hsl(var(--primary)/0.05))" 
                      }}
                    >
                      <div className="flex items-center justify-center">
                        <div
                          className="mr-3 rounded-full px-2 py-1"
                          style={{ backgroundColor: "hsl(var(--primary)/0.2)" }}
                        >
                          <Sparkles className="h-6 w-6" style={{ color: "hsl(var(--primary))" }} />
                        </div>
                        <div>
                          <h3 className="font-medium" style={{ color: "hsl(var(--card-foreground))" }}>
                            Premium Content
                          </h3>
                          {!accessManagedActive && (
                            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                              {bookData.purchaseMode === "FREE"
                                ? "Free to read"
                                : priceUnavailable
                                  ? "Not available for purchase"
                                  : `${symbol}${finalPrice.toLocaleString(locale)}`}
                            </p>
                          )}
                          {!accessManagedActive &&
                            bookData.purchaseMode === "PAID" &&
                            !priceUnavailable &&
                            priceDisplay.additionalPrices &&
                            priceDisplay.additionalPrices.length > 0 && (
                              <p className="mt-1 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                                Also priced: {priceDisplay.additionalPrices.map((p) => p.label).join(", ")}
                              </p>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* Unlock Button */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {accessManagedActive ? (
                        <AccessManagedCta
                          hasAccess={false}
                          supportEmail={supportEmail}
                          contactSubject={bookData.title}
                          fullWidth
                        />
                      ) : !priceUnavailable ? (
                      <button
                        className="group relative w-full overflow-hidden rounded-lg px-6 py-3 font-bold shadow-lg transition-all duration-300 hover:shadow-xl"
                        style={{
                          background: "linear-gradient(to right, hsl(var(--primary)), hsl(var(--primary)/0.8))",
                          color: "hsl(var(--primary-foreground))",
                        }}
                        onClick={onUnlock}
                      >
                        <span className="flex items-center justify-center text-base">
                          {bookData.purchaseMode === "FREE" ? (
                            <>
                              <BookOpen className="mr-3 h-5 w-5" />
                              Start Reading - Free
                            </>
                          ) : (
                            <>
                              <Lock className="mr-3 h-5 w-5" />
                              Unlock with Plus
                            </>
                          )}
                        </span>
                      </button>
                      ) : null}
                      {(bookData.status === "PUBLISHED" || bookData.publishStatus === "PUBLISHED") && !isEditMode && (
                        <div className="flex gap-2">
                          {callbacks.onAddToCart && bookData.purchaseMode === "PAID" && !priceUnavailable && !accessManagedActive && (
                            <button
                              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg font-medium border transition-colors hover:bg-muted/50"
                              style={{
                                borderColor: callbacks.isInCart ? "hsl(var(--destructive))" : "hsl(var(--border))",
                                color: callbacks.isInCart ? "hsl(var(--destructive))" : undefined,
                              }}
                              onClick={callbacks.onAddToCart}
                            >
                              <ShoppingCart className="h-5 w-5" />
                              {callbacks.isInCart ? "Remove from Cart" : "Add to Cart"}
                            </button>
                          )}
                          {callbacks.onBuyNow && bookData.purchaseMode === "PAID" && !priceUnavailable && !accessManagedActive && (
                            <button
                              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg font-medium border transition-colors hover:bg-muted/50"
                              style={{ borderColor: "hsl(var(--border))" }}
                              onClick={callbacks.onBuyNow}
                            >
                              Buy Now
                            </button>
                          )}
                          {callbacks.onBookmarkToggle && (
                            <button
                              className="p-3 rounded-lg border transition-colors hover:bg-muted/50"
                              style={{ borderColor: "hsl(var(--border))" }}
                              onClick={callbacks.onBookmarkToggle}
                              aria-label="Bookmark"
                            >
                              <Bookmark className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditMode && (
                      <button
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                        onClick={() => setActiveModal("pricing")}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit Pricing
                      </button>
                    )}

                    {/* Benefits */}
                    <div
                      className="space-y-2 rounded-lg p-4"
                      style={{ backgroundColor: "hsl(var(--muted))" }}
                    >
                      <h4 className="font-medium" style={{ color: "hsl(var(--card-foreground))" }}>
                        What you&apos;ll get:
                      </h4>
                      <ul className="space-y-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                        <li className="flex items-center">
                          <Check className="mr-2 h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
                          Unlimited access to all books
                        </li>
                        <li className="flex items-center">
                          <Check className="mr-2 h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
                          Access to courses and projects
                        </li>
                        <li className="flex items-center">
                          <Check className="mr-2 h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
                          Premium learning resources
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description Section */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-semibold" style={{ color: "hsl(var(--card-foreground))" }}>
                  Description
                </h3>
                {isEditMode && (
                  <button
                    className="p-2 rounded hover:bg-muted/50"
                    onClick={() => setActiveModal("description")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: "hsl(var(--muted))" }}
              >
                {isEditMode ? (
                  <EditableText
                    value={bookData.description || ""}
                    onChange={(description) => callbacks.onEditDescription?.(description)}
                    as="div"
                    className="prose prose-sm max-w-none"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                    placeholder="Add book description..."
                    multiline
                  />
                ) : (
                  <>
                    <div
                      className="prose prose-sm max-w-none"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                      dangerouslySetInnerHTML={{
                        __html: isLongDescription && !showFullDescription
                          ? (bookData.description?.slice(0, sliceLength) || "") + "..."
                          : bookData.description || "No description available",
                      }}
                    />
                    {isLongDescription && (
                      <button
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="mt-2 text-sm font-medium hover:underline"
                        style={{ color: "hsl(var(--primary))" }}
                      >
                        {showFullDescription ? "Show less" : "Show more"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Authors Section */}
      {authors.length > 0 && (
        <section className="py-8 lg:py-16" style={{ backgroundColor: "hsl(var(--muted))" }}>
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                About the Author{authors.length > 1 ? "s" : ""}
              </h2>
              {isEditMode && (
                <button
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-card/50 transition-colors"
                  style={{ borderColor: "hsl(var(--border))" }}
                  onClick={() => setActiveModal("author")}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              )}
            </div>
            <div className="space-y-6">
              {authors.map((author) => (
                <div
                  key={author.id}
                  className="flex flex-col sm:flex-row gap-6 items-start rounded-xl p-6"
                  style={{ backgroundColor: "hsl(var(--card))" }}
                >
                  {author.avatar ? (
                    <img
                      src={author.avatar}
                      alt={author.name}
                      className="h-24 w-24 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="h-24 w-24 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "hsl(var(--muted))" }}
                    >
                      <User className="h-10 w-10" style={{ color: "hsl(var(--muted-foreground))" }} />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold" style={{ color: "hsl(var(--card-foreground))" }}>
                      {author.name}
                    </h3>
                    {author.role && (
                      <p className="text-sm mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {author.role} {author.company && `at ${author.company}`}
                      </p>
                    )}
                    {author.bio && (
                      <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {author.bio}
                      </p>
                    )}
                    {author.experiences && author.experiences.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {author.experiences.map((exp, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {exp.companyLogo ? (
                              <img src={exp.companyLogo} alt={exp.company} className="h-7 w-7 rounded object-contain flex-shrink-0" style={{ backgroundColor: "hsl(var(--muted))", padding: "1px" }} />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded flex-shrink-0" style={{ backgroundColor: "hsl(var(--muted))" }}>
                                <span className="text-[10px] font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>{exp.company.charAt(0)}</span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-medium" style={{ color: "hsl(var(--card-foreground) / 0.85)" }}>{exp.company}</span>
                              {exp.years > 0 && <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}> &middot; {exp.years} yr{exp.years !== 1 ? "s" : ""}</span>}
                              {exp.details && (() => {
                                const detailKey = `${author.id}-${idx}`;
                                const isLong = exp.details.length > 100;
                                const isExpanded = expandedExpDetails.has(detailKey);
                                return (
                                  <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                                    {isLong && !isExpanded ? exp.details.slice(0, 100) : exp.details}
                                    {isLong && (
                                      <button
                                        onClick={() => toggleExpDetail(detailKey)}
                                        className="ml-1 font-medium hover:underline"
                                        style={{ color: "hsl(var(--primary))" }}
                                      >
                                        {isExpanded ? "Show less" : "...Show more"}
                                      </button>
                                    )}
                                  </p>
                                );
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {author.socialLinks && author.socialLinks.length > 0 && (
                      <div className="mt-2 flex items-center gap-1">
                        {author.socialLinks.map((link) => {
                          const Icon = SOCIAL_ICON_MAP[link.platform];
                          if (!Icon || !link.url.startsWith("http")) return null;
                          return (
                            <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded p-1 transition-colors hover:bg-muted" style={{ color: "hsl(var(--muted-foreground))" }} title={link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}>
                              <Icon className="h-4 w-4" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recommendations Section */}
      {((bookData.recommendations?.length ?? 0) > 0 || (isEditMode && callbacks.onEditRecommendations)) && (
        <section className="py-8 lg:py-16" style={{ backgroundColor: "hsl(var(--background))" }}>
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: "hsl(var(--card-foreground))" }}>
                <Library className="h-6 w-6" style={{ color: "hsl(var(--primary))" }} />
                More books you might like
              </h2>
              {isEditMode && callbacks.onEditRecommendations && (
                <button
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                  style={{ borderColor: "hsl(var(--border))" }}
                  onClick={() => callbacks.onEditRecommendations?.()}
                >
                  <Pencil className="h-4 w-4" />
                  {bookData.recommendations?.length ? "Edit" : "Add"}
                </button>
              )}
            </div>
            {(bookData.recommendations?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-start">
                {bookData.recommendations!.map((rec) => (
                  <a
                    key={rec.id}
                    href={`/books/${rec.slug}`}
                    className="flex flex-col rounded-lg border overflow-hidden transition-colors hover:border-primary/50 group w-full max-w-[200px] min-w-[180px]"
                    style={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                    }}
                  >
                    <div className="aspect-[2/3] w-full relative bg-muted flex-shrink-0 overflow-hidden">
                      {rec.thumbnailUrl ? (
                        <img src={rec.thumbnailUrl} alt={rec.title} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Library className="h-8 w-8 opacity-50" style={{ color: "hsl(var(--muted-foreground))" }} />
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex-1 min-h-[2.75rem] flex flex-col justify-center">
                      <p className="font-medium text-xs line-clamp-3 break-words" style={{ color: "hsl(var(--card-foreground))" }}>
                        {rec.title}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-xl border border-dashed" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                <Library className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No book recommendations yet</p>
                {isEditMode && callbacks.onEditRecommendations && (
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                    style={{ borderColor: "hsl(var(--border))" }}
                    onClick={() => callbacks.onEditRecommendations?.()}
                  >
                    Add Recommendations
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
