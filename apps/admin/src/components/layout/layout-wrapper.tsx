"use client";

import { Button, ScrollArea } from "@open-mtlms/core";
import type {
  LayoutFooter,
  PageLayoutOverrides,
  SidebarNavItem,
  TenantLayout,
  ThemeConfig,
} from "@open-mtlms/shared";
import { generateGoogleFontsUrl } from "@open-mtlms/shared";
import { HelpCircle, LogOut, Moon, Search, Settings, Sun, User, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import React, { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { DashboardFooter } from "./dashboard-footer";
import { DashboardHeader } from "./dashboard-header";
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from "./sidebar";
import { TopBar } from "./top-bar";

interface LayoutWrapperProps {
  layout: TenantLayout | null;
  theme: ThemeConfig;
  layoutOverrides?: PageLayoutOverrides;
  isHomePage?: boolean;
  children: React.ReactNode;
  className?: string;
  /** When true, enables editing mode for layout elements (e.g., clickable logo) */
  isEditing?: boolean;
  /** Offset from viewport top for fixed sidebar (e.g. when inside page editor with header above) */
  sidebarTopOffset?: number;
  /** Callback when header logo is changed in edit mode */
  onHeaderLogoChange?: (logo: string, logoAlt?: string) => void;
  /** Callback when footer logo is changed in edit mode */
  onFooterLogoChange?: (logo: string, logoAlt?: string) => void;
  /** Callback when footer config is updated in edit mode */
  onFooterUpdate?: (updates: Partial<LayoutFooter>) => void;
  /**
   * Override sidebar nav items (e.g. from Navigation settings).
   * When provided, uses this instead of layout.sidebar.navItems so sidebar
   * always shows full nav in sync with admin.
   */
  sidebarNavItemsOverride?: SidebarNavItem[];
}

/**
 * Convert theme config to CSS variables for light mode
 */
function themeToCssVariables(theme: ThemeConfig): Record<string, string> {
  const { colors, fonts, spacing, borders } = theme;

  return {
    // Light mode colors
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
    "--destructive": colors.light.destructive,
    "--destructive-foreground": colors.light.destructiveForeground,
    "--success": colors.light.success,
    "--success-foreground": colors.light.successForeground,
    "--warning": colors.light.warning,
    "--warning-foreground": colors.light.warningForeground,

    // Fonts
    "--font-heading": fonts.heading,
    "--font-body": fonts.body,
    "--font-heading-weight": fonts.headingWeight,
    "--font-body-weight": fonts.bodyWeight,

    // Spacing
    "--section-padding-y": spacing.sectionPaddingY,
    "--section-padding-x": spacing.sectionPaddingX,
    "--container-max-width": spacing.containerMaxWidth,
    "--gap": spacing.gap,
    "--gap-lg": spacing.gapLg,

    // Borders
    "--radius": borders.radius,
    "--radius-sm": borders.radiusSm,
    "--radius-md": borders.radiusMd,
    "--radius-lg": borders.radiusLg,
    "--radius-full": borders.radiusFull,
  };
}

/**
 * Convert dark mode colors to CSS variables (merges light + dark overrides)
 */
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

/**
 * Right-side mobile drawer containing search, dark/light mode, sidebar nav, and profile actions.
 */
function MobileRightDrawer({
  layout,
  open,
  onClose,
  searchPageHref,
  sidebarNavItemsOverride,
}: {
  layout: TenantLayout;
  open: boolean;
  onClose: () => void;
  searchPageHref: string;
  sidebarNavItemsOverride?: SidebarNavItem[];
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!open) return null;

  const showSidebar = !!layout.sidebar?.enabled;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right-side panel */}
      <aside className="bg-card fixed bottom-0 right-0 top-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-l shadow-xl md:hidden">
        {/* Header row */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-4">
            {/* Search input, navigates to search page on click */}
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

            {/* Dark / Light mode toggle */}
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

            {/* Divider */}
            <div className="bg-border my-2 h-px" />

            {/* Sidebar navigation items */}
            {showSidebar && layout.sidebar && (
              <Sidebar
                config={{
                  ...layout.sidebar,
                  navItems: sidebarNavItemsOverride ?? layout.sidebar?.navItems ?? [],
                  collapsible: false,
                  showLogo: false,
                }}
                logo={undefined}
                logoAlt={undefined}
                defaultCollapsed={false}
                variant="drawer"
                onNavClick={onClose}
                className="flex"
              />
            )}

            {/* Divider */}
            <div className="bg-border my-2 h-px" />

            {/* Profile actions */}
            <Link
              href="/profile"
              onClick={onClose}
              className="hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
            >
              <User className="h-4 w-4 shrink-0" />
              <span>Profile</span>
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span>Settings</span>
            </Link>
            <Link
              href="/help"
              onClick={onClose}
              className="hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
            >
              <HelpCircle className="h-4 w-4 shrink-0" />
              <span>Help Center</span>
            </Link>

            {/* Divider */}
            <div className="bg-border my-2 h-px" />

            <button
              type="button"
              className="text-destructive hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
              onClick={onClose}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Log out</span>
            </button>
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
 * Layout Structure:
 * +------------------------------------------------------------------+
 * |  [Logo]                    [Search Bar]           [User/Actions] |  <- Full-width Header
 * +------------------------------------------------------------------+
 * |            |                                                     |
 * |  Home      |                                                     |
 * |  Community |                   CONTENT AREA                      |
 * |  Courses   |                                                     |
 * |  ...       |                                                     |
 * |            +-----------------------------------------------------+
 * |            |                    FOOTER                           |
 * +------------+-----------------------------------------------------+
 *    Sidebar         Main Content (scrollable)
 */
export function LayoutWrapper({
  layout,
  theme,
  layoutOverrides,
  isHomePage: _isHomePage = false,
  children,
  className,
  isEditing = false,
  sidebarTopOffset = 0,
  onHeaderLogoChange: _onHeaderLogoChange,
  onFooterLogoChange: _onFooterLogoChange,
  onFooterUpdate,
  sidebarNavItemsOverride,
}: LayoutWrapperProps) {
  // Allow editing layout (header/footer) on any page in edit mode
  const canEditLayout = isEditing;
  // In editor, show sidebar expanded so labels are visible; otherwise respect template config
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    isEditing ? false : (layout?.sidebar?.defaultCollapsed ?? true)
  );
  // Mobile: profile icon opens right-side drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Convert theme to CSS variables
  const cssVariables = useMemo(() => themeToCssVariables(theme), [theme]);
  const darkCssVariables = useMemo(() => darkModeToCssVariables(theme), [theme]);

  // Apply tenant CSS variables via a scoped stylesheet
  useEffect(() => {
    const styleId = "layout-preview-theme";
    let styleEl = document.getElementById(styleId);

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    // Generate CSS with scoped selector for layout preview
    // Use higher specificity so course theme overrides admin root vars (fixes Midnight white primary)
    const lightCss = Object.entries(cssVariables)
      .map(([key, value]) => `${key}: ${value};`)
      .join("\n      ");
    const darkCss = Object.entries(darkCssVariables)
      .map(([key, value]) => `${key}: ${value};`)
      .join("\n      ");

    styleEl.textContent = `
    .layout-preview-wrapper {
      ${lightCss}
    }
    .dark .layout-preview-wrapper {
      ${darkCss}
    }
  `;

    return () => {
      styleEl?.remove();
    };
  }, [cssVariables, darkCssVariables]);

  // Dynamically load Google Fonts when theme fonts change
  useEffect(() => {
    const linkId = "layout-preview-google-fonts";
    const url = generateGoogleFontsUrl({ heading: theme.fonts.heading, body: theme.fonts.body });

    let linkEl = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!linkEl) {
      linkEl = document.createElement("link");
      linkEl.id = linkId;
      linkEl.rel = "stylesheet";
      document.head.appendChild(linkEl);
    }
    linkEl.href = url;

    return () => {
      linkEl?.remove();
    };
  }, [theme.fonts.heading, theme.fonts.body]);

  // If no layout is configured, just render children
  if (!layout) {
    return <>{children}</>;
  }

  // Determine visibility of each element based on layout config and page overrides
  // Optional chaining handles partial layout objects from new tenants.
  const showTopBar = !!layout.topBar?.enabled && !layoutOverrides?.hideTopBar;
  const showHeader = !!layout.header?.enabled && !layoutOverrides?.hideHeader;
  const showSidebar = !!layout.sidebar?.enabled && !layoutOverrides?.hideSidebar;
  const showFooter = !!layout.footer?.enabled && !layoutOverrides?.hideFooter;

  // Calculate sidebar width for content offset (used for fixed sidebar + main margin)
  const currentSidebarWidth = showSidebar
    ? sidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : layout.sidebar.width || SIDEBAR_WIDTH
    : "0px";

  return (
    <div
      className={cn(
        "bg-background layout-preview-wrapper relative flex min-h-screen flex-col overflow-x-hidden",
        "md:min-h-full",
        className
      )}
    >
      {/* Top Bar - Full width at very top */}
      {showTopBar && layout.topBar && <TopBar config={layout.topBar} />}

      {/* Mobile right-side drawer */}
      <MobileRightDrawer
        layout={layout}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        searchPageHref="/dashboard/search"
        sidebarNavItemsOverride={sidebarNavItemsOverride}
      />

      {/* Fixed Header, full width at top, does not scroll (like sidebar) */}
      {showHeader && layout.header && (
        <header
          className="bg-background fixed left-0 right-0 z-30 border-b"
          style={{ top: sidebarTopOffset, height: 64 }}
        >
          <DashboardHeader
            config={layout.header}
            sidebarWidth="0px"
            isEditing={canEditLayout}
            onMobileMenuToggle={() => setMobileMenuOpen((o) => !o)}
            isMobileMenuOpen={mobileMenuOpen}
            searchPageHref="/dashboard/search"
          />
        </header>
      )}

      {/* Fixed Sidebar, below header, offset for editor chrome when inside page editor */}
      {showSidebar && layout.sidebar && (
        <Sidebar
          config={{
            ...layout.sidebar,
            navItems: sidebarNavItemsOverride ?? layout.sidebar.navItems,
            collapsible: layout.sidebar.collapsible ?? true,
            showLogo: false,
          }}
          logo={undefined}
          logoAlt={undefined}
          defaultCollapsed={isEditing ? false : (layout.sidebar.defaultCollapsed ?? true)}
          onCollapsedChange={setSidebarCollapsed}
          className="fixed bottom-0 left-0 z-20 hidden !h-auto md:flex"
          style={{
            top: sidebarTopOffset + (showHeader ? 64 : 0),
          }}
        />
      )}

      {/* Main Content Area, offset by header height + sidebar width, min-w-0 prevents flex overflow */}
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 max-md:!ml-0"
        style={{
          marginLeft: currentSidebarWidth,
          marginTop: showHeader ? 64 : 0,
        }}
      >
        {/* Main Content - padding in edit mode gives section outline room */}
        <main className={cn("min-h-screen flex-1", canEditLayout && "pr-4")}>{children}</main>

        {/* Footer */}
        {showFooter && layout.footer && (
          <DashboardFooter
            config={layout.footer}
            sidebarWidth="0px"
            headerLogo={layout.header?.logo ?? ""}
            headerLogoAlt={layout.header?.logoAlt ?? ""}
            isEditing={canEditLayout}
            onFooterUpdate={onFooterUpdate}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Hook to get effective layout visibility based on config and overrides
 */
export function useLayoutVisibility(layout: TenantLayout | null, overrides?: PageLayoutOverrides) {
  if (!layout) {
    return {
      showTopBar: false,
      showHeader: false,
      showSidebar: false,
      showFooter: false,
    };
  }

  return {
    showTopBar: !!layout.topBar?.enabled && !overrides?.hideTopBar,
    showHeader: !!layout.header?.enabled && !overrides?.hideHeader,
    showSidebar: !!layout.sidebar?.enabled && !overrides?.hideSidebar,
    showFooter: !!layout.footer?.enabled && !overrides?.hideFooter,
  };
}
