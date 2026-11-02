"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from "@open-mtlms/core";
import type { LayoutHeader } from "@open-mtlms/shared";
import {
  BarChart3,
  ChevronDown,
  HelpCircle,
  ImageIcon,
  LifeBuoy,
  LogOut,
  Moon,
  Pencil,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  config: LayoutHeader;
  sidebarWidth?: string;
  className?: string;
  /** When true, logo links to organisation settings instead of home */
  isEditing?: boolean;
  /** Mobile: toggle right-side drawer */
  onMobileMenuToggle?: () => void;
  /** Mobile: drawer open state */
  isMobileMenuOpen?: boolean;
  /** Search page path for navigation (e.g. /dashboard/search) */
  searchPageHref?: string;
}

export function DashboardHeader({
  config,
  sidebarWidth = "280px",
  className,
  isEditing = false,
  onMobileMenuToggle,
  isMobileMenuOpen = false,
  searchPageHref = "/dashboard/search",
}: DashboardHeaderProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [logoError, setLogoError] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset logo error when logo URL changes
  useEffect(() => {
    setLogoError(false);
  }, [config.logo]);

  if (!config.enabled) return null;

  // Render actual logo image
  const renderLogoImage = () => {
    if (config.logo && !logoError) {
      return (
        <Image
          src={config.logo}
          alt={config.logoAlt || "Logo"}
          width={120}
          height={32}
          className="h-8 w-auto object-contain dark:invert"
          onError={() => setLogoError(true)}
          unoptimized
        />
      );
    }
    return null;
  };

  // Render placeholder when no logo is set
  const renderLogoPlaceholder = () => (
    <div className="bg-muted/50 border-muted-foreground/30 flex h-8 w-24 items-center justify-center rounded border-2 border-dashed">
      <ImageIcon className="text-muted-foreground h-4 w-4" />
    </div>
  );

  // Check if logo exists and is valid
  const hasValidLogo = config.logo && !logoError;

  return (
    <header
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 h-16 border-b backdrop-blur",
        className
      )}
      style={{ marginLeft: sidebarWidth }}
    >
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Left - Logo */}
        <div className="flex items-center gap-4">
          {isEditing ? (
            <Link
              href="/dashboard/settings/organisation"
              className="group relative flex items-center gap-2 rounded-md"
              title="Edit logo in Organisation Settings"
            >
              {/* Logo or Placeholder */}
              {hasValidLogo ? renderLogoImage() : renderLogoPlaceholder()}

              {/* Edit Overlay - shows on hover */}
              <div className="absolute inset-0 flex items-center justify-center rounded bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex items-center gap-1 text-xs text-white">
                  <Pencil className="h-3 w-3" />
                  <span>Edit</span>
                </div>
              </div>
            </Link>
          ) : (
            <Link href="/" className="flex items-center gap-2">
              {hasValidLogo ? renderLogoImage() : (
                <span className="text-xl font-bold">{config.logoAlt || "Logo"}</span>
              )}
            </Link>
          )}
        </div>

        {/* Center - Search Bar (desktop only) */}
        <div className="hidden flex-1 justify-center px-4 md:flex lg:px-8">
          <div className="relative w-full max-w-xl">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder={config.searchBar?.placeholder || "Search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const q = searchQuery.trim();
                  if (q) {
                    router.push(`${searchPageHref}?q=${encodeURIComponent(q)}`);
                    setSearchQuery("");
                  }
                }
              }}
              className="bg-muted/50 h-10 w-full rounded-full border-0 pl-10 pr-4 focus-visible:ring-1"
            />
          </div>
        </div>

        {/* Right - Actions & Profile */}
        <div className="flex items-center gap-2">
          {/* Analytics */}
          <Link
            href="/dashboard/analytics"
            className="hover:bg-muted inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors"
            title="Analytics"
          >
            <BarChart3 className="h-5 w-5" />
            <span className="sr-only">Analytics</span>
          </Link>

          {/* Dark Mode Toggle (desktop only, moves to drawer on mobile) */}
          {config.showDarkModeToggle && mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}

          {/* Profile Dropdown (desktop only) */}
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                    <User className="text-primary h-4 w-4" />
                  </div>
                  <span className="hidden text-sm font-medium lg:inline-block">Account</span>
                  <ChevronDown className="hidden h-4 w-4 lg:inline-block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">My Account</p>
                    <p className="text-muted-foreground text-xs">user@example.com</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/support" className="flex items-center gap-2">
                    <LifeBuoy className="h-4 w-4" />
                    <span>Support</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/help" className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    <span>Help Center</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Profile Button, opens right-side drawer */}
          {onMobileMenuToggle && (
            <Button
              variant="ghost"
              className="flex items-center gap-1 px-2 md:hidden"
              onClick={onMobileMenuToggle}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                <User className="text-primary h-4 w-4" />
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isMobileMenuOpen && "rotate-180")} />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
