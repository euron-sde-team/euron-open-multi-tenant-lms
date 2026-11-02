"use client";

import {
  AvailableRoutesProvider,
  Button,
  cn,
  Separator,
} from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Menu,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ApplicationSelector } from "@/components/application-selector";
import { GracePeriodBanner } from "@/components/grace-period-banner";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { RenewalBanner } from "@/components/renewal/renewal-banner";
import { RenewalPaymentWatcher } from "@/components/renewal/renewal-pay-dialog";
import { RoleBadge } from "@/components/role-badge";
import { RouteGuard } from "@/components/route-guard";
import { DashboardSidebar } from "@/components/sidebar/DashboardSidebar";
import { SubscriptionStatusOverlay } from "@/components/subscription-status-overlay";
import { TenantSelector } from "@/components/tenant-selector";
import { PLATFORM_NAME } from "@/lib/brand";
import { AuthGuard } from "@/lib/components/auth-guard";
import {
  CourseEditorHeaderProvider,
  useCourseEditorHeader,
} from "@/lib/contexts/course-editor-header-context";
import { useApplications } from "@/lib/hooks/use-applications";
import { useAvailableRoutesQuery } from "@/lib/hooks/use-available-routes";
import { usePopulateFeatureAccess } from "@/lib/hooks/use-feature-access";
import { useHasAnyPermission } from "@/lib/hooks/use-permissions";
import { useApplicationStore } from "@/lib/stores/application-store";
import { useTenantStore } from "@/lib/stores/tenant-store";

/* ------------------------------------------------------------------ */
/*  Icon helper (avoids hydration mismatch for server vs client SVG)   */
/* ------------------------------------------------------------------ */

function ClientIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className={cn("inline-block shrink-0", className)} aria-hidden />;
  return <Icon className={className} />;
}

/* ------------------------------------------------------------------ */
/*  Course editor header slot (Back, Preview, Save in main header)      */
/* ------------------------------------------------------------------ */

function CourseEditorHeaderSlot() {
  const ctx = useCourseEditorHeader();
  if (!ctx?.headerContent) return null;
  return (
    <div className="flex items-center gap-4">
      {ctx.headerContent}
      <Separator orientation="vertical" className="mx-2 h-6" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Analytics header link (permission-gated)                           */
/* ------------------------------------------------------------------ */

function AnalyticsHeaderLink() {
  const canView = useHasAnyPermission("analytics.dashboard");
  if (!canView) return null;
  return (
    <Link
      href="/dashboard/analytics"
      className="border-input bg-background hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
    >
      <BarChart3 className="h-4 w-4" />
      Analytics
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard shell                                                    */
/* ------------------------------------------------------------------ */

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Tenant & application context
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  const selectedAppCode = useApplicationStore((s) => s.selectedApplicationCode);

  // Refresh all server state when the org actually changes. Many list queries
  // key their cache without the tenant id (e.g. ["members","list",params]), so
  // their entries are byte-identical across tenants and the shared staleTime
  // would otherwise keep showing the previous org's rows until a hard reload.
  // We drop inactive cache (no stale flash on the next navigation) and refetch
  // mounted queries under the new X-Tenant-Id. Deliberately NOT queryClient
  // .clear(): invalidating active queries keeps their last data on screen while
  // refetching (isLoading stays false), so AuthGuard and the onboarding wizard,
  // which gate on isLoading, do not unmount their children mid-flow.
  const queryClient = useQueryClient();
  const prevTenantId = useRef(selectedTenantId);
  useEffect(() => {
    if (prevTenantId.current && prevTenantId.current !== selectedTenantId) {
      queryClient.removeQueries({ type: "inactive" });
      queryClient.invalidateQueries({ type: "active" });
    }
    prevTenantId.current = selectedTenantId;
  }, [selectedTenantId, queryClient]);

  // Fetch applications for the tenant (auto-populates store)
  useApplications(selectedTenantId ?? undefined);

  // Populate feature access store from resolved features API
  usePopulateFeatureAccess(selectedTenantId ?? undefined, selectedAppCode ?? undefined);

  // Backend-driven routes for EditableClickable (Button Generation Engine)
  const { data: availableRoutes } = useAvailableRoutesQuery(selectedTenantId ?? undefined);

  // Hide sidebar on course/book editor, template preview, and analytics pages (analytics has its own sidebar)
  const path = pathname ?? "";
  const isAnalyticsPage = path.startsWith("/dashboard/analytics");
  const shouldHideSidebar =
    /^\/dashboard\/courses\/[^/]+\/editor$/.test(path) ||
    /^\/dashboard\/courses\/templates\/[^/]+\/preview$/.test(path) ||
    /^\/dashboard\/books\/[^/]+\/editor$/.test(path) ||
    /^\/dashboard\/books\/templates\/[^/]+\/preview$/.test(path) ||
    /^\/dashboard\/subscriptions\/editor$/.test(path) ||
    /^\/dashboard\/pages\/[^/]+\/custom-code$/.test(path) ||
    isAnalyticsPage;

  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <CourseEditorHeaderProvider>
        <div className="flex min-h-screen flex-col">
          {/* Full-width Navbar at top, hidden on analytics pages (analytics has its own chrome) */}
          <header className={cn("bg-background sticky top-0 z-50 h-16 border-b", isAnalyticsPage && "hidden")}>
            <div className="flex h-full items-center gap-6 px-4">
              {/* Mobile menu button */}
              {!shouldHideSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="mr-2 lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <ClientIcon icon={Menu} className="h-5 w-5" />
                </Button>
              )}

              {/* Logo + Back */}
              <div className="flex items-center gap-2">
                <Link href="/dashboard" className="flex items-center">
                  <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg font-bold">
                    {PLATFORM_NAME.charAt(0)}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.back()}
                  className="hidden gap-2 sm:flex"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>

              {/* Application selector (between logo and right actions) */}
              <div className="ml-4">
                <ApplicationSelector />
              </div>

              {/* Analytics link, visible only to users with analytics permission */}
              <AnalyticsHeaderLink />

              <div className="flex-1" />

              {/* Course editor header slot (Back, Preview, Save when on editor) */}
              <CourseEditorHeaderSlot />

              {/* Right-side actions */}
              <div className="flex items-center gap-3">
                <TenantSelector />
                <RoleBadge />
                <ProfileDropdown />
              </div>
            </div>
          </header>

          {/* Billing banners. Offset like <main>: the sidebar is fixed, and
              without the margin it covered the first words of each banner. */}
          <div className={cn(!shouldHideSidebar && !isAnalyticsPage && "lg:ml-16")}>
            {/* Grace period banner (when payment failed), hidden on analytics pages */}
            {!isAnalyticsPage && <GracePeriodBanner />}

            {/* Red "payment due" strip: a plan nothing renews on its own. Shown on
                every page, analytics included: an unpaid plan outranks a chart. */}
            <RenewalBanner />
          </div>
          <RenewalPaymentWatcher />

          {/* Subscription status overlay (when cancelled/expired) */}
          <SubscriptionStatusOverlay />

          {/* Below navbar: Sidebar + Content */}
          <div className="flex flex-1">
            {/* Sidebar */}
            {!shouldHideSidebar && (
              <DashboardSidebar
                collapsed={sidebarCollapsed}
                onCollapse={setSidebarCollapsed}
                mobileOpen={sidebarOpen}
                onMobileClose={() => setSidebarOpen(false)}
              />
            )}

            {/* Main content, no top padding on editor pages; no padding at all on analytics pages */}
            <main
              className={cn(
                "flex-1",
                isAnalyticsPage
                  ? "p-0"
                  : shouldHideSidebar
                    ? "px-6 pb-6 pt-0"
                    : "p-6",
                !shouldHideSidebar && !isAnalyticsPage && "lg:ml-16"
              )}
            >
              <RouteGuard>{children}</RouteGuard>
            </main>
          </div>

        </div>

      </CourseEditorHeaderProvider>

    </AvailableRoutesProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardContent>{children}</DashboardContent>
    </AuthGuard>
  );
}
