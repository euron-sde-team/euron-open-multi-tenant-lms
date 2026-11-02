"use client";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { ShareModal } from "@/components/share-modal";
import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { cn } from "@/lib/utils";
import { fetchCourseList, getCourseThumbnailUrl } from "@/lib/api";
import {
  courseLearnHref,
  courseStatusFromProgress,
  findEnrolledCourses,
  MY_LEARNING_HREF,
  type CourseStatus,
} from "@/lib/utils/course-status";
import { getTestSeriesCoverUrl } from "@/lib/api/test-series";
import type { PublishedBundleDetail, PublishedBundleItem } from "@/lib/api/bundles";
import { checkoutApi, type CouponValidationResult } from "@/lib/api/checkout";
import { emptyLayout } from "@/lib/default-layout";
import { TaxHint } from "@/components/shared/TaxHint";
import { useCart } from "@/lib/hooks/use-cart";
import { useContentTerm, useContentTerms } from "@/lib/hooks/use-content-terms";
import { useCurrency } from "@/lib/hooks/use-currency";
import { usePrice } from "@/lib/hooks/use-price";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { useBookmark } from "@/lib/stores/bookmark-store";
import { AccessManagedCta, AvailableRoutesProvider, useAvailableRoutes, useToast } from "@open-mtlms/core";
import type { AvailableRoutesResponse, ContentTerm, PageConfig, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { discountLabel, getErrorMessage, isResolvedPrice, isUnavailablePrice } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  GraduationCap,
  Layers,
  Play,
  Share2,
  ShoppingCart,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CouponOffers } from "@/components/common/CouponOffers";
import { fetchBundleBySlug } from "@/lib/api/bundles";

const PH = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=450&fit=crop&q=80";

function getYoutubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // eslint-disable-next-line no-useless-escape
  const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
  if (match && match[2].length === 11) return `https://www.youtube.com/embed/${match[2]}?rel=0&autoplay=1`;
  return null;
}

/* ── Preview video modal ── */
function PreviewVideoModal({ open, previewUrl, onClose }: { open: boolean; previewUrl: string; onClose: () => void }) {
  const embedUrl = getYoutubeEmbedUrl(previewUrl);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
        <X className="h-6 w-6" />
      </button>
      {embedUrl ? (
        <div className="relative w-full max-w-4xl px-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
            <iframe src={embedUrl} title="Bundle preview video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="absolute inset-0 h-full w-full" />
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-md px-4">
          <div className="bg-card rounded-xl p-6 text-center shadow-2xl">
            <p className="text-card-foreground mb-4">This preview video cannot be embedded. Would you like to open it in a new tab?</p>
            <div className="flex justify-center gap-3">
              <button onClick={onClose} className="border-input hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition-colors">Cancel</button>
              <button onClick={() => { window.open(previewUrl, "_blank", "noopener,noreferrer"); onClose(); }} className="bg-primary text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-90">
                <ExternalLink className="h-4 w-4" /> Open in new tab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The owner's way into an included course, by their progress on it: Start
 * (nothing done yet), Continue Learning, or Completed. Unknown progress (still
 * loading, or not found) keeps a neutral "Go to".
 */
function courseCta(status: CourseStatus | null, course: ContentTerm) {
  switch (status) {
    case "completed":
      return { label: `${course.singular} Completed`, Icon: CheckCircle2, done: true };
    case "not_started":
      return { label: `Start ${course.singular}`, Icon: Play, done: false };
    case "in_progress":
      return { label: "Continue Learning", Icon: GraduationCap, done: false };
    default:
      return { label: `Go to ${course.singular}`, Icon: GraduationCap, done: false };
  }
}

/* ── Item preview modal ── */
function ItemModal({
  item,
  hasAccess,
  courseStatus,
  onClose,
}: {
  item: PublishedBundleItem;
  hasAccess: boolean;
  /** The owner's progress on this course, when it is a course. */
  courseStatus: CourseStatus | null;
  onClose: () => void;
}) {
  const terms = useContentTerms();
  const isCourse = item.itemType === "COURSE";
  const isTest = item.itemType === "TEST_SERIES";
  const title = isCourse
    ? item.courseTitle
    : isTest
      ? item.testSeriesTitle
      : item.bookTitle;
  const slug = isCourse
    ? item.courseSlug
    : isTest
      ? item.testSeriesSlug
      : item.bookSlug;
  const img =
    (isCourse
      ? getCourseThumbnailUrl(item.courseThumbnailKey)
      : isTest
        ? getTestSeriesCoverUrl(item.testSeriesCoverImageKey)
        : getCourseThumbnailUrl(item.bookThumbnailUrl)) ?? PH;
  const detailHref = slug
    ? isCourse
      ? `/courses/${encodeURIComponent(slug)}`
      : isTest
        ? `/test-series/${encodeURIComponent(slug)}`
        : `/books/${encodeURIComponent(slug)}`
    : isCourse
      ? "/all-courses"
      : isTest
        ? "/test-series"
        : "/books";
  const learnHref = slug ? courseLearnHref(slug) : MY_LEARNING_HREF;
  const cta = courseCta(courseStatus, terms.course);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="border-border bg-card relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="bg-muted text-muted-foreground hover:bg-muted/80 absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full transition"
        >
          <X className="h-4 w-4" />
        </button>
        {isCourse || isTest ? (
          <div className="bg-muted relative aspect-video w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={title || ""}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = PH;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div
              className={cn(
                "absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white",
                isTest ? "bg-purple-600/80" : "bg-blue-600/80",
              )}
            >
              {isTest ? <ClipboardList className="h-3 w-3" /> : <Video className="h-3 w-3" />}
              {isTest ? "Test Series" : "Course"}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4 bg-muted/50 p-5">
            <div className="relative w-24 shrink-0 overflow-hidden rounded-lg shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={title || ""}
                className="w-full object-cover"
                style={{ aspectRatio: "2/3" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PH;
                }}
              />
            </div>
            <div className="flex flex-col justify-center pt-1">
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-600/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <BookOpen className="h-3 w-3" />
                Book
              </div>
              <h2 className="mt-2 text-lg font-bold">{title || "Untitled"}</h2>
            </div>
          </div>
        )}
        <div className="p-5">
          {(isCourse || isTest) && <h2 className="text-lg font-bold">{title || "Untitled"}</h2>}
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {isCourse
              ? `This ${terms.course.singular.toLowerCase()} is included in the ${terms.bundle.singular.toLowerCase()}.`
              : isTest
                ? `This ${terms.testSeries.singular.toLowerCase()} is included in the ${terms.bundle.singular.toLowerCase()}.`
                : `This ${terms.book.singular.toLowerCase()} is included in the ${terms.bundle.singular.toLowerCase()}.`}
          </p>
          <div className="mt-5 flex gap-3">
            {hasAccess && isCourse ? (
              <Link
                href={learnHref}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition",
                  cta.done
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <cta.Icon className="h-4 w-4" /> {cta.label}
              </Link>
            ) : (
              <Link
                href={detailHref}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition"
              >
                View Details <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
            <button
              onClick={onClose}
              className="border-input hover:bg-muted rounded-xl border px-4 py-3 text-sm font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Item card for "What's Inside" ── */
function ItemCard({
  item,
  index,
  hasAccess,
  courseStatus = null,
  onPreview,
}: {
  item: PublishedBundleItem;
  index: number;
  hasAccess: boolean;
  /** The owner's progress on this course, when it is a course. */
  courseStatus?: CourseStatus | null;
  onPreview: (item: PublishedBundleItem) => void;
}) {
  const terms = useContentTerms();
  const isCourse = item.itemType === "COURSE";
  const isBook = item.itemType === "BOOK";
  const isTest = item.itemType === "TEST_SERIES";
  const title = isCourse
    ? item.courseTitle
    : isTest
      ? item.testSeriesTitle
      : item.bookTitle;
  const slug = isCourse
    ? item.courseSlug
    : isTest
      ? item.testSeriesSlug
      : item.bookSlug;
  const thumb =
    (isCourse
      ? getCourseThumbnailUrl(item.courseThumbnailKey)
      : isTest
        ? getTestSeriesCoverUrl(item.testSeriesCoverImageKey)
        : getCourseThumbnailUrl(item.bookThumbnailUrl)) ?? PH;
  const learnHref = slug ? courseLearnHref(slug) : MY_LEARNING_HREF;
  const testHref = slug ? `/test-series/${encodeURIComponent(slug)}` : "/test-series";
  const cta = courseCta(courseStatus, terms.course);

  // Books get a horizontal card with portrait cover
  if (isBook) {
    return (
      <div
        className="bg-card group cursor-pointer overflow-hidden rounded-2xl border border-border shadow-sm transition-all duration-300 hover:shadow-lg"
        onClick={() => onPreview(item)}
      >
        <div className="flex gap-0">
          {/* Book cover, portrait aspect ratio */}
          <div className="bg-muted relative w-24 shrink-0 overflow-hidden sm:w-28">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb}
              alt={title || ""}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ aspectRatio: "2/3" }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = PH;
              }}
            />
            <div className="bg-card/90 text-foreground absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shadow-sm backdrop-blur-sm">
              {index + 1}
            </div>
          </div>
          {/* Book details */}
          <div className="flex min-w-0 flex-1 flex-col justify-between p-3.5">
            <div>
              <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                <BookOpen className="h-2.5 w-2.5" />
                Book
              </div>
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{title || "Untitled"}</h3>
              {item.bookAuthor && (
                <p className="text-muted-foreground mt-1 text-xs">by {item.bookAuthor}</p>
              )}
              {item.bookPages && (
                <p className="text-muted-foreground mt-0.5 text-[11px]">{item.bookPages} pages</p>
              )}
            </div>
            {hasAccess && slug && (
              <Link
                href={`/books/${encodeURIComponent(slug)}`}
                className="bg-primary/10 text-primary hover:bg-primary/20 mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                onClick={(e) => e.stopPropagation()}
              >
                <BookOpen className="h-3 w-3" /> Continue Reading
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Courses keep the standard landscape card
  return (
    <div className="bg-card group overflow-hidden rounded-2xl border border-border shadow-sm transition-all duration-300 hover:shadow-lg">
      <div
        className="bg-muted relative aspect-video w-full cursor-pointer overflow-hidden"
        onClick={() => onPreview(item)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={title || ""}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PH;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="bg-card/90 text-foreground absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-sm backdrop-blur-sm">
          {index + 1}
        </div>
        <div
          className={cn(
            "absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm",
            isTest ? "bg-purple-600/80" : "bg-blue-600/80",
          )}
        >
          {isTest ? <ClipboardList className="h-2.5 w-2.5" /> : <Video className="h-2.5 w-2.5" />}
          {isTest ? "Test Series" : "Course"}
        </div>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{title || "Untitled"}</h3>
        {isCourse && item.courseSubtitle && (
          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">{item.courseSubtitle}</p>
        )}
        {hasAccess && isTest && (
          <Link
            href={testHref}
            className="bg-primary/10 text-primary hover:bg-primary/20 mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            onClick={(e) => e.stopPropagation()}
          >
            <ClipboardList className="h-3 w-3" /> Start Test Series
          </Link>
        )}
        {hasAccess && isCourse && (
          <Link
            href={learnHref}
            className={cn(
              "mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              cta.done
                ? "bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-400"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <cta.Icon className="h-3 w-3" /> {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Pricing card (reused in hero sidebar + mobile) ── */
function PricingCard({
  hasAccess,
  accessChecked,
  isAuthenticated,
  isFree,
  pr,
  coupon,
  enrolling,
  onBuyNow,
  onAddToCart,
  isInCartVal,
  onShare,
  onBookmark,
  onScrollToItems,
  bundleId,
  couponCurrency,
  onCouponApply,
  onCouponRemove,
  cartOk,
  bmOk,
  isBookmarkedVal,
  accessManaged,
  supportEmail,
  title,
}: {
  hasAccess: boolean;
  accessChecked: boolean;
  isAuthenticated: boolean;
  isFree: boolean;
  pr: { display: string; original: string | null; off: number; savingLabel?: string | null; unavailable?: boolean };
  coupon: CouponValidationResult | null;
  enrolling: boolean;
  onBuyNow: () => void;
  onAddToCart: () => void;
  isInCartVal: boolean;
  onShare: () => void;
  onBookmark: () => void;
  onScrollToItems: () => void;
  bundleId: string;
  couponCurrency: string;
  onCouponApply: (r: CouponValidationResult) => void;
  onCouponRemove: () => void;
  cartOk: boolean;
  bmOk: boolean;
  isBookmarkedVal: boolean;
  accessManaged: boolean;
  supportEmail: string | null;
  title: string;
}) {
  const term = useContentTerm("bundle");
  if (!accessChecked) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-8 w-36 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 w-full animate-pulse rounded-xl" />
        <div className="bg-muted h-10 w-full animate-pulse rounded-xl" />
      </div>
    );
  }

  if (hasAccess) {
    return (
      <div className="space-y-4">
        <div className="text-primary flex items-center gap-2 text-lg font-bold">
          <CheckCircle2 className="h-5 w-5" /> You own this {term.singular.toLowerCase()}
        </div>
        <button
          type="button"
          onClick={onScrollToItems}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition"
        >
          <GraduationCap className="h-4 w-4" /> Start Learning
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Access-managed storefront: no price, no buy/cart CTAs, viewers without
  // access get the Contact Support entry point instead. Share & bookmark stay.
  if (accessManaged) {
    return (
      <div className="space-y-4">
        <AccessManagedCta
          hasAccess={false}
          supportEmail={supportEmail}
          contactSubject={title}
          size="lg"
          fullWidth
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onShare}
            className="border-input hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          {bmOk && (
            <button
              type="button"
              onClick={onBookmark}
              className="border-input hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
            >
              <Bookmark className={`h-4 w-4 ${isBookmarkedVal ? "fill-current" : ""}`} /> {!isAuthenticated ? "Login to Save" : "Save"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Price */}
      <div className="flex items-baseline gap-3">
        {coupon ? (
          <>
            <span className="text-muted-foreground text-lg line-through">
              {coupon.currency === "USD" ? "$" : "₹"}
              {coupon.original_amount}
            </span>
            <span className="text-3xl font-extrabold">
              {coupon.currency === "USD" ? "$" : "₹"}
              {coupon.net_amount}
            </span>
          </>
        ) : pr.unavailable && !isFree ? (
          <span className="text-muted-foreground text-sm">Not available for purchase</span>
        ) : (
          <>
            {pr.original && (
              <span className="text-muted-foreground text-lg line-through">{pr.original}</span>
            )}
            <span className="text-3xl font-extrabold">{isFree ? "Free" : pr.display}</span>
          </>
        )}
        {!isFree && !pr.unavailable && <TaxHint />}
      </div>

      {/* Buy button */}
      {!(pr.unavailable && !isFree) && (
        <button
          type="button"
          onClick={onBuyNow}
          disabled={enrolling}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold shadow-md transition disabled:opacity-50"
        >
          <ShoppingCart className="h-4 w-4" />
          {!isAuthenticated ? "Login to Buy" : isFree ? (enrolling ? "Enrolling..." : "Get Now: Free") : "Buy Now"}
        </button>
      )}

      {/* Add to cart / Remove from cart */}
      {cartOk && !isFree && !pr.unavailable && (
        <button
          type="button"
          onClick={onAddToCart}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition",
            isInCartVal
              ? "border-destructive text-destructive hover:bg-destructive/10"
              : "border-input hover:bg-muted"
          )}
        >
          {!isAuthenticated ? "Login to Add to Cart" : isInCartVal ? "Remove from Cart" : "Add to Cart"}
        </button>
      )}

      {/* Share & Bookmark */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onShare}
          className="border-input hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
        {bmOk && (
          <button
            type="button"
            onClick={onBookmark}
            className="border-input hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
          >
            <Bookmark className={`h-4 w-4 ${isBookmarkedVal ? "fill-current" : ""}`} /> {!isAuthenticated ? "Login to Save" : "Save"}
          </button>
        )}
      </div>

      {/* Coupon */}
      {!isFree && !pr.unavailable && (
        <CouponOffers
          orderType="BUNDLE"
          itemId={bundleId}
          currency={couponCurrency}
          applied={coupon}
          onApply={onCouponApply}
          onRemove={onCouponRemove}
        />
      )}
    </div>
  );
}

/* ── Main page ── */
interface BundleDetailClientProps {
  bundle: PublishedBundleDetail;
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
  availableRoutes?: AvailableRoutesResponse | null;
}

function BundleDetailContent({
  bundle,
  layout,
  pageConfig,
}: Omit<BundleDetailClientProps, "availableRoutes">) {
  const router = useRouter();
  const { toast } = useToast();
  const term = useContentTerm("bundle");
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleBookmark, isBookmarked } = useBookmark();
  const { isPathAvailable } = useAvailableRoutes();
  const { isAuthenticated } = useUserAuthStore();
  const cur = useCurrency();
  const { accessManaged, supportEmail } = useStorefrontConfig();
  const guard = useBuyNowGuard();
  const [shareOpen, setShareOpen] = useState(false);
  const [coupon, setCoupon] = useState<CouponValidationResult | null>(null);
  const [preview, setPreview] = useState<PublishedBundleItem | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const itemsRef = useRef<HTMLDivElement>(null);

  const [bundleData, setBundleData] = useState(bundle);
  const [accessChecked, setAccessChecked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showPreviewVideo, setShowPreviewVideo] = useState(false);

  // Wait for Zustand auth store to hydrate before deciding access state
  useEffect(() => {
    // Zustand persist hydrates synchronously on first tick after mount
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      setAccessChecked(true);
      return;
    }
    setAccessChecked(false);
    fetchBundleBySlug(bundle.slug)
      .then((fresh) =>
        setBundleData((prev) => ({
          ...fresh,
          // Preserve items from SSR/previous state when refetch omits them
          items: fresh.items && fresh.items.length > 0 ? fresh.items : prev.items,
        }))
      )
      .catch(() => {})
      .finally(() => setAccessChecked(true));
  }, [hydrated, isAuthenticated, bundle.slug]);

  const hasAccess = bundleData.has_access === true;
  const isArchived = bundleData.is_archived === true;
  const theme: ThemeConfig = pageConfig?.theme ?? defaultThemeConfig;
  const lay = layout ?? emptyLayout;
  const img = getCourseThumbnailUrl(bundleData.thumbnailUrl) ?? PH;
  const isFree = bundleData.purchaseMode === "FREE";

  const courseItems = bundleData.items?.filter((i) => i.itemType === "COURSE") ?? [];

  // An owner's progress on each included course, so each card says Start,
  // Continue Learning or Completed (the same rule as My Learning).
  const courseIdsKey = courseItems
    .map((i) => i.courseId)
    .filter((id): id is string => Boolean(id))
    .join(",");
  const { data: courseProgress } = useQuery({
    queryKey: ["bundle-course-progress", bundleData.id, courseIdsKey],
    queryFn: async () => {
      const found = await findEnrolledCourses(courseIdsKey.split(","), (page) =>
        fetchCourseList({ enrolledOnly: true, page, limit: 50 }, window.location.host)
      );
      const percents: Record<string, number> = {};
      found.forEach((course, id) => {
        percents[id] = course.progress_percent ?? 0;
      });
      return percents;
    },
    enabled: hydrated && isAuthenticated && hasAccess && courseIdsKey.length > 0,
    staleTime: 30_000,
  });
  const courseStatusOf = (item: PublishedBundleItem): CourseStatus | null =>
    item.courseId ? courseStatusFromProgress(courseProgress?.[item.courseId]) : null;
  const bookItems = bundleData.items?.filter((i) => i.itemType === "BOOK") ?? [];
  const testSeriesItems =
    bundleData.items?.filter((i) => i.itemType === "TEST_SERIES") ?? [];
  // Content-product-link gating removed, linked_products no longer displayed
  // const linkedProducts = bundleData.linked_products ?? [];
  const totalItems = (bundleData.items?.length ?? bundleData.itemCount) || 0;

  const resolvedPrice = usePrice({
    prices:
      (bundle as { prices?: Record<string, { amount: number; discount?: number | null }> | null })
        .prices ?? null,
    legacyInr: bundle.priceInr,
    legacyUsd: bundle.priceUsd,
    legacyDiscountInr: bundle.discountInr,
    legacyDiscountUsd: bundle.discountUsd,
    purchaseMode: bundleData.purchaseMode,
  });

  const getPrice = (): {
    display: string;
    original: string | null;
    off: number;
    /** Saving labelled as entered: "₹100 off" (FLAT) or "10% off". */
    savingLabel?: string | null;
    loading?: boolean;
    unavailable?: boolean;
  } => {
    if (!cur) return { display: "", original: null, off: 0, loading: true };
    if (resolvedPrice && isUnavailablePrice(resolvedPrice)) {
      return { display: "Not available for purchase", original: null, off: 0, unavailable: true };
    }
    if (!isResolvedPrice(resolvedPrice) || resolvedPrice.original <= 0) {
      return { display: "Contact for price", original: null, off: 0 };
    }
    return {
      display: resolvedPrice.format(resolvedPrice.amount),
      original: resolvedPrice.hasDiscount ? resolvedPrice.format(resolvedPrice.original) : null,
      off:
        resolvedPrice.hasDiscount && resolvedPrice.original > 0
          ? Math.round((1 - resolvedPrice.amount / resolvedPrice.original) * 100)
          : 0,
      // "₹100 off" for a flat discount, "10% off" for a percentage.
      savingLabel: discountLabel(resolvedPrice),
    };
  };
  const pr = getPrice();

  const handleBuyNow = () => {
    const doBuyNow = async () => {
      if (isFree) {
        setEnrolling(true);
        try {
          await checkoutApi.freeEnroll({ order_type: "BUNDLE", item_id: bundle.id });
          toast({ title: "Enrolled!", description: `You now have access to ${bundle.title}.` });
          const fresh = await fetchBundleBySlug(bundle.slug);
          setBundleData((prev) => ({
            ...fresh,
            items: fresh.items && fresh.items.length > 0 ? fresh.items : prev.items,
          }));
        } catch (err) {
          toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" });
        } finally {
          setEnrolling(false);
        }
        return;
      }
      const p = new URLSearchParams({ type: "BUNDLE", id: bundle.id });
      if (coupon?.code) p.set("coupon", coupon.code);
      window.location.href = `/checkout/direct?${p.toString()}`;
    };
    guard.run(() => { void doBuyNow(); }, `/bundles/${bundle.slug}`);
  };

  const handleAddToCart = () => {
    guard.run(() => {
      if (isInCart(bundle.id)) {
        removeFromCart({ item_type: "BUNDLE", item_id: bundle.id });
        toast({ title: "Removed from cart", description: `${bundle.title} removed from your cart.` });
      } else {
        addToCart(
          { item_type: "BUNDLE", item_id: bundle.id, coupon_code: coupon?.code },
          {
            onSuccess: () => {
              toast({ title: "Added to cart", description: `${bundle.title} added to your cart.` });
            },
            onError: (err) => {
              toast({ title: "Failed to add", description: getErrorMessage(err), variant: "destructive" });
            },
          }
        );
      }
    }, `/bundles/${bundle.slug}`);
  };

  // Same resolution the old validate callback used: the priced currency when the
  // bundle has one, else the buyer's.
  const couponCurrency =
    (isResolvedPrice(resolvedPrice) ? resolvedPrice.currency : cur) ?? "INR";

  const handleBookmark = () => {
    guard.run(() => {
      const was = isBookmarked(bundle.id);
      toggleBookmark({
        productId: bundle.id,
        productType: "bundle",
        title: bundle.title,
        slug: bundle.slug,
        thumbnailUrl: bundle.thumbnailUrl,
        subtitle: bundle.subtitle,
      });
      toast({
        title: was ? "Removed" : "Saved",
        description: `${bundle.title} ${was ? "removed from" : "added to"} bookmarks.`,
      });
    }, `/bundles/${bundle.slug}`);
  };

  const scrollToItems = () => {
    itemsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cartOk = isPathAvailable("/cart");
  const bmOk = isPathAvailable("/bookmark");

  const pricingProps = {
    hasAccess,
    accessChecked,
    isAuthenticated: isAuthenticated || guard.easyCheckoutEnabled === true,
    isFree,
    pr,
    coupon,
    enrolling,
    onBuyNow: handleBuyNow,
    onAddToCart: handleAddToCart,
    isInCartVal: isInCart(bundle.id),
    onShare: () => setShareOpen(true),
    onBookmark: handleBookmark,
    onScrollToItems: scrollToItems,
    bundleId: bundle.id,
    couponCurrency: couponCurrency,
    onCouponApply: (r: CouponValidationResult) => setCoupon(r),
    onCouponRemove: () => setCoupon(null),
    cartOk,
    bmOk,
    isBookmarkedVal: isBookmarked(bundle.id),
    accessManaged,
    supportEmail,
    title: bundle.title,
  };

  if (isArchived && !hasAccess) {
    return (
      <LayoutWrapper layout={lay} theme={theme}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <h2 className="text-xl font-semibold">Content No Longer Available</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            This {term.singular.toLowerCase()} has been archived.
          </p>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper layout={lay} theme={theme}>
      {isArchived && hasAccess && (
        <div className="bg-muted text-muted-foreground border-b px-4 py-3 text-center text-sm">
          Archived, your access is preserved.
        </div>
      )}

      {/* ═══ HERO: Banner image + info below ═══ */}
      <section className="bg-muted/40 relative overflow-hidden">
        {/* Decorative gradient blobs */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-purple-300 opacity-20 mix-blend-multiply blur-3xl dark:opacity-10" />
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-blue-300 opacity-20 mix-blend-multiply blur-3xl dark:opacity-10" />

        <div className="relative z-10 mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
          {/* Back */}
          <button
            type="button"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition sm:mb-5"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {/* Banner image, 16:9 to match the AI thumbnail's generated ratio, so
              the composed image fills the box without the 21:9 crop that clipped
              the title. Display-only; the shared thumbnail image is unchanged. */}
          <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg sm:rounded-3xl">
            <div className="bg-muted relative aspect-video w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={bundle.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PH;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
              {bundleData.previewUrl && (
                <button
                  type="button"
                  onClick={() => setShowPreviewVideo(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
                  aria-label="Play bundle preview video"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform hover:scale-110 sm:h-16 sm:w-16">
                    <Play className="text-primary h-7 w-7 translate-x-0.5 sm:h-8 sm:w-8" />
                  </div>
                </button>
              )}
              {pr.off > 0 && !hasAccess && (
                <div className="pointer-events-none absolute right-4 top-4 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg sm:text-sm">
                  {pr.savingLabel}
                </div>
              )}
              <div className="pointer-events-none bg-card/90 text-foreground absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm sm:text-sm">
                <Layers className="text-primary h-3.5 w-3.5" />
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </div>
            </div>
          </div>
        </div>

        {/* Info + Pricing row */}
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            {/* Left: Title & meta */}
            <div className="min-w-0 flex-1">
              <div className="bg-card mb-3 inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
                </span>
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  {term.singular}
                </span>
              </div>

              <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
                {bundle.title}
              </h1>
              {bundle.subtitle && (
                <p className="text-muted-foreground mt-2 text-base sm:text-lg">
                  {bundle.subtitle}
                </p>
              )}

              {/* Meta pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {courseItems.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                    <Video className="h-3 w-3" /> {courseItems.length}{" "}
                    {courseItems.length === 1 ? "Course" : "Courses"}
                  </span>
                )}
                {bookItems.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <BookOpen className="h-3 w-3" /> {bookItems.length}{" "}
                    {bookItems.length === 1 ? "Book" : "Books"}
                  </span>
                )}
                {testSeriesItems.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-400">
                    <ClipboardList className="h-3 w-3" /> {testSeriesItems.length} Test Series
                  </span>
                )}
                {/* null validityDays = lifetime, not "no validity", render it. */}
                <span className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium">
                  <Clock className="h-3 w-3" />{" "}
                  {bundle.validityDays == null
                    ? "Lifetime access"
                    : `${bundle.validityDays} days access`}
                </span>
              </div>

              {/* Trust signals */}
              <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium sm:text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Instant Access
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {totalItems} Items
                  Included
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />{" "}
                  {bundle.validityDays == null
                    ? "Lifetime Access"
                    : `${bundle.validityDays} Days Access`}
                </span>
              </div>
            </div>

            {/* Right: Pricing card */}
            <div className="w-full shrink-0 lg:w-80 xl:w-96">
              <div className="bg-card overflow-hidden rounded-2xl border border-border shadow-lg lg:sticky lg:top-24">
                <div className="p-5">
                  <PricingCard {...pricingProps} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="bg-card border-y border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-5 sm:px-6 md:grid-cols-4 md:py-6">
          {courseItems.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
                <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-foreground text-xl font-bold">{courseItems.length}</p>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  {courseItems.length === 1 ? "Course" : "Courses"}
                </p>
              </div>
            </div>
          )}
          {bookItems.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-foreground text-xl font-bold">{bookItems.length}</p>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  {bookItems.length === 1 ? "Book" : "Books"}
                </p>
              </div>
            </div>
          )}
          {testSeriesItems.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10">
                <ClipboardList className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-foreground text-xl font-bold">{testSeriesItems.length}</p>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Test Series
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-xl">
              <Clock className="text-muted-foreground h-5 w-5" />
            </div>
            <div>
              <p className="text-foreground text-xl font-bold">
                {bundle.validityDays == null ? "Lifetime" : bundle.validityDays}
              </p>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                {bundle.validityDays == null ? "Access" : "Days Access"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
              <Layers className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="text-foreground text-xl font-bold">{totalItems}</p>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                Total Items
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DESCRIPTION ═══ */}
      {bundle.description && (
        <section className="bg-card px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-foreground mb-4 text-2xl font-bold">About this {term.singular}</h2>
            <p className="text-muted-foreground whitespace-pre-wrap text-base leading-relaxed sm:text-lg">
              {bundle.description}
            </p>
          </div>
        </section>
      )}

      {/* ═══ WHAT'S INSIDE ═══ */}
      <div ref={itemsRef} className="scroll-mt-20">
        {(courseItems.length > 0 ||
          bookItems.length > 0 ||
          testSeriesItems.length > 0) && (
          <section className="bg-muted/30 px-4 py-12 sm:px-6 sm:py-16">
            <div className="mx-auto max-w-6xl space-y-12">
              {/* Section header */}
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-foreground text-2xl font-bold sm:text-3xl">
                  Everything Inside the {term.singular}
                </h2>
                <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                  A complete learning package designed to help you grow
                </p>
              </div>

              {/* Courses */}
              {courseItems.length > 0 && (
                <div>
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
                      <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-foreground text-lg font-bold">Courses</h3>
                      <p className="text-muted-foreground text-sm">
                        {courseItems.length} {courseItems.length === 1 ? "course" : "courses"}{" "}
                        included
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {courseItems.map((item, idx) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        index={idx}
                        hasAccess={hasAccess}
                        courseStatus={courseStatusOf(item)}
                        onPreview={setPreview}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Books */}
              {bookItems.length > 0 && (
                <div>
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                      <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-foreground text-lg font-bold">Books</h3>
                      <p className="text-muted-foreground text-sm">
                        {bookItems.length} {bookItems.length === 1 ? "book" : "books"} included
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bookItems.map((item, idx) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        index={idx}
                        hasAccess={hasAccess}
                        onPreview={setPreview}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Test Series */}
              {testSeriesItems.length > 0 && (
                <div>
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10">
                      <ClipboardList className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-foreground text-lg font-bold">Test Series</h3>
                      <p className="text-muted-foreground text-sm">
                        {testSeriesItems.length}{" "}
                        {testSeriesItems.length === 1 ? "test series" : "test series"} included
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {testSeriesItems.map((item, idx) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        index={idx}
                        hasAccess={hasAccess}
                        onPreview={setPreview}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ═══ BOTTOM CTA ═══ */}
      {!hasAccess && accessChecked && (
        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="bg-foreground mx-auto max-w-4xl overflow-hidden rounded-3xl p-8 text-center shadow-xl sm:p-12">
            <h2 className="bg-background text-2xl font-bold sm:text-3xl" style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Ready to get started?
            </h2>
            <p className="bg-background/70 mx-auto mt-2 max-w-lg text-sm sm:text-base" style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Get instant access to all {totalItems} items in this {term.singular.toLowerCase()}
            </p>
            <div className="mt-6 inline-flex items-baseline gap-3">
              {accessManaged ? null : coupon ? (
                <>
                  <span className="bg-background/50 text-lg" style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    <s>
                      {coupon.currency === "USD" ? "$" : "₹"}
                      {coupon.original_amount}
                    </s>
                  </span>
                  <span className="bg-background text-4xl font-extrabold" style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {coupon.currency === "USD" ? "$" : "₹"}
                    {coupon.net_amount}
                  </span>
                </>
              ) : (
                <>
                  {pr.original && (
                    <span className="bg-background/50 text-lg" style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      <s>{pr.original}</s>
                    </span>
                  )}
                  <span
                    className={cn(
                      "bg-background font-extrabold",
                      pr.unavailable && !isFree ? "text-sm font-normal" : "text-4xl"
                    )}
                    style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
                  >
                    {isFree ? "Free" : pr.display}
                  </span>
                </>
              )}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {accessManaged && (
                <AccessManagedCta
                  hasAccess={false}
                  supportEmail={supportEmail}
                  contactSubject={bundle.title}
                  size="lg"
                />
              )}
              {!accessManaged && !(pr.unavailable && !isFree) && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={enrolling}
                  className="bg-background text-foreground hover:bg-background/90 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold shadow-lg transition disabled:opacity-50"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {isFree ? (enrolling ? "Enrolling..." : "Get Now: Free") : "Buy Now"}
                </button>
              )}
              {!accessManaged && cartOk && !isFree && !pr.unavailable && (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-8 py-3.5 text-sm font-medium transition",
                    isInCart(bundle.id)
                      ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20"
                      : "bg-background/10 border-background/20 text-background hover:bg-background/20"
                  )}
                >
                  {isInCart(bundle.id) ? "Remove from Cart" : "Add to Cart"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Modals */}
      {preview && (
        <ItemModal
          item={preview}
          hasAccess={hasAccess}
          courseStatus={courseStatusOf(preview)}
          onClose={() => setPreview(null)}
        />
      )}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        url={`${typeof window !== "undefined" ? window.location.origin : ""}/bundles/${bundle.slug}`}
        title={bundle.title ?? term.singular}
        modalTitle={`Share this ${term.singular.toLowerCase()}`}
      />
      {bundleData.previewUrl && (
        <PreviewVideoModal
          open={showPreviewVideo}
          previewUrl={bundleData.previewUrl}
          onClose={() => setShowPreviewVideo(false)}
        />
      )}
      <EasyCheckoutGuardModal guard={guard} />
    </LayoutWrapper>
  );
}

export function BundleDetailClient(props: BundleDetailClientProps) {
  const { availableRoutes, ...rest } = props;
  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <BundleDetailContent {...rest} />
    </AvailableRoutesProvider>
  );
}
