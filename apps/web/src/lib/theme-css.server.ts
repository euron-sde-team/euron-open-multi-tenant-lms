import type { ThemeConfig } from "@open-mtlms/shared";
import { cssDeclarations } from "./theme-css-value";

/**
 * Generate critical CSS for tenant theme (mirrors TenantThemeProvider variables).
 * Used for first-paint colors before hydration; client provider continues to own theme after.
 */
export function getCriticalThemeCss(theme: ThemeConfig): string {
  const { colors, fonts, spacing, borders } = theme;

  const lightVars = cssDeclarations({
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
    "--font-heading": fonts.heading,
    "--font-body": fonts.body,
    "--font-heading-weight": fonts.headingWeight,
    "--font-body-weight": fonts.bodyWeight,
    "--section-padding-y": spacing.sectionPaddingY,
    "--section-padding-x": spacing.sectionPaddingX,
    "--container-max-width": spacing.containerMaxWidth,
    "--gap": spacing.gap,
    "--gap-lg": spacing.gapLg,
    "--radius": borders.radius,
    "--radius-sm": borders.radiusSm,
    "--radius-md": borders.radiusMd,
    "--radius-lg": borders.radiusLg,
    "--radius-full": borders.radiusFull,
  }, ";\n  ");

  const light = colors.light;
  const dark = colors.dark;
  const darkVars = cssDeclarations({
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
    "--primary": (dark.primary ?? light.primary),
    "--primary-foreground": (dark.primaryForeground ?? light.primaryForeground),
    "--secondary": (dark.secondary ?? light.secondary),
    "--secondary-foreground": (dark.secondaryForeground ?? light.secondaryForeground),
    "--accent": (dark.accent ?? light.accent),
    "--accent-foreground": (dark.accentForeground ?? light.accentForeground),
    "--ring": (dark.ring ?? light.ring),
    "--destructive": (dark.destructive ?? light.destructive),
    "--destructive-foreground": (dark.destructiveForeground ?? light.destructiveForeground),
  }, ";\n    ");

  return `html:root {\n  ${lightVars}\n}\nhtml.dark {\n    ${darkVars}\n  }`;
}
