"use client";

import React, { useState, useEffect } from "react";
import { SafeLink } from "@open-mtlms/core";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LayoutHeader } from "@open-mtlms/shared";
import { Search, LogIn, Menu, Moon, Sun, ChevronDown, ShoppingCart, User, GraduationCap, Bookmark, LogOut } from "lucide-react";
import { userAuthApi } from "@/lib/api/auth";
import { useCart } from "@/lib/hooks/use-cart";
import { useStorefrontConfig } from "@/lib/hooks/use-storefront-config";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { SubscriptionBadge } from "@/components/layout/SubscriptionBadge";


interface DashboardHeaderProps {
  config: LayoutHeader;
  sidebarWidth?: string;
  className?: string;
  /** Mobile: toggle right-side drawer */
  onMobileMenuToggle?: () => void;
  /** Mobile: drawer open state */
  isMobileMenuOpen?: boolean;
  /** Search page path for navigation (e.g. /search) */
  searchPageHref?: string;
}

export function DashboardHeader({
  config,
  sidebarWidth = "0px",
  className,
  onMobileMenuToggle,
  isMobileMenuOpen = false,
  searchPageHref = "/search",
}: DashboardHeaderProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { cartCount } = useCart();
  const { accessManaged } = useStorefrontConfig();
  const { isAuthenticated, member, logout } = useUserAuthStore();
  const memberInitials =
    member?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  useEffect(() => setMounted(true), []);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // WHY THIS NO LONGER RETURNS NULL BEFORE MOUNT
  // --------------------------------------------
  // It used to, and the cost was that the site had NO navigation in its HTML
  // at all: no logo, no menu, no way to sign in until React had hydrated.
  // Search engines were served a page with no links off it, and a visitor on a
  // slow connection saw content with no way to move around it.
  //
  // Only two things here actually differ between server and client, whether
  // someone is signed in, and which colour theme resolved. Those are gated
  // individually below (`isSignedIn`, and the existing `mounted` on the theme
  // toggle). The shell, logo, navigation, search, and the signed-out
  // Log in / Sign up buttons, is identical on both sides, so it renders on the
  // server where it belongs. A crawler sees the signed-out header, which is
  // exactly what it should see.
  // With no logo image, the bar shows text: the configured alt text, or the
  // tenant's own name rather than the template's "Logo" placeholder.
  const [tenantName, setTenantName] = useState<string | null>(null);
  useEffect(() => {
    if (config.logo) return;
    userAuthApi
      .getTenantInfo()
      .then((info) => setTenantName(info.name))
      .catch(() => setTenantName(null));
  }, [config.logo]);
  const logoText = config.logoAlt && config.logoAlt !== "Logo" ? config.logoAlt : (tenantName ?? "");

  if (!config.enabled) return null;

  // Auth state comes from localStorage, so it is only knowable on the client.
  // Before mount we render the signed-out header rather than nothing.
  const isSignedIn = mounted && isAuthenticated;

  // The tenant's own navigation, all of it.
  //
  // This was capped at seven, and the eighth link a tenant added simply did not
  // appear, configured, saved, confirmed, invisible. Silently dropping what
  // someone asked for is worse than a crowded menu bar: they cannot see that
  // anything is wrong. The row scrolls instead (see `overflow-x-auto` below),
  // so a long menu can never push the search box or the account controls off
  // the bar either.
  const navLinks = (config.navItems ?? []).filter((item) => !item.hidden);


  return (
    <header
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 h-16 border-b backdrop-blur",
        className
      )}
      style={{ marginLeft: sidebarWidth }}
    >
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Left - Logo */}
        <div className="flex items-center gap-4">
          {config.logo ? (
            <SafeLink href="/" className="flex items-center gap-2">
              <Image
                src={resolvedTheme === "dark" && config.logoDark ? config.logoDark : config.logo}
                alt={config.logoAlt || "Logo"}
                width={120}
                height={32}
                className="h-8 w-auto rounded-lg object-contain"
                unoptimized
              />
            </SafeLink>
          ) : (
            <SafeLink href="/" className="text-xl font-bold">
              {logoText}
            </SafeLink>
          )}
        </div>

        {/* Primary navigation.

            THIS HAD NO RENDERER AT ALL. `LayoutHeader.navItems` is a real,
            typed, admin-editable field; the layout templates fill it in; the
            API serves it, and this component simply never read it. Every
            tenant site therefore shipped with a header containing a logo, a
            search box and a login link, and no way to reach the courses,
            bundles or books it was selling.

            Hidden items are respected, so an admin can turn one off without
            deleting it. */}
        {navLinks.length > 0 && (
          <nav
            aria-label="Primary"
            className="hidden min-w-0 items-center gap-1 overflow-x-auto lg:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {navLinks.map((item) => (
              <SafeLink
                key={item.id}
                href={item.href}
                className="text-muted-foreground hover:text-foreground hover:bg-muted/60 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {item.label}
              </SafeLink>
            ))}
          </nav>
        )}

        {/* Center - Search Bar (desktop only), navigates to /search on click */}
        <div className="hidden flex-1 justify-center px-4 md:flex lg:px-8">
          <button
            type="button"
            onClick={() => router.push(searchPageHref)}
            className="bg-muted/50 text-muted-foreground hover:bg-muted relative flex h-10 w-full max-w-xl items-center rounded-full pl-10 pr-4 text-sm transition-colors"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            {config.searchBar?.placeholder || "Search..."}
          </button>
        </div>

        {/* Right - Actions & Profile */}
        <div className="flex items-center gap-1">
          {/* Subscription Badge, desktop only (moves to drawer on mobile) */}
          {isSignedIn && (
            <div className="hidden md:flex">
              <SubscriptionBadge />
            </div>
          )}

          {/* Cart, hidden on access-managed storefronts (no self-checkout) */}
          {isSignedIn && !accessManaged && (
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-transparent hover:text-current"
              onClick={() => router.push("/cart")}
              aria-label={`Cart (${cartCount} items)`}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Button>
          )}

          {/* Notifications, always visible */}
          {isSignedIn && <NotificationBell />}

          {/* Logged in: Profile Dropdown (desktop only) */}
          {isSignedIn ? (
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 px-2 hover:bg-transparent hover:text-current focus-visible:ring-0 focus-visible:ring-offset-0 dark:hover:bg-transparent"
                  >
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
                      {memberInitials}
                    </div>
                    <span className="hidden max-w-[120px] truncate text-sm font-medium lg:inline-block">
                      {member?.name || "Account"}
                    </span>
                    <ChevronDown className="hidden h-4 w-4 lg:inline-block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{member?.name || "My Account"}</p>
                      <p className="text-muted-foreground text-xs">{member?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <SafeLink
                      href={
                        config.profileDropdown?.menuItems?.find((m) => m.id === "profile")?.href ??
                        "/profile"
                      }
                      className="flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      <span>Profile</span>
                    </SafeLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <SafeLink
                      href={
                        config.profileDropdown?.menuItems?.find((m) => m.id === "my-learning")
                          ?.href ?? "/my-learning"
                      }
                      className="flex items-center gap-2"
                    >
                      <GraduationCap className="h-4 w-4" />
                      <span>My Learning</span>
                    </SafeLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <SafeLink href="/bookmark" className="flex items-center gap-2">
                      <Bookmark className="h-4 w-4" />
                      <span>Bookmarks</span>
                    </SafeLink>
                  </DropdownMenuItem>
                  {config.showDarkModeToggle && mounted && (
                    <DropdownMenuItem
                      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    >
                      {resolvedTheme === "dark" ? (
                        <Sun className="mr-2 h-4 w-4" />
                      ) : (
                        <Moon className="mr-2 h-4 w-4" />
                      )}
                      <span>{resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            /* Not logged in: Theme toggle + Login button (desktop only) */
            <div className="hidden items-center gap-1 md:flex">
              {config.showDarkModeToggle && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                >
                  {resolvedTheme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => router.push("/login")}
              >
                <LogIn className="h-4 w-4" />
                Login
              </Button>
            </div>
          )}

          {/* Mobile: Hamburger / Profile toggle, always visible when drawer is available */}
          {onMobileMenuToggle && (
            <button
              type="button"
              className={cn(
                "flex items-center md:hidden",
                isAuthenticated
                  ? "gap-1"
                  : "hover:bg-muted h-9 w-9 items-center justify-center rounded-md"
              )}
              onClick={onMobileMenuToggle}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isSignedIn ? (
                <>
                  <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
                    {memberInitials}
                  </div>
                  <ChevronDown
                    className={cn(
                      "text-muted-foreground h-3.5 w-3.5 transition-transform",
                      isMobileMenuOpen && "rotate-180"
                    )}
                  />
                </>
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
