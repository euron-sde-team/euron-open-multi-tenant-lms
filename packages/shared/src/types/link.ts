/**
 * Link System Types
 *
 * Types for the unified link editing system. Covers every kind of
 * clickable destination: internal routes, external URLs, social links,
 * mailto, tel, and anchor links.
 */

// ============================================================================
// Link Types
// ============================================================================

/** All supported link destination types */
export type LinkType =
  | "internal"    // Internal route, e.g. /courses, /about
  | "external"    // External URL, e.g. https://google.com
  | "anchor"      // Anchor on current page, e.g. #pricing
  | "mailto"      // Email link, e.g. mailto:hello@example.com
  | "tel"         // Phone link, e.g. tel:+1234567890
  | "social"      // Social media link (external, but typed)
  | "download";   // File download link

/** Social media platforms for typed social links */
export type SocialPlatform =
  | "facebook"
  | "twitter"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "github"
  | "tiktok"
  | "discord"
  | "whatsapp"
  | "telegram"
  | "pinterest"
  | "reddit"
  | "custom";

// ============================================================================
// Link Configuration
// ============================================================================

/** Full link configuration, used by EditableClickable */
export interface LinkConfig {
  /** The raw href value */
  href: string;
  /** Auto-detected or manually set link type */
  type: LinkType;
  /** Whether to open in a new tab (default: true for external/social) */
  openInNewTab?: boolean;
  /** Social platform (only for social type) */
  socialPlatform?: SocialPlatform;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** rel attribute value (auto-set for external links) */
  rel?: string;
}

// ============================================================================
// Clickable Element State (for editor)
// ============================================================================

/** State of a clickable element that supports hiding */
export interface ClickableState {
  /** Whether the element is hidden by the admin */
  hidden?: boolean;
  /** Unique identifier for this clickable slot */
  slotId?: string;
  /** Human-readable label for admin UI (e.g. "Primary Button", "GitHub Link") */
  label?: string;
}

// ============================================================================
// Social Link Item (for footer/header social sections)
// ============================================================================

export interface SocialLinkItem {
  /** Social platform identifier */
  platform: SocialPlatform;
  /** Full URL to the social profile */
  url: string;
  /** Custom icon name (optional, platform icon used by default) */
  icon?: string;
  /** Whether this link is hidden */
  hidden?: boolean;
}

// ============================================================================
// Internal Route Helpers
// ============================================================================

/** Common internal routes for auto-suggest in the editor */
export interface InternalRoute {
  /** Route path */
  path: string;
  /** Display label */
  label: string;
  /** Page category */
  category?: string;
}

/** Available route for Button Generation Engine (tenant-scoped) */
export interface AvailableRoute {
  path: string;
  label: string;
  category?: string;
}

/** Response from available routes API */
export interface AvailableRoutesResponse {
  internal: AvailableRoute[];
  system: AvailableRoute[];
}
