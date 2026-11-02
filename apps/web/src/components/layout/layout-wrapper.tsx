"use client";

import type { TenantLayout, PageLayoutOverrides, ThemeConfig, LayoutSidebar } from "@open-mtlms/shared";
import {
  Bookmark,
  GraduationCap,
  LogIn,
  LogOut,
  Moon,
  Search,
  Sparkles,
  Sun,
  User,
  X,
} from "lucide-react";
import { SafeLink } from "@open-mtlms/core";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import React, { useState, useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTenantLayout } from "@/components/providers/tenant-layout-provider";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

import { DashboardFooter } from "./dashboard-footer";
import { DashboardHeader } from "./dashboard-header";
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH } from "./sidebar";
import { TopBar } from "./top-bar";

interface LayoutWrapperProps {
  layout: TenantLayout | null;
  theme?: ThemeConfig | null;
  layoutOverrides?: PageLayoutOverrides;
  children: React.ReactNode;
  className?: string;
}

const DEFAULT_SIDEBAR_CONFIG: LayoutSidebar = {
  enabled: true,
  position: "left",
  width: "280px",
  collapsible: true,
  defaultCollapsed: true,
  showLogo: false,
  logoSize: "md",
  navItems: [],
  widgets: [],
};

function themeToCssVariables(theme: ThemeConfig): Record<string, string> {
  const { colors, fonts, spacing, borders } = theme;

  return {
    "--primary": colors.light.primary,
    "--primary-foreground": colors.light.primaryForeground,
    "--secondary": colors.light.secondary,
    "--secondary-foreground": colors.light.secondaryForeground,
    "--accent": colors.light.accent,
    "--accent-foreground": colors.light.accentForeground,
    "--background": colors.light.background,
    "--foreground": colors.light.foreground,
    "--muted": colors.light.muted,
    "--muted-foreground": colors.light.mutedForeground,
    "--card": colors.light.card,
    "--card-foreground": colors.light.cardForeground,
    "--popover": colors.light.card,
    "--popover-foreground": colors.light.cardForeground,
    "--border": colors.light.border,
    "--input": colors.light.input,
    "--ring": colors.light.ring,
    "--destructive": colors.light.destructive || "0 84% 60%",
    "--destructive-foreground": colors.light.destructiveForeground || "0 0% 100%",
    "--success": colors.light.success || "142 76% 36%",
    "--success-foreground": colors.light.successForeground || "0 0% 100%",
    "--warning": colors.light.warning || "38 92% 50%",
    "--warning-foreground": colors.light.warningForeground || "0 0% 100%",
    "--font-heading": fonts.heading,
    "--font-body": fonts.body,
    "--font-heading-weight": fonts.headingWeight,
    "--font-body-weight": fonts.bodyWeight,
    "--section-padding-y": spacing?.sectionPaddingY || "4rem",
    "--section-padding-x": spacing?.sectionPaddingX || "1rem",
    "--container-max-width": spacing?.containerMaxWidth || "1280px",
    "--gap": spacing?.gap || "1rem",
    "--gap-lg": spacing?.gapLg || "2rem",
    "--radius": borders?.radius || "0.5rem",
    "--radius-sm": borders?.radiusSm || "0.25rem",
    "--radius-md": borders?.radiusMd || "0.375rem",
    "--radius-lg": borders?.radiusLg || "0.5rem",
    "--radius-full": borders?.radiusFull || "9999px",
  };
}

function darkModeToCssVariables(theme: ThemeConfig): Record<string, string> {
  const { colors } = theme;
  const light = colors.light;
  const dark = colors.dark;

  return {
    "--background": dark.background,
    "--foreground": dark.foreground,
    "--card": dark.card,
    "--card-foreground": dark.cardForeground,
    "--popover": dark.card,
    "--popover-foreground": dark.cardForeground,
    "--muted": dark.muted,
    "--muted-foreground": dark.mutedForeground,
    "--border": dark.border,
    "--input": dark.input,
    "--primary": dark.primary ?? light.primary,
    "--primary-foreground": dark.primaryForeground ?? light.primaryForeground,
    "--secondary": dark.secondary ?? light.secondary,
    "--secondary-foreground": dark.secondaryForeground ?? light.secondaryForeground,
    "--accent": dark.accent ?? light.accent,
    "--accent-foreground": dark.accentForeground ?? light.accentForeground,
    "--ring": dark.ring ?? light.ring,
    "--destructive": dark.destructive ?? light.destructive,
    "--destructive-foreground": dark.destructiveForeground ?? light.destructiveForeground,
  };
}

function MobileRightDrawer({
  sidebarConfig,
  layout,
  open,
  onClose,
  searchPageHref,
}: {
  sidebarConfig: LayoutSidebar | null;
  layout: TenantLayout;
  open: boolean;
  onClose: () => void;
  searchPageHref: string;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, logout } = useUserAuthStore();

  useEffect(() => setMounted(true), []);

  const handleLogout = () => {
    logout();
    onClose();
    router.push("/");
  };

  if (!open) return null;

  const showSidebar = !!sidebarConfig?.enabled && sidebarConfig.navItems.length > 0;
  const loginHref = layout?.header?.cta?.href ?? "/login";

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="bg-background fixed bottom-0 right-0 top-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-l shadow-xl md:hidden">
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-4">
            <button
              type="button"
              className="bg-muted/50 hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
              onClick={() => {
                router.push(searchPageHref);
                onClose();
              }}
            >
              <Search className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="text-muted-foreground">Search...</span>
            </button>

            {mounted && (
              <button
                type="button"
                className="hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4 shrink-0" />
                ) : (
                  <Moon className="h-4 w-4 shrink-0" />
                )}
                <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
              </button>
            )}

            {isAuthenticated && (
              <>
                <SafeLink
                  href="/subscribe"
                  onClick={onClose}
                  className="hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>Subscribe</span>
                </SafeLink>
              </>
            )}

            <div className="bg-border my-2 h-px" />

            {showSidebar && (
              <Sidebar
                config={{
                  ...sidebarConfig,
                  collapsible: false,
                  showLogo: false,
                }}
                logo={undefined}
                logoAlt={undefined}
                variant="drawer"
                onNavClick={onClose}
                className="flex"
              />
            )}

            <div className="bg-border my-2 h-px" />

            {isAuthenticated ? (
              <>
                <SafeLink
                  href={
                    layout?.header?.profileDropdown?.menuItems?.find((m) => m.id === "profile")
                      ?.href ?? "/profile"
                  }
                  onClick={onClose}
                  className="hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span>Profile</span>
                </SafeLink>
                <SafeLink
                  href={
                    layout?.header?.profileDropdown?.menuItems?.find((m) => m.id === "my-learning")
                      ?.href ?? "/my-learning"
                  }
                  onClick={onClose}
                  className="hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
                >
                  <GraduationCap className="h-4 w-4 shrink-0" />
                  <span>My Learning</span>
                </SafeLink>
                <SafeLink
                  href="/bookmark"
                  onClick={onClose}
                  className="hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
                >
                  <Bookmark className="h-4 w-4 shrink-0" />
                  <span>Bookmarks</span>
                </SafeLink>

                <div className="bg-border my-2 h-px" />

                <button
                  type="button"
                  className="text-destructive hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Log out</span>
                </button>
              </>
            ) : (
              <SafeLink
                href={loginHref}
                onClick={onClose}
                className="hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>Login</span>
              </SafeLink>
            )}
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}

/**
 * LayoutWrapper wraps page content with the tenant's layout elements
 * (header, footer, sidebar, top bar) based on the layout configuration
 * and per-page overrides.
 *
 * Sidebar navigation items are always fetched from the backend API
 * (same source as admin navigation settings) via TenantLayoutProvider,
 * ensuring consistency across all pages and sync with admin changes.
 */
export function LayoutWrapper({
  layout,
  theme,
  layoutOverrides,
  children,
  className,
}: LayoutWrapperProps) {
  const { sidebarNavItems } = useTenantLayout();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cssVariables = useMemo(() => (theme ? themeToCssVariables(theme) : null), [theme]);
  const darkCssVariables = useMemo(() => (theme ? darkModeToCssVariables(theme) : null), [theme]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!cssVariables || !darkCssVariables) return;

    const styleId = "layout-theme-styles";
    let styleEl = document.getElementById(styleId);

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const lightCss = Object.entries(cssVariables)
      .map(([key, value]) => `${key}: ${value};`)
      .join("\n      ");
    const darkCss = Object.entries(darkCssVariables)
      .map(([key, value]) => `${key}: ${value};`)
      .join("\n      ");

    styleEl.textContent = `
    :root {
      ${lightCss}
    }
    :root.dark, .dark {
      ${darkCss}
    }
  `;

    return () => {
      styleEl?.remove();
    };
  }, [cssVariables, darkCssVariables]);

  // Build effective sidebar config: use API-driven nav items when available,
  // fall back to layout.sidebar.navItems, then to defaults.
  const effectiveSidebarConfig: LayoutSidebar | null = useMemo(() => {
    const baseSidebar = layout?.sidebar ?? DEFAULT_SIDEBAR_CONFIG;
    const navItems = sidebarNavItems.length > 0 ? sidebarNavItems : (baseSidebar.navItems ?? []);

    if (navItems.length === 0) return null;

    return {
      ...DEFAULT_SIDEBAR_CONFIG,
      ...baseSidebar,
      enabled: true,
      navItems,
    };
  }, [layout?.sidebar, sidebarNavItems]);

  if (!layout) {
    // No layout from template API but we have sidebar items from the sidebar API
    if (effectiveSidebarConfig && effectiveSidebarConfig.navItems.length > 0) {
      return (
        <LayoutWrapperInner
          layout={null}
          effectiveSidebarConfig={effectiveSidebarConfig}
          showTopBar={false}
          showHeader={false}
          showSidebar={mounted && !layoutOverrides?.hideSidebar}
          showFooter={false}
          disableMainScroll={layoutOverrides?.disableMainScroll}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={() => setMobileMenuOpen((o) => !o)}
          onMobileMenuClose={() => setMobileMenuOpen(false)}
          className={className}
        >
          {children}
        </LayoutWrapperInner>
      );
    }
    return <>{children}</>;
  }

  // `mounted &&` used to gate all of this, which kept the header, footer and
  // top bar out of the server-rendered HTML entirely. The components
  // themselves now handle the parts that genuinely differ between server and
  // client, so visibility can be decided from configuration alone.
  const showTopBar = !!layout.topBar?.enabled && !layoutOverrides?.hideTopBar;
  const showHeader = !!layout.header?.enabled && !layoutOverrides?.hideHeader;
  const showSidebar =
    mounted &&
    !!effectiveSidebarConfig &&
    effectiveSidebarConfig.navItems.length > 0 &&
    !layoutOverrides?.hideSidebar;
  const showFooter = !!layout.footer?.enabled && !layoutOverrides?.hideFooter;
  const disableMainScroll = layoutOverrides?.disableMainScroll;

  return (
    <LayoutWrapperInner
      layout={layout}
      effectiveSidebarConfig={effectiveSidebarConfig}
      showTopBar={showTopBar}
      showHeader={showHeader}
      showSidebar={showSidebar}
      showFooter={showFooter}
      disableMainScroll={disableMainScroll}
      mobileMenuOpen={mobileMenuOpen}
      onMobileMenuToggle={() => setMobileMenuOpen((o) => !o)}
      onMobileMenuClose={() => setMobileMenuOpen(false)}
      className={className}
    >
      {children}
    </LayoutWrapperInner>
  );
}

interface LayoutWrapperInnerProps {
  layout: TenantLayout | null;
  effectiveSidebarConfig: LayoutSidebar | null;
  showTopBar: boolean;
  showHeader: boolean;
  showSidebar: boolean;
  showFooter: boolean;
  disableMainScroll?: boolean;
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
  onMobileMenuClose: () => void;
  children: React.ReactNode;
  className?: string;
}

function LayoutWrapperInner({
  layout,
  effectiveSidebarConfig,
  showTopBar,
  showHeader,
  showSidebar,
  showFooter,
  disableMainScroll,
  mobileMenuOpen,
  onMobileMenuToggle,
  onMobileMenuClose,
  children,
  className,
}: LayoutWrapperInnerProps) {
  const currentSidebarWidth =
    showSidebar && effectiveSidebarConfig ? SIDEBAR_COLLAPSED_WIDTH : "0px";

  // Immersive layout (LMS, etc.)
  if (disableMainScroll) {
    // The header/topbar are `fixed` (out of flow). Reserve their height as
    // padding on the h-screen wrapper so the flex children fill the REMAINING
    // space (100vh − offset), instead of pushing the content column down with
    // margin, which combined with flex-1 made it overflow past the viewport and
    // get clipped by overflow-hidden (the LMS lesson list's bottom, incl. the
    // "Course" footer row, was unreachable).
    const immersiveTopOffset = showHeader && layout?.header ? 64 : 0;
    return (
      <div
        className={cn(
          "bg-background layout-theme-wrapper relative flex h-screen flex-col overflow-hidden",
          className
        )}
        style={{ paddingTop: immersiveTopOffset }}
      >
        {showTopBar && layout?.topBar && <TopBar config={layout.topBar} />}


        {showHeader && layout?.header && (
          <header className="bg-background fixed left-0 right-0 top-0 z-40 h-16 border-b">
            <DashboardHeader
              config={layout.header}
              sidebarWidth="0px"
              onMobileMenuToggle={onMobileMenuToggle}
              isMobileMenuOpen={mobileMenuOpen}
              searchPageHref="/search"
            />
          </header>
        )}

        {layout && (
          <MobileRightDrawer
            sidebarConfig={effectiveSidebarConfig}
            layout={layout}
            open={mobileMenuOpen}
            onClose={onMobileMenuClose}
            searchPageHref="/search"
          />
        )}

        {showSidebar && effectiveSidebarConfig && (
          <Sidebar
            config={{
              ...effectiveSidebarConfig,
              collapsible: effectiveSidebarConfig.collapsible ?? true,
              showLogo: false,
            }}
            logo={undefined}
            logoAlt={undefined}
            className={cn(
              "fixed bottom-0 left-0 z-40 hidden !h-auto md:flex",
              showHeader ? "top-16" : "top-0"
            )}
          />
        )}

        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 max-md:!ml-0"
          style={{ marginLeft: currentSidebarWidth }}
        >
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
          {showFooter && layout?.footer && (
            <DashboardFooter
              config={layout.footer}
              sidebarWidth="0px"
              headerLogo={layout.header?.logo ?? ""}
              headerLogoDark={layout.header?.logoDark}
              headerLogoAlt={layout.header?.logoAlt ?? ""}
            />
          )}
        </div>
      </div>
    );
  }

  // Normal scrollable layout
  return (
    <div
      className={cn(
        "bg-background layout-theme-wrapper relative flex min-h-screen flex-col overflow-x-hidden",
        className
      )}
    >
      {showTopBar && layout?.topBar && <TopBar config={layout.topBar} />}


      {showHeader && layout?.header && (
        <header className="bg-background fixed left-0 right-0 top-0 z-40 h-16 border-b">
          <DashboardHeader
            config={layout.header}
            sidebarWidth="0px"
            onMobileMenuToggle={onMobileMenuToggle}
            isMobileMenuOpen={mobileMenuOpen}
            searchPageHref="/search"
          />
        </header>
      )}

      {layout && (
        <MobileRightDrawer
          sidebarConfig={effectiveSidebarConfig}
          layout={layout}
          open={mobileMenuOpen}
          onClose={onMobileMenuClose}
          searchPageHref="/search"
        />
      )}

      {showSidebar && effectiveSidebarConfig && (
        <Sidebar
          config={{
            ...effectiveSidebarConfig,
            collapsible: effectiveSidebarConfig.collapsible ?? true,
            showLogo: false,
          }}
          logo={undefined}
          logoAlt={undefined}
          className={cn(
            "fixed bottom-0 left-0 z-40 hidden !h-auto md:flex",
            showHeader ? "top-12" : "top-0"
          )}
        />
      )}

      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 max-md:!ml-0"
        style={{
          marginLeft: currentSidebarWidth,
          marginTop: showHeader ? 64 : 0,
        }}
      >
        <main className="min-h-screen">{children}</main>

        {showFooter && layout?.footer && (
          <DashboardFooter
            config={layout.footer}
            sidebarWidth="0px"
            headerLogo={layout.header?.logo ?? ""}
            headerLogoAlt={layout.header?.logoAlt ?? ""}
          />
        )}
      </div>
    </div>
  );
}

export function useLayoutVisibility(layout: TenantLayout | null, overrides?: PageLayoutOverrides) {
  const { sidebarNavItems } = useTenantLayout();

  if (!layout) {
    return {
      showTopBar: false,
      showHeader: false,
      showSidebar: sidebarNavItems.length > 0 && !overrides?.hideSidebar,
      showFooter: false,
    };
  }

  return {
    showTopBar: !!layout.topBar?.enabled && !overrides?.hideTopBar,
    showHeader: !!layout.header?.enabled && !overrides?.hideHeader,
    showSidebar:
      (sidebarNavItems.length > 0 || !!layout.sidebar?.enabled) && !overrides?.hideSidebar,
    showFooter: !!layout.footer?.enabled && !overrides?.hideFooter,
  };
}
