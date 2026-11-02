// Layout Types - Tenant-level layout configuration
// Layout is configured at tenant level and applies to all pages

import type { NavItem, CTAButton, FooterColumn } from "./section";

// Re-export FooterColumn for convenience
export type { FooterColumn } from "./section";

// ============================================
// Sidebar Types
// ============================================

export type SidebarBadgeVariant = "new" | "free" | "popular" | "beta" | "pro";

export type SidebarItemType = "system" | "entitlement" | "custom";

export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon?: string; // Icon name (e.g., "home", "book", "users")
  badge?: {
    text: string;
    variant: SidebarBadgeVariant;
  };
  children?: SidebarNavItem[];
  isExternal?: boolean;
  /** Origin of this item */
  itemType?: SidebarItemType;
  /** Links to entitlement feature key (for entitlement items) */
  featureKey?: string;
  /** Show/hide, default true when omitted */
  visible?: boolean;
}

// ============================================
// Sidebar Icon Registry & Feature Defaults
// ============================================

export const SIDEBAR_ICON_REGISTRY = [
  // Navigation & Layout
  { name: "home", label: "Home" },
  { name: "layout-dashboard", label: "Dashboard" },
  { name: "layout-grid", label: "Grid" },
  // Learning & Courses
  { name: "graduation-cap", label: "Graduation Cap" },
  { name: "book-open", label: "Book Open" },
  { name: "book-text", label: "Book Text" },
  { name: "play-circle", label: "Play" },
  { name: "monitor", label: "Monitor" },
  { name: "video", label: "Video" },
  { name: "radio", label: "Live / Radio" },
  { name: "layers", label: "Layers" },
  { name: "folder-tree", label: "Folder Tree" },
  // Assessment & Achievement
  { name: "trophy", label: "Trophy" },
  { name: "award", label: "Award" },
  { name: "target", label: "Target" },
  // AI & Intelligence
  { name: "sparkles", label: "Sparkles" },
  { name: "bot", label: "Bot" },
  { name: "zap", label: "Zap" },
  { name: "cpu", label: "CPU" },
  { name: "wand-2", label: "Wand" },
  { name: "lightbulb", label: "Lightbulb" },
  // Content & Media
  { name: "file-text", label: "File Text" },
  { name: "newspaper", label: "Newspaper" },
  { name: "image", label: "Image" },
  { name: "film", label: "Film" },
  { name: "music", label: "Music" },
  { name: "headphones", label: "Headphones" },
  { name: "bookmark", label: "Bookmark" },
  // Commerce & Monetization
  { name: "package", label: "Package" },
  { name: "shopping-bag", label: "Shopping Bag" },
  { name: "shopping-cart", label: "Shopping Cart" },
  { name: "tag", label: "Tag" },
  { name: "credit-card", label: "Credit Card" },
  { name: "wallet", label: "Wallet" },
  { name: "gift", label: "Gift" },
  // Communication
  { name: "message-circle", label: "Message Circle" },
  { name: "message-square", label: "Message Square" },
  { name: "mail", label: "Mail" },
  { name: "phone", label: "Phone" },
  { name: "mic", label: "Mic" },
  { name: "bell", label: "Bell" },
  // Analytics & Reporting
  { name: "bar-chart-2", label: "Bar Chart" },
  { name: "trending-up", label: "Trending Up" },
  { name: "activity", label: "Activity" },
  { name: "pie-chart", label: "Pie Chart" },
  // People & Teams
  { name: "users", label: "Users" },
  { name: "community", label: "Community" },
  { name: "briefcase", label: "Briefcase" },
  { name: "crown", label: "Crown" },
  { name: "star", label: "Star" },
  { name: "heart", label: "Heart" },
  // System & Settings
  { name: "settings", label: "Settings" },
  { name: "shield", label: "Shield" },
  { name: "lock", label: "Lock" },
  { name: "globe", label: "Globe" },
  { name: "code", label: "Code" },
  { name: "link", label: "Link" },
  { name: "search", label: "Search" },
  { name: "folder", label: "Folder" },
  // Time & Planning
  { name: "calendar", label: "Calendar" },
  { name: "clock", label: "Clock" },
  { name: "map", label: "Map" },
  // Growth & Misc
  { name: "rocket", label: "Rocket" },
] as const;

export type SidebarIconName = (typeof SIDEBAR_ICON_REGISTRY)[number]["name"];

export const SIDEBAR_ICON_NAMES = new Set(
  SIDEBAR_ICON_REGISTRY.map((i) => i.name)
);

/**
 * @deprecated Navigation defaults are now stored in the `features` table
 * (is_navigable, nav_route, nav_label, nav_icon, nav_sort_order columns).
 * Backends read from the DB instead of this constant. Will be removed in a future release.
 */
export const FEATURE_SIDEBAR_DEFAULTS: Record<
  string,
  { label: string; href: string; icon: string }
> = {
  all_courses: { label: "All Courses", href: "/all-courses", icon: "layout-grid" },
  self_paced_courses: { label: "Self Paced Courses", href: "/self-paced", icon: "book-open" },
  books: { label: "Books", href: "/books", icon: "book-text" },
  bundles: { label: "Bundles", href: "/bundles", icon: "package" },
  categories: { label: "Categories", href: "/categories", icon: "folder-tree" },
};

/**
 * @deprecated System sidebar items are now defined locally in each backend's
 * sidebar service. Will be removed in a future release.
 */
export const SYSTEM_SIDEBAR_DEFAULTS: Array<{
  id: string;
  label: string;
  href: string;
  icon: string;
}> = [{ id: "system-home", label: "Home", href: "/", icon: "home" }];

export type SidebarWidgetType =
  | "custom-html"
  | "social-links"
  | "newsletter"
  | "contact-info"
  | "banner";

export interface SidebarWidget {
  id: string;
  type: SidebarWidgetType;
  title?: string;
  content: SidebarWidgetContent;
  visible: boolean;
  order: number;
}

export interface SidebarWidgetContent {
  // For custom-html widget
  html?: string;

  // For social-links widget
  socialLinks?: {
    platform: string;
    url: string;
    icon: string;
  }[];

  // For newsletter widget
  newsletterTitle?: string;
  newsletterDescription?: string;
  newsletterPlaceholder?: string;
  newsletterButtonText?: string;

  // For contact-info widget
  email?: string;
  phone?: string;
  address?: string;

  // For banner widget
  bannerImage?: string;
  bannerLink?: string;
  bannerAlt?: string;
}

// ============================================
// Top Bar Types (Announcement Bar)
// ============================================

export type TopBarContentType = "text" | "rich";

export interface TopBarButton {
  text: string;
  href: string;
  variant: "primary" | "secondary" | "outline" | "ghost";
}

export interface TopBarCountdown {
  enabled: boolean;
  targetDate?: string; // ISO date string
  label?: string;
}

export interface TopBarContent {
  type: TopBarContentType;

  // For text type
  text?: string;
  link?: {
    text: string;
    href: string;
  };

  // For rich type
  richContent?: {
    message: string;
    buttons?: TopBarButton[];
    countdown?: TopBarCountdown;
  };
}

// ============================================
// Dashboard Header Types
// ============================================

export interface SearchBarConfig {
  enabled: boolean;
  placeholder?: string;
  /** Target path for search navigation (e.g. /search). Defaults to /search */
  searchPageHref?: string;
}

export interface ProfileDropdownItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  variant?: "default" | "destructive";
}

export interface ProfileDropdownConfig {
  enabled: boolean;
  showAvatar: boolean;
  showName: boolean;
  menuItems: ProfileDropdownItem[];
}

// ============================================
// Layout Element Configurations
// ============================================

export type HeaderVariant = "minimal" | "centered" | "transparent" | "sticky" | "dashboard";

export interface LayoutHeader {
  enabled: boolean;
  logo: string;
  logoDark?: string;
  logoAlt: string;
  navItems: NavItem[];
  cta?: CTAButton;
  showDarkModeToggle: boolean;
  variant: HeaderVariant;
  sticky?: boolean;
  // Dashboard header specific options
  searchBar?: SearchBarConfig;
  profileDropdown?: ProfileDropdownConfig;
  showNotifications?: boolean;
}

export type FooterVariant = "simple" | "centered" | "columns" | "comprehensive";

export interface FooterContactInfo {
  email?: string;
  phone?: string;
  address?: string;
}

export interface FooterTrustBadge {
  id: string;
  label: string;
  icon?: string;
}

export interface FooterWhatsAppContact {
  number: string;
  href: string;
}

export interface FooterAppDownload {
  enabled: boolean;
  appStoreUrl?: string;
  playStoreUrl?: string;
}

export interface LayoutFooter {
  enabled: boolean;
  logo: string;
  logoDark?: string;
  logoAlt: string;
  description?: string;
  columns: FooterColumn[];
  socialLinks?: {
    platform: string;
    url: string;
    icon: string;
  }[];
  copyright: string;
  bottomLinks?: { label: string; href: string }[];
  variant: FooterVariant;
  // Additional footer options
  contactInfo?: FooterContactInfo;
  trustBadges?: FooterTrustBadge[];
  showLanguageSelector?: boolean;
  // Logo sync with header
  useHeaderLogo?: boolean;
  // WhatsApp contact numbers
  whatsappContacts?: FooterWhatsAppContact[];
  // App download section
  appDownload?: FooterAppDownload;
}

export interface LayoutSidebar {
  enabled: boolean;
  position: "left"; // Fixed to left per requirements
  width: string; // e.g., "280px", "320px"
  navItems: SidebarNavItem[];
  widgets: SidebarWidget[];
  collapsible: boolean;
  /** Whether the sidebar starts in collapsed state (template-driven) */
  defaultCollapsed?: boolean;
  showLogo?: boolean;
  logoSize?: "sm" | "md" | "lg";
}

export interface LayoutTopBar {
  enabled: boolean;
  content: TopBarContent;
  dismissible: boolean;
  backgroundColor?: string;
  textColor?: string;
}

// ============================================
// Layout Template Types
// ============================================

export type LayoutTemplateId =
  | "full-width"
  | "with-sidebar"
  | "minimal"
  | "dashboard";

export interface LayoutTemplate {
  id: LayoutTemplateId;
  name: string;
  description: string;
  thumbnail: string;
  preview: {
    hasHeader: boolean;
    hasFooter: boolean;
    hasSidebar: boolean;
    hasTopBar: boolean;
  };
  defaultConfig: Omit<TenantLayout, "id" | "tenantId" | "createdAt" | "updatedAt">;
}

// ============================================
// Main Tenant Layout Type
// ============================================

// Course page template options
export type CoursePageTemplateId = "modern" | "classic" | "minimal";

// Book page template options
export type BookPageTemplateId = "classic" | "modern" | "minimal";

export interface CommunityLink {
  platform: "whatsapp" | "telegram" | "discord";
  url: string;
}

// Per-tenant SEO / analytics settings. Stored inside the tenant `layout` JSON
// (no schema change). All optional + undefined-safe: absent => feature simply
// not injected. Sitemap/robots/llms.txt remain on-by-default regardless.
export interface TenantSeoSettings {
  /** GA4 measurement ID, e.g. "G-XXXXXXXX". Injected only if valid + analytics enabled. */
  ga4MeasurementId?: string;
  /** Google Tag Manager container ID, e.g. "GTM-XXXXXXX". Injected only if valid + analytics enabled. */
  gtmContainerId?: string;
  /** Meta (Facebook) Pixel ID, a numeric string. Injected only if valid + analytics enabled. */
  metaPixelId?: string;
  /** Google Search Console site-verification token (the content of the meta tag). */
  googleSiteVerificationToken?: string;
  /** Master switch for analytics/tag injection (GA4, GTM, Meta Pixel). Treated as ON unless explicitly false. */
  analyticsEnabled?: boolean;
  /** Reserved toggles (sitemap + AI indexing are on-by-default today). */
  sitemapEnabled?: boolean;
  aiIndexingEnabled?: boolean;
}

export interface TenantLayout {
  id: string;
  tenantId: string;

  // Layout Elements
  header: LayoutHeader;
  footer: LayoutFooter;
  sidebar: LayoutSidebar;
  topBar: LayoutTopBar;

  // Layout Template (optional - for quick setup)
  templateId?: LayoutTemplateId;

  // Course page template selection (for course detail pages)
  coursePageTemplateId?: CoursePageTemplateId;

  // Book page template selection (for book detail pages)
  bookPageTemplateId?: BookPageTemplateId;

  // Community links (WhatsApp, Telegram, Discord), floating widget on home page
  communityLinks?: CommunityLink[];

  // Per-tenant SEO / analytics (GA4, site verification), optional, undefined-safe
  seo?: TenantSeoSettings;

  createdAt: string;
  updatedAt: string;
}

// ============================================
// Page-Level Layout Overrides
// ============================================

export interface PageLayoutOverrides {
  hideHeader?: boolean;
  hideFooter?: boolean;
  hideSidebar?: boolean;
  hideTopBar?: boolean;
  /** Disable main content scrolling - useful for immersive experiences like LMS that manage their own scrolling */
  disableMainScroll?: boolean;
}

// ============================================
// Default Layout Configuration
// ============================================

export const defaultLayoutHeader: LayoutHeader = {
  enabled: true,
  logo: "",
  logoAlt: "",
  navItems: [],
  showDarkModeToggle: true,
  variant: "minimal",
  sticky: true,
};

export const defaultLayoutFooter: LayoutFooter = {
  enabled: true,
  logo: "",
  logoAlt: "",
  description: "",
  columns: [
    {
      id: "more",
      title: "More",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Contact Us", href: "/contact" },
        { label: "FAQ", href: "/faq" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
  ],
  socialLinks: [],
  copyright: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
  variant: "columns",
  useHeaderLogo: true,
};

export const defaultLayoutSidebar: LayoutSidebar = {
  enabled: false,
  position: "left",
  width: "280px",
  navItems: [],
  widgets: [],
  collapsible: true,
  defaultCollapsed: false,
  showLogo: true,
  logoSize: "md",
};

export const defaultLayoutTopBar: LayoutTopBar = {
  enabled: false,
  content: {
    type: "text",
    text: "",
  },
  dismissible: true,
};

export const defaultTenantLayout: Omit<
  TenantLayout,
  "id" | "tenantId" | "createdAt" | "updatedAt"
> = {
  header: defaultLayoutHeader,
  footer: defaultLayoutFooter,
  sidebar: defaultLayoutSidebar,
  topBar: defaultLayoutTopBar,
};
