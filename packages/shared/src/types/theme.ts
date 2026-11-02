// Theme Types - CSS Variables based theming system

export interface ColorPalette {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  card: string;
  cardForeground: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
}

export interface DarkModeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  /** Override primary in dark mode (e.g. white buttons) */
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  accent?: string;
  accentForeground?: string;
  ring?: string;
  destructive?: string;
  destructiveForeground?: string;
}

export interface FontConfig {
  heading: string;
  body: string;
  headingWeight: string;
  bodyWeight: string;
}

export interface SpacingConfig {
  sectionPaddingY: string;
  sectionPaddingX: string;
  containerMaxWidth: string;
  gap: string;
  gapLg: string;
}

export interface BorderConfig {
  radius: string;
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusFull: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  mode: "light" | "dark" | "system";
  colors: {
    light: ColorPalette;
    dark: DarkModeColors;
  };
  fonts: FontConfig;
  spacing: SpacingConfig;
  borders: BorderConfig;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  preview: {
    primary: string;
    secondary: string;
    accent: string;
  };
  config: ThemeConfig;
}

// Google Fonts available for selection
export interface GoogleFont {
  family: string;
  category: "serif" | "sans-serif" | "display" | "monospace" | "handwriting";
  weights: string[];
}

export const AVAILABLE_FONTS: GoogleFont[] = [
  { family: "Inter", category: "sans-serif", weights: ["400", "500", "600", "700"] },
  { family: "Roboto", category: "sans-serif", weights: ["400", "500", "700"] },
  { family: "Open Sans", category: "sans-serif", weights: ["400", "600", "700"] },
  { family: "Lato", category: "sans-serif", weights: ["400", "700"] },
  { family: "Montserrat", category: "sans-serif", weights: ["400", "500", "600", "700"] },
  { family: "Poppins", category: "sans-serif", weights: ["400", "500", "600", "700"] },
  { family: "Nunito", category: "sans-serif", weights: ["400", "600", "700"] },
  { family: "Raleway", category: "sans-serif", weights: ["400", "500", "600", "700"] },
  { family: "Work Sans", category: "sans-serif", weights: ["400", "500", "600", "700"] },
  { family: "DM Sans", category: "sans-serif", weights: ["400", "500", "700"] },
  { family: "Plus Jakarta Sans", category: "sans-serif", weights: ["400", "500", "600", "700"] },
  { family: "Space Grotesk", category: "sans-serif", weights: ["400", "500", "600", "700"] },
  { family: "Playfair Display", category: "serif", weights: ["400", "500", "600", "700"] },
  { family: "Merriweather", category: "serif", weights: ["400", "700"] },
  { family: "Lora", category: "serif", weights: ["400", "500", "600", "700"] },
  { family: "Source Serif Pro", category: "serif", weights: ["400", "600", "700"] },
  { family: "Crimson Text", category: "serif", weights: ["400", "600", "700"] },
  { family: "Libre Baskerville", category: "serif", weights: ["400", "700"] },
  { family: "Oswald", category: "display", weights: ["400", "500", "600", "700"] },
  { family: "Bebas Neue", category: "display", weights: ["400"] },
  { family: "Archivo Black", category: "display", weights: ["400"] },
  { family: "Righteous", category: "display", weights: ["400"] },
  { family: "JetBrains Mono", category: "monospace", weights: ["400", "500", "700"] },
  { family: "Fira Code", category: "monospace", weights: ["400", "500", "700"] },
];
