"use client";

import {
  BookOpen,
  Globe,
  FileText,
  User,
  Share2,
  Pencil,
  Star,
  Clock,
  ShoppingCart,
  Bookmark,
  Library,
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

interface ModernTemplateProps {
  className?: string;
  onStartReading?: () => void;
  onUnlock?: () => void;
  /** EPUB upload callback - used in edit mode */
  onEpubUpload?: (file: File) => Promise<string | undefined>;
  /** PDF upload callback - used in edit mode */
  onPdfUpload?: (file: File) => Promise<string | undefined>;
}

/**
 * Modern book template - Contemporary design with gradient hero and sticky sidebar
 * Features 3D book cover effect and floating metadata badges
 */
export function ModernTemplate({ className, onStartReading, onUnlock, onEpubUpload: _onEpubUpload, onPdfUpload: _onPdfUpload }: ModernTemplateProps) {
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

  const sliceLength = 500;
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
  const { symbol, finalPrice, originalPrice, discountPct: discount, savingLabel, locale } = priceDisplay;
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
      {/* Hero Section with Gradient */}
      <section
        className="relative overflow-hidden py-12 lg:py-20"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary)/0.1) 0%, hsl(var(--background)) 50%, hsl(var(--primary)/0.05) 100%)",
        }}
      >
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Book Cover with 3D Effect */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                {/* Shadow/Depth Effect */}
                <div
                  className="absolute -right-4 top-8 h-[90%] w-[90%] rounded-lg opacity-20"
                  style={{ backgroundColor: "hsl(var(--foreground))" }}
                />
                <div
                  className="absolute -right-2 top-4 h-[95%] w-[95%] rounded-lg opacity-10"
                  style={{ backgroundColor: "hsl(var(--foreground))" }}
                />
                
                {/* Main Book Cover */}
                <div className="relative w-[280px] sm:w-[320px] lg:w-[350px] overflow-hidden rounded-xl shadow-2xl transform hover:scale-[1.02] transition-transform duration-500">
                  <EditableThumbnail
                    src={bookData.webThumbnailUrl || ""}
                    fallbackSrc={bookData.mobileThumbnailUrl || ""}
                    alt={bookData.title || "Book cover"}
                    aspectRatio="book"
                    placeholder="Click to add book cover"
                    className="w-full"
                  />
                </div>

                {/* Floating Badge, hidden once the reader owns the book so it
                    doesn't sit next to the "Start Reading" CTA and read as
                    "enrolled for free". */}
                {bookData.purchaseMode === "FREE" && !bookData.isBought && !accessManagedActive && (
                  <div
                    className="absolute -top-2 -right-2 rounded-full px-4 py-2 font-bold text-sm shadow-lg"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.8))",
                      color: "hsl(var(--primary-foreground))",
                    }}
                  >
                    FREE
                  </div>
                )}
              </div>
            </div>

            {/* Right: Book Info */}
            <div className="text-center lg:text-left">
              {/* Category Badge */}
              {(lastCategory || isEditMode) && (
                <div className="mb-4">
                  {isEditMode ? (
                    <button
                      onClick={() => setActiveModal("category")}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
                      style={{ 
                        backgroundColor: "hsl(var(--primary)/0.1)", 
                        color: "hsl(var(--primary))" 
                      }}
                    >
                      {lastCategory?.name || "Book"}
                      <Pencil className="h-3 w-3" />
                    </button>
                  ) : (
                    <span
                      className="inline-block rounded-full px-4 py-1.5 text-sm font-medium"
                      style={{ 
                        backgroundColor: "hsl(var(--primary)/0.1)", 
                        color: "hsl(var(--primary))" 
                      }}
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
                className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight"
                style={{ color: "hsl(var(--card-foreground))" }}
                placeholder="Book Title"
              />

              {/* Authors */}
              {(authors.length > 0 || isEditMode) && (
                <div className="mb-6 flex items-center justify-center lg:justify-start gap-2">
                  {authors.length > 0 && (
                    <p className="text-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
                      by <span className="font-semibold" style={{ color: "hsl(var(--foreground))" }}>{authorNames}</span>
                    </p>
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

              {/* Meta Badges */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-3 mb-8">
                {((bookData.rating != null && bookData.rating > 0) || (isEditMode && callbacks.onEditRating)) ? (
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                    style={{ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                  >
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>{(bookData.rating ?? 0).toFixed(1)}</span>
                    {bookData.ratingTotalCount != null && bookData.ratingTotalCount > 0 && (
                      <span>({bookData.ratingTotalCount} ratings)</span>
                    )}
                    {isEditMode && callbacks.onEditRating && (
                      <button onClick={() => callbacks.onEditRating?.()} style={{ color: "hsl(var(--primary))" }}>
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : null}
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                  style={{ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                >
                  <Globe className="h-4 w-4" />
                  {bookData.language || "English"}
                </div>
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                  style={{ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                >
                  <FileText className="h-4 w-4" />
                  {bookData.pages || "N/A"} pages
                </div>
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                  style={{ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                >
                  <Clock className="h-4 w-4" />
                  {Math.ceil((bookData.pages || 200) / 50)} hrs read
                </div>
              </div>

              {/* Price & CTA */}
              <div className="space-y-4">
                {priceUnavailable && !accessManagedActive && (
                  <div className="flex items-center justify-center lg:justify-start">
                    <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                      Not available for purchase
                    </span>
                  </div>
                )}
                {bookData.purchaseMode === "PAID" && !priceUnavailable && !accessManagedActive && (
                  <div>
                    <div className="flex items-center justify-center lg:justify-start gap-4">
                      <span className="text-3xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                        {symbol}{finalPrice.toLocaleString(locale)}
                      </span>
                      {discount > 0 && (
                        <>
                          <span className="text-lg line-through" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {symbol}{originalPrice.toLocaleString(locale)}
                          </span>
                          <span
                            className="rounded-full px-3 py-1 text-sm font-bold"
                            style={{
                              backgroundColor: "hsl(var(--primary)/0.1)",
                              color: "hsl(var(--primary))",
                            }}
                          >
                            {savingLabel?.toUpperCase()}
                          </span>
                        </>
                      )}
                    </div>
                    {priceDisplay.additionalPrices && priceDisplay.additionalPrices.length > 0 && (
                      <p className="mt-1 text-center text-sm lg:text-left" style={{ color: "hsl(var(--muted-foreground))" }}>
                        Also priced: {priceDisplay.additionalPrices.map((p) => p.label).join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {isEditMode && (
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                    onClick={() => setActiveModal("pricing")}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Pricing
                  </button>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
                  {accessManagedActive && !displayAsOwned ? (
                    <AccessManagedCta
                      hasAccess={false}
                      supportEmail={supportEmail}
                      contactSubject={bookData.title}
                      size="lg"
                    />
                  ) : !priceUnavailable || displayAsOwned ? (
                  <button
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 font-bold text-lg shadow-lg transition-all hover:shadow-xl hover:scale-[1.02]"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.8))",
                      color: "hsl(var(--primary-foreground))",
                    }}
                    onClick={displayAsOwned ? onStartReading : onUnlock}
                  >
                    {displayAsOwned ? (
                      <>
                        <BookOpen className="h-5 w-5" />
                        Start Reading
                      </>
                    ) : bookData.purchaseMode === "FREE" ? (
                      <>
                        <BookOpen className="h-5 w-5" />
                        Read Free
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5" />
                        Get Access
                      </>
                    )}
                  </button>
                  ) : null}

                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 font-medium border-2 transition-colors hover:bg-muted/50"
                    style={{ borderColor: "hsl(var(--border))" }}
                    onClick={!isEditMode ? callbacks.onShare : undefined}
                  >
                    <Share2 className="h-5 w-5" />
                    Share
                  </button>

                  {(bookData.status === "PUBLISHED" || bookData.publishStatus === "PUBLISHED") && !isEditMode && (
                    <>
                      {callbacks.onAddToCart && bookData.purchaseMode === "PAID" && !priceUnavailable && !accessManagedActive && (
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 font-medium border-2 transition-colors hover:bg-muted/50"
                          style={{
                            borderColor: callbacks.isInCart ? "hsl(var(--destructive))" : "hsl(var(--border))",
                            color: callbacks.isInCart ? "hsl(var(--destructive))" : undefined,
                          }}
                          onClick={callbacks.isInCart ? callbacks.onAddToCart : callbacks.onAddToCart}
                        >
                          <ShoppingCart className="h-5 w-5" />
                          {callbacks.isInCart ? "Remove from Cart" : "Add to Cart"}
                        </button>
                      )}
                      {callbacks.onBuyNow && bookData.purchaseMode === "PAID" && !priceUnavailable && !accessManagedActive && (
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 font-medium border-2 transition-colors hover:bg-muted/50"
                          style={{ borderColor: "hsl(var(--border))" }}
                          onClick={callbacks.onBuyNow}
                        >
                          Buy Now
                        </button>
                      )}
                      {callbacks.onBookmarkToggle && (
                        <button
                          className="inline-flex items-center justify-center gap-2 rounded-xl p-4 font-medium border-2 transition-colors hover:bg-muted/50"
                          style={{ borderColor: "hsl(var(--border))" }}
                          onClick={callbacks.onBookmarkToggle}
                          aria-label="Bookmark"
                        >
                          <Bookmark className="h-5 w-5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* Description */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                  About This Book
                </h2>
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
                className="rounded-2xl p-6"
                style={{ backgroundColor: "hsl(var(--card))" }}
              >
                {isEditMode ? (
                  <EditableText
                    value={bookData.description || ""}
                    onChange={(description) => callbacks.onEditDescription?.(description)}
                    as="div"
                    className="prose prose-lg max-w-none"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                    placeholder="Add book description..."
                    multiline
                  />
                ) : (
                  <>
                    <div
                      className="prose prose-lg max-w-none leading-relaxed"
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
                        className="mt-4 text-sm font-medium hover:underline"
                        style={{ color: "hsl(var(--primary))" }}
                      >
                        {showFullDescription ? "Show less" : "Read more"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Authors Section */}
            {authors.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                    About the Author{authors.length > 1 ? "s" : ""}
                  </h2>
                  {isEditMode && (
                    <button
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
                      style={{ borderColor: "hsl(var(--border))" }}
                      onClick={() => setActiveModal("author")}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {authors.map((author) => (
                    <div
                      key={author.id}
                      className="flex flex-col items-center text-center rounded-2xl p-6"
                      style={{ backgroundColor: "hsl(var(--card))" }}
                    >
                      {author.avatar ? (
                        <img
                          src={author.avatar}
                          alt={author.name}
                          className="h-20 w-20 rounded-full object-cover mb-4"
                        />
                      ) : (
                        <div
                          className="h-20 w-20 rounded-full flex items-center justify-center mb-4"
                          style={{ backgroundColor: "hsl(var(--muted))" }}
                        >
                          <User className="h-8 w-8" style={{ color: "hsl(var(--muted-foreground))" }} />
                        </div>
                      )}
                      <h3 className="text-lg font-semibold mb-1" style={{ color: "hsl(var(--card-foreground))" }}>
                        {author.name}
                      </h3>
                      {author.role && (
                        <p className="text-sm mb-2" style={{ color: "hsl(var(--primary))" }}>
                          {author.role}
                        </p>
                      )}
                      {author.bio && (
                        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {author.bio}
                        </p>
                      )}
                      {author.experiences && author.experiences.length > 0 && (
                        <div className="mt-2 flex flex-col items-center gap-1.5">
                          {author.experiences.map((exp, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              {exp.companyLogo ? (
                                <img src={exp.companyLogo} alt={exp.company} className="h-6 w-6 rounded object-contain flex-shrink-0" style={{ backgroundColor: "hsl(var(--muted))", padding: "1px" }} />
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded flex-shrink-0" style={{ backgroundColor: "hsl(var(--muted))" }}>
                                  <span className="text-[10px] font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>{exp.company.charAt(0)}</span>
                                </div>
                              )}
                              <div className="min-w-0 text-center">
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
                        <div className="mt-2 flex items-center justify-center gap-1">
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
                  ))}
                </div>
              </section>
            )}

            {/* Recommendations Section */}
            {((bookData.recommendations?.length ?? 0) > 0 || (isEditMode && callbacks.onEditRecommendations)) && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: "hsl(var(--card-foreground))" }}>
                    <Library className="h-6 w-6" style={{ color: "hsl(var(--primary))" }} />
                    More books you might like
                  </h2>
                  {isEditMode && callbacks.onEditRecommendations && (
                    <button
                      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
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
                        className="mt-4 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
                        style={{ borderColor: "hsl(var(--border))" }}
                        onClick={() => callbacks.onEditRecommendations?.()}
                      >
                        Add Recommendations
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-6">
              {/* Book Details */}
              <div
                className="rounded-2xl p-6"
                style={{ backgroundColor: "hsl(var(--card))" }}
              >
                <h3 className="text-lg font-bold mb-4" style={{ color: "hsl(var(--card-foreground))" }}>
                  Book Details
                </h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Language</dt>
                    <dd className="text-sm font-medium" style={{ color: "hsl(var(--card-foreground))" }}>
                      {bookData.language || "English"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Pages</dt>
                    <dd className="text-sm font-medium" style={{ color: "hsl(var(--card-foreground))" }}>
                      {bookData.pages || "N/A"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Format</dt>
                    <dd className="text-sm font-medium" style={{ color: "hsl(var(--card-foreground))" }}>
                      Digital (PDF)
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Publisher</dt>
                    <dd className="text-sm font-medium" style={{ color: "hsl(var(--card-foreground))" }}>
                      {authors.map((a) => a.name).join(", ") || "Self-published"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
