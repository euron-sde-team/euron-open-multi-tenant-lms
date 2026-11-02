"use client";

import { Badge, cn, Tooltip, TooltipContent, TooltipTrigger } from "@open-mtlms/core";
import { Lock, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { NavItemConfig } from "@/lib/config/navigation-registry";
import { useHasAnyPermission } from "@/lib/hooks/use-permissions";
import { useFeatureAccessStore, type FeatureAccessState } from "@/lib/stores/feature-access-store";

/* ------------------------------------------------------------------ */
/*  Icon helper (avoids hydration mismatch for server vs client SVG)   */
/* ------------------------------------------------------------------ */

function ClientIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className={cn("inline-block shrink-0", className)} aria-hidden />;
  return <Icon className={className} aria-hidden />;
}

/* ------------------------------------------------------------------ */
/*  Path matching                                                      */
/* ------------------------------------------------------------------ */

function isPathActive(pathname: string, item: NavItemConfig): boolean {
  if (item.key === "dashboard") return pathname === "/dashboard";
  if (item.key === "settings") return pathname === "/dashboard/settings";
  if (item.exactMatch) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SidebarNavItemProps {
  item: NavItemConfig;
  collapsed: boolean;
  pathname: string;
  onNavClick?: () => void;
}

export function SidebarNavItem({ item, collapsed, pathname, onNavClick }: SidebarNavItemProps) {
  const accessInfo = useFeatureAccessStore((s) => s.getFeatureAccess(item.key));
  const hasPermission = useHasAnyPermission(...(item.permissions ?? []));
  const isActive = isPathActive(pathname, item);

  // Hide items the user lacks permission for (owner always passes via hook)
  if (item.permissions && item.permissions.length > 0 && !hasPermission) {
    return null;
  }

  // System items are always active
  const accessState: FeatureAccessState = item.type === "system" ? "active" : accessInfo.state;

  if (accessState === "coming_soon") {
    return <ComingSoonItem item={item} collapsed={collapsed} />;
  }

  if (accessState === "locked") {
    return <LockedItem item={item} collapsed={collapsed} onNavClick={onNavClick} />;
  }

  return <ActiveItem item={item} collapsed={collapsed} isActive={isActive} onNavClick={onNavClick} />;
}

/* ------------------------------------------------------------------ */
/*  Active item                                                        */
/* ------------------------------------------------------------------ */

function ActiveItem({
  item,
  collapsed,
  isActive,
  onNavClick,
}: {
  item: NavItemConfig;
  collapsed: boolean;
  isActive: boolean;
  onNavClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          onClick={onNavClick}
          aria-label={collapsed ? item.label : undefined}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            collapsed && "lg:justify-center lg:px-2",
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <ClientIcon icon={item.icon} className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{item.label}</span>}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Coming-soon item                                                   */
/* ------------------------------------------------------------------ */

function ComingSoonItem({ item, collapsed }: { item: NavItemConfig; collapsed: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm opacity-50",
            collapsed && "lg:justify-center lg:px-2"
          )}
        >
          <ClientIcon icon={item.icon} className="h-5 w-5 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px] font-medium">
                Soon
              </Badge>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.comingSoonDescription ?? `${item.label}: Coming Soon`}
      </TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/*  Locked item                                                        */
/* ------------------------------------------------------------------ */

function LockedItem({ item, collapsed, onNavClick }: { item: NavItemConfig; collapsed: boolean; onNavClick?: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/dashboard/plans"
          onClick={onNavClick}
          aria-label={collapsed ? `${item.label}: upgrade to unlock` : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm opacity-50 transition-colors hover:bg-muted hover:opacity-70",
            collapsed && "lg:justify-center lg:px-2"
          )}
        >
          <ClientIcon icon={item.icon} className="h-5 w-5 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              <Lock className="h-3.5 w-3.5 shrink-0" />
            </>
          )}
          {collapsed && <Lock className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5" />}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}: Upgrade to unlock
      </TooltipContent>
    </Tooltip>
  );
}

export { isPathActive };
