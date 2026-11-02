import { z } from "zod";

export const colorPaletteSchema = z.object({
  primary: z.string(),
  primaryForeground: z.string(),
  secondary: z.string(),
  secondaryForeground: z.string(),
  accent: z.string(),
  accentForeground: z.string(),
  background: z.string(),
  foreground: z.string(),
  muted: z.string(),
  mutedForeground: z.string(),
  card: z.string(),
  cardForeground: z.string(),
  border: z.string(),
  input: z.string(),
  ring: z.string(),
  destructive: z.string(),
  destructiveForeground: z.string(),
  success: z.string(),
  successForeground: z.string(),
  warning: z.string(),
  warningForeground: z.string(),
});

export const darkModeColorsSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  card: z.string(),
  cardForeground: z.string(),
  muted: z.string(),
  mutedForeground: z.string(),
  border: z.string(),
  input: z.string(),
});

export const fontConfigSchema = z.object({
  heading: z.string(),
  body: z.string(),
  headingWeight: z.string(),
  bodyWeight: z.string(),
});

export const spacingConfigSchema = z.object({
  sectionPaddingY: z.string(),
  sectionPaddingX: z.string(),
  containerMaxWidth: z.string(),
  gap: z.string(),
  gapLg: z.string(),
});

export const borderConfigSchema = z.object({
  radius: z.string(),
  radiusSm: z.string(),
  radiusMd: z.string(),
  radiusLg: z.string(),
  radiusFull: z.string(),
});

export const themeConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: z.enum(["light", "dark", "system"]),
  colors: z.object({
    light: colorPaletteSchema,
    dark: darkModeColorsSchema,
  }),
  fonts: fontConfigSchema,
  spacing: spacingConfigSchema,
  borders: borderConfigSchema,
});

export const themePresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  preview: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
  }),
  config: themeConfigSchema,
});
