"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ArrowRight, GraduationCap, Home, Loader2 } from "lucide-react";

import type { PageConfig, TenantLayout } from "@open-mtlms/shared";
import { getAvailableRoutesResponse } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import { AvailableRoutesProvider } from "@open-mtlms/core";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { fetchCourseList } from "@/lib/api";
import { fetchBundleBySlug, fetchPublishedBundles } from "@/lib/api/bundles";
import { emptyLayout } from "@/lib/default-layout";
import { useContentTerm } from "@/lib/hooks/use-content-terms";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";
import { resolveSuccessTarget, type SuccessTargetDeps } from "@/lib/utils/checkout-success";
import { findEnrolledCourses } from "@/lib/utils/course-status";

/** Look-ups for the "Go to course" button (all client side, signed in). */
const successTargetDeps: SuccessTargetDeps = {
  courseSlugById: async (courseId) => {
    const found = await findEnrolledCourses([courseId], (page) =>
      fetchCourseList({ enrolledOnly: true, page, limit: 50 }, window.location.host)
    );
    return found.get(courseId)?.slug ?? null;
  },
  bundleSlugById: async (bundleId) => {
    for (let page = 1; page <= 10; page++) {
      const res = await fetchPublishedBundles({ page, limit: 50 });
      const hit = res.bundles.find((b) => b.id === bundleId);
      if (hit) return hit.slug;
      if (!res.pagination?.hasMore) break;
    }
    return null;
  },
  bundleCourseSlugs: async (bundleSlug) => {
    const bundle = await fetchBundleBySlug(bundleSlug);
    return (bundle.items ?? [])
      .filter((i) => i.itemType === "COURSE" && i.courseSlug)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => i.courseSlug as string);
  },
};

interface SuccessPageClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
}

export function SuccessPageClient({ layout, pageConfig }: SuccessPageClientProps) {
  const theme = pageConfig?.theme ?? defaultThemeConfig;
  const effectiveLayout = layout ?? emptyLayout;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthenticated = useUserAuthStore((s) => s.isAuthenticated);
  const courseTerm = useContentTerm("course");

  // What was bought (set by every checkout redirect), resolved to the course
  // contents (one course) or the list of bought courses (several).
  const boughtType = searchParams.get("type");
  const boughtId = searchParams.get("id");
  const boughtSlug = searchParams.get("slug");
  const targetQueryEnabled = Boolean(boughtType) && isAuthenticated;
  const { data: target, isPending: targetPending } = useQuery({
    queryKey: ["checkout-success-target", boughtType, boughtId, boughtSlug],
    queryFn: () =>
      resolveSuccessTarget(
        { type: boughtType, id: boughtId, slug: boughtSlug },
        successTargetDeps
      ),
    enabled: targetQueryEnabled,
    staleTime: Infinity,
    retry: 1,
  });
  const resolvingTarget = targetQueryEnabled && targetPending;
  const showGoToCourse = Boolean(target) || resolvingTarget;
  const goToLabel =
    target?.kind === "courses"
      ? `Go to ${courseTerm.plural}`
      : `Go to ${courseTerm.singular}`;

  const initialRoutes = useMemo(
    () => pageConfig?.availableRoutes ?? getAvailableRoutesResponse(),
    [pageConfig?.availableRoutes]
  );

  return (
    <TenantThemeProvider theme={theme}>
      <AvailableRoutesProvider initialRoutes={initialRoutes}>
        <LayoutWrapper layout={effectiveLayout} theme={theme}>
          <section className="flex min-h-[60vh] items-center justify-center bg-background py-16 md:py-24">
            <div className="container-custom">
              <div className="mx-auto max-w-lg text-center">
                {/* Success icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>

                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Payment Successful!
                </h1>

                <p className="mt-4 text-lg text-muted-foreground">
                  Your purchase has been confirmed. You now have access to your content.
                  Start learning right away!
                </p>

                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  {showGoToCourse && (
                    <button
                      type="button"
                      onClick={() => target && router.push(target.href)}
                      disabled={!target}
                      className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
                    >
                      {target ? (
                        <GraduationCap className="h-4 w-4" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {goToLabel}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors",
                      showGoToCourse
                        ? "border font-medium hover:bg-muted"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    <Home className="h-4 w-4" />
                    Go to Home
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/all-courses")}
                    className="flex items-center gap-2 rounded-lg border px-6 py-3 font-medium transition-colors hover:bg-muted"
                  >
                    Continue Browsing
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </LayoutWrapper>
      </AvailableRoutesProvider>
    </TenantThemeProvider>
  );
}
