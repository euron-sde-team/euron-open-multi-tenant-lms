"use client";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { getCourseThumbnailUrl, type CourseListItem } from "@/lib/api";
import {
  useInfiniteEnrolledCourses,
  type EnrolledCourseFilter,
} from "@/lib/hooks/use-infinite-enrolled-courses";
import { useInfiniteOwnedBooks } from "@/lib/hooks/use-infinite-owned-books";
import { useContentTerm, useNavLabel } from "@/lib/hooks/use-content-terms";
import { useCurrency } from "@/lib/hooks/use-currency";
import { useBookmark } from "@/lib/stores/bookmark-store";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { cn, decodeHtmlEntities } from "@/lib/utils";
import { THUMBNAILS_BASE_URL } from "@/lib/utils/constants";
import {
  AvailableRoutesProvider,
  BookCard,
  BookCardSkeleton,
  CourseCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useAvailableRoutes,
  useToast,
} from "@open-mtlms/core";
import type {
  AvailableRoutesResponse,
  TenantLayout,
  ThemeConfig,
} from "@open-mtlms/shared";
import {
  BookOpen,
  CheckCircle2,
  DollarSign,
  Gift,
  GraduationCap,
  Layers,
  LayoutGrid,
  Loader2,
  Radio,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PublishedBookListItem } from "@/lib/api/books";

function normalizeCourseForCard(course: CourseListItem) {
  const thumbnailKey =
    course.thumbnail_key ??
    (course as { thumbnailUrl?: string | null }).thumbnailUrl;
  const thumbnailUrl =
    getCourseThumbnailUrl(thumbnailKey) ?? thumbnailKey ?? null;
  const resolvedDifficulty = course.difficulty ?? "NONE";
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
    difficulty: resolvedDifficulty,
    language: ["English"],
    instructor: null,
  };
}

const COURSE_FILTERS: {
  value: EnrolledCourseFilter;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "FREE", label: "Free", icon: Gift },
  { value: "PAID", label: "Paid", icon: DollarSign },
  { value: "SELF_PACED", label: "Self-Paced", icon: BookOpen },
  { value: "LIVE", label: "Live", icon: Radio },
  { value: "HYBRID", label: "Hybrid", icon: Layers },
  { value: "complete", label: "Complete", icon: CheckCircle2 },
];

interface MyLearningClientProps {
  layout: TenantLayout | null;
  theme: ThemeConfig | null;
  availableRoutes?: AvailableRoutesResponse | null;
  initialHost: string;
}

function MyLearningContent({
  layout,
  theme,
  initialHost,
}: Omit<MyLearningClientProps, "availableRoutes">) {
  const router = useRouter();
  const bookTerm = useContentTerm("book");
  const courseTerm = useContentTerm("course");
  const myLearningLabel = useNavLabel("/my-learning", "My Learning");
  const { toast } = useToast();
  const { isPathAvailable } = useAvailableRoutes();
  const { toggleBookmark, isBookmarked } = useBookmark();
  const { isAuthenticated } = useUserAuthStore();
  const currency = useCurrency();
  const host = typeof window !== "undefined" ? window.location.host : initialHost;

  const bookmarkAvailable = isPathAvailable("/bookmark") && isAuthenticated;

  const [courseFilter, setCourseFilter] =
    useState<EnrolledCourseFilter>("all");
  const loadMoreCoursesRef = useRef<HTMLDivElement>(null);
  const loadMoreBooksRef = useRef<HTMLDivElement>(null);

  const {
    data: coursesData,
    fetchNextPage: fetchNextCourses,
    hasNextPage: hasNextCourses,
    isFetchingNextPage: isFetchingNextCourses,
    isLoading: isLoadingCourses,
    isError: isCoursesError,
    error: coursesError,
    refetch: refetchCourses,
  } = useInfiniteEnrolledCourses(host, courseFilter);

  const {
    data: booksData,
    fetchNextPage: fetchNextBooks,
    hasNextPage: hasNextBooks,
    isFetchingNextPage: isFetchingNextBooks,
    isLoading: isLoadingBooks,
    isError: isBooksError,
    error: booksError,
    refetch: refetchBooks,
  } = useInfiniteOwnedBooks();

  const courses = useMemo(() => {
    if (!coursesData?.pages) return [];
    return coursesData.pages.flatMap((p) => p.courses);
  }, [coursesData?.pages]);

  const books = useMemo(() => {
    if (!booksData?.pages) return [];
    return booksData.pages.flatMap((p) => p.books);
  }, [booksData?.pages]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasNextCourses &&
          !isFetchingNextCourses
        ) {
          fetchNextCourses();
        }
      },
      { rootMargin: "120px", threshold: 0.1 }
    );
    const el = loadMoreCoursesRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextCourses, hasNextCourses, isFetchingNextCourses]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasNextBooks &&
          !isFetchingNextBooks
        ) {
          fetchNextBooks();
        }
      },
      { rootMargin: "120px", threshold: 0.1 }
    );
    const el = loadMoreBooksRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextBooks, hasNextBooks, isFetchingNextBooks]);

  const handleCourseClick = (slug: string) => {
    router.push(`/courses/${slug}`);
  };

  const handleBookClick = (slug: string) => {
    router.push(`/books/${slug}`);
  };

  const handleBookmarkCourse = (course: CourseListItem) => {
    const wasBookmarked = isBookmarked(course.id);
    const thumbKey = course.thumbnail_key ?? (course as { thumbnailUrl?: string | null }).thumbnailUrl;
    toggleBookmark({
      productId: course.id,
      productType: "course",
      title: course.title ?? courseTerm.singular,
      slug: course.slug ?? course.id,
      thumbnailUrl: thumbKey ? getCourseThumbnailUrl(thumbKey) ?? null : null,
      subtitle: course.subtitle ?? null,
    });
    toast({
      title: wasBookmarked ? "Removed from bookmarks" : "Added to bookmarks",
      description: `${course.title ?? courseTerm.singular} has been ${wasBookmarked ? "removed from" : "added to"} your bookmarks.`,
    });
  };

  const handleBookmarkBook = (book: PublishedBookListItem) => {
    const wasBookmarked = isBookmarked(book.id);
    toggleBookmark({
      productId: book.id,
      productType: "book",
      title: book.title ?? bookTerm.singular,
      slug: book.slug ?? book.id,
      thumbnailUrl: book.thumbnailUrl ?? null,
      subtitle: book.description ?? null,
    });
    toast({
      title: wasBookmarked ? "Removed from bookmarks" : "Added to bookmarks",
      description: `${book.title ?? bookTerm.singular} has been ${wasBookmarked ? "removed from" : "added to"} your bookmarks.`,
    });
  };

  const allCoursesPath = isPathAvailable("/all-courses") ? "/all-courses" : "/";
  const booksPath = isPathAvailable("/books") ? "/books" : "/";

  return (
    <LayoutWrapper layout={layout ?? null} theme={theme ?? undefined}>
      <div className="container-custom max-w-full min-w-0 overflow-x-hidden pt-4 pb-8 sm:pt-6 sm:pb-10 md:pt-8 md:pb-12 lg:pt-12 lg:pb-16">
        <h1 className="mb-1 break-words text-xl font-bold sm:mb-2 sm:text-2xl md:text-3xl">
          {myLearningLabel}
        </h1>
        <p className="text-muted-foreground mb-3 break-words text-sm sm:mb-4 sm:text-base md:mb-6">
          Your enrolled {courseTerm.plural.toLowerCase()} and owned {bookTerm.plural.toLowerCase()}. Track progress and continue
          learning.
        </p>

        <Tabs defaultValue="courses" className="w-full min-w-0">
          <TabsList className="mb-4 flex h-auto w-full flex-row gap-0 rounded-none border-b border-border bg-transparent p-0 shadow-none sm:mb-5 md:mb-6">
            <TabsTrigger
              value="courses"
              className={cn(
                "min-h-[44px] -mb-px flex flex-1 items-center justify-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-semibold text-muted-foreground transition-all duration-200",
                "hover:bg-muted/40 hover:text-foreground",
                "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none",
                "sm:flex-initial sm:px-8 sm:py-3.5"
              )}
            >
              <GraduationCap className="h-4 w-4 shrink-0" aria-hidden />
              <span>{courseTerm.plural}</span>
            </TabsTrigger>
            <TabsTrigger
              value="books"
              className={cn(
                "min-h-[44px] -mb-px flex flex-1 items-center justify-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-semibold text-muted-foreground transition-all duration-200",
                "hover:bg-muted/40 hover:text-foreground",
                "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none",
                "sm:flex-initial sm:px-8 sm:py-3.5"
              )}
            >
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
              <span>{bookTerm.plural}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="mt-0 min-w-0">
            {/* Mobile: dropdown */}
            <div className="mb-3 md:hidden">
              <Select value={courseFilter} onValueChange={(v) => setCourseFilter(v as EnrolledCourseFilter)}>
                <SelectTrigger className="min-h-[44px] w-full">
                  <SelectValue placeholder={`Filter ${courseTerm.plural.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Desktop: filter buttons */}
            <div className="mb-3 hidden min-w-0 flex-wrap gap-2 overflow-hidden sm:mb-4 md:mb-6 md:flex">
              {COURSE_FILTERS.map((filter) => {
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setCourseFilter(filter.value)}
                    aria-label={filter.label}
                    className={cn(
                      "flex min-h-[44px] min-w-0 items-center justify-center gap-2 overflow-hidden rounded-md border px-3 py-2.5 text-xs font-medium transition-colors sm:min-w-0 sm:justify-start sm:px-4 sm:text-sm",
                      courseFilter === filter.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{filter.label}</span>
                  </button>
                );
              })}
            </div>

            {isCoursesError && (
              <div className="border-destructive/50 bg-destructive/10 mb-6 flex flex-col items-center justify-center rounded-lg border px-4 py-8 sm:mb-8 sm:py-12">
                <p className="text-destructive text-center text-sm sm:text-base">
                  {coursesError instanceof Error
                    ? coursesError.message
                    : `Failed to load ${courseTerm.plural.toLowerCase()}. Please try again.`}
                </p>
                <button
                  type="button"
                  onClick={() => refetchCourses()}
                  className="border-input bg-background hover:bg-muted mt-4 flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            )}

            {(isLoadingCourses || !currency) && (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-muted h-56 animate-pulse rounded-lg sm:h-64"
                  />
                ))}
              </div>
            )}

            {!isLoadingCourses && currency && !isCoursesError && courses.length > 0 && (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {courses.map((course) => {
                  const normalized = normalizeCourseForCard(course);
                  const progressPercent = course.progress_percent ?? 0;
                  const isCourseArchived = (course as { status?: string }).status === "ARCHIVED";
                  return (
                    <div key={course.id} className="relative">
                      {isCourseArchived && (
                        <span className="absolute top-2 left-2 z-10 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          Archived
                        </span>
                      )}
                      <CourseCard
                        {...normalized}
                        thumbnailBaseUrl={THUMBNAILS_BASE_URL ?? ""}
                        onClick={() => handleCourseClick(normalized.slug)}
                        currency={currency === "USD" ? "USD" : "INR"}
                        variant="grid"
                        className="min-w-0 w-full"
                        hasAccess={true}
                        onContinue={() =>
                          router.push(`/learn/courses/${normalized.slug}`)
                        }
                        showProgress={true}
                        progressPercent={progressPercent}
                        courseTerm={courseTerm.singular}
                        showBookmarkIcon={bookmarkAvailable}
                        isBookmarked={isBookmarked(course.id)}
                        onBookmarkToggle={
                          bookmarkAvailable ? () => handleBookmarkCourse(course) : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {!isLoadingCourses && currency && !isCoursesError && courses.length === 0 && (
              <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-12 sm:py-16">
                <BookOpen className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <p className="text-muted-foreground mb-4 text-center">
                  {courseFilter === "complete"
                    ? `No completed ${courseTerm.plural.toLowerCase()} yet.`
                    : courseFilter !== "all"
                      ? `No enrolled ${courseTerm.plural.toLowerCase()} match this filter.`
                      : `No enrolled ${courseTerm.plural.toLowerCase()} yet.`}
                </p>
                <Link
                  href={allCoursesPath}
                  className="text-primary hover:underline font-medium text-sm"
                >
                  Browse all {courseTerm.plural.toLowerCase()}
                </Link>
              </div>
            )}

            <div
              ref={loadMoreCoursesRef}
              className="flex min-h-[80px] items-center justify-center py-8"
            >
              {isFetchingNextCourses && (
                <Loader2 className="text-primary h-6 w-6 animate-spin" />
              )}
            </div>
          </TabsContent>

          <TabsContent value="books" className="mt-0">
            {isBooksError && (
              <div className="border-destructive/50 bg-destructive/10 mb-6 flex flex-col items-center justify-center rounded-lg border px-4 py-8 sm:mb-8 sm:py-12">
                <p className="text-destructive text-center text-sm sm:text-base">
                  {booksError instanceof Error
                    ? booksError.message
                    : `Failed to load ${bookTerm.plural.toLowerCase()}. Please try again.`}
                </p>
                <button
                  type="button"
                  onClick={() => refetchBooks()}
                  className="border-input bg-background hover:bg-muted mt-4 flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            )}

            {(isLoadingBooks || !currency) && (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <BookCardSkeleton key={i} className="min-w-0" />
                ))}
              </div>
            )}

            {!isLoadingBooks && currency && !isBooksError && books.length > 0 && (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {books.map((book: PublishedBookListItem) => {
                  const isBookArchived = book.status === "ARCHIVED";
                  return (
                    <div key={book.id} className="relative">
                      {isBookArchived && (
                        <span className="absolute top-2 left-2 z-10 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          Archived
                        </span>
                      )}
                      <BookCard
                        id={book.id}
                        title={decodeHtmlEntities(book.title)}
                        slug={book.slug}
                        description={book.description}
                        thumbnailUrl={book.thumbnailUrl}
                        thumbnailBaseUrl={THUMBNAILS_BASE_URL ?? ""}
                        pages={book.pages}
                        priceInr={book.priceInr}
                        priceUsd={book.priceUsd}
                        discountInr={book.discountInr}
                        discountUsd={book.discountUsd}
                        purchaseMode={book.purchaseMode}
                        language={book.language}
                        author={book.author}
                        authors={book.authors}
                        onClick={() => handleBookClick(book.slug)}
                        currency={currency === "USD" ? "USD" : "INR"}
                        variant="grid"
                        className="min-w-0 w-full transition-shadow duration-200 hover:shadow-lg"
                        hasAccess={true}
                        onContinue={() =>
                          router.push(`/book-reader/${book.slug}`)
                        }
                        showBookmarkIcon={bookmarkAvailable}
                        isBookmarked={isBookmarked(book.id)}
                        onBookmarkToggle={
                          bookmarkAvailable ? () => handleBookmarkBook(book) : undefined
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {!isLoadingBooks && currency && !isBooksError && books.length === 0 && (
              <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-12 sm:py-16">
                <BookOpen className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <p className="text-muted-foreground mb-4 text-center">
                  No {bookTerm.plural.toLowerCase()} yet.
                </p>
                <Link
                  href={booksPath}
                  className="text-primary hover:underline font-medium text-sm"
                >
                  Browse {bookTerm.plural.toLowerCase()}
                </Link>
              </div>
            )}

            <div
              ref={loadMoreBooksRef}
              className="flex min-h-[80px] items-center justify-center py-8"
            >
              {isFetchingNextBooks && (
                <Loader2 className="text-primary h-6 w-6 animate-spin" />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </LayoutWrapper>
  );
}

export function MyLearningClient(props: MyLearningClientProps) {
  const { availableRoutes, ...rest } = props;
  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <MyLearningContent {...rest} />
    </AvailableRoutesProvider>
  );
}
