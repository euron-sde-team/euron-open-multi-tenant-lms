"use client";

import { cn } from "@open-mtlms/core";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import type { NavGroupConfig, NavItemConfig } from "@/lib/config/navigation-registry";
import { useFeatureAccessStore } from "@/lib/stores/feature-access-store";

import { isPathActive, SidebarNavItem } from "./SidebarNavItem";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SidebarGroupProps {
  group: NavGroupConfig & { items: NavItemConfig[] };
  collapsed: boolean;
  pathname: string;
  onNavClick?: () => void;
}

export function SidebarGroup({ group, collapsed, pathname, onNavClick }: SidebarGroupProps) {
  const isReady = useFeatureAccessStore((s) => s.isReady);
  const featureMap = useFeatureAccessStore((s) => s.featureMap);

  // Determine if this group contains only coming-soon or locked items (nothing visible)
  const hasOnlyComingSoon =
    isReady &&
    group.items.every((item) => {
      if (item.type === "system") return false;
      const info = featureMap.get(item.key);
      return info?.state === "coming_soon";
    });

  const hasAnyVisibleItem =
    !isReady ||
    group.items.some((item) => {
      if (item.type === "system") return true;
      const info = featureMap.get(item.key);
      return info?.state === "active" || info?.state === "locked";
    });

  // Auto-expand if the group contains the active route
  const hasActiveRoute = group.items.some((item) => isPathActive(pathname, item));

  // Collapsible groups that contain ONLY coming-soon items start collapsed
  const [isExpanded, setIsExpanded] = useState(() => {
    if (!group.collapsible) return true;
    if (hasActiveRoute) return true;
    if (hasOnlyComingSoon) return false;
    return true;
  });

  // Auto-expand when navigating into this group
  useEffect(() => {
    if (hasActiveRoute && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasActiveRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isReady && !hasAnyVisibleItem) return null;

  // Non-collapsible groups: render items directly
  if (!group.collapsible) {
    return (
      <div className="space-y-0.5">
        {/* Non-collapsible groups with a label still show the label */}
        {group.label && !collapsed && (
          <div className={cn("px-3 pb-1 pt-4", collapsed && "lg:px-2 lg:pt-2")}>
            <span
              className={cn(
                "text-muted-foreground/70 text-xs font-semibold uppercase tracking-wider",
                collapsed && "lg:sr-only"
              )}
            >
              {group.label}
            </span>
          </div>
        )}
        {group.items.map((item) => (
          <SidebarNavItem
            key={item.key}
            item={item}
            collapsed={collapsed}
            pathname={pathname}
            onNavClick={onNavClick}
          />
        ))}
      </div>
    );
  }

  // Collapsed sidebar: show separator between groups, items only as icons
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {group.label && (
          <div className="mx-2 my-2 border-t" />
        )}
        {group.items.map((item) => (
          <SidebarNavItem
            key={item.key}
            item={item}
            collapsed={collapsed}
            pathname={pathname}
            onNavClick={onNavClick}
          />
        ))}
      </div>
    );
  }

  // Collapsible group with label + chevron
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="text-muted-foreground/70 hover:text-muted-foreground flex w-full items-center justify-between px-3 pb-1 pt-4 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wider">
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            !isExpanded && "-rotate-90"
          )}
        />
      </button>
      {isExpanded && (
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <SidebarNavItem
              key={item.key}
              item={item}
              collapsed={collapsed}
              pathname={pathname}
            />
          ))}
        </div>
      )}
    </div>
  );
}
