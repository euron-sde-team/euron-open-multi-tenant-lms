"use client";

import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@open-mtlms/core";
import {
  LogOut,
  Moon,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getGroupedNavItems } from "@/lib/config/navigation-registry";
import { useLogout } from "@/lib/hooks/use-auth";
import { useFeatureAccessStore } from "@/lib/stores/feature-access-store";

import { SidebarGroup } from "./SidebarGroup";

/* ------------------------------------------------------------------ */
/*  Icon helper (avoids hydration mismatch)                            */
/* ------------------------------------------------------------------ */

function ClientIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className={cn("inline-block shrink-0", className)} aria-hidden />;
  return <Icon className={className} />;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface DashboardSidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function DashboardSidebar({
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileClose,
}: DashboardSidebarProps) {
  const pathname = usePathname() ?? "";
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const logoutMutation = useLogout();
  const isReady = useFeatureAccessStore((s) => s.isReady);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  const groupedItems = useMemo(() => getGroupedNavItems(), []);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleMouseEnter = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    onCollapse(false);
  }, [onCollapse]);

  const handleMouseLeave = useCallback(() => {
    leaveTimerRef.current = setTimeout(() => {
      onCollapse(true);
      leaveTimerRef.current = null;
    }, 150);
  }, [onCollapse]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  // Collapse sidebar on navigation
  const handleNavClick = useCallback(() => {
    onCollapse(true);
  }, [onCollapse]);

  return (
    <>
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "bg-card fixed bottom-0 left-0 top-16 z-50 transform border-r transition-all duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-16" : "lg:w-64 lg:shadow-xl",
          "w-64"
        )}
      >
        <TooltipProvider delayDuration={300}>
          <div className="flex h-full flex-col">
            {/* Mobile close button */}
            <div className="flex items-center justify-end p-2 lg:hidden">
              <Button variant="ghost" size="icon" onClick={onMobileClose} aria-label="Close menu">
                <ClientIcon icon={X} className="h-5 w-5" />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {!isReady ? (
                // Loading skeleton while feature access is being resolved
                <div className="space-y-2 pt-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-muted h-9 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                groupedItems.map((group) => (
                  <SidebarGroup
                    key={group.id}
                    group={group}
                    collapsed={collapsed}
                    pathname={pathname}
                    onNavClick={handleNavClick}
                  />
                ))
              )}
            </nav>

            {/* Footer */}
            <div className={cn("space-y-2 border-t p-4", collapsed && "lg:px-2 lg:py-3")}>
              {/* Theme toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start",
                      collapsed && "lg:justify-center lg:px-0"
                    )}
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    aria-label={
                      collapsed
                        ? !mounted
                          ? "Theme"
                          : theme === "dark"
                            ? "Switch to Light Mode"
                            : "Switch to Dark Mode"
                        : undefined
                    }
                  >
                    {!mounted ? (
                      <>
                        <span
                          className={cn("inline-block h-4 w-4 shrink-0", !collapsed && "mr-2")}
                          aria-hidden
                        />
                        {!collapsed && <span>Theme</span>}
                      </>
                    ) : theme === "dark" ? (
                      <>
                        <ClientIcon icon={Sun} className={cn("h-4 w-4", !collapsed && "mr-2")} />
                        {!collapsed && <span>Light Mode</span>}
                      </>
                    ) : (
                      <>
                        <ClientIcon icon={Moon} className={cn("h-4 w-4", !collapsed && "mr-2")} />
                        {!collapsed && <span>Dark Mode</span>}
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {!mounted ? "Theme" : theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                </TooltipContent>
              </Tooltip>

              {/* Logout */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-destructive w-full justify-start",
                      collapsed && "lg:justify-center lg:px-0"
                    )}
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    aria-label={collapsed ? "Sign Out" : undefined}
                  >
                    <ClientIcon
                      icon={LogOut}
                      className={cn("h-4 w-4", !collapsed && "mr-2")}
                    />
                    {!collapsed &&
                      (logoutMutation.isPending ? "Signing out..." : "Sign Out")}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </aside>
    </>
  );
}
