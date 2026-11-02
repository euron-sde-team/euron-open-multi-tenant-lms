"use client";

import { Button } from "@open-mtlms/core";
import { ShieldAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { auditApi } from "@/lib/api/audit";
import { NAV_ITEMS } from "@/lib/config/navigation-registry";
import {
  HUB_ONLY_ROUTE_PERMISSIONS,
  ROUTE_PATTERN_PERMISSIONS,
} from "@/lib/config/route-permissions";
import { useHasAnyPermission } from "@/lib/hooks/use-permissions";

/**
 * Defense-in-depth route authorization for the dashboard.
 *
 * WHY THIS EXISTS
 * ---------------
 * The sidebar hides nav items a user lacks permission for, and the backend
 * returns 403 on privileged API calls. But nothing stopped a restricted user
 * from reaching a page by DIRECT URL and seeing its full UI (buttons/forms).
 * only the eventual API call failed. This guard closes that gap for all pages
 * at once, keyed off the SAME permission metadata that drives the sidebar, so
 * the two never drift.
 *
 * This is a UX / defense-in-depth layer, NOT the security boundary, the
 * backend requirePermission checks remain the real enforcement.
 *
 * Owner and the `admin` role bypass (via hasFullAccess inside the hook).
 * A route with no declared permissions is allowed, a faithful mirror of the
 * nav filter, and what keeps the dashboard home reachable by everyone.
 */
function resolveRequiredPermissions(pathname: string): string[] {
  // Pattern rules win first: editing surfaces with a dynamic id (e.g.
  // /dashboard/courses/<id>/editor) that need UPDATE, even though their view-only
  // parent (/dashboard/courses) only needs courses.view.
  for (const rule of ROUTE_PATTERN_PERMISSIONS) {
    if (rule.pattern.test(pathname)) return rule.permissions;
  }

  // Collect every (href, permissions) rule that matches this path, from both the
  // nav registry and the hub-only map, then pick the LONGEST-prefix match so a
  // more specific route (e.g. /dashboard/payment/withdrawals) wins over a broader
  // one (/dashboard/payment).
  const candidates: { href: string; permissions: string[] }[] = [];

  for (const item of NAV_ITEMS) {
    if (item.permissions && item.permissions.length > 0) {
      candidates.push({ href: item.href, permissions: item.permissions });
    }
  }
  for (const [href, permissions] of Object.entries(HUB_ONLY_ROUTE_PERMISSIONS)) {
    if (permissions.length > 0) candidates.push({ href, permissions });
  }

  const matched = candidates
    .filter((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
    .sort((a, b) => b.href.length - a.href.length);

  return matched.length > 0 ? matched[0].permissions : [];
}

/** The page's name as the sidebar shows it, for the owner's Activity Log. */
function pageLabel(pathname: string): string | null {
  const match = NAV_ITEMS.filter(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? null;
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const required = resolveRequiredPermissions(pathname ?? "");
  const allowed = useHasAnyPermission(...required);
  const denied = required.length > 0 && !allowed;

  // Blocking here means no API call is ever made, so the backend cannot see
  // the attempt. Report it, or the owner's Activity Log never shows that
  // someone tried to open a page their role doesn't include. Once per path:
  // the backend also folds repeats within 10 minutes.
  //
  // Permissions come from a persisted store that can be stale for a moment.
  // just after switching organisation, or before /me refreshes a role the
  // owner just changed. Only report a denial that is still a denial after a
  // short wait, so nobody is logged as "tried without access" for a flicker.
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!denied || !pathname || reported.current === pathname) return;
    const t = setTimeout(() => {
      reported.current = pathname;
      void auditApi.reportDeniedView(pathname, pageLabel(pathname));
    }, 2000);
    return () => clearTimeout(t);
  }, [denied, pathname]);

  if (denied) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <ShieldAlert className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">You don&apos;t have access to this page</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            This area isn&apos;t part of your role. Ask an admin if you think you
            should have access.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
