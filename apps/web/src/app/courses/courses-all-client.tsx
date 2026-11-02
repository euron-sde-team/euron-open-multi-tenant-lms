"use client";

import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { getCourseThumbnailUrl, type CourseListItem } from "@/lib/api";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useCart } from "@/lib/hooks/use-cart";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useCurrency, useCurrencyContext } from "@/lib/hooks/use-currency";
import { useInfiniteCourses, type CourseFilter } from "@/lib/hooks/use-infinite-courses";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { useBookmark } from "@/lib/stores/bookmark-store";
import { cn } from "@/lib/utils";
import { THUMBNAILS_BASE_URL } from "@/lib/utils/constants";
import { AvailableRoutesProvider, CourseCard, useAvailableRoutes, useToast } from "@open-mtlms/core";
import type { AvailableRoutesResponse, ContentTerm, ResolvePriceContext, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { getErrorMessage, HIDDEN_PRICE, resolvePrice } from "@open-mtlms/shared";
import { Bookmark, BookOpen, LayoutGrid, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function normalizeCourseForCard(course: CourseListItem) {
  const thumbnailKey =
    course.thumbnail_key ?? (course as { thumbnailUrl?: string | null }).thumbnailUrl;
  // Use resolved URL if available; otherwise pass key so CourseCard can build URL with thumbnailBaseUrl
  const thumbnailUrl = getCourseThumbnailUrl(thumbnailKey) ?? thumbnailKey ?? null;
  return {
    id: course.id,
    title: course.title ?? "Untitled Course",
    slug: course.slug ?? course.id,
    subtitle: course.subtitle ?? null,
    description: course.description ?? "Learn something new today",
    thumbnailUrl,
    duration: course.duration ?? null,
    priceInr: course.price_inr ?? (course as { priceInr?: string }).priceInr ?? null,
    priceUsd: course.price_usd ?? (course as { priceUsd?: string }).priceUsd ?? null,
    discountInr: null,
    discountUsd: null,
    purchaseMode: course.purchase_mode ?? "PAID",
    mode: course.mode ?? "SELF_PACED",
    difficulty: course.difficulty ?? "NONE",
    language: ["English"],
    instructor: null,
    // Surfaced by the learner-api course list so the card can show
    // "Part of <Bundle>".
    bundles: course.bundles ?? [],
  };
}

const MODE_TABS: { value: CourseFilter; label: string; icon: typeof BookOpen; authOnly?: boolean }[] = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "SELF_PACED", label: "Self-Paced", icon: BookOpen },
  { value: "bookmarked", label: "Bookmarked", icon: Bookmark, authOnly: true },
];

interface CoursesAllClientProps {
  layout: TenantLayout | null;
  theme: ThemeConfig | null;
  availableRoutes?: AvailableRoutesResponse | null;
  initialHost: string;
  /** When set, fixes the mode filter (no tabs). Used by /self-paced. */
  fixedMode?: CourseFilter;
  /** Custom page title when fixedMode is set */
  pageTitle?: string;
  /** Custom page subtitle when fixedMode is set */
  pageSubtitle?: string;
  /**
   * Page-specific term for inner labels (search, empty states, toasts…). Mode
   * pages pass this so a renamed nav item renames the whole page, not just the
   * heading. Falls back to
   * the generic course term when omitted (e.g. /all-courses).
   */
  term?: ContentTerm;
}

/** Defensive read of multi-currency + legacy price fields off a course list item. */
function coursePriceInput(course: CourseListItem) {
  const raw = course as CourseListItem & {
    purchaseMode?: string;
    priceInr?: string;
    priceUsd?: string;
    discountInr?: string;
    discountUsd?: string;
    discount_inr?: string | null;
    discount_usd?: string | null;
    prices?: Record<string, { amount: number | string; discount?: number | string | null }> | null;
  };
  return {
    prices: raw.prices ?? null,
    legacyInr: course.price_inr ?? raw.priceInr,
    legacyUsd: course.price_usd ?? raw.priceUsd,
    legacyDiscountInr: raw.discount_inr ?? raw.discountInr,
    legacyDiscountUsd: raw.discount_usd ?? raw.discountUsd,
    purchaseMode: course.purchase_mode ?? raw.purchaseMode,
  };
}

function CoursesAllContent({
  layout,
  theme,
  initialHost,
  fixedMode,
  pageTitle,
  pageSubtitle,
  term,
}: Omit<CoursesAllClientProps, "availableRoutes">) {
  const router = useRouter();
  // Page-specific term (mode pages) overrides the generic course term so every
  // inner label follows the renamed nav item, not just the heading.
  const genericCourseTerm = useContentTerm("course");
  const courseTerm = term ?? genericCourseTerm;
  const { isPathAvailable } = useAvailableRoutes();
  const { toast } = useToast();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleBookmark, isBookmarked } = useBookmark();
  const { isAuthenticated } = useUserAuthStore();
  const currency = useCurrency();
  const { resolvedCurrency, defaultCurrency, enabledCurrencies } = useCurrencyContext();
  const { accessManaged, enrolledCoursesOnly } = useStorefrontConfig();
  const priceCtx: ResolvePriceContext = { resolvedCurrency, defaultCurrency, enabledCurrencies };
  const guard = useBuyNowGuard();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [modeFilter, setModeFilter] = useState<CourseFilter>("all");
  const effectiveFilter = fixedMode ?? modeFilter;
  const host = typeof window !== "undefined" ? window.location.host : initialHost;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteCourses(host, effectiveFilter);

  const courses = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.courses);
  }, [data?.pages]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "120px", threshold: 0.1 }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleCourseClick = (slug: string) => {
    const path = `/courses/${slug}`;
    router.push(path);
  };

  const handleCartToggle = (course: CourseListItem) => {
    guard.run(() => doCartToggle(course));
  };

  const doCartToggle = (course: CourseListItem) => {
    const inCart = isInCart(course.id);
    if (inCart) {
      removeFromCart({ item_type: "COURSE", item_id: course.id });
      toast({ title: "Removed from cart", description: `${course.title ?? courseTerm.singular} has been removed from your cart.` });
    } else {
      addToCart(
        { item_type: "COURSE", item_id: course.id },
        {
          onSuccess: () => {
            toast({ title: "Added to cart", description: `${course.title ?? courseTerm.singular} has been added to your cart.` });
          },
          onError: (err) => {
            toast({ title: "Failed to add", description: getErrorMessage(err), variant: "destructive" });
          },
        }
      );
    }
  };

  const renderCourseCard = (course: CourseListItem) => {
    const normalized = normalizeCourseForCard(course);
    const isPaid = (course.purchase_mode ?? "PAID") === "PAID";
    const owned = course.has_access === true;
    const cartAvailable = isPathAvailable("/cart");
    const bookmarkAvailable = isPathAvailable("/bookmark");
    return (
      <CourseCard
        key={course.id}
        {...normalized}
        thumbnailBaseUrl={THUMBNAILS_BASE_URL ?? ""}
        onClick={() => handleCourseClick(normalized.slug)}
        currency={currency === "USD" ? "USD" : "INR"}
        priceParts={accessManaged ? HIDDEN_PRICE : resolvePrice(coursePriceInput(course), priceCtx)}
        variant="grid"
        className="w-full"
        hasAccess={owned}
        progressPercent={owned ? course.progress_percent : undefined}
        // The plain course word, not this page's heading ("Self Paced
        // Courses"), so a card reads "Start Course", not "Start Self Paced Course".
        courseTerm={genericCourseTerm.singular}
        onContinue={owned ? () => router.push(`/learn/courses/${normalized.slug}`) : undefined}
        showAddToCartIcon={!owned && isPaid && cartAvailable && !accessManaged}
        isInCart={isAuthenticated ? isInCart(course.id) : false}
        onAddToCart={!owned && isPaid && cartAvailable && !accessManaged ? () => handleCartToggle(course) : undefined}
        showBookmarkIcon={bookmarkAvailable}
        isBookmarked={isAuthenticated ? isBookmarked(course.id) : false}
        onBookmarkToggle={
          bookmarkAvailable
            ? () => {
                if (!isAuthenticated) {
                  router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
                  return;
                }
                const wasBookmarked = isBookmarked(course.id);
                toggleBookmark({
                  productId: course.id,
                  productType: "course",
                  title: course.title ?? `Untitled ${courseTerm.singular}`,
                  slug: course.slug ?? course.id,
                  thumbnailUrl: getCourseThumbnailUrl(course.thumbnail_key ?? null) ?? null,
                  subtitle: course.subtitle ?? null,
                });
                toast({
                  title: wasBookmarked ? "Removed from bookmarks" : "Added to bookmarks",
                  description: `${course.title ?? courseTerm.singular} has been ${
                    wasBookmarked ? "removed from" : "added to"
                  } your bookmarks.`,
                });
              }
            : undefined
        }
      />
    );
  };

  // Enrolled-only tenants: the server already returns only the learner's
  // enrolled courses, so reframe this as "My Courses" and drop the catalog
  // framing (no explore/mode tabs, enrolled-only empty state).
  const title = enrolledCoursesOnly
    ? (pageTitle ?? `My ${courseTerm.plural}`)
    : (pageTitle ?? `All ${courseTerm.plural}`);
  const subtitle = enrolledCoursesOnly
    ? (pageSubtitle ?? `The ${courseTerm.plural.toLowerCase()} you're enrolled in.`)
    : (pageSubtitle ??
      `Explore our ${courseTerm.plural.toLowerCase()}. Browse and find what fits you best.`);

  return (
    <LayoutWrapper layout={layout ?? null} theme={theme ?? undefined}>
      <div className="container-custom section-padding">
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground mb-6 text-sm sm:mb-8 sm:text-base">{subtitle}</p>

        {/* Mode filter tabs, hidden when fixedMode is set, and hidden entirely
            in enrolled-only mode (no catalog to explore/filter). */}
        {!fixedMode && !enrolledCoursesOnly && (
          <div className="mb-6 flex flex-wrap gap-2 sm:mb-8">
            {MODE_TABS.filter((tab) => !tab.authOnly || isAuthenticated).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setModeFilter(tab.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                    modeFilter === tab.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {isError && (
          <div className="border-destructive/50 bg-destructive/10 mb-8 flex flex-col items-center justify-center rounded-lg border py-12">
            <p className="text-destructive text-center text-sm sm:text-base">
              {error instanceof Error
                ? error.message
                : `Failed to load ${courseTerm.plural.toLowerCase()}. Please try again.`}
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              Make sure the learner API is running.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="border-input bg-background hover:bg-muted mt-4 flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {(isLoading || !currency) && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-muted h-64 animate-pulse rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && currency && !isError && courses.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {courses.map((course) => renderCourseCard(course))}
          </div>
        )}

        {!isLoading && currency && !isError && courses.length === 0 && (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <BookOpen className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-center">
              {enrolledCoursesOnly
                ? isAuthenticated
                  ? `You're not enrolled in any ${courseTerm.plural.toLowerCase()} yet.`
                  : `Sign in to see the ${courseTerm.plural.toLowerCase()} you're enrolled in.`
                : `No ${courseTerm.plural.toLowerCase()} in this category yet.`}
            </p>
          </div>
        )}

        <div ref={loadMoreRef} className="flex min-h-[80px] items-center justify-center py-8">
          {isFetchingNextPage && <Loader2 className="text-primary h-6 w-6 animate-spin" />}
        </div>
      </div>
      <EasyCheckoutGuardModal guard={guard} />
    </LayoutWrapper>
  );
}

export function CoursesAllClient(props: CoursesAllClientProps) {
  const { availableRoutes, ...rest } = props;
  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <CoursesAllContent {...rest} />
    </AvailableRoutesProvider>
  );
}
