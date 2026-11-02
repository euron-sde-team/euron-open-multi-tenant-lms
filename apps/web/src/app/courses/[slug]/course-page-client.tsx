"use client";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { CouponOffers } from "@/components/common/CouponOffers";
import { ShareModal } from "@/components/share-modal";
import {
  CoursePreviewPlayer,
  type PreviewRequest,
} from "@/components/course/CoursePreviewPlayer";
import { EasyCheckoutGuardModal } from "@/components/auth/easy-checkout-guard-modal";
import { apiGet } from "@/lib/api/api-client";
import { captureEvent, trackAddToCart, trackEnrollmentInitiated, trackProductViewed } from "@/lib/analytics";
import { checkoutApi } from "@/lib/api/checkout";
import { useCart } from "@/lib/hooks/use-cart";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useCurrency } from "@/lib/hooks/use-currency";
import { usePrice } from "@/lib/hooks/use-price";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { isResolvedPrice, resolveCourseRating } from "@open-mtlms/shared";
import { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { AvailableRoutesProvider, useToast } from "@open-mtlms/core";
import {
  CourseProvider,
  ModernTemplate,
  type CourseCategory,
  type CourseInstructor,
  type CouponValidationResult,
} from "@open-mtlms/course-templates";
import {
  getAvailableRoutesResponse,
  type PageConfig,
  type TenantLayout,
  type ThemeConfig,
} from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  convertPageConfigToCourseData,
  extractCategoriesFromPageConfig,
  extractInstructorsFromPageConfig,
} from "./course-converter";

// Mock categories - in production this would come from the API
const MOCK_CATEGORIES: CourseCategory[] = [
  { id: "cat-1", name: "Web Development", icon: "🌐" },
  { id: "cat-2", name: "Mobile App", icon: "📱" },
  { id: "cat-3", name: "Data Science", icon: "📊" },
  { id: "cat-4", name: "Machine Learning", icon: "🤖" },
  { id: "cat-5", name: "Cloud Computing", icon: "☁️" },
  { id: "cat-6", name: "DevOps", icon: "🔧" },
  { id: "cat-7", name: "Cybersecurity", icon: "🔒" },
  { id: "cat-8", name: "UI/UX Design", icon: "🎨" },
  { id: "cat-9", name: "Programming Languages", icon: "💻" },
  { id: "cat-10", name: "Database", icon: "🗄️" },
];

/** API instructor shape from GET /instructors/course/:courseId */
interface ApiCourseInstructor {
  id: string;
  instructorId: string;
  name: string;
  bio: string | null;
  expertise: string | null;
  profileUrl: string | null;
  sortOrder: number;
  socials: {
    linkedinUrl: string | null;
    twitterUrl: string | null;
    githubUrl: string | null;
    youtubeUrl: string | null;
    websiteUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
  };
  experiences?: Array<{
    company: string;
    companyLogo: string | null;
    years: number;
    details: string | null;
  }>;
}

function mapApiInstructorToTemplate(i: ApiCourseInstructor): CourseInstructor {
  const socialLinks: Array<{ platform: string; url: string }> = [];
  if (i.socials.linkedinUrl) socialLinks.push({ platform: "linkedin", url: i.socials.linkedinUrl });
  if (i.socials.twitterUrl) socialLinks.push({ platform: "twitter", url: i.socials.twitterUrl });
  if (i.socials.githubUrl) socialLinks.push({ platform: "github", url: i.socials.githubUrl });
  if (i.socials.youtubeUrl) socialLinks.push({ platform: "youtube", url: i.socials.youtubeUrl });
  if (i.socials.websiteUrl) socialLinks.push({ platform: "website", url: i.socials.websiteUrl });
  if (i.socials.facebookUrl) socialLinks.push({ platform: "facebook", url: i.socials.facebookUrl });
  if (i.socials.instagramUrl) socialLinks.push({ platform: "instagram", url: i.socials.instagramUrl });
  return {
    id: i.instructorId,
    name: i.name,
    role: i.expertise ?? "",
    avatar: i.profileUrl ?? undefined,
    bio: i.bio ?? undefined,
    socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
    experiences: i.experiences?.map((e) => ({
      company: e.company,
      companyLogo: e.companyLogo ?? undefined,
      years: e.years,
      details: e.details ?? undefined,
    })),
  };
}

/** Map API instructors to the section content format used in page config */
function mapApiInstructorsToSectionContent(apiInstructors: ApiCourseInstructor[]) {
  return apiInstructors.map((i) => {
    const socialLinks: Array<{ platform: string; url: string }> = [];
    if (i.socials.linkedinUrl) socialLinks.push({ platform: "linkedin", url: i.socials.linkedinUrl });
    if (i.socials.twitterUrl) socialLinks.push({ platform: "twitter", url: i.socials.twitterUrl });
    if (i.socials.githubUrl) socialLinks.push({ platform: "github", url: i.socials.githubUrl });
    if (i.socials.youtubeUrl) socialLinks.push({ platform: "youtube", url: i.socials.youtubeUrl });
    if (i.socials.websiteUrl) socialLinks.push({ platform: "website", url: i.socials.websiteUrl });
    if (i.socials.facebookUrl) socialLinks.push({ platform: "facebook", url: i.socials.facebookUrl });
    if (i.socials.instagramUrl) socialLinks.push({ platform: "instagram", url: i.socials.instagramUrl });
    return {
      id: i.instructorId,
      name: i.name,
      role: i.expertise ?? "",
      bio: i.bio ?? undefined,
      avatar: i.profileUrl ?? undefined,
      socialLinks,
      experiences: i.experiences?.map((e) => ({
        company: e.company,
        companyLogo: e.companyLogo ?? undefined,
        years: e.years,
        details: e.details ?? undefined,
      })),
    };
  });
}

// Normalize theme to ensure it has the correct structure
function normalizeTheme(theme: unknown): ThemeConfig {
  if (!theme || typeof theme !== "object") return defaultThemeConfig;

  const t = theme as Record<string, unknown>;

  // Check if it's the old simplified format
  if ("colorScheme" in t || "primaryColor" in t || !("colors" in t)) {
    return defaultThemeConfig;
  }

  // Check for correct structure
  const hasCorrectStructure =
    t.colors &&
    typeof t.colors === "object" &&
    "light" in (t.colors as object) &&
    t.fonts &&
    typeof t.fonts === "object";

  if (!hasCorrectStructure) return defaultThemeConfig;

  return {
    ...defaultThemeConfig,
    ...t,
    colors: {
      light: {
        ...defaultThemeConfig.colors.light,
        ...((t.colors as { light?: object })?.light || {}),
      },
      dark: {
        ...defaultThemeConfig.colors.dark,
        ...((t.colors as { dark?: object })?.dark || {}),
      },
    },
    fonts: { ...defaultThemeConfig.fonts, ...((t.fonts as object) || {}) },
    spacing: { ...defaultThemeConfig.spacing, ...((t.spacing as object) || {}) },
    borders: { ...defaultThemeConfig.borders, ...((t.borders as object) || {}) },
  } as ThemeConfig;
}

interface CoursePageClientProps {
  initialPageConfig: PageConfig;
  layout: TenantLayout | null;
  /** Course slug from URL (e.g. "python-masterclass") for fetching LMS reviews */
  courseSlug?: string;
}

/** Banner shown at the top of archived content pages for enrolled users. */
function ArchivedBanner() {
  return (
    <div className="bg-muted border-b px-4 py-3 text-center text-sm text-muted-foreground">
      This content has been archived. Your access is preserved, but no new updates will be made.
    </div>
  );
}

/** Full-page message for non-enrolled users viewing archived content. */
function ArchivedUnavailable() {
  const courseTerm = useContentTerm("course");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold">Content No Longer Available</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        This {courseTerm.singular.toLowerCase()} has been archived and is no longer available for enrollment.
      </p>
    </div>
  );
}

export function CoursePageClient({ initialPageConfig, layout, courseSlug }: CoursePageClientProps) {
  const courseTerm = useContentTerm("course");
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { toast } = useToast();
  const { member } = useUserAuthStore();
  const preferredCurrency = useCurrency();
  const { accessManaged, supportEmail } = useStorefrontConfig();
  // Free sample the visitor asked to watch. Null while the modal is closed.
  const [previewRequest, setPreviewRequest] = useState<PreviewRequest | null>(null);
  const guard = useBuyNowGuard();
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Normalize the theme from page config
  const theme = normalizeTheme(initialPageConfig.theme);

  const [reviewsOverlay, setReviewsOverlay] = useState<{
    ratings: Array<{
      id: string;
      userId: string;
      userName: string;
      rating: number;
      review?: string;
      createdAt: string;
    }>;
    ratingSummary: { averageRating: number; totalRatings: number };
  } | null>(null);
  const [resolvedCourseId, setResolvedCourseId] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [apiInstructors, setApiInstructors] = useState<ApiCourseInstructor[] | null>(null);
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const isArchived = initialPageConfig.is_archived === true;

  useEffect(() => {
    if (!courseSlug) return;
    let cancelled = false;
    setResolvedCourseId(null);
    setHasAccess(false);
    const bareSlug = courseSlug.startsWith("courses/")
      ? courseSlug.slice("courses/".length)
      : courseSlug;

    apiGet<{ course: { id: string }; has_access?: boolean; is_archived?: boolean }>(
      `/courses/by-slug/${encodeURIComponent(bareSlug)}`
    )
      .then((json) => {
        if (cancelled) return;
        if (!json?.course?.id) {
          setAccessChecked(true);
          return;
        }
        const courseId = json.course.id;
        setResolvedCourseId(courseId);
        if (json.has_access === true) setHasAccess(true);
        setAccessChecked(true);
        captureEvent("course_viewed", {
          course_id: courseId,
          course_slug: bareSlug,
          tenant_id: member?.tenantId,
        });
        return apiGet<{ reviews?: unknown[]; summary?: { average?: number; count?: number } }>(
          `/courses/${courseId}/reviews`
        );
      })
      .then((data) => {
        if (cancelled || !data) return;
        type ReviewItem = {
          id: string;
          tenant_member_id: string;
          member_name: string | null;
          member_avatar_url: string | null;
          rating: number;
          review_text?: string | null;
          created_at: string;
        };
        const list = ((data.reviews || []) as ReviewItem[]).map((r) => ({
          id: r.id,
          userId: r.tenant_member_id,
          userName: r.member_name || "Anonymous",
          userAvatar: r.member_avatar_url ?? undefined,
          rating: r.rating,
          review: r.review_text ?? undefined,
          createdAt: r.created_at,
        }));
        const sum = data.summary || {};
        setReviewsOverlay({
          ratings: list,
          ratingSummary: {
            averageRating: sum.average ?? 0,
            totalRatings: sum.count ?? 0,
          },
        });
      })
      .catch(() => { setReviewsOverlay(null); setAccessChecked(true); });
    return () => {
      cancelled = true;
    };
  }, [courseSlug, member?.tenantId]);

  // Fetch live instructor data from course_instructors junction table
  useEffect(() => {
    if (!resolvedCourseId) return;
    let cancelled = false;
    apiGet<ApiCourseInstructor[]>(`/instructors/course/${resolvedCourseId}`)
      .then((data) => {
        if (!cancelled && data && data.length > 0) {
          setApiInstructors(data);
        }
      })
      .catch(() => { /* fallback to page config instructors */ });
    return () => { cancelled = true; };
  }, [resolvedCourseId]);

  // Enrich page config with live instructor data for section rendering
  const enrichedPageConfig = useMemo(() => {
    if (!apiInstructors || apiInstructors.length === 0) return initialPageConfig;
    const mappedInstructors = mapApiInstructorsToSectionContent(apiInstructors);
    return {
      ...initialPageConfig,
      sections: initialPageConfig.sections.map((s) =>
        s.type === "course-instructor"
          ? { ...s, content: { ...(s.content as Record<string, unknown>), instructors: mappedInstructors } }
          : s
      ),
    };
  }, [initialPageConfig, apiInstructors]);

  // Convert page config to course form data (uses enriched config when API data is available)
  const baseCourseData = useMemo(
    () => convertPageConfigToCourseData(enrichedPageConfig),
    [enrichedPageConfig]
  );

  // Admin-authored hero rating always wins; LMS review summary is the fallback.
  // The real reviews are still rendered in the ratings section either way.
  const courseData = useMemo(() => {
    const resolved = resolveCourseRating(
      baseCourseData.rating,
      baseCourseData.ratingTotalCount,
      reviewsOverlay?.ratingSummary
    );
    return {
      ...baseCourseData,
      ...(reviewsOverlay && {
        ratings: reviewsOverlay.ratings,
        ratingSummary: {
          averageRating: resolved.rating ?? 0,
          totalRatings: resolved.ratingTotalCount ?? 0,
        },
      }),
      rating: resolved.rating,
      ratingTotalCount: resolved.ratingTotalCount,
    };
  }, [baseCourseData, reviewsOverlay]);

  // Get instructors - prefer live API data, fallback to page config
  const instructors: CourseInstructor[] = useMemo(() => {
    // Use live API data when available
    if (apiInstructors && apiInstructors.length > 0) {
      return apiInstructors.map(mapApiInstructorToTemplate);
    }
    // Fallback to page config snapshot
    const extractedInstructors = extractInstructorsFromPageConfig(initialPageConfig);
    if (extractedInstructors.length > 0) {
      return extractedInstructors;
    }
    return [];
  }, [initialPageConfig, apiInstructors]);

  // Get categories - first try to extract from page config, fallback to defaults
  const categories: CourseCategory[] = useMemo(() => {
    const extractedCategories = extractCategoriesFromPageConfig(enrichedPageConfig);
    if (extractedCategories.length > 0) {
      return extractedCategories;
    }
    return MOCK_CATEGORIES;
  }, [enrichedPageConfig]);

  const handleAddToCart = useCallback(() => {
    const slug = courseSlug ?? initialPageConfig.slug?.replace(/^courses\/?/, "") ?? "";
    guard.run(() => {
      if (!resolvedCourseId) return;
      addToCart({ item_type: "COURSE", item_id: resolvedCourseId, coupon_code: couponResult?.code });
      trackAddToCart(resolvedCourseId, "COURSE", undefined, {
        name: courseData.title,
        price: isResolvedPrice(priceParts) ? priceParts.amount : undefined,
        currency: chargeCurrency ?? undefined,
      });
      toast({
        title: "Added to cart",
        description: `${courseData.title ?? courseTerm.singular} has been added to your cart.`,
      });
    }, `/courses/${slug}`);
  }, [
    addToCart,
    toast,
    courseData,
    courseTerm,
    initialPageConfig,
    courseSlug,
    guard,
    resolvedCourseId,
    couponResult,
  ]);

  const handleRemoveFromCart = useCallback(() => {
    if (!resolvedCourseId) return;
    removeFromCart({ item_type: "COURSE", item_id: resolvedCourseId });
    toast({
      title: "Removed from cart",
      description: `${courseData.title ?? courseTerm.singular} has been removed from your cart.`,
    });
  }, [removeFromCart, toast, courseData, courseTerm, resolvedCourseId]);

  const [isEnrolling, setIsEnrolling] = useState(false);

  const handleBuyNow = useCallback(() => {
    const slug = courseSlug ?? initialPageConfig.slug?.replace(/^courses\/?/, "") ?? "";
    const doBuyNow = async () => {
      if (!resolvedCourseId) return;

      if (courseData.purchaseMode === "FREE") {
        setIsEnrolling(true);
        trackEnrollmentInitiated(resolvedCourseId, "FREE");
        try {
          await checkoutApi.freeEnroll({ order_type: "COURSE", item_id: resolvedCourseId });
          toast({
            title: "Enrolled successfully",
            description: `You now have access to this ${courseTerm.singular.toLowerCase()}. Redirecting...`,
          });
          window.location.href = `/learn/courses/${slug}`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to enroll";
          toast({ title: "Enrollment failed", description: msg, variant: "destructive" });
        } finally {
          setIsEnrolling(false);
        }
        return;
      }

      trackEnrollmentInitiated(resolvedCourseId, "PAID");
      const params = new URLSearchParams({ type: "COURSE", id: resolvedCourseId });
      if (couponResult?.code) params.set("coupon", couponResult.code);
      window.location.href = `/checkout/direct?${params.toString()}`;
    };
    guard.run(() => { void doBuyNow(); }, `/courses/${slug}`);
  }, [courseData, courseTerm, initialPageConfig, courseSlug, guard, resolvedCourseId, toast, couponResult]);

  const handleContinueLearning = useCallback(() => {
    const slug = courseSlug ?? initialPageConfig.slug?.replace(/^courses\/?/, "") ?? "";
    window.location.href = `/learn/courses/${slug}`;
  }, [courseSlug, initialPageConfig]);

  // Resolve display price under the buyer's currency context. Null while the
  // context loads, templates fall back to the legacy preferredCurrency math.
  const priceParts = usePrice({
    prices: courseData.prices ?? null,
    legacyInr: courseData.webPriceINR,
    legacyUsd: courseData.webPriceUSD,
    legacyDiscountInr: courseData.webDiscount,
    legacyDiscountUsd: courseData.mobileDiscount ?? courseData.webDiscount,
    purchaseMode: courseData.purchaseMode,
  });
  const chargeCurrency = isResolvedPrice(priceParts) ? priceParts.currency : null;

  // ViewContent / view_item, once the course and its resolved price are known.
  // The ref keeps a re-render (currency resolving, coupon applied) from
  // reporting the same page view again.
  const viewReportedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resolvedCourseId || viewReportedRef.current === resolvedCourseId) return;
    viewReportedRef.current = resolvedCourseId;
    trackProductViewed(
      {
        id: resolvedCourseId,
        name: courseData.title,
        category: "COURSE",
        price: isResolvedPrice(priceParts) ? priceParts.amount : undefined,
      },
      chargeCurrency ?? undefined
    );
  }, [resolvedCourseId, courseData.title, priceParts, chargeCurrency]);


  // Archived content: gate access, non-enrolled users see "unavailable" message
  if (isArchived && accessChecked && !hasAccess) {
    return (
      <AvailableRoutesProvider
        initialRoutes={initialPageConfig.availableRoutes ?? getAvailableRoutesResponse()}
      >
        <LayoutWrapper layout={layout} theme={theme}>
          <ArchivedUnavailable />
        </LayoutWrapper>
      </AvailableRoutesProvider>
    );
  }

  // Course detail pages use the Modern template only.
  // LayoutWrapper handles hydration-safe mounting internally.
  // it renders the same DOM structure on server and client,
  // only showing layout elements (header/sidebar/footer) after mount.
  return (
    <AvailableRoutesProvider
      initialRoutes={initialPageConfig.availableRoutes ?? getAvailableRoutesResponse()}
    >
      <LayoutWrapper layout={layout} theme={theme}>
        <CourseProvider
          courseData={courseData}
          instructors={instructors}
          categories={categories}
          isEditMode={false}
          accessManaged={accessManaged}
          supportEmail={supportEmail}
          onPreviewPlay={setPreviewRequest}
          callbacks={{
            onAddToCart: handleAddToCart,
            onRemoveFromCart: handleRemoveFromCart,
            isInCart: resolvedCourseId ? isInCart(resolvedCourseId) : false,
            onBuyNow: handleBuyNow,
            onContinueLearning: handleContinueLearning,
            onShare: () => setShareModalOpen(true),
            hasAccess,
            preferredCurrency: preferredCurrency === "USD" ? "USD" : preferredCurrency === null ? null : "INR",
            priceParts,
            isEnrollingFree: isEnrolling,
            isPurchaseDisabled: !resolvedCourseId,
            couponSlot: resolvedCourseId ? (
              <CouponOffers
                orderType="COURSE"
                itemId={resolvedCourseId}
                currency={chargeCurrency ?? preferredCurrency}
                applied={couponResult}
                onApply={(result) => setCouponResult(result)}
                onRemove={() => setCouponResult(null)}
              />
            ) : undefined,
            onCouponApplied: (result) => setCouponResult(result),
            onCouponRemoved: () => setCouponResult(null),
            appliedCoupon: couponResult,
          }}
        >
          <div className="min-h-screen">
            {isArchived && hasAccess && <ArchivedBanner />}
            <ModernTemplate />
          </div>
        </CourseProvider>
      </LayoutWrapper>
      {/* Free sample playback. Lives outside the template because the players
          ship in @open-mtlms/lms-templates, which course-templates must not depend
          on. The syllabus button routes here through onPreviewPlay. */}
      <CoursePreviewPlayer
        courseSlug={
          courseSlug ?? initialPageConfig.slug?.replace(/^courses\/?/, "") ?? ""
        }
        request={previewRequest}
        onClose={() => setPreviewRequest(null)}
      />
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        url={`${typeof window !== "undefined" ? window.location.origin : ""}/courses/${courseSlug ?? initialPageConfig.slug?.replace(/^courses\/?/, "") ?? ""}`}
        title={courseData.title ?? courseTerm.singular}
        modalTitle={`Share this ${courseTerm.singular.toLowerCase()}`}
      />
      <EasyCheckoutGuardModal guard={guard} />
    </AvailableRoutesProvider>
  );
}
