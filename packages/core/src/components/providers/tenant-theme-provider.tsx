"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { ThemeConfig } from "@open-mtlms/shared";

interface TenantThemeContextValue {
  theme: ThemeConfig;
  cssVariables: Record<string, string>;
}

const TenantThemeContext = createContext<TenantThemeContextValue | null>(null);

export function useTenantTheme() {
  const context = useContext(TenantThemeContext);
  if (!context) {
    throw new Error("useTenantTheme must be used within a TenantThemeProvider");
  }
  return context;
}

interface TenantThemeProviderProps {
  children: ReactNode;
  theme: ThemeConfig;
}

/**
 * Convert theme config to CSS variables
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

export function TenantThemeProvider({ children, theme }: TenantThemeProviderProps) {
  const cssVariables = useMemo(() => themeToCssVariables(theme), [theme]);
  const darkCssVariables = useMemo(() => darkModeToCssVariables(theme), [theme]);

  // Apply CSS variables to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply light mode variables to :root
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Create or update dark mode styles
    let darkStyleEl = document.getElementById("tenant-dark-theme");
    if (!darkStyleEl) {
      darkStyleEl = document.createElement("style");
      darkStyleEl.id = "tenant-dark-theme";
      document.head.appendChild(darkStyleEl);
    }

    const darkCss = Object.entries(darkCssVariables)
      .map(([key, value]) => `${key}: ${value};`)
      .join("\n    ");

    darkStyleEl.textContent = `.dark {\n    ${darkCss}\n  }`;

    // Cleanup
    return () => {
      Object.keys(cssVariables).forEach((key) => {
        root.style.removeProperty(key);
      });
    };
  }, [cssVariables, darkCssVariables]);

  const value = useMemo(
    () => ({
      theme,
      cssVariables,
    }),
    [theme, cssVariables]
  );

  return <TenantThemeContext.Provider value={value}>{children}</TenantThemeContext.Provider>;
}
