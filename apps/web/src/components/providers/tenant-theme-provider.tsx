"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { ThemeConfig } from "@open-mtlms/shared";
import { generateGoogleFontsUrl } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config/themes";
import { cssDeclarations } from "@/lib/theme-css-value";

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
  theme?: ThemeConfig;
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

export function TenantThemeProvider({ children, theme = defaultThemeConfig }: TenantThemeProviderProps) {
  const cssVariables = useMemo(() => themeToCssVariables(theme), [theme]);
  const darkCssVariables = useMemo(() => darkModeToCssVariables(theme), [theme]);

  // Apply tenant CSS variables via a single stylesheet so theme toggle (class="dark" on html) works.
  // Inline styles on root would override .dark rules and prevent the toggle from applying.
  useEffect(() => {
    let styleEl = document.getElementById("tenant-theme-vars");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "tenant-theme-vars";
      document.head.appendChild(styleEl);
    }

    // Tenant-controlled values: only plain colors, lengths and font names pass.
    const lightCss = cssDeclarations(cssVariables, ";\n  ") + ";";
    const darkCss = cssDeclarations(darkCssVariables, ";\n    ") + ";";

    styleEl.textContent = `html:root {\n  ${lightCss}\n}\nhtml.dark {\n    ${darkCss}\n  }`;

    return () => {
      styleEl?.remove();
    };
  }, [cssVariables, darkCssVariables]);

  // Dynamically load Google Fonts when theme fonts change
  useEffect(() => {
    const linkId = "tenant-google-fonts";
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

  const value = useMemo(
    () => ({
      theme,
      cssVariables,
    }),
    [theme, cssVariables]
  );

  return <TenantThemeContext.Provider value={value}>{children}</TenantThemeContext.Provider>;
}
