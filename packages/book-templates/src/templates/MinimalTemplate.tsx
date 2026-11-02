"use client";

import {
  BookOpen,
  Globe,
  FileText,
  User,
  Pencil,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Upload,
  Library,
  Loader2,
  Star,
  Share2,
  ShoppingCart,
  Bookmark,
  Linkedin,
  Twitter,
  Github,
  Youtube,
  Facebook,
  Instagram,
} from "lucide-react";
import { useState, useRef } from "react";
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

interface MinimalTemplateProps {
  className?: string;
  onStartReading?: () => void;
  onUnlock?: () => void;
  /** EPUB upload callback - used in edit mode */
  onEpubUpload?: (file: File) => Promise<string | undefined>;
  /** PDF upload callback - used in edit mode */
  onPdfUpload?: (file: File) => Promise<string | undefined>;
}

/**
 * Minimal book template - Clean, centered layout with typography-focused design
 * Features collapsible sections and bottom floating CTA
 */
export function MinimalTemplate({ className, onStartReading, onUnlock, onEpubUpload, onPdfUpload }: MinimalTemplateProps) {
  const { bookData, authors, categories, accessManaged, supportEmail } = useBookData();
  const { isEditMode, callbacks, setActiveModal } = useBookEdit();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["description", "recommendations"]));
  const [expandedExpDetails, setExpandedExpDetails] = useState<Set<string>>(new Set());
  const [isUploadingEpub, setIsUploadingEpub] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isEditingLanguage, setIsEditingLanguage] = useState(false);
  const [isEditingPages, setIsEditingPages] = useState(false);
  // language can be string or string[] - normalize to single string for display/edit
  const languageDisplay = Array.isArray(bookData.language) ? bookData.language[0] || "English" : (bookData.language || "English");
  const [editLanguageValue, setEditLanguageValue] = useState(languageDisplay);
  const [editPagesValue, setEditPagesValue] = useState(String(bookData.pages || 0));
  const epubInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const currentFormat = bookData.fileFormat ?? "EPUB";

  const toggleExpDetail = (key: string) => {
    setExpandedExpDetails((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

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

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // EPUB upload handler
  const handleEpubUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onEpubUpload) return;

    setIsUploadingEpub(true);
    try {
      await onEpubUpload(file);
    } finally {
      setIsUploadingEpub(false);
      if (epubInputRef.current) {
        epubInputRef.current.value = "";
      }
    }
  };

  // PDF upload handler
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onPdfUpload) return;

    setIsUploadingPdf(true);
    try {
      await onPdfUpload(file);
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = "";
      }
    }
  };

  // Either upload in flight should disable the opposite button so we don't
  // race two formats into the same book row.
  const anyUploadInFlight = isUploadingEpub || isUploadingPdf;

  // Language edit handlers
  const handleLanguageSave = () => {
    callbacks.onEditLanguage?.(editLanguageValue);
    setIsEditingLanguage(false);
  };

  // Pages edit handlers
  const handlePagesSave = () => {
    const pages = parseInt(editPagesValue, 10) || 0;
    callbacks.onEditPages?.(pages);
    setIsEditingPages(false);
  };

  return (
    <div className={cn("min-h-screen", className)} style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
      {/* Hero - Centered and Minimal */}
      <section className="pt-16 lg:pt-24 pb-6 lg:pb-8">
        <div className="mx-auto max-w-3xl px-4 text-center">
          {/* Category */}
          {(lastCategory || isEditMode) && (
            <div className="mb-6">
              {isEditMode ? (
                <button
                  onClick={() => setActiveModal("category")}
                  className="inline-flex items-center gap-2 text-sm font-medium tracking-wide uppercase transition-colors"
                  style={{ color: "hsl(var(--primary))" }}
                >
                  {lastCategory?.name || "Book"}
                  <Pencil className="h-3 w-3" />
                </button>
              ) : (
                <span
                  className="text-sm font-medium tracking-wide uppercase"
                  style={{ color: "hsl(var(--primary))" }}
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
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
            style={{ color: "hsl(var(--card-foreground))" }}
            placeholder="Book Title"
          />

          {/* Authors */}
          {(authors.length > 0 || isEditMode) && (
            <div className="mb-8 flex items-center justify-center gap-2">
              {authors.length > 0 && (
                <p className="text-lg" style={{ color: "hsl(var(--muted-foreground))" }}>
                  by {authorNames}
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

          {/* Meta */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-6 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            {/* Language - Editable */}
            {isEditMode && isEditingLanguage ? (
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <input
                  type="text"
                  value={editLanguageValue}
                  onChange={(e) => setEditLanguageValue(e.target.value)}
                  onBlur={handleLanguageSave}
                  onKeyDown={(e) => e.key === "Enter" && handleLanguageSave()}
                  className="border rounded px-2 py-0.5 text-sm bg-background"
                  style={{ width: "100px" }}
                  autoFocus
                />
              </span>
            ) : (
              <span 
                className={cn("flex items-center gap-2", isEditMode && "cursor-pointer hover:text-primary")}
                onClick={() => isEditMode && setIsEditingLanguage(true)}
              >
                <Globe className="h-4 w-4" />
                {languageDisplay}
                {isEditMode && <Pencil className="h-3 w-3 ml-1" />}
              </span>
            )}
            <span className="w-1 h-1 rounded-full bg-current opacity-50" />
            {/* Pages - Editable */}
            {isEditMode && isEditingPages ? (
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <input
                  type="number"
                  value={editPagesValue}
                  onChange={(e) => setEditPagesValue(e.target.value)}
                  onBlur={handlePagesSave}
                  onKeyDown={(e) => e.key === "Enter" && handlePagesSave()}
                  className="border rounded px-2 py-0.5 text-sm bg-background"
                  style={{ width: "80px" }}
                  autoFocus
                />
                <span>pages</span>
              </span>
            ) : (
              <span 
                className={cn("flex items-center gap-2", isEditMode && "cursor-pointer hover:text-primary")}
                onClick={() => isEditMode && setIsEditingPages(true)}
              >
                <FileText className="h-4 w-4" />
                {bookData.pages || "N/A"} pages
                {isEditMode && <Pencil className="h-3 w-3 ml-1" />}
              </span>
            )}
            {((bookData.rating != null && bookData.rating > 0) || (isEditMode && callbacks.onEditRating)) ? (
              <>
                <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                <span
                  className="flex items-center gap-2"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500 shrink-0" />
                  <span className="font-medium" style={{ color: "hsl(var(--foreground))" }}>{(bookData.rating ?? 0).toFixed(1)}</span>
                  {bookData.ratingTotalCount != null && bookData.ratingTotalCount > 0 && (
                    <span>({bookData.ratingTotalCount} ratings)</span>
                  )}
                  {isEditMode && callbacks.onEditRating && (
                    <button onClick={() => callbacks.onEditRating?.()} style={{ color: "hsl(var(--primary))" }}>
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </span>
              </>
            ) : null}
            <span className="w-1 h-1 rounded-full bg-current opacity-50" />
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Digital Format
            </span>
          </div>
        </div>
      </section>

      {/* Book Cover - Centered */}
      <section className="pb-16">
        <div className="mx-auto max-w-md px-4">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl">
            <EditableThumbnail
              src={bookData.webThumbnailUrl || ""}
              fallbackSrc={bookData.mobileThumbnailUrl || ""}
              alt={bookData.title || "Book cover"}
              aspectRatio="book"
              placeholder="Click to add book cover"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Book file Section - Edit Mode Only */}
      {isEditMode && (
        <section className="pb-8">
          <div className="mx-auto max-w-md px-4">
            <div
              className="rounded-2xl p-6 border-2 border-dashed"
              style={{
                backgroundColor: "hsl(var(--card))",
                borderColor: bookData.url ? "hsl(var(--primary))" : "hsl(var(--border))",
              }}
            >
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2" style={{ color: "hsl(var(--card-foreground))" }}>
                  Book file
                </h3>
                {bookData.url ? (
                  <div className="flex items-center justify-center gap-2 text-sm mb-3" style={{ color: "hsl(var(--primary))" }}>
                    <FileText className="h-4 w-4" />
                    <span>{currentFormat} ready · upload again to replace</span>
                  </div>
                ) : (
                  <p className="text-sm mb-3" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Upload an EPUB or PDF for this book.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <label className={cn("cursor-pointer", anyUploadInFlight && "cursor-not-allowed opacity-60")}>
                    <input
                      ref={epubInputRef}
                      type="file"
                      accept=".epub,application/epub+zip"
                      className="hidden"
                      onChange={handleEpubUpload}
                      disabled={anyUploadInFlight}
                    />
                    <span
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                      style={{
                        backgroundColor:
                          !bookData.url || currentFormat === "EPUB"
                            ? "hsl(var(--primary))"
                            : "hsl(var(--muted))",
                        color:
                          !bookData.url || currentFormat === "EPUB"
                            ? "hsl(var(--primary-foreground))"
                            : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {isUploadingEpub ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {isUploadingEpub ? "Uploading EPUB..." : bookData.url && currentFormat === "EPUB" ? "Replace EPUB" : "Upload EPUB"}
                    </span>
                  </label>
                  <label className={cn("cursor-pointer", anyUploadInFlight && "cursor-not-allowed opacity-60")}>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={handlePdfUpload}
                      disabled={anyUploadInFlight}
                    />
                    <span
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                      style={{
                        backgroundColor:
                          bookData.url && currentFormat === "PDF"
                            ? "hsl(var(--primary))"
                            : "hsl(var(--muted))",
                        color:
                          bookData.url && currentFormat === "PDF"
                            ? "hsl(var(--primary-foreground))"
                            : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {isUploadingPdf ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {isUploadingPdf ? "Uploading PDF..." : bookData.url && currentFormat === "PDF" ? "Replace PDF" : "Upload PDF"}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-12" style={{ backgroundColor: "hsl(var(--muted))" }}>
        <div className="mx-auto max-w-2xl px-4 text-center">
          {/* Price */}
          {priceUnavailable && !accessManagedActive && (
            <div className="mb-6">
              <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                Not available for purchase
              </span>
            </div>
          )}
          {bookData.purchaseMode === "PAID" && !priceUnavailable && !accessManagedActive && (
            <div className="mb-6">
              <span className="text-4xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                {symbol}{finalPrice.toLocaleString(locale)}
              </span>
              {discount > 0 && (
                <span className="ml-3">
                  <span className="text-lg line-through" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {symbol}{originalPrice.toLocaleString(locale)}
                  </span>
                  <span className="ml-2 text-sm font-bold" style={{ color: "hsl(var(--primary))" }}>
                    {savingLabel}
                  </span>
                </span>
              )}
              {priceDisplay.additionalPrices && priceDisplay.additionalPrices.length > 0 && (
                <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Also priced: {priceDisplay.additionalPrices.map((p) => p.label).join(", ")}
                </p>
              )}
            </div>
          )}

          {isEditMode && (
            <button
              className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
              onClick={() => setActiveModal("pricing")}
            >
              <Pencil className="h-4 w-4" />
              Edit Pricing
            </button>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {accessManagedActive && !displayAsOwned ? (
              <AccessManagedCta
                hasAccess={false}
                supportEmail={supportEmail}
                contactSubject={bookData.title}
                size="lg"
              />
            ) : !priceUnavailable || displayAsOwned ? (
            <button
              className="inline-flex items-center gap-2 px-10 py-5 rounded-full font-bold text-lg transition-transform hover:scale-105"
              style={{
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
              onClick={displayAsOwned ? onStartReading : onUnlock}
            >
              {displayAsOwned ? "Start Reading" : bookData.purchaseMode === "FREE" ? "Read Free" : "Get Access"}
              <ArrowRight className="h-5 w-5" />
            </button>
            ) : null}
            {(bookData.status === "PUBLISHED" || bookData.publishStatus === "PUBLISHED") && !isEditMode && (
              <div className="flex items-center gap-2">
                {callbacks.onAddToCart && bookData.purchaseMode === "PAID" && !priceUnavailable && !accessManagedActive && (
                  <button
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium border-2 transition-colors hover:bg-muted/50"
                    style={{
                      borderColor: callbacks.isInCart ? "hsl(var(--destructive))" : "hsl(var(--border))",
                      color: callbacks.isInCart ? "hsl(var(--destructive))" : "hsl(var(--card-foreground))",
                    }}
                    onClick={callbacks.onAddToCart}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {callbacks.isInCart ? "Remove from Cart" : "Add to Cart"}
                  </button>
                )}
                {callbacks.onBuyNow && bookData.purchaseMode === "PAID" && !priceUnavailable && !accessManagedActive && (
                  <button
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium border-2 transition-colors hover:bg-muted/50"
                    style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                    onClick={callbacks.onBuyNow}
                  >
                    Buy Now
                  </button>
                )}
                {callbacks.onBookmarkToggle && (
                  <button
                    className="inline-flex items-center gap-2 p-3 rounded-full border-2 transition-colors hover:bg-muted/50"
                    style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                    onClick={callbacks.onBookmarkToggle}
                    aria-label="Bookmark"
                  >
                    <Bookmark className="h-5 w-5" />
                  </button>
                )}
                {callbacks.onShare && (
                  <button
                    className="inline-flex items-center gap-2 p-3 rounded-full border-2 transition-colors hover:bg-muted/50"
                    style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                    onClick={callbacks.onShare}
                    aria-label="Share"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Purchase info */}
          {!bookData.isBought && bookData.purchaseMode === "PAID" && !accessManagedActive && (
            <p className="mt-4 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Instant access after purchase
            </p>
          )}
        </div>
      </section>

      {/* Collapsible Content Sections */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 space-y-4">
          {/* Description Section */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "hsl(var(--card))" }}
          >
            <button
              className="w-full flex items-center justify-between p-6 text-left"
              onClick={() => toggleSection("description")}
            >
              <h2 className="text-xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                About This Book
              </h2>
              <div className="flex items-center gap-2">
                {isEditMode && (
                  <button
                    className="p-2 rounded hover:bg-muted/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveModal("description");
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {expandedSections.has("description") ? (
                  <ChevronUp className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />
                ) : (
                  <ChevronDown className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />
                )}
              </div>
            </button>
            {expandedSections.has("description") && (
              <div className="px-6 pb-6">
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
                  <div
                    className="prose prose-lg max-w-none leading-relaxed"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                    dangerouslySetInnerHTML={{
                      __html: bookData.description || "No description available",
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Authors Section */}
          {authors.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "hsl(var(--card))" }}
            >
              <button
                className="w-full flex items-center justify-between p-6 text-left"
                onClick={() => toggleSection("authors")}
              >
                <h2 className="text-xl font-bold" style={{ color: "hsl(var(--card-foreground))" }}>
                  About the Author{authors.length > 1 ? "s" : ""}
                </h2>
                <div className="flex items-center gap-2">
                  {isEditMode && (
                    <button
                      className="p-2 rounded hover:bg-muted/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModal("author");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {expandedSections.has("authors") ? (
                    <ChevronUp className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />
                  ) : (
                    <ChevronDown className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />
                  )}
                </div>
              </button>
              {expandedSections.has("authors") && (
                <div className="px-6 pb-6 space-y-6">
                  {authors.map((author) => (
                    <div key={author.id} className="flex gap-4 items-start">
                      {author.avatar ? (
                        <img
                          src={author.avatar}
                          alt={author.name}
                          className="h-16 w-16 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: "hsl(var(--muted))" }}
                        >
                          <User className="h-6 w-6" style={{ color: "hsl(var(--muted-foreground))" }} />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold" style={{ color: "hsl(var(--card-foreground))" }}>
                          {author.name}
                        </h3>
                        {author.role && (
                          <p className="text-sm mb-1" style={{ color: "hsl(var(--primary))" }}>
                            {author.role}
                          </p>
                        )}
                        {author.bio && (
                          <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {author.bio}
                          </p>
                        )}
                        {author.experiences && author.experiences.length > 0 && (
                          <div className="mt-1.5 flex flex-col gap-1">
                            {author.experiences.map((exp, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                                {exp.companyLogo ? (
                                  <img src={exp.companyLogo} alt={exp.company} className="h-5 w-5 rounded object-contain flex-shrink-0" style={{ backgroundColor: "hsl(var(--muted))", padding: "1px" }} />
                                ) : (
                                  <div className="flex h-5 w-5 items-center justify-center rounded flex-shrink-0" style={{ backgroundColor: "hsl(var(--muted))" }}>
                                    <span className="text-[9px] font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>{exp.company.charAt(0)}</span>
                                  </div>
                                )}
                                <span className="font-medium">{exp.company}</span>
                                {exp.years > 0 && <span>&middot; {exp.years} yr{exp.years !== 1 ? "s" : ""}</span>}
                                {exp.details && (() => {
                                  const detailKey = `${author.id}-${idx}`;
                                  const isLong = exp.details.length > 100;
                                  const isExpanded = expandedExpDetails.has(detailKey);
                                  return (
                                    <span>
                                      &middot; {isLong && !isExpanded ? exp.details.slice(0, 100) : exp.details}
                                      {isLong && (
                                        <button
                                          onClick={() => toggleExpDetail(detailKey)}
                                          className="ml-1 font-medium hover:underline"
                                          style={{ color: "hsl(var(--primary))" }}
                                        >
                                          {isExpanded ? "Show less" : "...Show more"}
                                        </button>
                                      )}
                                    </span>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        )}
                        {author.socialLinks && author.socialLinks.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1">
                            {author.socialLinks.map((link) => {
                              const Icon = SOCIAL_ICON_MAP[link.platform];
                              if (!Icon || !link.url.startsWith("http")) return null;
                              return (
                                <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded p-1 transition-colors hover:bg-muted" style={{ color: "hsl(var(--muted-foreground))" }} title={link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}>
                                  <Icon className="h-3.5 w-3.5" />
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recommendations Section - More books you might like */}
          {((bookData.recommendations?.length ?? 0) > 0 || (isEditMode && callbacks.onEditRecommendations)) && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "hsl(var(--card))" }}
            >
              <button
                className="w-full flex items-center justify-between p-6 text-left"
                onClick={() => toggleSection("recommendations")}
              >
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "hsl(var(--card-foreground))" }}>
                  <Library className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                  More books you might like
                </h2>
                <div className="flex items-center gap-2">
                  {isEditMode && callbacks.onEditRecommendations && (
                    <button
                      className="p-2 rounded hover:bg-muted/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        callbacks.onEditRecommendations?.();
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {expandedSections.has("recommendations") ? (
                    <ChevronUp className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />
                  ) : (
                    <ChevronDown className="h-5 w-5" style={{ color: "hsl(var(--muted-foreground))" }} />
                  )}
                </div>
              </button>
              {expandedSections.has("recommendations") && (
                <div className="px-6 pb-6">
                  {(bookData.recommendations?.length ?? 0) > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-start">
                      {bookData.recommendations!.map((rec) => (
                        <a
                          key={rec.id}
                          href={`/books/${rec.slug}`}
                          className="flex flex-col rounded-lg border overflow-hidden transition-colors hover:border-primary/50 group w-full max-w-[200px] min-w-[180px]"
                          style={{
                            backgroundColor: "hsl(var(--background))",
                            borderColor: "hsl(var(--border))",
                          }}
                        >
                          <div className="aspect-[2/3] w-full relative bg-muted flex-shrink-0 overflow-hidden">
                            {rec.thumbnailUrl ? (
                              <img
                                src={rec.thumbnailUrl}
                                alt={rec.title}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Library className="h-8 w-8 opacity-50" style={{ color: "hsl(var(--muted-foreground))" }} />
                              </div>
                            )}
                          </div>
                          <div className="p-2 flex-1 min-h-[2.75rem] flex flex-col justify-center">
                            <p className="font-medium text-xs line-clamp-3 break-words group-hover:text-primary transition-colors" style={{ color: "hsl(var(--card-foreground))" }}>
                              {rec.title}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8" style={{ color: "hsl(var(--muted-foreground))" }}>
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
              )}
            </div>
          )}
        </div>
      </section>

      {/* Bottom Floating CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
        <div
          className="p-4 border-t shadow-lg"
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <div className="mx-auto max-w-md flex items-center justify-between gap-4">
            {!accessManagedActive && (
              <div>
                {priceUnavailable ? (
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Not available for purchase
                  </p>
                ) : bookData.purchaseMode === "PAID" ? (
                  <>
                    <p className="font-bold text-lg" style={{ color: "hsl(var(--card-foreground))" }}>
                      {symbol}{finalPrice.toLocaleString(locale)}
                    </p>
                    {priceDisplay.additionalPrices && priceDisplay.additionalPrices.length > 0 && (
                      <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                        Also priced: {priceDisplay.additionalPrices.map((p) => p.label).join(", ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-medium" style={{ color: "hsl(var(--primary))" }}>
                    Free
                  </p>
                )}
              </div>
            )}
            {accessManagedActive && !displayAsOwned ? (
              <AccessManagedCta
                hasAccess={false}
                supportEmail={supportEmail}
                contactSubject={bookData.title}
                fullWidth
                className="flex-1"
              />
            ) : !priceUnavailable || displayAsOwned ? (
            <button
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold transition-transform hover:scale-[1.02]"
              style={{
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
              onClick={displayAsOwned ? onStartReading : onUnlock}
            >
              {displayAsOwned ? "Start Reading" : "Get Access"}
            </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Spacer for fixed bottom bar on mobile */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}
