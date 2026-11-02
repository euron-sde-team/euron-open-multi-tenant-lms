"use client";

import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { getCourseThumbnailUrl } from "@/lib/api";
import type { CategoryListItem } from "@/lib/api/categories";
import { emptyLayout } from "@/lib/default-layout";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useCart } from "@/lib/hooks/use-cart";
import { useCurrency, useCurrencyContext } from "@/lib/hooks/use-currency";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useBookmark } from "@/lib/stores/bookmark-store";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { THUMBNAILS_BASE_URL } from "@/lib/utils/constants";
import {
  AvailableRoutesProvider,
  BookCard,
  CourseCard,
  useAvailableRoutes,
  useToast,
} from "@open-mtlms/core";
import type { AvailableRoutesResponse, PageConfig, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { getErrorMessage, HIDDEN_PRICE, resolvePrice } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import { FolderTree } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CategoryDetailClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
  availableRoutes?: AvailableRoutesResponse | null;
  category: CategoryListItem;
  parentCategory: CategoryListItem | null;
  subcategories: CategoryListItem[];
  initialCourses: Array<Record<string, unknown>>;
  initialBooks: Array<Record<string, unknown>>;
}

function getIconUrl(iconUrl: string | null): string | null {
  return getCourseThumbnailUrl(iconUrl);
}

function CategoryDetailContent({
  layout,
  pageConfig,
  category,
  parentCategory,
  subcategories,
  initialCourses,
  initialBooks,
}: Omit<CategoryDetailClientProps, "availableRoutes">) {
  const router = useRouter();
  const { toast } = useToast();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toggleBookmark, isBookmarked } = useBookmark();
  const { isPathAvailable } = useAvailableRoutes();
  const { isAuthenticated } = useUserAuthStore();
  const guard = useBuyNowGuard();
  const currency = useCurrency();
  const { resolvedCurrency, defaultCurrency, enabledCurrencies } = useCurrencyContext();
  const { accessManaged } = useStorefrontConfig();
  const priceCtx = { resolvedCurrency, defaultCurrency, enabledCurrencies };
  const bookmarkAvailable = isPathAvailable("/bookmark");

  const theme: ThemeConfig = pageConfig?.theme ?? defaultThemeConfig;
  const effectiveLayout = layout ?? emptyLayout;
  const iconUrl = getIconUrl(category.icon_url);

  const courses = initialCourses as Array<{
    id: string;
    title: string;
    slug: string;
    subtitle?: string | null;
    description?: string | null;
    thumbnail_key?: string | null;
    thumbnailUrl?: string | null;
    duration?: string | null;
    price_inr?: string | null;
    price_usd?: string | null;
    priceInr?: string | null;
    priceUsd?: string | null;
    discount_inr?: string | null;
    discount_usd?: string | null;
    discountInr?: string | null;
    discountUsd?: string | null;
    purchase_mode?: string;
    purchaseMode?: string;
    mode?: string;
    difficulty?: string;
    language?: string[];
    instructor?: { id: string; name: string; avatar: string | null } | null;
  }>;

  const books = initialBooks as Array<{
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    thumbnail_url?: string | null;
    pages?: number | null;
    priceInr?: string | null;
    priceUsd?: string | null;
    price_inr?: string | null;
    price_usd?: string | null;
    discountInr?: string | null;
    discountUsd?: string | null;
    discount_inr?: string | null;
    discount_usd?: string | null;
    purchaseMode?: string;
    purchase_mode?: string;
    language?: string[];
    author?: string | null;
    authors?: { id: string; name: string }[];
  }>;

  const handleCourseClick = (slug: string) => {
    router.push(`/courses/${slug}`);
  };

  const handleBookClick = (slug: string) => {
    router.push(`/books/${slug}`);
  };

  const handleCartToggleCourse = (course: (typeof courses)[0]) => {
    guard.run(() => {
      if (isInCart(course.id)) {
        removeFromCart({ item_type: "COURSE", item_id: course.id });
        toast({ title: "Removed from cart", description: `${course.title} has been removed from your cart.` });
      } else {
        addToCart(
          { item_type: "COURSE", item_id: course.id },
          {
            onSuccess: () => toast({ title: "Added to cart", description: `${course.title} has been added to your cart.` }),
            onError: (err) => toast({ title: "Failed to add", description: getErrorMessage(err), variant: "destructive" }),
          }
        );
      }
    });
  };

  const handleCartToggleBook = (book: (typeof books)[0]) => {
    guard.run(() => {
      if (isInCart(book.id)) {
        removeFromCart({ item_type: "BOOK", item_id: book.id });
        toast({ title: "Removed from cart", description: `${book.title} has been removed from your cart.` });
      } else {
        addToCart(
          { item_type: "BOOK", item_id: book.id },
          {
            onSuccess: () => toast({ title: "Added to cart", description: `${book.title} has been added to your cart.` }),
            onError: (err) => toast({ title: "Failed to add", description: getErrorMessage(err), variant: "destructive" }),
          }
        );
      }
    });
  };

  const handleBookmarkCourse = (course: (typeof courses)[0]) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const wasBookmarked = isBookmarked(course.id);
    toggleBookmark({
      productId: course.id,
      productType: "course",
      title: course.title ?? "Untitled Course",
      slug: course.slug ?? course.id,
      thumbnailUrl:
        getCourseThumbnailUrl(course.thumbnail_key ?? course.thumbnailUrl ?? null) ?? null,
    });
    toast({
      title: wasBookmarked ? "Removed from bookmarks" : "Added to bookmarks",
      description: `${course.title} has been ${wasBookmarked ? "removed from" : "added to"} your bookmarks.`,
    });
  };

  const handleBookmarkBook = (book: (typeof books)[0]) => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const wasBookmarked = isBookmarked(book.id);
    toggleBookmark({
      productId: book.id,
      productType: "book",
      title: book.title ?? "Untitled Book",
      slug: book.slug ?? book.id,
      thumbnailUrl: book.thumbnailUrl ?? book.thumbnail_url ?? null,
    });
    toast({
      title: wasBookmarked ? "Removed from bookmarks" : "Added to bookmarks",
      description: `${book.title} has been ${wasBookmarked ? "removed from" : "added to"} your bookmarks.`,
    });
  };

  const handleSubcategoryClick = (subSlug: string) => {
    router.push(`/categories/${subSlug}`);
  };

  return (
    <LayoutWrapper layout={effectiveLayout} theme={theme}>
      <div className="container-custom section-padding scroll-smooth">
        <nav className="text-muted-foreground mb-6 flex flex-wrap items-center gap-2 text-sm">
          <Link href="/categories" className="hover:text-foreground transition-colors">
            Categories
          </Link>
          {parentCategory && (
            <>
              <span>/</span>
              <Link
                href={`/categories/${parentCategory.slug}`}
                className="hover:text-foreground transition-colors"
              >
                {parentCategory.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground font-medium">{category.name}</span>
        </nav>

        <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="bg-muted flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full">
            {iconUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={iconUrl} alt={category.name} className="h-full w-full object-cover" />
            ) : (
              <FolderTree className="text-muted-foreground h-10 w-10" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{category.name}</h1>
            {category.description && (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm sm:text-base">
                {category.description}
              </p>
            )}
          </div>
        </div>

        {subcategories.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-lg font-semibold sm:text-xl">Subcategories</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {subcategories.map((sub) => {
                const subIconUrl = getIconUrl(sub.icon_url);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSubcategoryClick(sub.slug)}
                    className="bg-card hover:border-primary/50 group flex items-center gap-3 rounded-xl border p-4 text-left shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full">
                      {subIconUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={subIconUrl}
                          alt={sub.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FolderTree className="text-muted-foreground h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground group-hover:text-primary block font-medium">
                        {sub.name}
                      </span>
                      {sub.description && (
                        <span className="text-muted-foreground line-clamp-2 block text-xs">
                          {sub.description}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {courses.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-lg font-semibold sm:text-xl">Courses</h2>
            {!currency ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: Math.min(courses.length, 8) }).map((_, i) => (
                  <div key={i} className="bg-muted h-64 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  id={course.id}
                  title={course.title ?? "Untitled Course"}
                  slug={course.slug ?? course.id}
                  subtitle={course.subtitle ?? null}
                  description={course.description ?? ""}
                  thumbnailUrl={
                    getCourseThumbnailUrl(course.thumbnail_key ?? course.thumbnailUrl ?? null) ??
                    course.thumbnail_key ??
                    course.thumbnailUrl ??
                    null
                  }
                  thumbnailBaseUrl={THUMBNAILS_BASE_URL ?? ""}
                  duration={course.duration ?? null}
                  priceInr={course.price_inr ?? course.priceInr ?? null}
                  priceUsd={course.price_usd ?? course.priceUsd ?? null}
                  discountInr={course.discount_inr ?? course.discountInr ?? null}
                  discountUsd={course.discount_usd ?? course.discountUsd ?? null}
                  currency={currency === "USD" ? "USD" : "INR"}
                  priceParts={
                    accessManaged
                      ? HIDDEN_PRICE
                      : resolvePrice(
                          {
                            prices:
                              (course as { prices?: Record<string, { amount: number; discount?: number | null }> | null })
                                .prices ?? null,
                            legacyInr: course.price_inr ?? course.priceInr,
                            legacyUsd: course.price_usd ?? course.priceUsd,
                            legacyDiscountInr: course.discount_inr ?? course.discountInr,
                            legacyDiscountUsd: course.discount_usd ?? course.discountUsd,
                            purchaseMode: course.purchase_mode ?? course.purchaseMode ?? "PAID",
                          },
                          priceCtx
                        )
                  }
                  purchaseMode={
                    (course.purchase_mode ?? course.purchaseMode ?? "PAID") as "FREE" | "PAID"
                  }
                  mode={(course.mode ?? "SELF_PACED") as "LIVE" | "SELF_PACED" | "HYBRID"}
                  difficulty={course.difficulty ?? "NONE"}
                  language={course.language ?? ["English"]}
                  instructor={course.instructor ?? null}
                  onClick={() => handleCourseClick(course.slug ?? course.id)}
                  showAddToCartIcon={!accessManaged}
                  isInCart={isAuthenticated ? isInCart(course.id) : false}
                  onAddToCart={accessManaged ? undefined : () => handleCartToggleCourse(course)}
                  showBookmarkIcon={bookmarkAvailable}
                  isBookmarked={isAuthenticated ? isBookmarked(course.id) : false}
                  onBookmarkToggle={bookmarkAvailable ? () => handleBookmarkCourse(course) : undefined}
                  className="w-full transition-shadow hover:shadow-lg"
                />
              ))}
            </div>
            )}
          </section>
        )}

        {books.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold sm:text-xl">Books</h2>
            {!currency ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                {Array.from({ length: Math.min(books.length, 8) }).map((_, i) => (
                  <div key={i} className="bg-muted h-64 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  id={book.id}
                  title={book.title ?? "Untitled Book"}
                  slug={book.slug ?? book.id}
                  description={book.description ?? null}
                  thumbnailUrl={book.thumbnailUrl ?? book.thumbnail_url ?? null}
                  thumbnailBaseUrl={THUMBNAILS_BASE_URL ?? ""}
                  pages={book.pages ?? null}
                  priceInr={book.priceInr ?? book.price_inr ?? null}
                  priceUsd={book.priceUsd ?? book.price_usd ?? null}
                  discountInr={book.discountInr ?? book.discount_inr ?? null}
                  discountUsd={book.discountUsd ?? book.discount_usd ?? null}
                  purchaseMode={
                    (book.purchaseMode ?? book.purchase_mode ?? "PAID") as "FREE" | "PAID"
                  }
                  language={book.language ?? ["English"]}
                  author={book.author ?? null}
                  authors={book.authors ?? []}
                  onClick={() => handleBookClick(book.slug ?? book.id)}
                  currency={currency === "USD" ? "USD" : "INR"}
                  priceParts={
                    accessManaged
                      ? HIDDEN_PRICE
                      : resolvePrice(
                          {
                            prices:
                              (book as { prices?: Record<string, { amount: number; discount?: number | null }> | null })
                                .prices ?? null,
                            legacyInr: book.priceInr ?? book.price_inr,
                            legacyUsd: book.priceUsd ?? book.price_usd,
                            legacyDiscountInr: book.discountInr ?? book.discount_inr,
                            legacyDiscountUsd: book.discountUsd ?? book.discount_usd,
                            purchaseMode: book.purchaseMode ?? book.purchase_mode ?? "PAID",
                          },
                          priceCtx
                        )
                  }
                  variant="grid"
                  className="w-full transition-shadow hover:shadow-lg"
                  showAddToCartIcon={!accessManaged}
                  isInCart={isAuthenticated ? isInCart(book.id) : false}
                  onAddToCart={accessManaged ? undefined : () => handleCartToggleBook(book)}
                  showBookmarkIcon={bookmarkAvailable}
                  isBookmarked={isAuthenticated ? isBookmarked(book.id) : false}
                  onBookmarkToggle={bookmarkAvailable ? () => handleBookmarkBook(book) : undefined}
                />
              ))}
            </div>
            )}
          </section>
        )}

        {courses.length === 0 && books.length === 0 && subcategories.length === 0 && (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-16">
            <FolderTree className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground px-4 text-center text-sm sm:text-base">
              No courses or books in this category yet.
            </p>
            <Link href="/all-courses" className="text-primary mt-4 text-sm font-medium hover:underline">
              Browse all courses
            </Link>
          </div>
        )}
      </div>
      <EasyCheckoutGuardModal guard={guard} />
    </LayoutWrapper>
  );
}

export function CategoryDetailClient(props: CategoryDetailClientProps) {
  const { availableRoutes, ...rest } = props;
  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <CategoryDetailContent {...rest} />
    </AvailableRoutesProvider>
  );
}
