/**
 * Link System Utilities
 *
 * Functions for detecting link types, validating URLs,
 * formatting links for display, and building link configs.
 */

import type { LinkConfig, LinkType, SocialPlatform } from "../types/link";

// ============================================================================
// Link Type Detection
// ============================================================================

/** Map of social media domains to platform identifiers */
const SOCIAL_DOMAIN_MAP: Record<string, SocialPlatform> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "github.com": "github",
  "tiktok.com": "tiktok",
  "discord.gg": "discord",
  "discord.com": "discord",
  "wa.me": "whatsapp",
  "whatsapp.com": "whatsapp",
  "t.me": "telegram",
  "telegram.org": "telegram",
  "pinterest.com": "pinterest",
  "reddit.com": "reddit",
};

/**
 * Auto-detect the link type from a raw href string.
 */
export function detectLinkType(href: string): LinkType {
  if (!href || href.trim() === "") return "internal";

  const trimmed = href.trim();

  // Anchor links
  if (trimmed.startsWith("#")) return "anchor";

  // mailto links
  if (trimmed.startsWith("mailto:")) return "mailto";

  // tel links
  if (trimmed.startsWith("tel:")) return "tel";

  // Internal routes (start with /)
  if (trimmed.startsWith("/")) return "internal";

  // Check for social media domains
  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace("www.", "");
    if (SOCIAL_DOMAIN_MAP[hostname]) return "social";
  } catch {
    // Not a valid URL, treat as internal
  }

  // External URLs
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return "external";

  // Default to internal for relative paths
  return "internal";
}

/**
 * Detect the social platform from a URL.
 */
export function detectSocialPlatform(href: string): SocialPlatform | undefined {
  try {
    const url = new URL(href);
    const hostname = url.hostname.replace("www.", "");
    return SOCIAL_DOMAIN_MAP[hostname];
  } catch {
    return undefined;
  }
}

// ============================================================================
// Link Building
// ============================================================================

/**
 * Build a full LinkConfig from a raw href string.
 */
export function buildLinkConfig(href: string, overrides?: Partial<LinkConfig>): LinkConfig {
  const type = detectLinkType(href);
  const socialPlatform = type === "social" ? detectSocialPlatform(href) : undefined;

  // Auto-determine if should open in new tab
  const openInNewTab =
    overrides?.openInNewTab ??
    (type === "external" || type === "social" || type === "download");

  // Auto-set rel for external links
  const rel =
    overrides?.rel ??
    (type === "external" || type === "social" ? "noopener noreferrer" : undefined);

  return {
    href,
    type,
    openInNewTab,
    socialPlatform,
    rel,
    ...overrides,
  };
}

// ============================================================================
// Link Formatting (for display in tooltips/editor)
// ============================================================================

/**
 * Format a link for display in the admin tooltip/popover.
 * Shows a human-readable version of the link.
 */
export function formatLinkForDisplay(href: string, maxLength = 50): string {
  if (!href || href.trim() === "") return "(no link set)";

  const trimmed = href.trim();

  // Anchor
  if (trimmed.startsWith("#")) return `Scroll to: ${trimmed.slice(1)}`;

  // mailto
  if (trimmed.startsWith("mailto:")) return `Email: ${trimmed.slice(7)}`;

  // tel
  if (trimmed.startsWith("tel:")) return `Call: ${trimmed.slice(4)}`;

  // Internal route
  if (trimmed.startsWith("/")) return `Page: ${trimmed}`;

  // External / Social
  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace("www.", "");
    const platform = SOCIAL_DOMAIN_MAP[hostname];
    if (platform) {
      return `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${url.pathname === "/" ? hostname : hostname + url.pathname}`;
    }
    const display = hostname + (url.pathname !== "/" ? url.pathname : "");
    return display.length > maxLength ? display.slice(0, maxLength) + "..." : display;
  } catch {
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) + "..." : trimmed;
  }
}

/**
 * Get a label for a link type (used in admin UI dropdowns).
 */
export function getLinkTypeLabel(type: LinkType): string {
  const labels: Record<LinkType, string> = {
    internal: "Internal Page",
    external: "External URL",
    anchor: "Scroll to Section",
    mailto: "Email Address",
    tel: "Phone Number",
    social: "Social Media",
    download: "File Download",
  };
  return labels[type];
}

/**
 * Get a placeholder for the link input based on link type.
 */
export function getLinkPlaceholder(type: LinkType): string {
  const placeholders: Record<LinkType, string> = {
    internal: "/all-courses",
    external: "https://example.com",
    anchor: "#section-id",
    mailto: "mailto:hello@example.com",
    tel: "tel:+1234567890",
    social: "https://twitter.com/username",
    download: "https://example.com/file.pdf",
  };
  return placeholders[type];
}

// ============================================================================
// Link Validation
// ============================================================================

/**
 * Validate a link value based on its detected type.
 * Returns null if valid, or an error message string.
 */
export function validateLink(href: string): string | null {
  if (!href || href.trim() === "") return "Link cannot be empty";

  const trimmed = href.trim();
  const type = detectLinkType(trimmed);

  switch (type) {
    case "internal":
      if (!trimmed.startsWith("/")) return "Internal links must start with /";
      return null;

    case "external":
    case "social":
      try {
        new URL(trimmed);
        return null;
      } catch {
        return "Please enter a valid URL (e.g. https://example.com)";
      }

    case "anchor":
      if (trimmed.length < 2) return "Anchor must have a section ID (e.g. #pricing)";
      return null;

    case "mailto":
      if (!trimmed.includes("@")) return "Please enter a valid email (e.g. mailto:hello@example.com)";
      return null;

    case "tel":
      if (trimmed.length < 5) return "Please enter a valid phone number";
      return null;

    case "download":
      try {
        new URL(trimmed);
        return null;
      } catch {
        return "Please enter a valid file URL";
      }

    default:
      return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/** Check if a link is internal (starts with / or is an anchor) */
export function isInternalLink(href: string): boolean {
  const type = detectLinkType(href);
  return type === "internal" || type === "anchor";
}

/** Check if a link should open in a new tab by default */
export function shouldOpenInNewTab(href: string): boolean {
  const type = detectLinkType(href);
  return type === "external" || type === "social" || type === "download";
}

/** Get the social platform icon name (lucide) for a social platform */
export function getSocialPlatformIcon(platform: SocialPlatform): string {
  const icons: Record<SocialPlatform, string> = {
    facebook: "Facebook",
    twitter: "Twitter",
    instagram: "Instagram",
    linkedin: "Linkedin",
    youtube: "Youtube",
    github: "Github",
    tiktok: "Music2",
    discord: "MessageCircle",
    whatsapp: "Phone",
    telegram: "Send",
    pinterest: "Pin",
    reddit: "MessagesSquare",
    custom: "Globe",
  };
  return icons[platform];
}

/**
 * @deprecated Use ALL_AVAILABLE_ROUTES from @open-mtlms/shared constants instead.
 * Kept for backward compatibility with EditableClickable fallback.
 */
export { ALL_AVAILABLE_ROUTES as COMMON_INTERNAL_ROUTES } from "../constants/all-available-routes";
