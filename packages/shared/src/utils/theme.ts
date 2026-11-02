import type { ThemeConfig, DarkModeColors } from "../types/theme";
import { validateThemeContrast } from "./contrast";

const isDev =
  typeof globalThis !== "undefined" &&
  typeof (globalThis as Record<string, unknown>).process === "object" &&
  ((globalThis as Record<string, unknown>).process as Record<string, unknown>)?.env &&
  ((((globalThis as Record<string, unknown>).process as Record<string, unknown>).env) as Record<string, unknown>)?.NODE_ENV === "development";

/**
 * Convert theme config to CSS variables object.
 *
 * In development mode, runs WCAG contrast validation and logs warnings
 * for any color pairs that fail AA requirements.
 */
export function themeToCssVariables(theme: ThemeConfig): Record<string, string> {
  if (isDev) {
    try {
      const report = validateThemeContrast(theme);
      const fails = report.violations.filter((v) => v.severity === "fail");
      if (fails.length > 0) {
        console.warn(
          `[Theme Contrast] "${theme.name}" has ${fails.length} WCAG AA violation(s):\n` +
            fails
              .map((v) => `  - [${v.mode}] ${v.pair}: ${v.ratio}:1 (need ${v.required}:1)`)
              .join("\n")
        );
      }
    } catch {
      // Contrast validation is non-critical, never break rendering
    }
  }
  const { colors, fonts, spacing, borders } = theme;

  return {
    // Light mode colors
    "--color-primary": colors.light.primary,
    "--color-primary-foreground": colors.light.primaryForeground,
    "--color-secondary": colors.light.secondary,
    "--color-secondary-foreground": colors.light.secondaryForeground,
    "--color-accent": colors.light.accent,
    "--color-accent-foreground": colors.light.accentForeground,
    "--color-background": colors.light.background,
    "--color-foreground": colors.light.foreground,
    "--color-muted": colors.light.muted,
    "--color-muted-foreground": colors.light.mutedForeground,
    "--color-card": colors.light.card,
    "--color-card-foreground": colors.light.cardForeground,
    "--color-border": colors.light.border,
    "--color-input": colors.light.input,
    "--color-ring": colors.light.ring,
    "--color-destructive": colors.light.destructive,
    "--color-destructive-foreground": colors.light.destructiveForeground,
    "--color-success": colors.light.success,
    "--color-success-foreground": colors.light.successForeground,
    "--color-warning": colors.light.warning,
    "--color-warning-foreground": colors.light.warningForeground,

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
 * Convert dark mode colors to CSS variables
 */
export function darkModeToCssVariables(darkColors: DarkModeColors): Record<string, string> {
  return {
    "--color-background": darkColors.background,
    "--color-foreground": darkColors.foreground,
    "--color-card": darkColors.card,
    "--color-card-foreground": darkColors.cardForeground,
    "--color-muted": darkColors.muted,
    "--color-muted-foreground": darkColors.mutedForeground,
    "--color-border": darkColors.border,
    "--color-input": darkColors.input,
  };
}

/**
 * Generate CSS string from variables object
 */
export function cssVariablesToString(variables: Record<string, string>): string {
  return Object.entries(variables)
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n  ");
}

/**
 * Generate Google Fonts URL from theme config
 */
export function generateGoogleFontsUrl(fonts: { heading: string; body: string }): string {
  const families = new Set([fonts.heading, fonts.body]);
  const familyParams = Array.from(families)
    .map((family) => `family=${family.replace(/\s+/g, "+")}:wght@400;500;600;700`)
    .join("&");

  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}

/**
 * Validate hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Convert hex to HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { h: 0, s: 0, l: 0 };
  }

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
