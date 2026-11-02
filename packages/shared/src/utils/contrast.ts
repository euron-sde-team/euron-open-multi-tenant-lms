/**
 * WCAG 2.1 Contrast & Readability Utilities
 *
 * Provides functions to:
 * - Calculate contrast ratios between HSL color pairs
 * - Validate entire theme configs against WCAG AA/AAA standards
 * - Auto-adjust colors to meet minimum contrast requirements
 *
 * All colors use the project's HSL string format: "h s% l%" (e.g., "221.2 83.2% 53.3%")
 */

import type { ThemeConfig, ColorPalette, DarkModeColors } from "../types/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RGB {
  r: number; // 0-255
  g: number;
  b: number;
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export type WCAGLevel = "AA" | "AAA";
export type TextSize = "normal" | "large";

export interface ContrastViolation {
  /** Human-readable pair name, e.g. "primary on background" */
  pair: string;
  /** Foreground color (HSL string) */
  foreground: string;
  /** Background color (HSL string) */
  background: string;
  /** Computed contrast ratio */
  ratio: number;
  /** Required minimum for WCAG AA */
  required: number;
  /** Which mode this violation occurs in */
  mode: "light" | "dark";
  /** Severity, "fail" is below AA, "warn" is below AAA but passes AA */
  severity: "fail" | "warn";
}

export interface ContrastReport {
  /** true if every semantic pair passes WCAG AA */
  valid: boolean;
  /** All violations found */
  violations: ContrastViolation[];
  /** Total pairs checked */
  pairsChecked: number;
  /** Summary per mode */
  summary: {
    light: { passed: number; failed: number; warnings: number };
    dark: { passed: number; failed: number; warnings: number };
  };
}

// ---------------------------------------------------------------------------
// WCAG Thresholds
// ---------------------------------------------------------------------------

/** WCAG 2.1 minimum contrast ratios */
export const WCAG_THRESHOLDS = {
  /** Normal text (< 18pt or < 14pt bold): AA */
  AA_NORMAL: 4.5,
  /** Large text (≥ 18pt or ≥ 14pt bold): AA */
  AA_LARGE: 3,
  /** Normal text: AAA (enhanced) */
  AAA_NORMAL: 7,
  /** Large text: AAA (enhanced) */
  AAA_LARGE: 4.5,
  /** UI components and graphical objects: AA */
  AA_UI: 3,
} as const;

// ---------------------------------------------------------------------------
// Color Parsing
// ---------------------------------------------------------------------------

/**
 * Parse the project's HSL string format ("h s% l%") into an HSL object.
 *
 * Accepts formats:
 *  - "221.2 83.2% 53.3%"
 *  - "0 0% 100%"
 *  - "221.2, 83.2%, 53.3%" (comma-separated)
 */
export function parseHslString(hslStr: string): HSL {
  const cleaned = hslStr.replace(/,/g, " ").replace(/%/g, "").trim();
  const parts = cleaned.split(/\s+/).map(Number);

  if (parts.length < 3 || parts.some(isNaN)) {
    throw new Error(`Invalid HSL string: "${hslStr}". Expected format: "h s% l%"`);
  }

  return { h: parts[0], s: parts[1], l: parts[2] };
}

/**
 * Convert HSL to RGB (values 0-255).
 */
export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

// ---------------------------------------------------------------------------
// WCAG Luminance & Contrast
// ---------------------------------------------------------------------------

/**
 * Calculate relative luminance per WCAG 2.1 definition.
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(rgb: RGB): number {
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate WCAG contrast ratio between two colors (1:1 to 21:1).
 * Accepts HSL strings in the project format.
 */
export function contrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(hslToRgb(parseHslString(color1)));
  const l2 = relativeLuminance(hslToRgb(parseHslString(color2)));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color pair meets a specific WCAG level.
 */
export function meetsContrast(
  foreground: string,
  background: string,
  level: WCAGLevel = "AA",
  textSize: TextSize = "normal"
): boolean {
  const ratio = contrastRatio(foreground, background);
  const threshold =
    level === "AAA"
      ? textSize === "large"
        ? WCAG_THRESHOLDS.AAA_LARGE
        : WCAG_THRESHOLDS.AAA_NORMAL
      : textSize === "large"
        ? WCAG_THRESHOLDS.AA_LARGE
        : WCAG_THRESHOLDS.AA_NORMAL;
  return ratio >= threshold;
}

// ---------------------------------------------------------------------------
// Semantic Pair Definitions
// ---------------------------------------------------------------------------

/**
 * Semantic color pairs that MUST have sufficient contrast.
 *
 * These are divided into two categories:
 * 1. PRIMARY PAIRS, foreground color designed to sit on its matching background.
 *    These MUST pass AA normal text (4.5:1).
 * 2. CROSS-SURFACE PAIRS, commonly used accent/heading combos on page backgrounds.
 *    These MUST pass AA large text (3:1) and SHOULD pass AA normal (4.5:1).
 */

interface SemanticPair {
  name: string;
  fg: string; // key into ColorPalette
  bg: string; // key into ColorPalette
  /** Minimum contrast required, "normal" = 4.5:1, "large" = 3:1 */
  textSize: TextSize;
}

const LIGHT_SEMANTIC_PAIRS: SemanticPair[] = [
  // Primary pairs, text must be readable on its own surface
  { name: "foreground on background", fg: "foreground", bg: "background", textSize: "normal" },
  { name: "cardForeground on card", fg: "cardForeground", bg: "card", textSize: "normal" },
  { name: "primaryForeground on primary", fg: "primaryForeground", bg: "primary", textSize: "normal" },
  { name: "secondaryForeground on secondary", fg: "secondaryForeground", bg: "secondary", textSize: "normal" },
  { name: "accentForeground on accent", fg: "accentForeground", bg: "accent", textSize: "normal" },
  { name: "mutedForeground on muted", fg: "mutedForeground", bg: "muted", textSize: "normal" },
  { name: "destructiveForeground on destructive", fg: "destructiveForeground", bg: "destructive", textSize: "normal" },
  { name: "successForeground on success", fg: "successForeground", bg: "success", textSize: "normal" },
  { name: "warningForeground on warning", fg: "warningForeground", bg: "warning", textSize: "normal" },

  // Cross-surface pairs, accent colors used as text on page/card backgrounds
  { name: "primary on background", fg: "primary", bg: "background", textSize: "large" },
  { name: "primary on card", fg: "primary", bg: "card", textSize: "large" },
  { name: "mutedForeground on background", fg: "mutedForeground", bg: "background", textSize: "normal" },
  { name: "mutedForeground on card", fg: "mutedForeground", bg: "card", textSize: "normal" },
  { name: "foreground on card", fg: "foreground", bg: "card", textSize: "normal" },
];

// ---------------------------------------------------------------------------
// Resolve Full Dark Palette
// ---------------------------------------------------------------------------

/**
 * Resolve optional dark mode colors by falling back to light mode values.
 * This mirrors the runtime behavior in TenantThemeProvider.
 */
export function resolveDarkPalette(light: ColorPalette, dark: DarkModeColors): ColorPalette {
  return {
    background: dark.background,
    foreground: dark.foreground,
    card: dark.card,
    cardForeground: dark.cardForeground,
    muted: dark.muted,
    mutedForeground: dark.mutedForeground,
    border: dark.border,
    input: dark.input,
    ring: dark.ring ?? light.ring,
    primary: dark.primary ?? light.primary,
    primaryForeground: dark.primaryForeground ?? light.primaryForeground,
    secondary: dark.secondary ?? light.secondary,
    secondaryForeground: dark.secondaryForeground ?? light.secondaryForeground,
    accent: dark.accent ?? light.accent,
    accentForeground: dark.accentForeground ?? light.accentForeground,
    destructive: dark.destructive ?? light.destructive,
    destructiveForeground: dark.destructiveForeground ?? light.destructiveForeground,
    // success & warning don't have dark overrides in the current type
    success: light.success,
    successForeground: light.successForeground,
    warning: light.warning,
    warningForeground: light.warningForeground,
  };
}

// ---------------------------------------------------------------------------
// Theme Validation
// ---------------------------------------------------------------------------

function checkPairs(
  palette: ColorPalette,
  pairs: SemanticPair[],
  mode: "light" | "dark"
): { violations: ContrastViolation[]; passed: number; failed: number; warnings: number } {
  const violations: ContrastViolation[] = [];
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const pair of pairs) {
    const fg = palette[pair.fg as keyof ColorPalette];
    const bg = palette[pair.bg as keyof ColorPalette];

    if (!fg || !bg) continue;

    const ratio = contrastRatio(fg, bg);
    const requiredAA = pair.textSize === "large" ? WCAG_THRESHOLDS.AA_LARGE : WCAG_THRESHOLDS.AA_NORMAL;
    const requiredAAA = pair.textSize === "large" ? WCAG_THRESHOLDS.AAA_LARGE : WCAG_THRESHOLDS.AAA_NORMAL;

    if (ratio < requiredAA) {
      failed++;
      violations.push({
        pair: pair.name,
        foreground: fg,
        background: bg,
        ratio: Math.round(ratio * 100) / 100,
        required: requiredAA,
        mode,
        severity: "fail",
      });
    } else if (ratio < requiredAAA) {
      warnings++;
      passed++;
      violations.push({
        pair: pair.name,
        foreground: fg,
        background: bg,
        ratio: Math.round(ratio * 100) / 100,
        required: requiredAAA,
        mode,
        severity: "warn",
      });
    } else {
      passed++;
    }
  }

  return { violations, passed, failed, warnings };
}

/**
 * Validate an entire ThemeConfig for WCAG contrast compliance.
 *
 * Checks all semantic pairs in both light and dark modes.
 * Returns a detailed report with violations and summary.
 */
export function validateThemeContrast(theme: ThemeConfig): ContrastReport {
  const lightResult = checkPairs(theme.colors.light, LIGHT_SEMANTIC_PAIRS, "light");
  const darkPalette = resolveDarkPalette(theme.colors.light, theme.colors.dark);
  const darkResult = checkPairs(darkPalette, LIGHT_SEMANTIC_PAIRS, "dark");

  const allViolations = [...lightResult.violations, ...darkResult.violations];
  const hasFails = allViolations.some((v) => v.severity === "fail");

  return {
    valid: !hasFails,
    violations: allViolations,
    pairsChecked:
      lightResult.passed +
      lightResult.failed +
      darkResult.passed +
      darkResult.failed,
    summary: {
      light: {
        passed: lightResult.passed,
        failed: lightResult.failed,
        warnings: lightResult.warnings,
      },
      dark: {
        passed: darkResult.passed,
        failed: darkResult.failed,
        warnings: darkResult.warnings,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Auto-Fix: Ensure Readable
// ---------------------------------------------------------------------------

/**
 * Adjust the lightness of a foreground HSL color to meet minimum contrast
 * against a given background.
 *
 * Returns the original color if it already meets the threshold.
 * Otherwise, darkens (on light backgrounds) or lightens (on dark backgrounds)
 * until the threshold is met or min/max lightness is reached.
 */
export function ensureReadable(
  fgHsl: string,
  bgHsl: string,
  minRatio: number = WCAG_THRESHOLDS.AA_NORMAL
): string {
  const currentRatio = contrastRatio(fgHsl, bgHsl);
  if (currentRatio >= minRatio) return fgHsl;

  const fg = parseHslString(fgHsl);
  const bg = parseHslString(bgHsl);
  const bgLum = relativeLuminance(hslToRgb(bg));

  // Determine direction: darken on light bg, lighten on dark bg
  const shouldDarken = bgLum > 0.5;
  const step = 1; // 1% lightness per iteration
  const minL = 0;
  const maxL = 100;

  let adjustedL = fg.l;

  for (let i = 0; i < 100; i++) {
    adjustedL = shouldDarken ? adjustedL - step : adjustedL + step;

    if (adjustedL < minL || adjustedL > maxL) break;

    const adjustedStr = `${fg.h} ${fg.s}% ${adjustedL}%`;
    const newRatio = contrastRatio(adjustedStr, bgHsl);

    if (newRatio >= minRatio) {
      return adjustedStr;
    }
  }

  // Extreme fallback: use black or white
  return shouldDarken ? "0 0% 0%" : "0 0% 100%";
}

/**
 * Given a foreground and background HSL string, returns a human-readable
 * accessibility grade.
 */
export function getContrastGrade(
  foreground: string,
  background: string
): "AAA" | "AA" | "AA-LARGE" | "FAIL" {
  const ratio = contrastRatio(foreground, background);
  if (ratio >= WCAG_THRESHOLDS.AAA_NORMAL) return "AAA";
  if (ratio >= WCAG_THRESHOLDS.AA_NORMAL) return "AA";
  if (ratio >= WCAG_THRESHOLDS.AA_LARGE) return "AA-LARGE";
  return "FAIL";
}

/**
 * Format a contrast ratio for display (e.g., "4.52:1").
 */
export function formatContrastRatio(foreground: string, background: string): string {
  const ratio = contrastRatio(foreground, background);
  return `${ratio.toFixed(2)}:1`;
}
