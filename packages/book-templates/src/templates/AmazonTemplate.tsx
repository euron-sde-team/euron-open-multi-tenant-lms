"use client";

import {
  Star,
  ShoppingCart,
  BookOpen,
  User,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Upload,
  FileText,
  Bookmark,
  BookmarkCheck,
  Eye,
  Library,
  Settings,
  Tag,
  X,
  Loader2,
  Share2,
  Linkedin,
  Twitter,
  Github,
  Youtube,
  Globe,
  Facebook,
  Instagram,
} from "lucide-react";
import { useState, useRef } from "react";
import { AccessManagedCta } from "@open-mtlms/core";
import { cn, resolveTemplatePrice } from "../lib/utils";
import { useBookData, useBookEdit } from "../context";
import { EditableText, EditableThumbnail } from "../components/editable";
import { SampleReaderModal } from "../components/SampleReaderModal";

const SOCIAL_ICON_MAP: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  twitter: Twitter,
  github: Github,
  youtube: Youtube,
  website: Globe,
  facebook: Facebook,
  instagram: Instagram,
};

/** Lightweight inline coupon input for book template packages. */
function BookInlineCouponInput({
  onValidate,
  onApply,
}: {
  onValidate?: (code: string) => Promise<import("../types").CouponValidationResult>;
  onApply?: (result: import("../types").CouponValidationResult) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!code.trim() || !onValidate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onValidate(code.trim());
      onApply?.(result);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      setError(
        axiosErr?.response?.data?.error?.message ||
        axiosErr?.response?.data?.message ||
        (err instanceof Error ? err.message : "Failed to validate coupon")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div
        className="flex overflow-hidden rounded-lg border"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }}
          placeholder="Coupon code"
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm font-mono uppercase outline-none placeholder:font-sans placeholder:normal-case"
          style={{ color: "hsl(var(--foreground))" }}
          disabled={loading}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="shrink-0 border-l px-3 py-2 text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-40"
          style={{
            borderColor: "hsl(var(--border))",
            backgroundColor: "hsl(var(--muted))",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: "hsl(var(--destructive, 0 84% 60%))" }}>{error}</p>}
    </div>
  );
}

interface AmazonTemplateProps {
  className?: string;
  onStartReading?: () => void;
  onUnlock?: () => void;
  onEpubUpload?: (file: File) => Promise<string | undefined>;
  onPdfUpload?: (file: File) => Promise<string | undefined>;
}

export function AmazonTemplate({
  className,
  onStartReading,
  onUnlock,
  onEpubUpload,
  onPdfUpload,
}: AmazonTemplateProps) {
  const { bookData, authors, categories, accessManaged, supportEmail } = useBookData();
  const { isEditMode, callbacks, setActiveModal } = useBookEdit();
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [expandedExpDetails, setExpandedExpDetails] = useState<Set<string>>(new Set());
  const [isUploadingEpub, setIsUploadingEpub] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isEditingLanguage, setIsEditingLanguage] = useState(false);
  const [isEditingPages, setIsEditingPages] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const epubInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const currentFormat = bookData.fileFormat ?? "EPUB";

  const languageDisplay = Array.isArray(bookData.language)
    ? bookData.language[0] || "English"
    : bookData.language || "English";
  const [editLanguageValue, setEditLanguageValue] = useState(languageDisplay);
  const [editPagesValue, setEditPagesValue] = useState(String(bookData.pages || 0));

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

  // Authors
  const authorNames = authors.length > 0 ? authors.map((a) => a.name).join(", ") : "";
  const primaryAuthor = authors[0];

  // Category
  const categoryIds = bookData.categoryIds || [];
  const bookCategories = categoryIds
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean);

  // Rating
  const rating = bookData.rating || 0;
  const ratingCount = bookData.ratingTotalCount || 0;


  const toggleExpDetail = (key: string) => {
    setExpandedExpDetails((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
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
      if (epubInputRef.current) epubInputRef.current.value = "";
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
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const anyUploadInFlight = isUploadingEpub || isUploadingPdf;

  const handleLanguageSave = () => {
    callbacks.onEditLanguage?.(editLanguageValue);
    setIsEditingLanguage(false);
  };

  const handlePagesSave = () => {
    const pages = parseInt(editPagesValue, 10) || 0;
    callbacks.onEditPages?.(pages);
    setIsEditingPages(false);
  };

  // Render stars
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative">
            <Star className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
            <div className="absolute inset-0 w-1/2 overflow-hidden">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </div>
          </div>
        );
      } else {
        stars.push(
          <Star key={i} className="h-4 w-4" style={{ color: "hsl(var(--muted-foreground))" }} />
        );
      }
    }
    return stars;
  };

  return (
    <div
      className={cn("min-h-screen", className)}
      style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Left Column - Book Cover */}
          <div className="lg:col-span-3">
            <div className="sticky top-6">
              {/* Book Cover */}
              <div
                className="relative overflow-hidden rounded-lg border shadow-lg"
                style={{ backgroundColor: "hsl(var(--muted))", borderColor: "hsl(var(--border))" }}
              >
                <EditableThumbnail
                  src={bookData.webThumbnailUrl || ""}
                  fallbackSrc={bookData.mobileThumbnailUrl || ""}
                  alt={bookData.title || "Book cover"}
                  aspectRatio="book"
                  placeholder="Click to add book cover"
                  className="w-full"
                />
              </div>

              {/* Read Sample Button - Show for non-purchased books with EPUB content when enabled by admin */}
              {!callbacks.hasAccess && bookData.url && bookData.sampleEnabled !== false && !isEditMode && (
                <button
                  onClick={() => setShowSampleModal(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
                  style={{
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                    backgroundColor: "hsl(var(--card))",
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Read sample
                </button>
              )}

              {/* Continue Reading Button - Show for purchased books */}
              {callbacks.hasAccess && (
                <button
                  onClick={onStartReading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
                  style={{
                    borderColor: "hsl(var(--border))",
                    color: "hsl(var(--foreground))",
                    backgroundColor: "hsl(var(--card))",
                  }}
                >
                  <BookOpen className="h-4 w-4" />
                  Continue Reading
                </button>
              )}

              {/* Rating Display */}
              {(rating > 0 || isEditMode) && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-amber-600">{rating.toFixed(1)}</span>
                    <div className="flex items-center">{renderStars(rating)}</div>
                  </div>
                  {ratingCount > 0 && (
                    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                      ({ratingCount.toLocaleString()} ratings)
                    </span>
                  )}
                  {isEditMode && callbacks.onEditRating && (
                    <button
                      onClick={() => callbacks.onEditRating?.()}
                      className="ml-1"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Book file Upload - Edit Mode */}
              {isEditMode && (
                <div
                  className="mt-4 rounded-lg border-2 border-dashed p-4"
                  style={{
                    borderColor: bookData.url ? "hsl(var(--primary))" : "hsl(var(--border))",
                  }}
                >
                  <div className="text-center">
                    <h4
                      className="mb-2 text-sm font-medium"
                      style={{ color: "hsl(var(--foreground))" }}
                    >
                      Book file
                    </h4>
                    {bookData.url ? (
                      <div
                        className="mb-3 flex items-center justify-center gap-2 text-xs"
                        style={{ color: "hsl(var(--primary))" }}
                      >
                        <FileText className="h-3 w-3" />
                        <span>{currentFormat} ready · upload again to replace</span>
                      </div>
                    ) : (
                      <p className="mb-3 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                        Upload an EPUB or PDF.
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
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
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
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3" />
                          )}
                          {isUploadingEpub
                            ? "Uploading EPUB..."
                            : bookData.url && currentFormat === "EPUB"
                              ? "Replace EPUB"
                              : "Upload EPUB"}
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
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
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
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3" />
                          )}
                          {isUploadingPdf
                            ? "Uploading PDF..."
                            : bookData.url && currentFormat === "PDF"
                              ? "Replace PDF"
                              : "Upload PDF"}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Preview Settings - Edit Mode */}
              {isEditMode && bookData.url && callbacks.onEditSampleSettings && (
                <div
                  className="mt-4 rounded-lg border p-4"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4
                        className="text-sm font-medium"
                        style={{ color: "hsl(var(--foreground))" }}
                      >
                        Sample Preview
                      </h4>
                      <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                        {bookData.sampleEnabled !== false
                          ? `${bookData.samplePages || 10} pages preview enabled`
                          : "Preview disabled"}
                      </p>
                    </div>
                    <button
                      onClick={callbacks.onEditSampleSettings}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: "hsl(var(--muted))",
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      <Settings className="h-3 w-3" />
                      Configure
                    </button>
                  </div>
                </div>
              )}

              {/* Follow the Author */}
              {primaryAuthor && (
                <div className="mt-6 border-t pt-6" style={{ borderColor: "hsl(var(--border))" }}>
                  <h3
                    className="mb-3 text-sm font-medium"
                    style={{ color: "hsl(var(--foreground))" }}
                  >
                    Follow the author
                  </h3>
                  <div className="flex items-center gap-3">
                    {primaryAuthor.avatar ? (
                      <img
                        src={primaryAuthor.avatar}
                        alt={primaryAuthor.name}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: "hsl(var(--muted))" }}
                      >
                        <User
                          className="h-5 w-5"
                          style={{ color: "hsl(var(--muted-foreground))" }}
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        style={{ color: "hsl(var(--foreground))" }}
                      >
                        {primaryAuthor.name}
                      </p>
                      {primaryAuthor.role && (
                        <p
                          className="truncate text-xs"
                          style={{ color: "hsl(var(--muted-foreground))" }}
                        >
                          {primaryAuthor.role}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle Column - Book Details */}
          <div className="lg:col-span-6">
            {/* Title */}
            <EditableText
              value={bookData.title || ""}
              onChange={(title) => callbacks.onEditTitle?.(title)}
              as="h1"
              className="text-2xl font-medium leading-tight lg:text-3xl"
              style={{ color: "hsl(var(--foreground))" }}
              placeholder="Book Title"
            />

            {/* Subtitle/Format */}
            <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Digital Edition • {languageDisplay}
              {isEditMode && (
                <button
                  onClick={() => setIsEditingLanguage(true)}
                  className="ml-2"
                  style={{ color: "hsl(var(--primary))" }}
                >
                  <Pencil className="inline h-3 w-3" />
                </button>
              )}
            </p>

            {/* Author */}
            {(authors.length > 0 || isEditMode) && (
              <p className="mt-2 text-sm">
                {authors.length > 0 && (
                  <>
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>by </span>
                    <span
                      className="cursor-pointer hover:underline"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      {authorNames}
                    </span>
                  </>
                )}
                {isEditMode && (
                  <button
                    onClick={() => setActiveModal("author")}
                    className="ml-2"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    <Pencil className="inline h-3 w-3" />
                  </button>
                )}
              </p>
            )}

            {/* Book Description */}
            <div className="mb-4">
              <h2 className="mb-4 text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
                About this book
                {isEditMode && (
                  <button
                    onClick={() => setActiveModal("description")}
                    className="ml-2"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    <Pencil className="inline h-4 w-4" />
                  </button>
                )}
              </h2>

              {isEditMode ? (
                <EditableText
                  value={bookData.description || ""}
                  onChange={(description) => callbacks.onEditDescription?.(description)}
                  as="div"
                  className="text-base leading-relaxed"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                  placeholder="Add book description..."
                  multiline
                />
              ) : (
                <div className="relative">
                  <div
                    className={cn(
                      "prose prose-base max-w-none text-base leading-relaxed",
                      !showFullDescription && "line-clamp-[16]"
                    )}
                    style={{ color: "hsl(var(--muted-foreground))" }}
                    dangerouslySetInnerHTML={{
                      __html: bookData.description || "No description available",
                    }}
                  />
                  {bookData.description && bookData.description.length > 300 && (
                    <button
                      onClick={() => setShowFullDescription(!showFullDescription)}
                      className="mt-3 flex items-center gap-1 text-base font-medium hover:underline"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      {showFullDescription ? (
                        <>
                          Show less <ChevronUp className="h-5 w-5" />
                        </>
                      ) : (
                        <>
                          Read more <ChevronDown className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Book Details */}
            <div className="mt-6 border-t pt-6" style={{ borderColor: "hsl(var(--border))" }}>
              <h3 className="mb-3 text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>
                Product details
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt style={{ color: "hsl(var(--muted-foreground))" }}>Language</dt>
                <dd style={{ color: "hsl(var(--foreground))" }}>
                  {isEditMode && isEditingLanguage ? (
                    <input
                      type="text"
                      value={editLanguageValue}
                      onChange={(e) => setEditLanguageValue(e.target.value)}
                      onBlur={handleLanguageSave}
                      onKeyDown={(e) => e.key === "Enter" && handleLanguageSave()}
                      className="w-24 rounded border px-2 py-0.5 text-sm"
                      style={{
                        borderColor: "hsl(var(--border))",
                        backgroundColor: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => isEditMode && setIsEditingLanguage(true)}
                      className={isEditMode ? "cursor-pointer" : ""}
                    >
                      {languageDisplay}
                      {isEditMode && (
                        <Pencil
                          className="ml-1 inline h-3 w-3"
                          style={{ color: "hsl(var(--primary))" }}
                        />
                      )}
                    </span>
                  )}
                </dd>

                <dt style={{ color: "hsl(var(--muted-foreground))" }}>Pages</dt>
                <dd style={{ color: "hsl(var(--foreground))" }}>
                  {isEditMode && isEditingPages ? (
                    <input
                      type="number"
                      value={editPagesValue}
                      onChange={(e) => setEditPagesValue(e.target.value)}
                      onBlur={handlePagesSave}
                      onKeyDown={(e) => e.key === "Enter" && handlePagesSave()}
                      className="w-20 rounded border px-2 py-0.5 text-sm"
                      style={{
                        borderColor: "hsl(var(--border))",
                        backgroundColor: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => isEditMode && setIsEditingPages(true)}
                      className={isEditMode ? "cursor-pointer" : ""}
                    >
                      {bookData.pages || "N/A"} pages
                      {isEditMode && (
                        <Pencil
                          className="ml-1 inline h-3 w-3"
                          style={{ color: "hsl(var(--primary))" }}
                        />
                      )}
                    </span>
                  )}
                </dd>

                <dt style={{ color: "hsl(var(--muted-foreground))" }}>Format</dt>
                <dd style={{ color: "hsl(var(--foreground))" }}>Digital (EPUB)</dd>

                {(bookCategories.length > 0 || isEditMode) && (
                  <>
                    <dt style={{ color: "hsl(var(--muted-foreground))" }}>Category</dt>
                    <dd style={{ color: "hsl(var(--primary))" }}>
                      {bookCategories.length > 0 ? (
                        bookCategories.map((c, i) => (
                          <span key={c?.id}>
                            {i > 0 && ", "}
                            <span className="cursor-pointer hover:underline">{c?.name}</span>
                          </span>
                        ))
                      ) : (
                        <span style={{ color: "hsl(var(--muted-foreground))" }}>Not set</span>
                      )}
                      {isEditMode && (
                        <button onClick={() => setActiveModal("category")} className="ml-1">
                          <Pencil className="inline h-3 w-3" />
                        </button>
                      )}
                    </dd>
                  </>
                )}
              </dl>
            </div>

            {/* About the Author */}
            {authors.length > 0 && (
              <div className="mt-6 border-t pt-6" style={{ borderColor: "hsl(var(--border))" }}>
                <h3 className="mb-4 text-sm font-bold" style={{ color: "hsl(var(--foreground))" }}>
                  About the Author{authors.length > 1 ? "s" : ""}
                  {isEditMode && (
                    <button
                      onClick={() => setActiveModal("author")}
                      className="ml-2"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      <Pencil className="inline h-3 w-3" />
                    </button>
                  )}
                </h3>
                {authors.map((author) => (
                    <div key={author.id} className="mb-4 flex gap-4 last:mb-0">
                      {author.avatar ? (
                        <img
                          src={author.avatar}
                          alt={author.name}
                          className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: "hsl(var(--muted))" }}
                        >
                          <User
                            className="h-6 w-6"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          />
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium" style={{ color: "hsl(var(--foreground))" }}>
                          {author.name}
                        </h4>
                        {author.role && (
                          <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {author.role}
                          </p>
                        )}
                        {author.bio && (
                          <p
                            className="mt-1 text-sm"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            {author.bio}
                          </p>
                        )}
                        {author.experiences && author.experiences.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {author.experiences.map((exp, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                {exp.companyLogo ? (
                                  <img src={exp.companyLogo} alt={exp.company} className="h-6 w-6 rounded object-contain flex-shrink-0" style={{ backgroundColor: "hsl(var(--muted))", padding: "1px" }} />
                                ) : (
                                  <div className="flex h-6 w-6 items-center justify-center rounded flex-shrink-0" style={{ backgroundColor: "hsl(var(--muted))" }}>
                                    <span className="text-[10px] font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>{exp.company.charAt(0)}</span>
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="text-xs font-medium" style={{ color: "hsl(var(--foreground) / 0.8)" }}>{exp.company}</span>
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
                                <a
                                  key={link.platform}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded p-1 transition-colors hover:bg-muted"
                                  style={{ color: "hsl(var(--muted-foreground))" }}
                                  title={link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}
                                >
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

          {/* Right Column - Purchase Box */}
          <div className="lg:col-span-3">
            <div className="sticky top-6">
              {/* Validity Info */}
              {(bookData.validityDays === null ||
                (bookData.validityDays && bookData.validityDays > 0)) && (
                <div
                  className="mt-4 rounded-lg border p-4"
                  style={{
                    backgroundColor: "hsl(var(--muted))",
                    borderColor: "hsl(var(--border))",
                  }}
                >
                  <p className="text-sm" style={{ color: "hsl(var(--foreground))" }}>
                    {bookData.validityDays === null ? (
                      <>
                        <span className="font-medium">Access validity:</span> Lifetime access
                      </>
                    ) : (
                      <>
                        <span className="font-medium">Access validity:</span> {bookData.validityDays}{" "}
                        days from purchase
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Purchase Card */}
              <div
                className="overflow-hidden mt-6 rounded-lg border shadow-sm"
                style={{ borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
              >
                <div className="p-4">
                  {callbacks.hasAccess && !isEditMode ? (
                    /* ── User has access, show enrolled state ── */
                    <>
                      <div className="flex items-center gap-2 text-lg font-semibold" style={{ color: "hsl(var(--primary))" }}>
                        <Check className="h-5 w-5" />
                        You have access
                      </div>
                      <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                        Instant access after purchase
                      </p>
                      <button
                        onClick={onStartReading}
                        className="mt-4 w-full rounded-full px-4 py-3 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: "hsl(var(--primary))",
                          color: "hsl(var(--primary-foreground))",
                        }}
                      >
                        Start Reading
                      </button>

                      {/* Secure Transaction */}
                      <div className="mt-4 border-t pt-4" style={{ borderColor: "hsl(var(--border))" }}>
                        <div className="flex items-start gap-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>Secure transaction. Your payment information is encrypted.</span>
                        </div>
                      </div>
                    </>
                  ) : !isEditMode && callbacks.accessChecked === false ? (
                    /* ── Still checking access, show loading ── */
                    <div className="flex items-center justify-center py-6">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "hsl(var(--primary))" }} />
                    </div>
                  ) : accessManagedActive ? (
                    /* ── Access-managed storefront, no price, contact support ── */
                    <AccessManagedCta
                      hasAccess={false}
                      supportEmail={supportEmail}
                      contactSubject={bookData.title}
                      fullWidth
                    />
                  ) : (
                    /* ── No access, show pricing + purchase buttons ── */
                    <>
                      {/* Price Section */}
                      {priceUnavailable ? (
                        <div className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                          Not available for purchase
                        </div>
                      ) : bookData.purchaseMode === "PAID" ? (
                        callbacks.appliedCoupon ? (
                          <>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-medium" style={{ color: "hsl(var(--foreground))" }}>
                                {callbacks.appliedCoupon.currency === "USD" ? "$" : "₹"}
                                {callbacks.appliedCoupon.net_amount.toLocaleString(callbacks.appliedCoupon.currency === "USD" ? "en-US" : "en-IN")}
                              </span>
                              <span className="text-sm line-through" style={{ color: "hsl(var(--muted-foreground))" }}>
                                {callbacks.appliedCoupon.currency === "USD" ? "$" : "₹"}
                                {callbacks.appliedCoupon.original_amount.toLocaleString(callbacks.appliedCoupon.currency === "USD" ? "en-US" : "en-IN")}
                              </span>
                            </div>
                            <div
                              className="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: "hsl(var(--primary) / 0.1)",
                                color: "hsl(var(--primary))",
                              }}
                            >
                              <Tag className="h-3 w-3" />
                              Coupon applied
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-medium" style={{ color: "hsl(var(--foreground))" }}>
                                {symbol}{finalPrice.toLocaleString(locale)}
                              </span>
                              {discount > 0 && (
                                <>
                                  <span className="text-sm line-through" style={{ color: "hsl(var(--muted-foreground))" }}>
                                    {symbol}{originalPrice.toLocaleString(locale)}
                                  </span>
                                  <span className="text-sm font-medium" style={{ color: "hsl(var(--primary))" }}>
                                    ({savingLabel})
                                  </span>
                                </>
                              )}
                            </div>
                            {priceDisplay.additionalPrices && priceDisplay.additionalPrices.length > 0 && (
                              <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                                Also priced: {priceDisplay.additionalPrices.map((p) => p.label).join(", ")}
                              </p>
                            )}
                          </>
                        )
                      ) : (
                        <div className="text-2xl font-medium" style={{ color: "hsl(var(--primary))" }}>
                          Free
                        </div>
                      )}

                      {isEditMode && (
                        <button
                          onClick={() => setActiveModal("pricing")}
                          className="mt-2 flex items-center gap-1 text-sm hover:underline"
                          style={{ color: "hsl(var(--primary))" }}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit Pricing
                        </button>
                      )}

                      {/* Availability */}
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
                        <span className="font-medium" style={{ color: "hsl(var(--primary))" }}>
                          Available
                        </span>
                      </div>

                      <p className="mt-2 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                        <span className="font-medium">Instant access</span> after purchase
                      </p>

                      {/* CTA Buttons */}
                      <div className="mt-4 space-y-2">
                        {callbacks.onAddToCart && bookData.purchaseMode === "PAID" && !priceUnavailable && (
                          <button
                            onClick={callbacks.onAddToCart}
                            className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-colors"
                            style={{
                              backgroundColor: "hsl(var(--primary))",
                              color: "hsl(var(--primary-foreground))",
                            }}
                          >
                            <ShoppingCart className="h-4 w-4" />
                            {callbacks.isInCart ? "Remove from Cart" : "Add to Cart"}
                          </button>
                        )}
                        {!priceUnavailable && (
                        <button
                          onClick={
                            bookData.purchaseMode === "FREE"
                              ? onUnlock
                              : callbacks.onBuyNow || onUnlock
                          }
                          className="w-full rounded-full border px-4 py-3 text-sm font-medium transition-colors"
                          style={{
                            backgroundColor: "hsl(var(--secondary))",
                            color: "hsl(var(--secondary-foreground))",
                            borderColor: "hsl(var(--border))",
                          }}
                        >
                          {bookData.purchaseMode === "FREE" ? "Get Free Access" : "Buy Now"}
                        </button>
                        )}
                      </div>

                      {/* Coupon Section */}
                      {!isEditMode && bookData.purchaseMode === "PAID" && !priceUnavailable && (callbacks.couponSlot || callbacks.onValidateCoupon) && (
                        <div className="mt-3">
                          {callbacks.couponSlot ? (
                            callbacks.couponSlot
                          ) : callbacks.appliedCoupon ? (
                            <div
                              className="flex items-center justify-between rounded-lg px-3 py-2"
                              style={{
                                backgroundColor: "hsl(var(--primary) / 0.06)",
                                border: "1px solid hsl(var(--primary) / 0.15)",
                              }}
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                <Tag className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                                <span className="truncate font-mono text-xs font-medium" style={{ color: "hsl(var(--foreground))" }}>
                                  {callbacks.appliedCoupon.code}
                                </span>
                                <span className="shrink-0 text-xs" style={{ color: "hsl(var(--primary))" }}>
                                  {callbacks.appliedCoupon.discount_type === "PERCENTAGE"
                                    ? `${callbacks.appliedCoupon.discount_value}% off`
                                    : `${callbacks.appliedCoupon.currency === "USD" ? "$" : "₹"}${callbacks.appliedCoupon.discount_amount} off`}
                                </span>
                              </div>
                              <button type="button" onClick={callbacks.onCouponRemoved} className="shrink-0 rounded p-0.5 hover:opacity-70">
                                <X className="h-3.5 w-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
                              </button>
                            </div>
                          ) : (
                            <BookInlineCouponInput onValidate={callbacks.onValidateCoupon} onApply={callbacks.onCouponApplied} />
                          )}
                        </div>
                      )}

                      {/* Secure Transaction */}
                      <div className="mt-4 border-t pt-4" style={{ borderColor: "hsl(var(--border))" }}>
                        <div className="flex items-start gap-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>Secure transaction. Your payment information is encrypted.</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Bookmark Button */}
                  {callbacks.onBookmarkToggle && !isEditMode && (
                    <button
                      onClick={callbacks.onBookmarkToggle}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                      style={{
                        borderColor: callbacks.isBookmarked ? "hsl(var(--primary))" : "hsl(var(--border))",
                        color: callbacks.isBookmarked ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                        backgroundColor: callbacks.isBookmarked ? "hsl(var(--primary) / 0.1)" : "hsl(var(--card))",
                      }}
                    >
                      {callbacks.isBookmarked ? (
                        <>
                          <BookmarkCheck className="h-4 w-4" />
                          Bookmarked
                        </>
                      ) : (
                        <>
                          <Bookmark className="h-4 w-4" />
                          Add to Wishlist
                        </>
                      )}
                    </button>
                  )}

                  {/* Share Button */}
                  {callbacks.onShare && !isEditMode && (
                    <button
                      onClick={callbacks.onShare}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
                      style={{
                        borderColor: "hsl(var(--border))",
                        color: "hsl(var(--foreground))",
                        backgroundColor: "hsl(var(--card))",
                      }}
                      aria-label="Share this book"
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Books Section */}
        {((bookData.recommendations?.length ?? 0) > 0 || (isEditMode && callbacks.onEditRecommendations)) && (
          <section className="mt-12 pt-8 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "hsl(var(--foreground))" }}>
                <Library className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
                Customers who viewed this item also viewed
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {bookData.recommendations!.map((rec) => (
                  <a
                    key={rec.id}
                    href={`/books/${rec.slug}`}
                    className="group flex flex-col rounded-lg border overflow-hidden transition-all hover:shadow-md"
                    style={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                    }}
                  >
                    <div className="aspect-[2/3] w-full relative bg-muted flex-shrink-0 overflow-hidden">
                      {rec.thumbnailUrl ? (
                        <img
                          src={rec.thumbnailUrl}
                          alt={rec.title}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "hsl(var(--muted))" }}>
                          <Library className="h-10 w-10 opacity-40" style={{ color: "hsl(var(--muted-foreground))" }} />
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <p
                        className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors"
                        style={{ color: "hsl(var(--card-foreground))" }}
                      >
                        {rec.title}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div
                className="text-center py-12 rounded-xl border border-dashed"
                style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
              >
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

      {/* Mobile Fixed Bottom Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 border-t shadow-lg lg:hidden"
        style={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <div className="flex items-center justify-between gap-4 p-4">
          {callbacks.hasAccess && !isEditMode ? (
            /* ── Has access, just show Start Reading ── */
            <div className="flex flex-1 justify-end">
              <button
                onClick={onStartReading}
                className="max-w-[200px] flex-1 rounded-full px-4 py-3 text-sm font-medium"
                style={{
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                }}
              >
                Start Reading
              </button>
            </div>
          ) : accessManagedActive ? (
            /* ── Access-managed storefront, no price, contact support ── */
            <AccessManagedCta
              hasAccess={false}
              supportEmail={supportEmail}
              contactSubject={bookData.title}
              fullWidth
              className="flex-1"
            />
          ) : (
            /* ── No access, show price + button ── */
            <>
              <div>
                {priceUnavailable ? (
                  <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                    Not available for purchase
                  </p>
                ) : bookData.purchaseMode === "PAID" ? (
                  <>
                    <p className="text-lg font-bold" style={{ color: "hsl(var(--foreground))" }}>
                      {symbol}{finalPrice.toLocaleString(locale)}
                    </p>
                    {priceDisplay.additionalPrices && priceDisplay.additionalPrices.length > 0 && (
                      <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                        Also priced: {priceDisplay.additionalPrices.map((p) => p.label).join(", ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-lg font-bold" style={{ color: "hsl(var(--primary))" }}>
                    Free
                  </p>
                )}
              </div>
              {!priceUnavailable && (
              <div className="flex flex-1 justify-end gap-2">
                <button
                  onClick={
                    bookData.purchaseMode === "FREE" ? onUnlock : callbacks.onBuyNow || onUnlock
                  }
                  className="max-w-[200px] flex-1 rounded-full px-4 py-3 text-sm font-medium"
                  style={{
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  }}
                >
                  {bookData.purchaseMode === "FREE" ? "Get Free" : "Buy Now"}
                </button>
              </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Bottom Spacer */}
      <div className="h-20 lg:hidden" />

      {/* Sample Reader Modal, purchase CTA hidden on access-managed storefronts */}
      <SampleReaderModal
        isOpen={showSampleModal}
        onClose={() => setShowSampleModal(false)}
        bookSlug={bookData.slug || ""}
        bookTitle={bookData.title || "Book"}
        fileFormat={bookData.fileFormat === "PDF" ? "PDF" : "EPUB"}
        samplePages={bookData.samplePages || 10}
        onPurchase={
          accessManagedActive
            ? undefined
            : () => {
                setShowSampleModal(false);
                if (bookData.purchaseMode === "FREE") {
                  onUnlock?.();
                } else {
                  callbacks.onBuyNow?.() || onUnlock?.();
                }
              }
        }
      />
    </div>
  );
}
