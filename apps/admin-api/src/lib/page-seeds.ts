// Tenant layout helper for auto-provisioning.
//
// Per-page sections + per-section content are NOT seeded here, the
// frontend orchestrator (useAutoProvisionAcademy) takes over after
// provisioning to create pages with template defaults and run the same
// pageAIService.generateSection engine the rich /dashboard/pages
// onboarding wizard uses. That gives every section of every page
// (Home / About / FAQ / Terms / Privacy / Contact) full per-section AI
// parity with the pre-update flow.
//
// The only thing this file still owns is the `tenants.layout` JSON we
// write at provisioning time, its hex brand colours are what tenant-admin
// UI surfaces (color pickers, brand chips). The Pages renderer uses the
// canonical ThemeConfig from @open-mtlms/ui-config, so we don't build that here.

import type { ThemeId } from "./creator-intent/types";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
}

const THEME_REGISTRY: Record<ThemeId, ThemeColors> = {
  "artisan-craft": {
    primary: "#be185d",
    secondary: "#78716c",
    accent: "#eab308",
    background: "#fdf8f5",
    foreground: "#1c1917",
    muted: "#f5ede8",
  },
  "kids-bright": {
    primary: "#2563eb",
    secondary: "#64748b",
    accent: "#facc15",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
  },
  "fintech-emerald": {
    primary: "#047857",
    secondary: "#334155",
    accent: "#d97706",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
  },
  "quant-navy": {
    primary: "#2f5cff",
    secondary: "#1e293b",
    accent: "#2dd4bf",
    background: "#0a0e1a",
    foreground: "#f8fafc",
    muted: "#131a2e",
  },
  "quant-light": {
    primary: "#2447f9",
    secondary: "#0f172a",
    accent: "#3b82f6",
    background: "#ffffff",
    foreground: "#0e1a3a",
    muted: "#f3f5f9",
  },
  "language-coral": {
    primary: "#f43f5e",
    secondary: "#64748b",
    accent: "#14b8a6",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
  },
  "culinary-warmth": {
    primary: "#c2410c",
    secondary: "#78716c",
    accent: "#f59e0b",
    background: "#fffbf5",
    foreground: "#1c1917",
    muted: "#f5f0eb",
  },
  "athletic-energy": {
    primary: "#1d4ed8",
    secondary: "#334155",
    accent: "#f97316",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
  },
  "studio-sound": {
    primary: "#7c3aed",
    secondary: "#3b0764",
    accent: "#ec4899",
    background: "#ffffff",
    foreground: "#1e1b2e",
    muted: "#f5f3ff",
  },
  "corporate-slate": {
    primary: "#4338ca",
    secondary: "#475569",
    accent: "#0d9488",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
  },
  "sunset-orange": {
    primary: "#f97316",
    secondary: "#fb923c",
    accent: "#facc15",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f5f5f4",
  },
  "shadcn-midnight": {
    primary: "#ffffff",
    secondary: "#a3a3a3",
    accent: "#facc15",
    background: "#0a0a0a",
    foreground: "#fafafa",
    muted: "#262626",
  },
  "coral-warm": {
    primary: "#ef4444",
    secondary: "#fb7185",
    accent: "#f59e0b",
    background: "#fff7ed",
    foreground: "#1c1917",
    muted: "#fef3c7",
  },
  "golden-luxury": {
    primary: "#ca8a04",
    secondary: "#a16207",
    accent: "#facc15",
    background: "#fefce8",
    foreground: "#422006",
    muted: "#fef9c3",
  },
  "noir-gold": {
    primary: "#C8A24E",
    secondary: "#9b7820",
    accent: "#fbbf24",
    background: "#0c0a09",
    foreground: "#fafaf9",
    muted: "#1c1917",
  },
  "examprep-academic": {
    primary: "#3B82F6",
    secondary: "#60a5fa",
    accent: "#22d3ee",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#eff6ff",
  },
  "govtexam-warm": {
    primary: "#D97706",
    secondary: "#f59e0b",
    accent: "#facc15",
    background: "#fffbeb",
    foreground: "#1c1917",
    muted: "#fef3c7",
  },
  "photography-brutalist": {
    primary: "#D4AF37",
    secondary: "#a16207",
    accent: "#fbbf24",
    background: "#0a0a0a",
    foreground: "#fafafa",
    muted: "#262626",
  },
  "astrology-cosmic": {
    primary: "#0D9488",
    secondary: "#14b8a6",
    accent: "#a78bfa",
    background: "#0f172a",
    foreground: "#f1f5f9",
    muted: "#1e293b",
  },
  "corpupskill-slate": {
    primary: "#3B4A5C",
    secondary: "#64748b",
    accent: "#3b82f6",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
  },
  default: {
    primary: "#3b82f6",
    secondary: "#60a5fa",
    accent: "#facc15",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
  },
  mindfulness: {
    primary: "#16a34a",
    secondary: "#86efac",
    accent: "#facc15",
    background: "#f0fdf4",
    foreground: "#14532d",
    muted: "#dcfce7",
  },
  "design-vivid": { primary: "#7c3aed", secondary: "#f5f3ff", accent: "#06b6d4", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "data-nebula": { primary: "#4f46e5", secondary: "#eef2ff", accent: "#10b981", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "medical-trust": { primary: "#0d9488", secondary: "#f0fdfa", accent: "#0284c7", background: "#ffffff", foreground: "#0f172a", muted: "#f0fdfa" },
  "beauty-rose": { primary: "#db2777", secondary: "#fdf2f8", accent: "#f59e0b", background: "#fdf8f5", foreground: "#1c1917", muted: "#f5ede8" },
  "abroad-azure": { primary: "#1d4ed8", secondary: "#eff6ff", accent: "#f97316", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "marketing-punch": { primary: "#f97316", secondary: "#fff7ed", accent: "#ec4899", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "cyber-matrix": { primary: "#10b981", secondary: "#ecfdf5", accent: "#06b6d4", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "estate-emerald": { primary: "#059669", secondary: "#ecfdf5", accent: "#f59e0b", background: "#ffffff", foreground: "#0f172a", muted: "#ecfdf5" },
  "cloud-sky": { primary: "#0ea5e9", secondary: "#f0f9ff", accent: "#8b5cf6", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "ledger-navy": { primary: "#1e3a8a", secondary: "#eef2ff", accent: "#f59e0b", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "counsel-burgundy": { primary: "#9f1239", secondary: "#fef2f2", accent: "#ca8a04", background: "#fdf8f5", foreground: "#1c1917", muted: "#f5ede8" },
  "cinema-crimson": { primary: "#e11d48", secondary: "#fff1f2", accent: "#f59e0b", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "founder-indigo": { primary: "#4f46e5", secondary: "#eef2ff", accent: "#10b981", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "atelier-blush": { primary: "#831843", secondary: "#fdf2f8", accent: "#fb7185", background: "#fdf8f5", foreground: "#1c1917", muted: "#f5ede8" },
  "terra-warm": { primary: "#c2410c", secondary: "#fff7ed", accent: "#4d7c6f", background: "#fdf8f5", foreground: "#1c1917", muted: "#f5ede8" },
  "zen-teal": { primary: "#0f766e", secondary: "#f0fdfa", accent: "#d4a373", background: "#f0fdfa", foreground: "#134e4a", muted: "#ccfbf1" },
  "neon-fuchsia": { primary: "#c026d3", secondary: "#fdf4ff", accent: "#06b6d4", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "playful-sky": { primary: "#2563eb", secondary: "#eff6ff", accent: "#f59e0b", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "podium-violet": { primary: "#7c3aed", secondary: "#f5f3ff", accent: "#f59e0b", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
  "saffron-rouge": { primary: "#b91c1c", secondary: "#fef2f2", accent: "#f59e0b", background: "#fdf8f5", foreground: "#1c1917", muted: "#f5ede8" },
  "mystic-violet": { primary: "#7e22ce", secondary: "#faf5ff", accent: "#eab308", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9" },
};

function getThemeColors(themeId: ThemeId): ThemeColors {
  return THEME_REGISTRY[themeId] ?? THEME_REGISTRY["default"];
}

/**
 * Tenant layout JSON written into `tenants.layout` at provisioning. The
 * tenant-admin UI surfaces these brand colours (chips, color pickers).
 * Page rendering itself uses the canonical ThemeConfig from
 * @open-mtlms/ui-config, set when each page is created.
 */
export function buildTenantLayout(
  themeId: ThemeId,
  templateId: string,
  orgName: string,
) {
  const colors = getThemeColors(themeId);
  return {
    primary_color: colors.primary,
    secondary_color: colors.secondary,
    accent_color: colors.accent,
    background_color: colors.background,
    foreground_color: colors.foreground,
    muted_color: colors.muted,
    brand_name: orgName,
    logo_key: null as string | null,
    theme_id: themeId,
    template_id: templateId,
  };
}
